import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "../session";
import { brandFont, theme } from "../theme";
import type { Meal, Recipe } from "../types";
import { Avatar, Button, Card, Chip, ErrorText, Input, Label, Sheet } from "../components/ui";
import { confirmAction } from "../components/confirm";
import { MONTHS, WEEKDAYS_SHORT, addDays, dayKey, startOfDay } from "../format";

const c = theme.colors;

const mondayOf = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));

/** Wochen-Essensplan + Rezepte; Zutaten wandern mit einem Tipp auf die Einkaufsliste. */
export function MealPlan() {
  const { api, memberById } = useSession();
  const qc = useQueryClient();
  const [week, setWeek] = useState(() => mondayOf(new Date()));
  const [editingDay, setEditingDay] = useState<Date | null>(null);
  const [recipe, setRecipe] = useState<Recipe | "new" | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week]);
  const from = dayKey(days[0]!);
  const to = dayKey(days[6]!);
  const meals = useQuery({ queryKey: ["meals", "plan", from], queryFn: () => api.meals(from, to) });
  const recipes = useQuery({ queryKey: ["meals", "recipes"], queryFn: api.recipes });
  const byDate = new Map((meals.data ?? []).map((m) => [m.date, m]));
  const today = dayKey(new Date());
  const thisWeek = dayKey(mondayOf(new Date())) === from;

  const toShopping = useMutation({
    mutationFn: () => api.mealsToShopping(today > from ? today : from, to),
    onSuccess: (r) => {
      setResult(
        r.added.length
          ? `${r.added.length} ${r.added.length === 1 ? "Zutat" : "Zutaten"} auf „${r.listName}“ gesetzt${r.skipped ? ` · ${r.skipped} standen schon drauf` : ""} 🛒`
          : r.skipped
            ? "Alles schon auf der Einkaufsliste 👍"
            : "Keine Zutaten gefunden – plane Gerichte aus euren Rezepten.",
      );
      void qc.invalidateQueries({ queryKey: ["lists"] });
    },
  });

  const label = `${days[0]!.getDate()}. ${days[0]!.getMonth() !== days[6]!.getMonth() ? MONTHS[days[0]!.getMonth()]!.slice(0, 3) + ". " : ""}– ${days[6]!.getDate()}. ${MONTHS[days[6]!.getMonth()]}`;

  return (
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <View style={s.nav}>
        <Button
          small
          variant="ghost"
          label="‹"
          onPress={() => {
            setWeek(addDays(week, -7));
            setResult(null);
          }}
        />
        <Text style={s.week}>{thisWeek ? "Diese Woche" : label}</Text>
        <Button
          small
          variant="ghost"
          label="›"
          onPress={() => {
            setWeek(addDays(week, 7));
            setResult(null);
          }}
        />
      </View>
      <ErrorText error={meals.error ?? toShopping.error} />

      {days.map((d, i) => {
        const key = dayKey(d);
        const meal = byDate.get(key);
        const cook = memberById(meal?.cookId ?? "");
        const isToday = key === today;
        return (
          <Pressable
            key={key}
            onPress={() => setEditingDay(d)}
            accessibilityRole="button"
            accessibilityLabel={`${WEEKDAYS_SHORT[i]} ${d.getDate()}.: ${meal?.title ?? "nichts geplant"}`}
          >
            <Card style={[s.day, isToday && { borderColor: c.gold }, key < today && { opacity: 0.55 }]}>
              <View style={s.dayLabel}>
                <Text style={[s.weekday, isToday && { color: c.gold }]}>{WEEKDAYS_SHORT[i]}</Text>
                <Text style={s.date}>{d.getDate()}.</Text>
              </View>
              <View style={{ flex: 1 }}>
                {meal ? <Text style={s.meal}>{meal.title}</Text> : <Text style={s.empty}>+ Gericht planen</Text>}
                {cook ? <Text style={s.cook}>kocht: {cook.name}</Text> : null}
              </View>
              {cook ? <Avatar member={cook} size={28} /> : null}
            </Card>
          </Pressable>
        );
      })}

      <Button
        label="🛒 Zutaten auf die Einkaufsliste"
        onPress={() => toShopping.mutate()}
        loading={toShopping.isPending}
        disabled={!byDate.size}
      />
      {result ? <Text style={s.result}>{result}</Text> : null}
      <Text style={s.hint}>
        Übernimmt die Zutaten der geplanten Gerichte ab heute – was schon auf der Liste steht, kommt nicht doppelt drauf.
      </Text>

      <View style={s.recipesHeader}>
        <Label>Eure Rezepte · {recipes.data?.length ?? 0}</Label>
        <Button small variant="ghost" label="+ Rezept" onPress={() => setRecipe("new")} />
      </View>
      <View style={s.recipes}>
        {(recipes.data ?? []).map((r) => (
          <Pressable key={r.id} onPress={() => setRecipe(r)} style={s.recipe} accessibilityRole="button">
            <Text style={s.recipeName} numberOfLines={2}>
              {r.name}
            </Text>
            <Text style={s.cook}>{r.ingredients.length} Zutaten</Text>
          </Pressable>
        ))}
      </View>

      {editingDay ? (
        <MealSheet
          date={editingDay}
          meal={byDate.get(dayKey(editingDay))}
          recipes={recipes.data ?? []}
          onClose={() => setEditingDay(null)}
        />
      ) : null}
      {recipe ? <RecipeSheet recipe={recipe === "new" ? undefined : recipe} onClose={() => setRecipe(null)} /> : null}
    </ScrollView>
  );
}

function MealSheet({ date, meal, recipes, onClose }: { date: Date; meal?: Meal; recipes: Recipe[]; onClose: () => void }) {
  const { api, members } = useSession();
  const qc = useQueryClient();
  const [recipeId, setRecipeId] = useState<string | undefined>(meal?.recipeId);
  const [title, setTitle] = useState(meal && !meal.recipeId ? meal.title : "");
  const [cookId, setCookId] = useState<string | undefined>(meal?.cookId);
  const key = dayKey(date);
  const done = () => {
    void qc.invalidateQueries({ queryKey: ["meals"] });
    onClose();
  };
  const save = useMutation({
    mutationFn: () => api.setMeal(key, recipeId ? { recipeId, cookId } : { title: title.trim(), cookId }),
    onSuccess: done,
  });
  const clear = useMutation({ mutationFn: () => api.clearMeal(key), onSuccess: done });
  const wd = date.toLocaleDateString("de-DE", { weekday: "long" });

  return (
    <Sheet eyebrow="Essensplan" title={`${wd}, ${date.getDate()}. ${MONTHS[date.getMonth()]}`} onClose={onClose}>
      <Label>Aus euren Rezepten</Label>
      <View style={s.chips}>
        {recipes.map((r) => (
          <Chip
            key={r.id}
            label={r.name}
            active={recipeId === r.id}
            onPress={() => {
              setRecipeId(recipeId === r.id ? undefined : r.id);
              setTitle("");
            }}
          />
        ))}
      </View>
      <Input
        label="Oder etwas anderes"
        value={title}
        onChangeText={(t) => {
          setTitle(t);
          if (t) setRecipeId(undefined);
        }}
        placeholder="z. B. Reste essen, Grillen, Pizza bestellen"
        maxLength={80}
      />
      <Label>Wer kocht?</Label>
      <View style={s.chips}>
        <Chip label="Offen" active={!cookId} onPress={() => setCookId(undefined)} />
        {members.map((m) => (
          <Chip key={m.id} label={m.name} color={m.color} active={cookId === m.id} onPress={() => setCookId(m.id)} />
        ))}
      </View>
      <ErrorText error={save.error ?? clear.error} />
      <Button label="Speichern" onPress={() => save.mutate()} disabled={!recipeId && !title.trim()} loading={save.isPending} />
      <View style={{ flexDirection: "row", gap: theme.spacing(3) }}>
        <Button style={{ flex: 1 }} variant="ghost" label="Abbrechen" onPress={onClose} />
        {meal ? (
          <Button style={{ flex: 1 }} variant="danger" label="Entfernen" onPress={() => clear.mutate()} loading={clear.isPending} />
        ) : null}
      </View>
    </Sheet>
  );
}

function RecipeSheet({ recipe, onClose }: { recipe?: Recipe; onClose: () => void }) {
  const { api } = useSession();
  const qc = useQueryClient();
  const [name, setName] = useState(recipe?.name ?? "");
  const [ingredients, setIngredients] = useState(recipe?.ingredients.join("\n") ?? "");
  const [notes, setNotes] = useState(recipe?.notes ?? "");
  const list = ingredients
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  const done = () => {
    void qc.invalidateQueries({ queryKey: ["meals"] });
    onClose();
  };
  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), ingredients: list, notes: notes.trim() };
      return recipe ? api.updateRecipe(recipe.id, body) : api.createRecipe(body);
    },
    onSuccess: done,
  });
  const remove = useMutation({ mutationFn: () => api.deleteRecipe(recipe!.id), onSuccess: done });

  return (
    <Sheet eyebrow={recipe ? "Rezept" : "Neues Rezept"} onClose={onClose}>
      <Input label="Name" value={name} onChangeText={setName} placeholder="z. B. Omas Kartoffelsuppe" maxLength={80} autoFocus={!recipe} />
      <Input
        label={`Zutaten · ${list.length} (eine pro Zeile)`}
        value={ingredients}
        onChangeText={setIngredients}
        placeholder={"Kartoffeln\nMöhren\nLauch\nWürstchen"}
        multiline
        style={{ minHeight: 140, paddingTop: 12, textAlignVertical: "top" }}
      />
      <Input
        label="Notiz"
        value={notes}
        onChangeText={setNotes}
        placeholder="Zubereitung, Tipps, Quelle …"
        multiline
        style={{ minHeight: 70, paddingTop: 12 }}
        maxLength={2000}
      />
      <ErrorText error={save.error ?? remove.error} />
      <Button label="Speichern" onPress={() => save.mutate()} disabled={!name.trim()} loading={save.isPending} />
      <View style={{ flexDirection: "row", gap: theme.spacing(3) }}>
        <Button style={{ flex: 1 }} variant="ghost" label="Abbrechen" onPress={onClose} />
        {recipe ? (
          <Button
            style={{ flex: 1 }}
            variant="danger"
            label="Löschen"
            onPress={() => confirmAction("Rezept löschen?", `„${recipe.name}“ wird für alle gelöscht.`, "Löschen", () => remove.mutate())}
            loading={remove.isPending}
          />
        ) : null}
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: theme.spacing(4), paddingBottom: theme.spacing(24), gap: theme.spacing(2.5) },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: theme.spacing(1) },
  week: { color: c.text, fontSize: 16, fontWeight: "600" },
  day: { flexDirection: "row", alignItems: "center", gap: theme.spacing(3.5), paddingVertical: theme.spacing(3) },
  dayLabel: { width: 34, alignItems: "center" },
  weekday: { color: c.textMuted, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" },
  date: { color: c.text, fontSize: 17, fontWeight: "700" },
  meal: { color: c.text, fontSize: 16, fontFamily: brandFont },
  empty: { color: c.textFaint, fontSize: 15 },
  cook: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  result: { color: c.sage, fontSize: 14, textAlign: "center" },
  hint: { color: c.textFaint, fontSize: 12, lineHeight: 17, textAlign: "center", paddingHorizontal: theme.spacing(4) },
  recipesHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: theme.spacing(5) },
  recipes: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing(2) },
  recipe: {
    width: "48.5%",
    backgroundColor: c.surface,
    borderRadius: theme.radiusSm,
    borderWidth: 1,
    borderColor: c.hairline,
    padding: theme.spacing(3),
    minHeight: 74,
  },
  recipeName: { color: c.text, fontSize: 15, fontFamily: brandFont },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
