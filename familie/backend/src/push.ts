/**
 * Push-Benachrichtigungen ueber den kostenlosen Expo-Push-Dienst.
 * Die App meldet ihr "ExponentPushToken[...]" beim Server an; der Server
 * schickt Hinweise (neue Nachricht, neuer Termin, ...) an die anderen Mitglieder.
 */

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** Liefert die Tokens zurueck, die Expo als ungueltig gemeldet hat. */
export type PushSender = (messages: PushMessage[]) => Promise<string[]>;

export const isExpoPushToken = (t: unknown): t is string =>
  typeof t === "string" && /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(t);

export function createExpoPushSender(): PushSender {
  return async (messages) => {
    const invalid: string[] = [];
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100).map((m) => ({ ...m, sound: "default" }));
      try {
        const res = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(chunk),
        });
        const json = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
        json.data?.forEach((ticket, idx) => {
          if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") invalid.push(chunk[idx]!.to);
        });
      } catch (e) {
        console.warn("Push fehlgeschlagen:", e instanceof Error ? e.message : e);
      }
    }
    return invalid;
  };
}
