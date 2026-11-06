import { useEffect, useState } from "react";
import { Alert, Platform, Text } from "react-native";
import { theme } from "../theme";
import { Button, Sheet } from "./ui";

interface Request {
  title: string;
  text: string;
  yes: string;
  onYes: () => void;
}

let show: ((r: Request) => void) | null = null;

/**
 * Sicherheitsabfrage vor dem Loeschen. Nativ als System-Dialog; im Web als
 * eigenes Fenster, weil Browser-confirm() in eingebetteten Seiten blockiert sein kann.
 */
export function confirmAction(title: string, text: string, yes: string, onYes: () => void) {
  if (Platform.OS !== "web") {
    Alert.alert(title, text, [
      { text: "Abbrechen", style: "cancel" },
      { text: yes, style: "destructive", onPress: onYes },
    ]);
    return;
  }
  if (show) show({ title, text, yes, onYes });
}

/** Einmal in der App-Wurzel einbinden. */
export function ConfirmHost() {
  const [req, setReq] = useState<Request | null>(null);
  useEffect(() => {
    show = setReq;
    return () => {
      show = null;
    };
  }, []);
  if (!req) return null;
  return (
    <Sheet eyebrow="Bitte bestätigen" title={req.title} onClose={() => setReq(null)}>
      <Text style={{ color: theme.colors.textMuted, fontSize: 15, lineHeight: 21 }}>{req.text}</Text>
      <Button
        variant="danger"
        label={req.yes}
        onPress={() => {
          setReq(null);
          req.onYes();
        }}
      />
      <Button variant="ghost" label="Abbrechen" onPress={() => setReq(null)} />
    </Sheet>
  );
}
