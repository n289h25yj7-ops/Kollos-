import { dayKey } from "./format";
import type { Birthday, CalendarEvent } from "./types";

/**
 * Wiederkehrende Termine in einzelne Vorkommen aufloesen – in der lokalen
 * Zeitzone, damit "jeden Dienstag 17 Uhr" auch nach der Zeitumstellung 17 Uhr bleibt.
 * Vorkommen behalten die id der Serie (Bearbeiten aendert die ganze Serie).
 */
export function expandEvents(events: CalendarEvent[], from: Date, to: Date): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const e of events) {
    const start = new Date(e.start);
    const duration = e.end ? new Date(e.end).getTime() - start.getTime() : 0;
    if (!e.repeat || e.repeat === "none") {
      if (start <= to && new Date(e.end ?? e.start) >= from) out.push(e);
      continue;
    }
    const [y, m, d, h, min] = [start.getFullYear(), start.getMonth(), start.getDate(), start.getHours(), start.getMinutes()];
    for (let k = 0; k < 2000; k++) {
      const occ =
        e.repeat === "weekly"
          ? new Date(y, m, d + 7 * k, h, min)
          : e.repeat === "biweekly"
            ? new Date(y, m, d + 14 * k, h, min)
            : e.repeat === "monthly"
              ? new Date(y, m + k, d, h, min)
              : new Date(y + k, m, d, h, min);
      if (occ > to) break;
      if (e.repeatUntil && dayKey(occ) > e.repeatUntil) break;
      // Monatlich am 31. -> Monate ohne 31. auslassen
      if ((e.repeat === "monthly" || e.repeat === "yearly") && occ.getDate() !== d) continue;
      const occEnd = new Date(occ.getTime() + duration);
      if (occEnd < from) continue;
      out.push({ ...e, start: occ.toISOString(), end: e.end ? occEnd.toISOString() : undefined, seriesStart: e.start, seriesEnd: e.end });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

export interface BirthdayOccurrence {
  birthday: Birthday;
  date: Date;
  /** Alter an diesem Tag, wenn das Geburtsjahr bekannt ist. */
  age?: number;
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Alle Geburtstage im Zeitraum (29.2. wird in Nicht-Schaltjahren am 28.2. gefeiert). */
export function birthdaysInRange(birthdays: Birthday[], from: Date, to: Date): BirthdayOccurrence[] {
  const out: BirthdayOccurrence[] = [];
  for (const b of birthdays) {
    const [mm, dd] = b.date.split("-").map(Number) as [number, number];
    for (let y = from.getFullYear(); y <= to.getFullYear(); y++) {
      const day = mm === 2 && dd === 29 && !isLeap(y) ? 28 : dd;
      const date = new Date(y, mm - 1, day);
      if (date >= new Date(from.getFullYear(), from.getMonth(), from.getDate()) && date <= to) {
        out.push({ birthday: b, date, age: b.year ? y - b.year : undefined });
      }
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export const REPEAT_LABELS: Record<string, string> = {
  none: "Nie",
  weekly: "Wöchentlich",
  biweekly: "Alle 2 Wochen",
  monthly: "Monatlich",
  yearly: "Jährlich",
};

/** Jahrestage ("Hochzeitstag", "Jahrestag", ...) erkennt man am Namen. */
const isAnniversary = (name: string) => /tag\b|jubil/i.test(name.replace(/[^\p{L}\s]/gu, "").trim());

export function birthdayLabel(o: BirthdayOccurrence): string {
  if (isAnniversary(o.birthday.name)) return o.age ? `${o.birthday.name} – ${o.age} Jahre` : o.birthday.name;
  return o.age ? `${o.birthday.name} wird ${o.age}` : `${o.birthday.name} hat Geburtstag`;
}
