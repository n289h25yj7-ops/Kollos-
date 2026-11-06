import { useState } from "react";
import { Alert, Platform, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "../session";
import { theme } from "../theme";
import { Avatar, Button, Card, ErrorText, Input, ScreenHeader } from "../components/ui";

const c = theme.colors;

function ask(title: string, text: string, yes: string, onYes: () => void) {
  if (Platform.OS === "web") {
    if (globalThis.confirm?.(`${title}\n\n${text}`)) onYes();
    return;
  }
  Alert.alert(title, text, [
    { text: "Abbrechen", style: "cancel" },
    { text: yes, style: "destructive", onPress: onYes },
  ]);
}

export function FamilyScreen() {
  const { api, session, members, signOut, serverUrl, live } = useSession();
  const qc = useQueryClient();
  const [name, setName] = useState(session.member.name);
  const code = session.family.inviteCode;

  const rename = useMutation({ mutationFn: () => api.updateMe({ name: name.trim() }), onSuccess: (s) => qc.setQueryData(["me"], s) });
  const newCode = useMutation({ mutationFn: api.newInviteCode, onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }) });
  const leave = useMutation({ mutationFn: api.leave, onSuccess: signOut });

  const invite = () =>
    Share.share({
      message: `Komm in unsere Familien-App „${session.family.name}“! Einladungscode: ${code}\nServer: ${serverUrl}`,
    }).catch(() => undefined);

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader eyebrow="Familie" title={session.family.name} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: theme.spacing(4), paddingBottom: theme.spacing(24), gap: theme.spacing(4) }}>
        <Card style={{ alignItems: "center", gap: theme.spacing(2), borderColor: c.goldDim }}>
          <Text style={s.label}>Einladungscode</Text>
          <Text style={s.code} selectable>
            {code}
          </Text>
          <Text style={s.hint}>Wer diesen Code hat, kann eurer Familie beitreten.</Text>
          <View style={{ flexDirection: "row", gap: theme.spacing(2), marginTop: theme.spacing(2) }}>
            <Button small label="Einladen" onPress={invite} />
            <Button
              small
              variant="ghost"
              label="Neuer Code"
              loading={newCode.isPending}
              onPress={() => ask("Neuen Code erzeugen?", "Der alte Code funktioniert danach nicht mehr.", "Erneuern", () => newCode.mutate())}
            />
          </View>
        </Card>

        <View style={{ gap: theme.spacing(2) }}>
          <Text style={s.label}>Mitglieder · {members.length}</Text>
          {members.map((m) => (
            <Card key={m.id} style={s.member}>
              <Avatar member={m} />
              <Text style={s.name}>{m.name}</Text>
              {m.id === session.member.id ? <Text style={s.you}>Du</Text> : null}
            </Card>
          ))}
        </View>

        <View style={{ gap: theme.spacing(2) }}>
          <Input label="Mein Name" value={name} onChangeText={setName} maxLength={40} />
          <Button small variant="ghost" label="Namen speichern" onPress={() => rename.mutate()} disabled={!name.trim() || name.trim() === session.member.name} loading={rename.isPending} />
          <ErrorText error={rename.error ?? newCode.error ?? leave.error} />
        </View>

        <Text style={s.server}>
          {live ? "● Verbunden" : "○ Nicht verbunden"} · {serverUrl}
        </Text>

        <View style={{ gap: theme.spacing(2) }}>
          <Button variant="ghost" label="Auf diesem Gerät abmelden" onPress={() => ask("Abmelden?", "Du kannst später mit dem Einladungscode wieder beitreten – allerdings als neues Mitglied.", "Abmelden", () => void signOut())} />
          <Button variant="danger" label="Familie verlassen" loading={leave.isPending} onPress={() => ask("Familie verlassen?", "Du wirst aus der Familie entfernt und dein Standort gelöscht.", "Verlassen", () => leave.mutate())} />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  label: { color: c.textMuted, fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase" },
  code: { color: c.goldBright, fontSize: 36, fontWeight: "800", letterSpacing: 8 },
  hint: { color: c.textFaint, fontSize: 13, textAlign: "center" },
  member: { flexDirection: "row", alignItems: "center", gap: theme.spacing(3), paddingVertical: theme.spacing(3) },
  name: { color: c.text, fontSize: 16, flex: 1 },
  you: { color: c.gold, fontSize: 12, fontWeight: "700" },
  server: { color: c.textFaint, fontSize: 12, textAlign: "center" },
});
