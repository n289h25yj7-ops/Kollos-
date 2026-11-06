import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "./session";
import { load, save } from "./storage";

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

/**
 * Standort beobachten; liefert eine Stopp-Funktion. Im Web direkt ueber die
 * Browser-API, weil expo-location dort beim Abmelden einen Fehler wirft.
 */
async function watch(onPos: (c: Coords) => void): Promise<() => void> {
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
  const sub = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, timeInterval: 60_000, distanceInterval: 50 },
    (p) => onPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy ?? undefined }),
  );
  return () => sub.remove();
}

/**
 * Standort teilen ist opt-in und laeuft, solange die App offen ist – egal
 * welcher Tab gerade sichtbar ist. Ausschalten loescht den letzten Standort
 * sofort auf dem Server.
 */
export function LocationSharingProvider({ children }: { children: ReactNode }) {
  const { api } = useSession();
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
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setError("Ohne Standort-Berechtigung kann nichts geteilt werden. Du kannst sie in den Einstellungen erlauben.");
        setSharingState(false);
        void save(SHARE_KEY, false);
        return;
      }
      setError(null);
      const s = await watch((c) => {
        // Nicht oefter als alle 20 s senden (Browser melden teils sehr haeufig).
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
  }, [sharing, api, qc]);

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
