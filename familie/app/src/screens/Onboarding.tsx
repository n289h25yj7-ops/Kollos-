import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { normalizeUrl, publicApi } from "../api";
import { DEFAULT_SERVER_URL } from "../config";
import { brandFont, theme } from "../theme";
import type { Session } from "../types";
import { Button, Chip, ErrorText, Input } from "../components/ui";

type Mode = "create" | "join";

/** Erster Start: neue Familie gruenden oder per Einladungscode beitreten. */
export function Onboarding({ onSignedIn }: { onSignedIn: (serverUrl: string, s: Session) => Promise<void> }) {
  const [mode, setMode] = useState<Mode>("create");
  const [name, setName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [code, setCode] = useState("");
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [showServer, setShowServer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const ready = name.trim() && (mode === "create" ? familyName.trim() : code.trim().length >= 4);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const url = normalizeUrl(serverUrl);
      const s =
        mode === "create"
          ? await publicApi.createFamily(url, familyName, name)
          : await publicApi.joinFamily(url, code, name);
      await onSignedIn(url, s);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <Text style={s.mark}>✦</Text>
        <Text style={s.brand}>Familie</Text>
        <Text style={s.tagline}>Kalender, Einkauf, Chat und Standort – an einem Ort, nur für euch.</Text>

        <View style={s.modes}>
          <Chip label="Familie gründen" active={mode === "create"} onPress={() => setMode("create")} />
          <Chip label="Beitreten" active={mode === "join"} onPress={() => setMode("join")} />
        </View>

        <View style={{ gap: theme.spacing(4) }}>
          <Input label="Dein Name" value={name} onChangeText={setName} placeholder="z. B. Mama, Leon, Oma Gerda" maxLength={40} />
          {mode === "create" ? (
            <Input label="Name der Familie" value={familyName} onChangeText={setFamilyName} placeholder="z. B. Familie Schmidt" maxLength={60} />
          ) : (
            <Input
              label="Einladungscode"
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              placeholder="z. B. K7QF3M"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              style={{ letterSpacing: 4, fontWeight: "700" }}
            />
          )}

          {showServer ? (
            <Input
              label="Server-Adresse"
              value={serverUrl}
              onChangeText={setServerUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          ) : (
            <Text style={s.link} onPress={() => setShowServer(true)}>
              Server: {serverUrl} · ändern
            </Text>
          )}

          <ErrorText error={error} />
          <Button
            label={mode === "create" ? "Familie gründen" : "Familie beitreten"}
            onPress={submit}
            disabled={!ready}
            loading={busy}
          />
          {mode === "create" ? (
            <Text style={s.hint}>Danach bekommst du einen Einladungscode, den du an deine Familie schickst.</Text>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: "center", padding: theme.spacing(6), gap: theme.spacing(2), maxWidth: 520, width: "100%", alignSelf: "center" },
  mark: { color: theme.colors.gold, fontSize: 28, textAlign: "center" },
  brand: { color: theme.colors.text, fontSize: 44, fontFamily: brandFont, textAlign: "center" },
  tagline: { color: theme.colors.textMuted, fontSize: 15, textAlign: "center", lineHeight: 22, marginBottom: theme.spacing(6) },
  modes: { flexDirection: "row", gap: theme.spacing(2), justifyContent: "center", marginBottom: theme.spacing(5) },
  link: { color: theme.colors.textFaint, fontSize: 12, textAlign: "center" },
  hint: { color: theme.colors.textFaint, fontSize: 13, textAlign: "center", lineHeight: 19 },
});
