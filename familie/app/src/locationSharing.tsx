import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "./session";
import { load, save } from "./storage";
import { IS_DEMO } from "./config";
import { distanceKm } from "./format";
import { ARRIVAL_RADIUS_KM } from "./travel";
import type { ChatMessage, Place } from "./types";

const SHARE_KEY = "familie.shareLocation";

interface Value {
  /** null = noch nicht geladen */
  sharing: boolean | null;
  setSharing: (on: boolean) => Promise<void>;
  error: string | null;
}

const Ctx = createContext<Value>({ sharing: null, setSharing: async () => {}, error: null });
export const useLocationSharing = () => useContext(Ctx);

type Coords = { lat: number; lng: number; accuracy?: number };

/** Demo: ein Spaziergang durch Berlin-Mitte statt echtem GPS. */
let demoStep = 0;
const demoPosition = (): Coords => ({ lat: 52.5145 + Math.sin(demoStep / 6) * 0.004, lng: 13.3501 + demoStep * 0.0008, accuracy: 15 });

/** Aktuelle Position einmalig abfragen (fuer "Bin gleich da" und "Zuhause speichern"). */
export async function getPositionOnce(): Promise<Coords> {
  if (IS_DEMO) return demoPosition();
  if (Platform.OS === "web") {
    return new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
        () => reject(new Error("Standort nicht verfügbar. Bitte im Browser erlauben.")),
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
      ),
    );
  }
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== "granted") throw new Error("Ohne Standort-Berechtigung geht das leider nicht.");
  const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy ?? undefined };
}

/** Offene "Bin gleich da"-Meldungen dieser Person, die bei Ankunft automatisch abgeschlossen werden. */
function openEtas(messages: ChatMessage[] | undefined, memberId: string) {
  return (messages ?? []).filter((m) => m.memberId === memberId && m.eta && !m.eta.arrivedAt && !m.eta.replaced);
}

/**
 * Standort beobachten; liefert eine Stopp-Funktion. Im Web direkt ueber die
 * Browser-API, weil expo-location dort beim Abmelden einen Fehler wirft.
 */
async function watch(onPos: (c: Coords) => void): Promise<() => void> {
  if (IS_DEMO) {
    const step = () => {
      demoStep++;
      onPos(demoPosition());
    };
    step();
    const t = setInterval(step, 25_000);
    return () => clearInterval(t);
  }
  if (Platform.OS === "web") {
    const id = navigator.geolocation.watchPosition(
      (p) => onPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => undefined,
      { enableHighAccuracy: false, maximumAge: 60_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }
  const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  onPos({ lat: first.coords.latitude, lng: first.coords.longitude, accuracy: first.coords.accuracy ?? undefined });
  const sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 60_000, distanceInterval: 50 }, (p) =>
    onPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy ?? undefined }),
  );
  return () => sub.remove();
}

/**
 * Standort teilen ist opt-in und laeuft, solange die App offen ist – egal
 * welcher Tab gerade sichtbar ist. Ausschalten loescht den letzten Standort
 * sofort auf dem Server.
 */
export function LocationSharingProvider({ children }: { children: ReactNode }) {
  const { api, session } = useSession();
  const home: Place | undefined = session.family.home;
  const memberId = session.member.id;
  const qc = useQueryClient();
  const [sharing, setSharingState] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load<boolean>(SHARE_KEY).then((v) => setSharingState(Boolean(v)));
  }, []);

  useEffect(() => {
    if (!sharing) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    let last = 0;
    (async () => {
      const perm = IS_DEMO ? { status: "granted" } : await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setError("Ohne Standort-Berechtigung kann nichts geteilt werden. Du kannst sie in den Einstellungen erlauben.");
        setSharingState(false);
        void save(SHARE_KEY, false);
        return;
      }
      setError(null);
      const s = await watch((c) => {
        // Nicht oefter als alle 20 s senden (Browser melden teils sehr haeufig).
        // Ankunft erkennen: offene "Bin gleich da"-Meldung + nah genug am Zuhause.
        if (home && distanceKm(c, home) <= ARRIVAL_RADIUS_KM) {
          const finish = (msgs: ChatMessage[] | undefined) => {
            for (const m of openEtas(msgs, memberId)) {
              api.markArrived(m.id).then(
                () => qc.invalidateQueries({ queryKey: ["messages"] }),
                () => undefined,
              );
            }
          };
          const cached = qc.getQueryData<ChatMessage[]>(["messages"]);
          if (cached) finish(cached);
          else api.messages().then(finish, () => undefined);
        }
        if (Date.now() - last < 20_000) return;
        last = Date.now();
        api
          .shareLocation(c.lat, c.lng, c.accuracy)
          .then(() => qc.invalidateQueries({ queryKey: ["locations"] }))
          .catch((e) => setError(e instanceof Error ? e.message : String(e)));
      });
      if (cancelled) s();
      else stop = s;
    })().catch((e) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [sharing, api, qc, home, memberId]);

  const setSharing = useCallback(
    async (on: boolean) => {
      setSharingState(on);
      await save(SHARE_KEY, on);
      if (!on) {
        try {
          await api.stopSharing();
          void qc.invalidateQueries({ queryKey: ["locations"] });
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    },
    [api, qc],
  );

  return <Ctx.Provider value={{ sharing, setSharing, error }}>{children}</Ctx.Provider>;
}
