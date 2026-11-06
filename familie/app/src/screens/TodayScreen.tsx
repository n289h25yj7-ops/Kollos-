import { useMemo, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "../session";
import { useNav, type Tab } from "../nav";
import { brandFont, theme } from "../theme";
import type { Task } from "../types";
import { Avatar, Card, ScreenHeader } from "../components/ui";
import { addDays, ago, dayKey, longDate, startOfDay, time } from "../format";
import { birthdayLabel, birthdaysInRange, expandEvents } from "../recurrence";

const c = theme.colors;

function greeting(h: number) {
  if (h < 5) return "Gute Nacht";
  if (h < 11) return "Guten Morgen";
  if (h < 18) return "Hallo";
  return "Guten Abend";
}

/** Ein Abschnitt mit Ueberschrift und "alle ansehen"-Link zum passenden Tab. */
function Section({ title, link, onLink, children }: { title: string; link?: string; onLink?: () => void; children: ReactNode }) {
  return (
    <View style={{ gap: theme.spacing(2) }}>
      <View style={s.sectionHead}>
        <Text style={s.section}>{title}</Text>
        {link ? (
          <Text style={s.link} onPress={onLink} accessibilityRole="link">
            {link} ›
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Startbildschirm: alles, was heute fuer die Familie wichtig ist, auf einen Blick. */
export function TodayScreen() {
  const { api, session, members, memberById } = useSession();
  const { setTab } = useNav();
  const qc = useQueryClient();
  const go = (t: Tab) => () => setTab(t);

  const now = new Date();
  const today = startOfDay(now);
  const todayKey = dayKey(today);
  const from = today.toISOString();
  const to = addDays(today, 2).toISOString();

  const events = useQuery({ queryKey: ["events", "today", from], queryFn: () => api.events(from, to) });
  const birthdays = useQuery({ queryKey: ["birthdays"], queryFn: api.birthdays });
  const meals = useQuery({ queryKey: ["meals", "today", todayKey], queryFn: () => api.meals(todayKey, dayKey(addDays(today, 1))) });
  const tasks = useQuery({ queryKey: ["tasks", "list"], queryFn: api.tasks });
  const lists = useQuery({ queryKey: ["lists"], queryFn: api.lists });
  const locations = useQuery({ queryKey: ["locations"], queryFn: api.locations, refetchInterval: 60_000 });
  const messages = useQuery({ queryKey: ["messages"], queryFn: api.messages });

  const occ = useMemo(() => expandEvents(events.data ?? [], today, addDays(today, 2)), [events.data, todayKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const todayEvents = occ.filter((e) => dayKey(new Date(e.start)) <= todayKey && dayKey(new Date(e.end ?? e.start)) >= todayKey);
  const tomorrowCount = occ.filter((e) => dayKey(new Date(e.start)) === dayKey(addDays(today, 1))).length;
  const nextBirthdays = birthdaysInRange(birthdays.data ?? [], today, addDays(today, 14));
  const mealToday = meals.data?.find((m) => m.date === todayKey);
  const mealTomorrow = meals.data?.find((m) => m.date === dayKey(addDays(today, 1)));

  const myTasks = (tasks.data ?? [])
    .filter((t) => !t.done && t.due && t.due <= todayKey && (!t.assigneeId || t.assigneeId === session.member.id))
    .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
  const openFamilyTasks = (tasks.data ?? []).filter((t) => !t.done && t.due && t.due <= todayKey).length;

  const openItems = (lists.data ?? []).flatMap((l) => l.items.filter((i) => !i.done));
  const lastMessage = messages.data?.at(-1);
  const locs = locations.data ?? [];

  const complete = useMutation({
    mutationFn: (t: Task) => api.completeTask(t.id, t.assigneeId, todayKey),
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader eyebrow={`${greeting(now.getHours())} · ${longDate(now)}`} title={session.member.name} />
      <ScrollView contentContainerStyle={s.scroll}>
        {nextBirthdays.map((o) => {
          const days = Math.round((o.date.getTime() - today.getTime()) / 86_400_000);
          return (
            <Card key={o.birthday.id + o.date.getFullYear()} style={[s.banner, days === 0 && s.bannerToday]}>
              <Text style={s.bannerIcon}>{days === 0 ? "🎉" : "🎂"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.bannerTitle}>{days === 0 ? `Heute: ${birthdayLabel(o)}!` : birthdayLabel(o)}</Text>
                <Text style={s.meta}>
                  {days === 0 ? "Gratulieren nicht vergessen 💛" : days === 1 ? "Morgen – Geschenk schon besorgt?" : `in ${days} Tagen`}
                </Text>
              </View>
            </Card>
          );
        })}

        <Section title="Termine heute" link="Kalender" onLink={go("calendar")}>
          {todayEvents.length === 0 ? (
            <Text style={s.quiet}>
              Heute steht nichts an.{tomorrowCount ? ` Morgen: ${tomorrowCount} ${tomorrowCount === 1 ? "Termin" : "Termine"}.` : ""}
            </Text>
          ) : (
            todayEvents.map((e) => (
              <Pressable key={e.id + e.start} onPress={go("calendar")}>
                <Card style={s.row}>
                  <Text style={s.time}>{e.allDay ? "ganztags" : time(e.start)}</Text>
                  <Text style={s.rowTitle} numberOfLines={1}>
                    {e.title}
                  </Text>
                  <View style={{ flexDirection: "row" }}>
                    {e.memberIds.slice(0, 3).map((id, i) => (
                      <View key={id} style={{ marginLeft: i ? -8 : 0 }}>
                        <Avatar member={memberById(id)} size={24} />
                      </View>
                    ))}
                  </View>
                </Card>
              </Pressable>
            ))
          )}
        </Section>

        <Section title="Heute gibt's" link="Essensplan" onLink={go("shopping")}>
          <Pressable onPress={go("shopping")}>
            <Card style={s.row}>
              <Text style={{ fontSize: 24 }}>🍽️</Text>
              <View style={{ flex: 1 }}>
                <Text style={mealToday ? s.meal : s.quiet}>{mealToday?.title ?? "Noch nichts geplant"}</Text>
                <Text style={s.meta}>
                  {mealToday?.cookId
                    ? `kocht: ${memberById(mealToday.cookId)?.name}`
                    : mealToday
                      ? "Koch gesucht 🙋"
                      : "Tippe hier, um die Woche zu planen"}
                  {mealTomorrow ? ` · morgen: ${mealTomorrow.title}` : ""}
                </Text>
              </View>
            </Card>
          </Pressable>
        </Section>

        <Section title={myTasks.length ? `Deine Aufgaben · ${myTasks.length}` : "Deine Aufgaben"} link="Alle Aufgaben" onLink={go("tasks")}>
          {myTasks.length === 0 ? (
            <Text style={s.quiet}>Alles erledigt ✨{openFamilyTasks ? ` (In der Familie sind noch ${openFamilyTasks} offen.)` : ""}</Text>
          ) : (
            myTasks.slice(0, 5).map((t) => (
              <Card key={t.id} style={s.row}>
                <Pressable
                  onPress={() => complete.mutate(t)}
                  hitSlop={8}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: false }}
                  accessibilityLabel={t.title}
                >
                  <View style={s.check} />
                </Pressable>
                <Text style={s.rowTitle} numberOfLines={1}>
                  {t.title}
                </Text>
                {t.due && t.due < todayKey ? <Text style={s.overdue}>überfällig</Text> : null}
                {t.points ? <Text style={s.points}>+{t.points}</Text> : null}
              </Card>
            ))
          )}
        </Section>

        <Section title={`Einkaufsliste · ${openItems.length}`} link="Einkauf" onLink={go("shopping")}>
          <Pressable onPress={go("shopping")}>
            <Card>
              <Text style={openItems.length ? s.items : s.quiet} numberOfLines={2}>
                {openItems.length
                  ? openItems
                      .slice(0, 8)
                      .map((i) => i.text)
                      .join(" · ") + (openItems.length > 8 ? " …" : "")
                  : "Nichts zu besorgen 🎉"}
              </Text>
            </Card>
          </Pressable>
        </Section>

        <Section title="Wo sind alle?" link="Karte" onLink={go("map")}>
          <Pressable onPress={go("map")}>
            <Card style={s.people}>
              {members.map((m) => {
                const loc = locs.find((l) => l.memberId === m.id);
                return (
                  <View key={m.id} style={s.person}>
                    <Avatar member={m} size={40} />
                    <Text style={s.personName} numberOfLines={1}>
                      {m.id === session.member.id ? "Du" : m.name}
                    </Text>
                    <Text style={s.personMeta} numberOfLines={1}>
                      {loc ? ago(loc.updatedAt) : "—"}
                    </Text>
                  </View>
                );
              })}
            </Card>
          </Pressable>
        </Section>

        {lastMessage ? (
          <Section title="Zuletzt im Chat" link="Chat" onLink={go("chat")}>
            <Pressable onPress={go("chat")}>
              <Card style={s.row}>
                <Avatar member={memberById(lastMessage.memberId)} size={30} />
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle} numberOfLines={2}>
                    {lastMessage.text}
                  </Text>
                  <Text style={s.meta}>
                    {memberById(lastMessage.memberId)?.name ?? "?"} · {ago(lastMessage.createdAt)}
                  </Text>
                </View>
              </Card>
            </Pressable>
          </Section>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  scroll: {
    paddingHorizontal: theme.spacing(4),
    paddingBottom: theme.spacing(24),
    gap: theme.spacing(5),
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  section: { color: c.textMuted, fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase" },
  link: { color: c.gold, fontSize: 13 },
  quiet: { color: c.textMuted, fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing(3), paddingVertical: theme.spacing(3) },
  rowTitle: { flex: 1, color: c.text, fontSize: 16 },
  time: { color: c.gold, fontWeight: "700", fontSize: 14, minWidth: 54 },
  meal: { color: c.text, fontSize: 18, fontFamily: brandFont },
  meta: { color: c.textMuted, fontSize: 13, marginTop: 2 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: c.hairlineStrong },
  overdue: { color: c.danger, fontSize: 12 },
  points: {
    color: c.goldBright,
    fontWeight: "800",
    fontSize: 12,
    backgroundColor: c.goldDim,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
  },
  items: { color: c.text, fontSize: 15, lineHeight: 22 },
  people: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing(3) },
  person: { alignItems: "center", width: 62, gap: 3 },
  personName: { color: c.text, fontSize: 12, fontWeight: "600", maxWidth: 62 },
  personMeta: { color: c.textFaint, fontSize: 10, maxWidth: 62 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(3),
    backgroundColor: c.goldDim,
    borderColor: "rgba(201,168,106,0.35)",
  },
  bannerToday: { borderColor: c.gold },
  bannerIcon: { fontSize: 28 },
  bannerTitle: { color: c.goldBright, fontSize: 16, fontWeight: "700" },
});
