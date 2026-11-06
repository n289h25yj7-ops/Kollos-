import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useQuery } from "@tanstack/react-query";
import { addDays, startOfDay, time } from "./format";
import { birthdayLabel, birthdaysInRange, expandEvents } from "./recurrence";
import type { Tab } from "./nav";
import { useSession } from "./session";
import { load, save } from "./storage";

const REMINDER_KEY = "familie.reminders";
const REMINDER_MINUTES = 30;
const native = Platform.OS !== "web";

export type PushStatus = "aktiv" | "web" | "simulator" | "abgelehnt" | "kein-projekt" | "fehler" | "…";

interface NotificationsValue {
  push: PushStatus;
  reminders: boolean;
  setReminders: (on: boolean) => void;
}

const Ctx = createContext<NotificationsValue>({ push: "…", reminders: false, setReminders: () => {} });
export const useNotifications = () => useContext(Ctx);

if (native) {
  // Auch bei geoeffneter App anzeigen.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Familie",
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: "#c9a86a",
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * Push-Benachrichtigungen + lokale Termin-Erinnerungen.
 *
 * Push braucht eine Expo-Projekt-ID (einmalig `npx eas init` im app-Ordner,
 * siehe README). Ohne ID funktionieren die lokalen Termin-Erinnerungen trotzdem.
 */
export function NotificationsProvider({ onOpenTab, children }: { onOpenTab: (t: Tab) => void; children: ReactNode }) {
  const { api, session } = useSession();
  const [push, setPush] = useState<PushStatus>(native ? "…" : "web");
  const [reminders, setRemindersState] = useState(false);

  // Gespeicherte Einstellung laden (Standard: an).
  useEffect(() => {
    if (native) load<boolean>(REMINDER_KEY).then((v) => setRemindersState(v ?? true));
  }, []);
  const setReminders = (on: boolean) => {
    setRemindersState(on);
    void save(REMINDER_KEY, on);
  };

  // Geraet fuer Push anmelden.
  useEffect(() => {
    if (!native) return;
    let token: string | null = null;
    (async () => {
      if (!Device.isDevice) return setPush("simulator");
      if (!(await ensurePermission())) return setPush("abgelehnt");
      const projectId =
        (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) return setPush("kein-projekt");
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      await api.registerPush(token);
      setPush("aktiv");
    })().catch((e) => {
      console.warn("Push-Anmeldung fehlgeschlagen", e);
      setPush("fehler");
    });
  }, [api]);

  // Tipp auf eine Benachrichtigung -> passenden Tab oeffnen.
  useEffect(() => {
    if (!native) return;
    const open = (r: Notifications.NotificationResponse | null) => {
      const tab = r?.notification.request.content.data?.tab;
      if (typeof tab === "string") onOpenTab(tab as Tab);
    };
    void Notifications.getLastNotificationResponseAsync().then(open);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [onOpenTab]);

  // Termine der naechsten 14 Tage als lokale Erinnerungen einplanen.
  const from = startOfDay(new Date()).toISOString();
  const to = addDays(new Date(), 14).toISOString();
  const events = useQuery({ queryKey: ["events", "reminders", from], queryFn: () => api.events(from, to), enabled: native });
  const birthdays = useQuery({ queryKey: ["birthdays"], queryFn: api.birthdays, enabled: native });

  useEffect(() => {
    if (!native || !events.data) return;
    let cancelled = false;
    (async () => {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      await Promise.all(
        scheduled
          .filter((n) => n.content.data?.kind === "event-reminder")
          .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
      );
      if (cancelled || !reminders || !(await ensurePermission())) return;
      const start0 = startOfDay(new Date());
      const occurrences = expandEvents(events.data, start0, addDays(start0, 14));
      const mine = occurrences.filter((e) => e.memberIds.length === 0 || e.memberIds.includes(session.member.id));
      // Geburtstage: eine Woche vorher (9 Uhr) und am Tag selbst (8 Uhr).
      for (const o of birthdaysInRange(birthdays.data ?? [], start0, addDays(start0, 21))) {
        const y = o.date.getFullYear(),
          m = o.date.getMonth(),
          d = o.date.getDate();
        const plans: [Date, string, string][] = [
          [new Date(y, m, d - 7, 9, 0), `🎁 In einer Woche: ${birthdayLabel(o)}`, "Zeit, an ein Geschenk zu denken."],
          [new Date(y, m, d, 8, 0), `🎂 Heute: ${birthdayLabel(o)}!`, "Gratulieren nicht vergessen 💛"],
        ];
        for (const [when, title, body] of plans) {
          if (when.getTime() <= Date.now()) continue;
          await Notifications.scheduleNotificationAsync({
            content: { title, body, data: { kind: "event-reminder", tab: "today" } },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
          });
        }
      }
      for (const e of mine.slice(0, 40)) {
        const start = new Date(e.start);
        const at = e.allDay
          ? new Date(start.getFullYear(), start.getMonth(), start.getDate(), 8, 0)
          : new Date(start.getTime() - REMINDER_MINUTES * 60_000);
        if (at.getTime() <= Date.now()) continue;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `📅 ${e.title}`,
            body: e.allDay ? "Heute ganztägig" : `Um ${time(e.start)} Uhr${e.notes ? ` · ${e.notes.slice(0, 80)}` : ""}`,
            data: { kind: "event-reminder", tab: "calendar" },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
        });
      }
    })().catch((e) => console.warn("Erinnerungen konnten nicht geplant werden", e));
    return () => {
      cancelled = true;
    };
  }, [events.data, birthdays.data, reminders, session.member.id]);

  return <Ctx.Provider value={{ push, reminders, setReminders }}>{children}</Ctx.Provider>;
}

export const PUSH_LABEL: Record<PushStatus, string> = {
  aktiv: "Push-Benachrichtigungen sind aktiv.",
  web: "Im Browser gibt es keine Push-Benachrichtigungen – nutze dafür die App.",
  simulator: "Push funktioniert nur auf einem echten Gerät.",
  abgelehnt: "Benachrichtigungen sind nicht erlaubt. Du kannst sie in den Einstellungen des Handys einschalten.",
  "kein-projekt": "Push ist noch nicht eingerichtet (Expo-Projekt-ID fehlt, siehe README). Termin-Erinnerungen funktionieren trotzdem.",
  fehler: "Push-Anmeldung fehlgeschlagen. Stimmt die Server-Adresse?",
  "…": "Push wird eingerichtet …",
};
