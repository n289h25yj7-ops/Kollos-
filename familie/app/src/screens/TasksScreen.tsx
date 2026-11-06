import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "../session";
import { theme } from "../theme";
import type { Member, Repeat, Reward, Task } from "../types";
import { Avatar, Button, Card, Chip, Empty, ErrorText, Input, Label, ScreenHeader, Sheet } from "../components/ui";
import { addDays, dayKey } from "../format";

const c = theme.colors;
const POINTS = [5, 10, 20, 50];
const REPEAT_LABEL: Record<Repeat, string> = { none: "Einmalig", daily: "Täglich", weekly: "Wöchentlich" };

function dueLabel(due: string | undefined, today: string): string | null {
  if (!due) return null;
  if (due < today) return "überfällig";
  if (due === today) return "heute";
  if (due === dayKey(addDays(new Date(), 1))) return "morgen";
  const [, m, d] = due.split("-");
  return `bis ${Number(d)}.${Number(m)}.`;
}

export function TasksScreen() {
  const [view, setView] = useState<"tasks" | "points">("tasks");
  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader eyebrow="Aufgaben & Ämtchen" title={view === "tasks" ? "To-dos" : "Punkte"} />
      <View style={s.segment}>
        <Chip label="Aufgaben" active={view === "tasks"} onPress={() => setView("tasks")} />
        <Chip label="★ Punkte & Belohnungen" active={view === "points"} onPress={() => setView("points")} />
      </View>
      {view === "tasks" ? <TaskList /> : <PointsView />}
    </View>
  );
}

// ---------------------------------------------------------------- Aufgaben

function TaskList() {
  const { api, session, memberById } = useSession();
  const qc = useQueryClient();
  const tasks = useQuery({ queryKey: ["tasks", "list"], queryFn: api.tasks });
  const [mine, setMine] = useState(false);
  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const today = dayKey(new Date());
  const refresh = () => qc.invalidateQueries({ queryKey: ["tasks"] });

  const complete = useMutation({
    mutationFn: (t: Task) => api.completeTask(t.id, t.assigneeId, today),
    onSettled: refresh,
  });
  const undo = useMutation({ mutationFn: (t: Task) => api.uncompleteTask(t.id), onSettled: refresh });

  const sections = useMemo(() => {
    const all = (tasks.data ?? []).filter((t) => !mine || !t.assigneeId || t.assigneeId === session.member.id);
    const open = all.filter((t) => !t.done).sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
    return [
      { title: "Überfällig", items: open.filter((t) => t.due && t.due < today) },
      { title: "Heute", items: open.filter((t) => t.due === today) },
      { title: "Demnächst", items: open.filter((t) => t.due && t.due > today) },
      { title: "Ohne Datum", items: open.filter((t) => !t.due) },
      { title: "Erledigt", items: all.filter((t) => t.done).slice(-10).reverse() },
    ].filter((sec) => sec.items.length);
  }, [tasks.data, mine, session.member.id, today]);

  return (
    <>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.toolbar}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip label="Alle" active={!mine} onPress={() => setMine(false)} />
            <Chip label="Meine" active={mine} onPress={() => setMine(true)} />
          </View>
          <Button small label="+ Aufgabe" onPress={() => setEditing("new")} />
        </View>
        <ErrorText error={tasks.error ?? complete.error ?? undo.error} />
        {sections.length === 0 ? (
          <Empty icon="✓" title="Alles erledigt!" text="Lege Aufgaben an – z. B. „Spülmaschine ausräumen“ für 10 Punkte, täglich." />
        ) : (
          sections.map((sec) => (
            <View key={sec.title} style={{ gap: theme.spacing(2) }}>
              <Text style={[s.section, sec.title === "Überfällig" && { color: c.danger }]}>
                {sec.title} · {sec.items.length}
              </Text>
              {sec.items.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  assignee={memberById(t.assigneeId ?? "")}
                  today={today}
                  onToggle={() => (t.done ? undo.mutate(t) : complete.mutate(t))}
                  onPress={() => setEditing(t)}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
      {editing ? <TaskEditor task={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function TaskRow({ task, assignee, today, onToggle, onPress }: { task: Task; assignee?: Member; today: string; onToggle: () => void; onPress: () => void }) {
  const due = dueLabel(task.due, today);
  const meta = [assignee?.name ?? "Jeder", task.repeat !== "none" ? REPEAT_LABEL[task.repeat] : null, task.done ? null : due].filter(Boolean).join(" · ");
  return (
    <Pressable onPress={onPress}>
      <Card style={s.task}>
        <Pressable onPress={onToggle} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: task.done }} accessibilityLabel={task.title}>
          <View style={[s.check, task.done && s.checkOn]}>{task.done ? <Text style={s.checkMark}>✓</Text> : null}</View>
        </Pressable>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[s.taskTitle, task.done && s.taskDone]}>{task.title}</Text>
          <Text style={[s.meta, due === "überfällig" && !task.done && { color: c.danger }]}>{meta}</Text>
        </View>
        {assignee ? <Avatar member={assignee} size={26} /> : null}
        {task.points ? (
          <View style={s.pts}>
            <Text style={s.ptsText}>+{task.points}</Text>
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

function TaskEditor({ task, onClose }: { task?: Task; onClose: () => void }) {
  const { api, members } = useSession();
  const qc = useQueryClient();
  const today = new Date();
  const [title, setTitle] = useState(task?.title ?? "");
  const [assigneeId, setAssigneeId] = useState<string | undefined>(task?.assigneeId);
  const [points, setPoints] = useState(task?.points ?? 10);
  const [repeat, setRepeat] = useState<Repeat>(task?.repeat ?? "none");
  const [due, setDue] = useState<string | undefined>(task?.due ?? dayKey(today));
  const dueOptions: { label: string; value?: string }[] = [
    { label: "Kein Datum", value: undefined },
    { label: "Heute", value: dayKey(today) },
    { label: "Morgen", value: dayKey(addDays(today, 1)) },
    { label: "In 1 Woche", value: dayKey(addDays(today, 7)) },
  ];
  if (due && !dueOptions.some((o) => o.value === due)) dueOptions.push({ label: dueLabel(due, dayKey(today)) ?? due, value: due });

  const done = () => {
    void qc.invalidateQueries({ queryKey: ["tasks"] });
    onClose();
  };
  const save = useMutation({
    mutationFn: () => {
      const body = { title: title.trim(), assigneeId: assigneeId ?? "", points, repeat, due: due ?? "" };
      return task ? api.updateTask(task.id, body) : api.createTask({ ...body, assigneeId, due });
    },
    onSuccess: done,
  });
  const remove = useMutation({ mutationFn: () => api.deleteTask(task!.id), onSuccess: done });

  return (
    <Sheet eyebrow={task ? "Aufgabe bearbeiten" : "Neue Aufgabe"} onClose={onClose}>
      <Input label="Was ist zu tun?" value={title} onChangeText={setTitle} placeholder="z. B. Spülmaschine ausräumen" maxLength={120} autoFocus={!task} />
      <View style={{ gap: 8 }}>
        <Label>Wer?</Label>
        <View style={s.chips}>
          <Chip label="Jeder" active={!assigneeId} onPress={() => setAssigneeId(undefined)} />
          {members.map((m) => (
            <Chip key={m.id} label={m.name} color={m.color} active={assigneeId === m.id} onPress={() => setAssigneeId(m.id)} />
          ))}
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <Label>Punkte</Label>
        <View style={s.chips}>
          {[0, ...POINTS].map((p) => (
            <Chip key={p} label={p ? `★ ${p}` : "Keine"} active={points === p} onPress={() => setPoints(p)} />
          ))}
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <Label>Wiederholen</Label>
        <View style={s.chips}>
          {(Object.keys(REPEAT_LABEL) as Repeat[]).map((r) => (
            <Chip key={r} label={REPEAT_LABEL[r]} active={repeat === r} onPress={() => setRepeat(r)} />
          ))}
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <Label>Fällig</Label>
        <View style={s.chips}>
          {dueOptions.map((o) => (
            <Chip key={o.label} label={o.label} active={due === o.value} onPress={() => setDue(o.value)} />
          ))}
        </View>
      </View>
      <ErrorText error={save.error ?? remove.error} />
      <Button label="Speichern" onPress={() => save.mutate()} disabled={!title.trim()} loading={save.isPending} />
      <View style={{ flexDirection: "row", gap: theme.spacing(3) }}>
        <Button style={{ flex: 1 }} variant="ghost" label="Abbrechen" onPress={onClose} />
        {task ? <Button style={{ flex: 1 }} variant="danger" label="Löschen" onPress={() => remove.mutate()} loading={remove.isPending} /> : null}
      </View>
    </Sheet>
  );
}

// ---------------------------------------------------------------- Punkte & Belohnungen

function PointsView() {
  const { api, members, memberById } = useSession();
  const qc = useQueryClient();
  const points = useQuery({ queryKey: ["tasks", "points"], queryFn: api.points });
  const rewards = useQuery({ queryKey: ["tasks", "rewards"], queryFn: api.rewards });
  const [redeeming, setRedeeming] = useState<Reward | null>(null);
  const [title, setTitle] = useState("");
  const [cost, setCost] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["tasks"] });

  const addReward = useMutation({
    mutationFn: () => api.createReward(title.trim(), Number(cost)),
    onSuccess: () => {
      setTitle("");
      setCost("");
    },
    onSettled: refresh,
  });
  const delReward = useMutation({ mutationFn: (id: string) => api.deleteReward(id), onSettled: refresh });

  const balances = [...(points.data?.balances ?? [])].sort((a, b) => b.balance - a.balance || b.week - a.week);
  const balanceOf = (id: string) => balances.find((b) => b.memberId === id)?.balance ?? 0;
  const medal = ["🥇", "🥈", "🥉"];

  return (
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <ErrorText error={points.error ?? rewards.error} />
      <Text style={s.section}>Rangliste</Text>
      {balances.map((b, i) => {
        const m = memberById(b.memberId);
        return (
          <Card key={b.memberId} style={s.rank}>
            <Text style={s.medal}>{b.earned ? (medal[i] ?? `${i + 1}.`) : "·"}</Text>
            <Avatar member={m} size={38} />
            <View style={{ flex: 1 }}>
              <Text style={s.taskTitle}>{m?.name}</Text>
              <Text style={s.meta}>diese Woche +{b.week} · gesamt {b.earned}</Text>
            </View>
            <Text style={s.balance}>★ {b.balance}</Text>
          </Card>
        );
      })}

      <Text style={[s.section, { marginTop: theme.spacing(4) }]}>Belohnungen</Text>
      {(rewards.data ?? []).map((r) => (
        <Card key={r.id} style={s.rank}>
          <Text style={{ fontSize: 22 }}>🎁</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.taskTitle}>{r.title}</Text>
            <Text style={s.meta}>★ {r.cost} Punkte</Text>
          </View>
          <Button small label="Einlösen" onPress={() => setRedeeming(r)} />
          <Pressable onPress={() => delReward.mutate(r.id)} hitSlop={8} accessibilityLabel="Belohnung löschen">
            <Text style={s.del}>✕</Text>
          </Pressable>
        </Card>
      ))}
      <View style={s.addReward}>
        <View style={{ flex: 2 }}>
          <Input value={title} onChangeText={setTitle} placeholder="Neue Belohnung" maxLength={80} />
        </View>
        <View style={{ flex: 1 }}>
          <Input value={cost} onChangeText={(t) => setCost(t.replace(/\D/g, ""))} placeholder="Punkte" keyboardType="number-pad" maxLength={6} />
        </View>
        <Button label="+" onPress={() => addReward.mutate()} disabled={!title.trim() || !Number(cost)} loading={addReward.isPending} />
      </View>
      <ErrorText error={addReward.error} />

      {points.data?.history.length ? (
        <>
          <Text style={[s.section, { marginTop: theme.spacing(4) }]}>Verlauf</Text>
          {points.data.history.slice(0, 15).map((h) => (
            <View key={h.id} style={s.history}>
              <Text style={[s.historyPts, h.points < 0 && { color: c.danger }]}>{h.points > 0 ? `+${h.points}` : h.points}</Text>
              <Text style={s.historyText} numberOfLines={1}>
                {memberById(h.memberId)?.name ?? "?"} · {h.title}
              </Text>
            </View>
          ))}
        </>
      ) : null}

      {redeeming ? <RedeemSheet reward={redeeming} members={members} balanceOf={balanceOf} onClose={() => setRedeeming(null)} /> : null}
    </ScrollView>
  );
}

function RedeemSheet({ reward, members, balanceOf, onClose }: { reward: Reward; members: Member[]; balanceOf: (id: string) => number; onClose: () => void }) {
  const { api, session } = useSession();
  const qc = useQueryClient();
  const [who, setWho] = useState(session.member.id);
  const redeem = useMutation({
    mutationFn: () => api.redeemReward(reward.id, who),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    },
  });
  const enough = balanceOf(who) >= reward.cost;
  return (
    <Sheet eyebrow="Belohnung einlösen" title={`🎁 ${reward.title}`} onClose={onClose}>
      <Text style={s.meta}>Kostet ★ {reward.cost} Punkte. Für wen?</Text>
      <View style={s.chips}>
        {members.map((m) => (
          <Chip key={m.id} label={`${m.name} · ★ ${balanceOf(m.id)}`} color={m.color} active={who === m.id} onPress={() => setWho(m.id)} />
        ))}
      </View>
      {!enough ? <Text style={{ color: c.textMuted }}>Noch {reward.cost - balanceOf(who)} Punkte bis dahin – weiter so! 💪</Text> : null}
      <ErrorText error={redeem.error} />
      <Button label="Einlösen" onPress={() => redeem.mutate()} disabled={!enough} loading={redeem.isPending} />
      <Button variant="ghost" label="Abbrechen" onPress={onClose} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  segment: { flexDirection: "row", gap: 8, paddingHorizontal: theme.spacing(4), paddingBottom: theme.spacing(3) },
  scroll: { paddingHorizontal: theme.spacing(4), paddingBottom: theme.spacing(24), gap: theme.spacing(3) },
  toolbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  section: { color: c.textMuted, fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", marginTop: theme.spacing(2) },
  task: { flexDirection: "row", alignItems: "center", gap: theme.spacing(3), paddingVertical: theme.spacing(3) },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: c.hairlineStrong, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: c.gold, borderColor: c.gold },
  checkMark: { color: c.onGold, fontWeight: "900", fontSize: 14 },
  taskTitle: { color: c.text, fontSize: 16, fontWeight: "600" },
  taskDone: { color: c.textFaint, textDecorationLine: "line-through", fontWeight: "400" },
  meta: { color: c.textMuted, fontSize: 13 },
  pts: { backgroundColor: c.goldDim, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  ptsText: { color: c.goldBright, fontWeight: "800", fontSize: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rank: { flexDirection: "row", alignItems: "center", gap: theme.spacing(3), paddingVertical: theme.spacing(3) },
  medal: { width: 26, textAlign: "center", fontSize: 18, color: c.textFaint },
  balance: { color: c.goldBright, fontSize: 20, fontWeight: "800" },
  del: { color: c.textFaint, fontSize: 16, paddingHorizontal: 4 },
  addReward: { flexDirection: "row", gap: 8, alignItems: "center" },
  history: { flexDirection: "row", gap: theme.spacing(3), alignItems: "center", paddingHorizontal: 4 },
  historyPts: { width: 44, color: c.sage, fontWeight: "800", textAlign: "right" },
  historyText: { flex: 1, color: c.textMuted, fontSize: 14 },
});
