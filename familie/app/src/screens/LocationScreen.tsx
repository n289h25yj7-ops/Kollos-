import { useEffect, useState } from "react";
import { Linking, Platform, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import * as Location from "expo-location";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "../session";
import { load, save } from "../storage";
import { theme } from "../theme";
import { Avatar, Button, Card, Empty, ErrorText, ScreenHeader } from "../components/ui";
import { ago, distanceKm, formatDistance } from "../format";

const c = theme.colors;
const SHARE_KEY = "familie.shareLocation";

function openInMaps(lat: number, lng: number, label: string) {
  const q = encodeURIComponent(label);
  const url =
    Platform.OS === "ios"
      ? `http://maps.apple.com/?ll=${lat},${lng}&q=${q}`
      : Platform.OS === "android"
        ? `geo:${lat},${lng}?q=${lat},${lng}(${q})`
        : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  void Linking.openURL(url);
}

/**
 * Standort teilen ist bewusst opt-in und nur aktiv, solange die App offen ist.
 * Ausschalten loescht den zuletzt geteilten Standort sofort auf dem Server.
 */
export function LocationScreen() {
  const { api, session, members, memberById } = useSession();
  const qc = useQueryClient();
  const [sharing, setSharing] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locations = useQuery({ queryKey: ["locations"], queryFn: api.locations, refetchInterval: 60_000 });

  useEffect(() => {
    load<boolean>(SHARE_KEY).then((v) => setSharing(Boolean(v)));
  }, []);

  useEffect(() => {
    if (!sharing) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setError("Ohne Standort-Berechtigung kann nichts geteilt werden. Du kannst sie in den Einstellungen erlauben.");
        setSharing(false);
        void save(SHARE_KEY, false);
        return;
      }
      setError(null);
      const push = async (pos: Location.LocationObject) => {
        try {
          await api.shareLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy ?? undefined);
          void qc.invalidateQueries({ queryKey: ["locations"] });
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        }
      };
      const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (cancelled) return;
      await push(first);
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 60_000, distanceInterval: 50 },
        (pos) => void push(pos),
      );
      if (cancelled) sub.remove();
    })().catch((e) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [sharing, api, qc]);

  const setShare = async (on: boolean) => {
    setSharing(on);
    await save(SHARE_KEY, on);
    if (!on) {
      try {
        await api.stopSharing();
        void qc.invalidateQueries({ queryKey: ["locations"] });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  };

  const locs = locations.data ?? [];
  const mine = locs.find((l) => l.memberId === session.member.id);
  const others = members.filter((m) => m.id !== session.member.id);

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader eyebrow="Standort" title="Wo sind alle?" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: theme.spacing(4), paddingBottom: theme.spacing(24), gap: theme.spacing(3) }}>
        <Card style={s.share}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.shareTitle}>Meinen Standort teilen</Text>
            <Text style={s.shareText}>
              {sharing
                ? mine
                  ? `Wird geteilt · aktualisiert ${ago(mine.updatedAt)}`
                  : "Standort wird ermittelt …"
                : "Aus. Deine Familie sieht deinen Standort nicht."}
            </Text>
          </View>
          <Switch
            value={Boolean(sharing)}
            onValueChange={setShare}
            disabled={sharing === null}
            trackColor={{ true: c.gold, false: c.surface3 }}
            thumbColor={c.text}
            {...({ activeThumbColor: c.text } as object)}
          />
        </Card>
        <Text style={s.note}>Geteilt wird nur, solange die App geöffnet ist. Beim Ausschalten wird dein letzter Standort gelöscht.</Text>
        {error ? <Text style={{ color: c.danger }}>{error}</Text> : null}
        <ErrorText error={locations.error} />

        {others.length === 0 ? (
          <Empty icon="⌖" title="Noch allein hier" text="Lade deine Familie über den Tab „Familie“ ein." />
        ) : (
          others.map((m) => {
            const loc = locs.find((l) => l.memberId === m.id);
            return (
              <Card key={m.id} style={s.member}>
                <Avatar member={memberById(m.id)} size={42} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={s.name}>{m.name}</Text>
                  <Text style={s.meta}>
                    {loc
                      ? [ago(loc.updatedAt), mine ? `${formatDistance(distanceKm(mine, loc))} entfernt` : null].filter(Boolean).join(" · ")
                      : "teilt gerade keinen Standort"}
                  </Text>
                </View>
                {loc ? <Button small variant="ghost" label="Karte" onPress={() => openInMaps(loc.lat, loc.lng, m.name)} /> : null}
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  share: { flexDirection: "row", alignItems: "center", gap: theme.spacing(3), borderColor: c.goldDim },
  shareTitle: { color: c.text, fontSize: 16, fontWeight: "600" },
  shareText: { color: c.textMuted, fontSize: 13 },
  note: { color: c.textFaint, fontSize: 12, lineHeight: 17, paddingHorizontal: 4 },
  member: { flexDirection: "row", alignItems: "center", gap: theme.spacing(3.5) },
  name: { color: c.text, fontSize: 16, fontWeight: "600" },
  meta: { color: c.textMuted, fontSize: 13 },
});
