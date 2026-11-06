import { useState } from "react";
import { Platform, ScrollView, Share, StyleSheet, Switch, Text, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "../session";
import { theme } from "../theme";
import { Avatar, Button, Card, ErrorText, Input, Label, ScreenHeader } from "../components/ui";
import { PUSH_LABEL, useNotifications } from "../notifications";
import { confirmAction } from "../components/confirm";
import { IS_DEMO } from "../config";
import { resetDemo } from "../demo/server";

const c = theme.colors;


export function FamilyScreen({ onClose }: { onClose: () => void }) {
  const { api, session, members, signOut, serverUrl, live } = useSession();
  const qc = useQueryClient();
  const [name, setName] = useState(session.member.name);
  const code = session.family.inviteCode;
  const notif = useNotifications();

  const rename = useMutation({ mutationFn: () => api.updateMe({ name: name.trim() }), onSuccess: (s) => qc.setQueryData(["me"], s) });
  const newCode = useMutation({ mutationFn: api.newInviteCode, onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }) });
  const leave = useMutation({ mutationFn: api.leave, onSuccess: signOut });

  const invite = () =>
    Share.share({
      message: `Komm in unsere Familien-App „${session.family.name}“! Einladungscode: ${code}\nServer: ${serverUrl}`,
    }).catch(() => undefined);

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader eyebrow="Familie & Einstellungen" title={session.family.name} hideFamily right={<Button small variant="ghost" label="Fertig" onPress={onClose} />} />
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
              onPress={() => confirmAction("Neuen Code erzeugen?", "Der alte Code funktioniert danach nicht mehr.", "Erneuern", () => newCode.mutate())}
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

        <View style={{ gap: theme.spacing(2) }}>
          <Label>Benachrichtigungen</Label>
          <Card style={{ gap: theme.spacing(3) }}>
            <Text style={s.hint2}>{PUSH_LABEL[notif.push]}</Text>
            {Platform.OS !== "web" ? (
              <View style={s.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>Termin- & Geburtstags-Erinnerungen</Text>
                  <Text style={s.hint2}>Termine 30 Min. vorher, Geburtstage eine Woche vorher</Text>
                </View>
                <Switch value={notif.reminders} onValueChange={notif.setReminders} trackColor={{ true: c.gold, false: c.surface3 }} thumbColor={c.text} />
              </View>
            ) : null}
          </Card>
        </View>

        <Text style={s.server}>
          {IS_DEMO ? "Demo-Modus · alles bleibt auf diesem Gerät" : `${live ? "● Verbunden" : "○ Nicht verbunden"} · ${serverUrl}`}
        </Text>

        <View style={{ gap: theme.spacing(2) }}>
          <Button variant="ghost" label="Auf diesem Gerät abmelden" onPress={() => confirmAction("Abmelden?", "Du kannst später mit dem Einladungscode wieder beitreten – allerdings als neues Mitglied.", "Abmelden", () => void signOut())} />
          {IS_DEMO ? (
            <Button
              variant="ghost"
              label="Demo zurücksetzen"
              onPress={() =>
                confirmAction("Demo zurücksetzen?", "Alle Änderungen gehen verloren, die Beispiel-Familie startet neu.", "Zurücksetzen", () => {
                  resetDemo();
                  void signOut();
                })
              }
            />
          ) : null}
          <Button variant="danger" label="Familie verlassen" loading={leave.isPending} onPress={() => confirmAction("Familie verlassen?", "Du wirst aus der Familie entfernt und dein Standort gelöscht.", "Verlassen", () => leave.mutate())} />
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
  hint2: { color: c.textMuted, fontSize: 13, lineHeight: 18 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing(3) },
  server: { color: c.textFaint, fontSize: 12, textAlign: "center" },
});
