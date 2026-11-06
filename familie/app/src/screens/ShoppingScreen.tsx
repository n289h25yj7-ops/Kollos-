import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "../session";
import { theme } from "../theme";
import type { ShoppingList } from "../types";
import { Button, Card, Chip, Empty, ErrorText, Input, ScreenHeader } from "../components/ui";
import { confirmAction } from "../components/confirm";
import { MealPlan } from "./MealPlan";

const c = theme.colors;


export function ShoppingScreen() {
  const [view, setView] = useState<"lists" | "meals">("lists");
  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader eyebrow="Einkauf & Essen" title={view === "lists" ? "Einkaufslisten" : "Essensplan"} />
      <View style={s.segment}>
        <Chip label="☰ Listen" active={view === "lists"} onPress={() => setView("lists")} />
        <Chip label="🍽️ Essensplan" active={view === "meals"} onPress={() => setView("meals")} />
      </View>
      {view === "lists" ? <Lists /> : <MealPlan />}
    </View>
  );
}

function Lists() {
  const { api, memberById } = useSession();
  const qc = useQueryClient();
  const lists = useQuery({ queryKey: ["lists"], queryFn: api.lists });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [newList, setNewList] = useState<string | null>(null);

  const all = lists.data ?? [];
  const active = all.find((l) => l.id === activeId) ?? all[0];
  useEffect(() => {
    if (active && active.id !== activeId) setActiveId(active.id);
  }, [active, activeId]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["lists"] });
  /** Sofort lokal anzeigen, dann mit dem Server abgleichen. */
  const patchLocal = (fn: (ls: ShoppingList[]) => ShoppingList[]) =>
    qc.setQueryData<ShoppingList[]>(["lists"], (old: ShoppingList[] | undefined) => (old ? fn(old) : old));

  const add = useMutation({
    mutationFn: (t: string) => api.addItem(active!.id, t),
    onSettled: refresh,
  });
  const toggle = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => api.updateItem(id, { done }),
    onMutate: ({ id, done }) =>
      patchLocal((ls) => ls.map((l) => ({ ...l, items: l.items.map((i) => (i.id === id ? { ...i, done } : i)) }))),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteItem(id),
    onMutate: (id) => patchLocal((ls) => ls.map((l) => ({ ...l, items: l.items.filter((i) => i.id !== id) }))),
    onSettled: refresh,
  });
  const clearDone = useMutation({ mutationFn: () => api.clearDone(active!.id), onSettled: refresh });
  const createList = useMutation({
    mutationFn: (name: string) => api.createList(name),
    onSuccess: (l) => {
      setActiveId(l.id);
      setNewList(null);
    },
    onSettled: refresh,
  });
  const deleteList = useMutation({
    mutationFn: (id: string) => api.deleteList(id),
    onSuccess: () => setActiveId(null),
    onSettled: refresh,
  });

  const submit = () => {
    const t = text.trim();
    if (!t || !active) return;
    setText("");
    add.mutate(t);
  };

  const open = active?.items.filter((i) => !i.done) ?? [];
  const done = active?.items.filter((i) => i.done) ?? [];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.tabs}>
        {all.map((l) => (
          <Chip key={l.id} label={`${l.name} · ${l.items.filter((i) => !i.done).length}`} active={l.id === active?.id} onPress={() => setActiveId(l.id)} />
        ))}
        <Chip label="+ Liste" active={false} onPress={() => setNewList("")} />
      </ScrollView>

      {newList !== null ? (
        <View style={s.addRow}>
          <View style={{ flex: 1 }}>
            <Input value={newList} onChangeText={setNewList} placeholder="Name, z. B. Drogerie" autoFocus onSubmitEditing={() => newList.trim() && createList.mutate(newList.trim())} />
          </View>
          <Button label="Anlegen" onPress={() => createList.mutate(newList.trim())} disabled={!newList.trim()} loading={createList.isPending} />
          <Button variant="ghost" label="✕" onPress={() => setNewList(null)} />
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ paddingHorizontal: theme.spacing(4), paddingBottom: theme.spacing(24), gap: theme.spacing(2) }} keyboardShouldPersistTaps="handled">
        <ErrorText error={lists.error} />
        {active ? (
          <View style={[s.addRow, { paddingHorizontal: 0 }]}>
            <View style={{ flex: 1 }}>
              <Input value={text} onChangeText={setText} placeholder="Was fehlt? z. B. Milch" onSubmitEditing={submit} returnKeyType="done" blurOnSubmit={false} maxLength={120} />
            </View>
            <Button label="+" onPress={submit} disabled={!text.trim()} />
          </View>
        ) : null}

        {active && active.items.length === 0 ? <Empty icon="◇" title="Liste ist leer" text="Alles da – oder einfach oben etwas eintragen." /> : null}

        {open.map((i) => (
          <ItemRow key={i.id} text={i.text} by={memberById(i.addedBy)?.name} done={false} onToggle={() => toggle.mutate({ id: i.id, done: true })} onDelete={() => remove.mutate(i.id)} />
        ))}

        {done.length > 0 ? (
          <>
            <View style={s.doneHeader}>
              <Text style={s.doneLabel}>Erledigt · {done.length}</Text>
              <Text style={s.clear} onPress={() => clearDone.mutate()}>
                Erledigte entfernen
              </Text>
            </View>
            {done.map((i) => (
              <ItemRow key={i.id} text={i.text} done onToggle={() => toggle.mutate({ id: i.id, done: false })} onDelete={() => remove.mutate(i.id)} />
            ))}
          </>
        ) : null}

        {active && all.length > 1 ? (
          <Text style={[s.clear, { textAlign: "center", marginTop: theme.spacing(8), color: c.textFaint }]} onPress={() => confirmAction("Liste löschen?", `„${active.name}“ und alle Einträge werden für alle gelöscht.`, "Löschen", () => deleteList.mutate(active.id))}>
            Liste „{active.name}“ löschen
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ItemRow({ text, by, done, onToggle, onDelete }: { text: string; by?: string; done: boolean; onToggle: () => void; onDelete: () => void }) {
  return (
    <Card style={s.item}>
      <Pressable onPress={onToggle} style={s.itemMain} accessibilityRole="checkbox" accessibilityState={{ checked: done }}>
        <View style={[s.check, done && s.checkOn]}>{done ? <Text style={s.checkMark}>✓</Text> : null}</View>
        <View style={{ flex: 1 }}>
          <Text style={[s.itemText, done && s.itemDone]}>{text}</Text>
          {by ? <Text style={s.itemBy}>von {by}</Text> : null}
        </View>
      </Pressable>
      <Pressable onPress={onDelete} hitSlop={10} accessibilityLabel="Eintrag löschen">
        <Text style={s.del}>✕</Text>
      </Pressable>
    </Card>
  );
}

const s = StyleSheet.create({
  segment: { flexDirection: "row", gap: 8, paddingHorizontal: theme.spacing(4), paddingBottom: theme.spacing(3) },
  tabs: { paddingHorizontal: theme.spacing(4), gap: 8, paddingBottom: theme.spacing(3) },
  addRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing(2), paddingHorizontal: theme.spacing(4), paddingBottom: theme.spacing(2) },
  item: { flexDirection: "row", alignItems: "center", paddingVertical: theme.spacing(3) },
  itemMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: theme.spacing(3) },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: c.hairlineStrong, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: c.gold, borderColor: c.gold },
  checkMark: { color: c.onGold, fontWeight: "900", fontSize: 14 },
  itemText: { color: c.text, fontSize: 16 },
  itemDone: { color: c.textFaint, textDecorationLine: "line-through" },
  itemBy: { color: c.textFaint, fontSize: 11, marginTop: 2 },
  del: { color: c.textFaint, fontSize: 16, paddingHorizontal: 6 },
  doneHeader: { flexDirection: "row", justifyContent: "space-between", marginTop: theme.spacing(5), marginBottom: theme.spacing(1) },
  doneLabel: { color: c.textMuted, fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase" },
  clear: { color: c.gold, fontSize: 13 },
});
