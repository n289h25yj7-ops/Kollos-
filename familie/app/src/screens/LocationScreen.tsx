import { useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "../session";
import { useLocationSharing } from "../locationSharing";
import { useNav } from "../nav";
import { theme } from "../theme";
import { Avatar, Button, Card, Empty, ErrorText, ScreenHeader } from "../components/ui";
import { ago, distanceKm, formatDistance } from "../format";
import { FamilyMap } from "../components/FamilyMap";
import type { MapPin } from "../components/mapTypes";

const c = theme.colors;

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

/** Karte + Liste: wer ist wo? Das Teilen selbst steuert LocationSharingProvider. */
export function LocationScreen() {
  const { api, session, members, memberById } = useSession();
  const { sharing, setSharing: setShare, error } = useLocationSharing();
  const { setTab } = useNav();
  const [focus, setFocus] = useState<string | null>(null);
  const { height: screenH } = useWindowDimensions();
  const locations = useQuery({ queryKey: ["locations"], queryFn: api.locations, refetchInterval: 60_000 });

  const locs = locations.data ?? [];
  const mine = locs.find((l) => l.memberId === session.member.id);
  const others = members.filter((m) => m.id !== session.member.id);
  const pins: MapPin[] = locs.flatMap((l) => {
    const m = memberById(l.memberId);
    return m
      ? [
          {
            id: m.id,
            name: m.id === session.member.id ? `${m.name} (du)` : m.name,
            color: m.color,
            lat: l.lat,
            lng: l.lng,
            subtitle: ago(l.updatedAt),
          },
        ]
      : [];
  });

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader eyebrow="Karte" title="Wo sind alle?" hideFamily right={<Button small variant="ghost" label="‹ Heute" onPress={() => setTab("today")} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: theme.spacing(4), paddingBottom: theme.spacing(24), gap: theme.spacing(3) }}>
        {pins.length ? (
          <FamilyMap pins={pins} height={Math.round(Math.min(380, screenH * 0.4))} focusId={focus} />
        ) : (
          <Card style={s.mapEmpty}>
            <Text style={s.mapEmptyIcon}>⌖</Text>
            <Text style={s.shareText}>Sobald jemand den Standort teilt, erscheint hier die Karte.</Text>
          </Card>
        )}
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
              <Pressable key={m.id} onPress={() => loc && setFocus((f) => (f === m.id ? null : m.id))} disabled={!loc}>
                <Card style={[s.member, focus === m.id && { borderColor: c.gold }]}>
                  <Avatar member={memberById(m.id)} size={42} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={s.name}>{m.name}</Text>
                    <Text style={s.meta}>
                      {loc
                        ? [ago(loc.updatedAt), mine ? `${formatDistance(distanceKm(mine, loc))} entfernt` : null]
                            .filter(Boolean)
                            .join(" · ")
                        : "teilt gerade keinen Standort"}
                    </Text>
                  </View>
                  {loc ? <Button small variant="ghost" label="Route" onPress={() => openInMaps(loc.lat, loc.lng, m.name)} /> : null}
                </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  mapEmpty: { alignItems: "center", gap: 6, paddingVertical: theme.spacing(8) },
  mapEmptyIcon: { color: c.gold, fontSize: 28 },
  share: { flexDirection: "row", alignItems: "center", gap: theme.spacing(3), borderColor: c.goldDim },
  shareTitle: { color: c.text, fontSize: 16, fontWeight: "600" },
  shareText: { color: c.textMuted, fontSize: 13 },
  note: { color: c.textFaint, fontSize: 12, lineHeight: 17, paddingHorizontal: 4 },
  member: { flexDirection: "row", alignItems: "center", gap: theme.spacing(3.5) },
  name: { color: c.text, fontSize: 16, fontWeight: "600" },
  meta: { color: c.textMuted, fontSize: 13 },
});
