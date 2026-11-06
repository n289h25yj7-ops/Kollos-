import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "../session";
import { theme } from "../theme";
import type { CalendarEvent, EventRepeat } from "../types";
import { Avatar, Button, Card, Chip, Empty, ErrorText, Input, Label, ScreenHeader, Sheet } from "../components/ui";
import { REPEAT_LABELS, birthdayLabel, birthdaysInRange, expandEvents, type BirthdayOccurrence } from "../recurrence";
import { confirmAction } from "../components/confirm";
import { MONTHS, WEEKDAYS_SHORT, addDays, dayKey, longDate, monthGrid, parseTime, sameDay, startOfDay, time } from "../format";

const c = theme.colors;
/** react-native-web kennt eine eigene Prop fuer die Schalterfarbe im aktiven Zustand. */
const webThumb = { activeThumbColor: c.text } as object;

/** Alle Tage (lokal), die ein Termin beruehrt. */
function daysOf(e: CalendarEvent): string[] {
  const start = startOfDay(new Date(e.start));
  const end = startOfDay(new Date(e.end ?? e.start));
  const out: string[] = [];
  for (let d = start; d <= end && out.length < 62; d = addDays(d, 1)) out.push(dayKey(d));
  return out;
}

export function CalendarScreen() {
  const { api, memberById } = useSession();
  const today = startOfDay(new Date());
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selected, setSelected] = useState(today);
  const [editing, setEditing] = useState<CalendarEvent | "new" | null>(null);
  const [birthdaysOpen, setBirthdaysOpen] = useState(false);

  const grid = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);
  const from = grid[0]!.toISOString();
  const to = addDays(grid[41]!, 1).toISOString();
  const events = useQuery({ queryKey: ["events", from, to], queryFn: () => api.events(from, to) });
  const birthdays = useQuery({ queryKey: ["birthdays"], queryFn: api.birthdays });

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    const expanded = expandEvents(events.data ?? [], grid[0]!, addDays(grid[41]!, 1));
    for (const e of expanded) for (const k of daysOf(e)) map.set(k, [...(map.get(k) ?? []), e]);
    return map;
  }, [events.data, grid]);

  const bdays = useMemo(() => {
    const map = new Map<string, BirthdayOccurrence[]>();
    for (const o of birthdaysInRange(birthdays.data ?? [], grid[0]!, grid[41]!)) map.set(dayKey(o.date), [...(map.get(dayKey(o.date)) ?? []), o]);
    return map;
  }, [birthdays.data, grid]);

  const dayEvents = byDay.get(dayKey(selected)) ?? [];
  const dayBirthdays = bdays.get(dayKey(selected)) ?? [];
  const shiftMonth = (n: number) =>
    setCursor(({ y, m }) => {
      const d = new Date(y, m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader eyebrow={`Kalender · ${cursor.y}`} title={MONTHS[cursor.m]!} />
      <View style={s.nav}>
        <Button small variant="ghost" label="‹" onPress={() => shiftMonth(-1)} />
        <Button
          small
          variant="ghost"
          label="Heute"
          onPress={() => {
            setCursor({ y: today.getFullYear(), m: today.getMonth() });
            setSelected(today);
          }}
        />
        <Button small variant="ghost" label="›" onPress={() => shiftMonth(1)} />
        <View style={{ flex: 1 }} />
        <Button small variant="ghost" label="🎂 Geburtstage" onPress={() => setBirthdaysOpen(true)} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: theme.spacing(4), paddingBottom: theme.spacing(24) }}>
        <View style={s.weekRow}>
          {WEEKDAYS_SHORT.map((w) => (
            <Text key={w} style={s.weekday}>
              {w}
            </Text>
          ))}
        </View>
        <View style={s.grid}>
          {grid.map((d) => {
            const k = dayKey(d);
            const inMonth = d.getMonth() === cursor.m;
            const isSel = sameDay(d, selected);
            const isToday = sameDay(d, today);
            const dots = (byDay.get(k) ?? []).slice(0, 3);
            const hasBirthday = bdays.has(k);
            return (
              <Pressable key={k} style={s.cell} onPress={() => setSelected(d)} accessibilityLabel={longDate(d)}>
                <View style={[s.dayNum, isSel && s.daySel, !isSel && isToday && s.dayToday]}>
                  <Text style={[s.dayText, !inMonth && { color: c.textFaint }, isSel && { color: c.onGold, fontWeight: "800" }]}>
                    {d.getDate()}
                  </Text>
                </View>
                <View style={s.dots}>
                  {hasBirthday ? <Text style={s.cake}>🎂</Text> : null}
                  {dots.map((e) => (
                    <View key={e.id} style={[s.dot, { backgroundColor: memberById(e.memberIds[0] ?? "")?.color ?? c.gold }]} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={s.dayHeader}>
          <Text style={s.dayTitle}>{longDate(selected)}</Text>
          <Button small label="+ Termin" onPress={() => setEditing("new")} />
        </View>
        <ErrorText error={events.error} />
        {dayBirthdays.map((o) => (
          <Card key={o.birthday.id} style={[s.event, s.birthday]}>
            <Text style={{ fontSize: 22 }}>🎂</Text>
            <Text style={[s.eventTitle, { flex: 1 }]}>{birthdayLabel(o)}</Text>
          </Card>
        ))}
        {dayEvents.length === 0 && dayBirthdays.length === 0 ? (
          <Empty icon="☾" title="Nichts geplant" text="Tippe auf „+ Termin“, um etwas für die Familie einzutragen." />
        ) : (
          <View style={{ gap: theme.spacing(2.5) }}>
            {dayEvents.map((e) => (
              <Pressable key={e.id} onPress={() => setEditing(e)}>
                <Card style={s.event}>
                  <View style={s.eventTime}>
                    <Text style={s.eventTimeText}>{e.allDay ? "ganztags" : time(e.start)}</Text>
                    {!e.allDay && e.end ? <Text style={s.eventTimeEnd}>{time(e.end)}</Text> : null}
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={s.eventTitle}>
                      {e.title}
                      {e.repeat && e.repeat !== "none" ? <Text style={s.repeatMark}> ↻</Text> : null}
                    </Text>
                    {e.notes ? (
                      <Text style={s.eventNotes} numberOfLines={2}>
                        {e.notes}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: "row" }}>
                    {e.memberIds.length === 0 ? (
                      <Text style={s.all}>Alle</Text>
                    ) : (
                      e.memberIds.map((id, i) => (
                        <View key={id} style={{ marginLeft: i ? -8 : 0 }}>
                          <Avatar member={memberById(id)} size={26} />
                        </View>
                      ))
                    )}
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {editing ? (
        <EventEditor day={selected} event={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />
      ) : null}
      {birthdaysOpen ? <BirthdaySheet onClose={() => setBirthdaysOpen(false)} /> : null}
    </View>
  );
}

function EventEditor({ day, event, onClose }: { day: Date; event?: CalendarEvent; onClose: () => void }) {
  const { api, members } = useSession();
  const qc = useQueryClient();
  const [title, setTitle] = useState(event?.title ?? "");
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [startTime, setStartTime] = useState(event && !event.allDay ? time(event.start) : "18:00");
  const [endTime, setEndTime] = useState(event?.end && !event.allDay ? time(event.end) : "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [who, setWho] = useState<string[]>(event?.memberIds ?? []);
  const [repeat, setRepeat] = useState<EventRepeat>(event?.repeat ?? "none");
  const [error, setError] = useState<string | null>(null);
  /** Bei Serien wird immer die ganze Serie bearbeitet – gespeichert wird am Tag des ersten Termins. */
  const shownDay = event ? startOfDay(new Date(event.start)) : day;
  const baseDay = event ? startOfDay(new Date(event.seriesStart ?? event.start)) : day;

  const done = () => {
    void qc.invalidateQueries({ queryKey: ["events"] });
    onClose();
  };
  const save = useMutation({
    mutationFn: async () => {
      const at = (hm: { h: number; m: number }) =>
        new Date(baseDay.getFullYear(), baseDay.getMonth(), baseDay.getDate(), hm.h, hm.m).toISOString();
      let start: string;
      let end: string | undefined;
      if (allDay) {
        start = baseDay.toISOString();
        end = undefined;
      } else {
        const st = parseTime(startTime);
        if (!st) throw new Error("Bitte eine Startzeit wie 18:00 eingeben.");
        start = at(st);
        if (endTime.trim()) {
          const et = parseTime(endTime);
          if (!et) throw new Error("Bitte eine Endzeit wie 19:30 eingeben.");
          end = at(et);
          if (end < start) throw new Error("Das Ende liegt vor dem Beginn.");
        }
      }
      const body = { title: title.trim(), start, end, allDay, notes: notes.trim() || undefined, memberIds: who, repeat };
      return event ? api.updateEvent(event.id, body) : api.createEvent(body);
    },
    onSuccess: done,
    onError: (e) => setError(e.message),
  });
  const remove = useMutation({ mutationFn: () => api.deleteEvent(event!.id), onSuccess: done, onError: (e) => setError(e.message) });

  const toggle = (id: string) => setWho((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <ScrollView style={s.sheet} contentContainerStyle={{ gap: theme.spacing(4), paddingBottom: theme.spacing(8) }} keyboardShouldPersistTaps="handled">
          <Text style={s.sheetEyebrow}>{event ? "Termin bearbeiten" : "Neuer Termin"}</Text>
          <Text style={s.sheetTitle}>{longDate(shownDay)}</Text>
          {event?.seriesStart ? <Text style={s.seriesHint}>Teil einer Serie – Änderungen gelten für alle Termine.</Text> : null}
          <Input label="Titel" value={title} onChangeText={setTitle} placeholder="z. B. Fußballtraining" maxLength={120} autoFocus={!event} />
          <View style={s.row}>
            <Text style={s.rowLabel}>Ganztägig</Text>
            <Switch value={allDay} onValueChange={setAllDay} trackColor={{ true: c.gold, false: c.surface3 }} thumbColor={c.text} {...webThumb} />
          </View>
          {!allDay ? (
            <View style={{ flexDirection: "row", gap: theme.spacing(3) }}>
              <View style={{ flex: 1 }}>
                <Input label="Beginn" value={startTime} onChangeText={setStartTime} placeholder="18:00" keyboardType="numbers-and-punctuation" />
              </View>
              <View style={{ flex: 1 }}>
                <Input label="Ende (optional)" value={endTime} onChangeText={setEndTime} placeholder="19:30" keyboardType="numbers-and-punctuation" />
              </View>
            </View>
          ) : null}
          <View style={{ gap: 8 }}>
            <Text style={s.label}>Wiederholen</Text>
            <View style={s.chips}>
              {(Object.keys(REPEAT_LABELS) as EventRepeat[]).map((r) => (
                <Chip key={r} label={REPEAT_LABELS[r]!} active={repeat === r} onPress={() => setRepeat(r)} />
              ))}
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <Text style={s.label}>Für wen?</Text>
            <View style={s.chips}>
              <Chip label="Ganze Familie" active={who.length === 0} onPress={() => setWho([])} />
              {members.map((m) => (
                <Chip key={m.id} label={m.name} color={m.color} active={who.includes(m.id)} onPress={() => toggle(m.id)} />
              ))}
            </View>
          </View>
          <Input label="Notiz" value={notes} onChangeText={setNotes} placeholder="Ort, Mitbringen, …" multiline style={{ minHeight: 80, paddingTop: 12 }} maxLength={2000} />
          {error ? <Text style={{ color: c.danger }}>{error}</Text> : null}
          <Button label="Speichern" onPress={() => save.mutate()} disabled={!title.trim()} loading={save.isPending} />
          <View style={{ flexDirection: "row", gap: theme.spacing(3) }}>
            <Button style={{ flex: 1 }} variant="ghost" label="Abbrechen" onPress={onClose} />
            {event ? <Button style={{ flex: 1 }} variant="danger" label="Löschen" onPress={() => remove.mutate()} loading={remove.isPending} /> : null}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "13.3." / "13.03" / "13.3.1946" -> { date: "03-13", year? } */
function parseBirthday(input: string): { date: string; year?: number } | null {
  const m = input.trim().match(/^(\d{1,2})\.(\d{1,2})\.?(\d{4})?$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { date: `${pad2(mo)}-${pad2(d)}`, year: m[3] ? Number(m[3]) : undefined };
}

function BirthdaySheet({ onClose }: { onClose: () => void }) {
  const { api } = useSession();
  const qc = useQueryClient();
  const birthdays = useQuery({ queryKey: ["birthdays"], queryFn: api.birthdays });
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const parsed = parseBirthday(date);
  const refresh = () => qc.invalidateQueries({ queryKey: ["birthdays"] });
  const add = useMutation({
    mutationFn: () => api.createBirthday({ name: name.trim(), ...parsed! }),
    onSuccess: () => {
      setName("");
      setDate("");
    },
    onSettled: refresh,
  });
  const remove = useMutation({ mutationFn: (id: string) => api.deleteBirthday(id), onSettled: refresh });

  const today = startOfDay(new Date());
  const upcoming = birthdaysInRange(birthdays.data ?? [], today, addDays(today, 366));
  const seen = new Set<string>();
  const list = upcoming.filter((o) => (seen.has(o.birthday.id) ? false : (seen.add(o.birthday.id), true)));

  return (
    <Sheet eyebrow="Geburtstage & Jahrestage" title="Nicht mehr vergessen 🎂" onClose={onClose}>
      <Text style={s.seriesHint}>Erscheinen im Kalender und auf „Heute“. In der App gibt es eine Woche vorher eine Erinnerung.</Text>
      {list.map((o) => {
        const days = Math.round((o.date.getTime() - today.getTime()) / 86_400_000);
        return (
          <View key={o.birthday.id} style={s.bdayRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.eventTitle}>{o.birthday.name}</Text>
              <Text style={s.eventNotes}>
                {o.date.getDate()}. {MONTHS[o.date.getMonth()]}
                {o.age ? ` · wird ${o.age}` : ""} · {days === 0 ? "heute! 🎉" : days === 1 ? "morgen" : `in ${days} Tagen`}
              </Text>
            </View>
            <Pressable
              hitSlop={8}
              accessibilityLabel={`${o.birthday.name} löschen`}
              onPress={() => confirmAction("Geburtstag löschen?", `${o.birthday.name} wird aus dem Kalender entfernt.`, "Löschen", () => remove.mutate(o.birthday.id))}
            >
              <Text style={{ color: c.textFaint, fontSize: 16 }}>✕</Text>
            </Pressable>
          </View>
        );
      })}
      <Label>Neuer Geburtstag</Label>
      <Input value={name} onChangeText={setName} placeholder="Name, z. B. Oma Gerda" maxLength={60} />
      <Input value={date} onChangeText={setDate} placeholder="Datum, z. B. 13.3.1946 (Jahr optional)" keyboardType="numbers-and-punctuation" maxLength={10} />
      {date && !parsed ? <Text style={{ color: c.danger }}>Bitte als Tag.Monat eingeben, z. B. 13.3. oder 13.3.1946</Text> : null}
      <ErrorText error={add.error} />
      <Button label="Hinzufügen" onPress={() => add.mutate()} disabled={!name.trim() || !parsed} loading={add.isPending} />
      <Button variant="ghost" label="Fertig" onPress={onClose} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  nav: { flexDirection: "row", gap: 6, paddingHorizontal: theme.spacing(5), marginBottom: theme.spacing(3) },
  weekRow: { flexDirection: "row", marginBottom: 4 },
  weekday: { flex: 1, textAlign: "center", color: c.textFaint, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 4, height: 52 },
  dayNum: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  daySel: { backgroundColor: c.gold },
  dayToday: { borderWidth: 1, borderColor: c.gold },
  dayText: { color: c.text, fontSize: 15 },
  dots: { flexDirection: "row", gap: 3, marginTop: 3, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  cake: { fontSize: 8, lineHeight: 6, marginTop: -1 },
  birthday: { borderColor: c.goldDim, backgroundColor: c.goldDim, marginBottom: theme.spacing(2.5) },
  repeatMark: { color: c.gold, fontSize: 14 },
  seriesHint: { color: c.textMuted, fontSize: 13, lineHeight: 18 },
  bdayRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing(3), paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.hairline },
  dayHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: theme.spacing(5), marginBottom: theme.spacing(3) },
  dayTitle: { color: c.text, fontSize: 18, fontWeight: "600", flex: 1 },
  event: { flexDirection: "row", alignItems: "center", gap: theme.spacing(3.5) },
  eventTime: { width: 62 },
  eventTimeText: { color: c.gold, fontWeight: "700", fontSize: 14 },
  eventTimeEnd: { color: c.textFaint, fontSize: 12, marginTop: 2 },
  eventTitle: { color: c.text, fontSize: 16, fontWeight: "600" },
  eventNotes: { color: c.textMuted, fontSize: 13 },
  all: { color: c.textFaint, fontSize: 12 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "92%",
    backgroundColor: c.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: c.hairline,
    padding: theme.spacing(5),
  },
  sheetEyebrow: { color: c.gold, fontSize: 11, letterSpacing: 2.2, textTransform: "uppercase" },
  sheetTitle: { color: c.text, fontSize: 22, fontWeight: "600", marginTop: -8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowLabel: { color: c.text, fontSize: 16 },
  label: { color: c.textMuted, fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
