import { randomUUID } from "node:crypto";
import type { Express, Request } from "express";
import type { Ctx } from "../context.js";
import { HttpError, day, now, str } from "../http.js";
import type { Database, Meal } from "../types.js";

const STARTER: [string, string[]][] = [
  ["Spaghetti Bolognese", ["Spaghetti", "Hackfleisch", "Passierte Tomaten", "Zwiebeln", "Möhren", "Parmesan"]],
  ["Pfannkuchen", ["Mehl", "Milch", "Eier", "Apfelmus"]],
  ["Pizza", ["Pizzateig", "Tomatensoße", "Mozzarella", "Salami", "Paprika"]],
  ["Gemüsecurry mit Reis", ["Reis", "Kokosmilch", "Currypaste", "Brokkoli", "Paprika", "Kichererbsen"]],
  ["Fischstäbchen mit Kartoffelpüree", ["Fischstäbchen", "Kartoffeln", "Milch", "Butter", "Erbsen"]],
];

/** Ein paar Lieblingsrezepte, damit der Essensplan nicht leer startet. */
export function seedRecipes(db: Database, familyId: string, memberId: string) {
  for (const [name, ingredients] of STARTER) {
    db.recipes.push({ id: randomUUID(), familyId, name, ingredients, createdBy: memberId, createdAt: now() });
  }
}

/** Zutaten vergleichen, ohne dass "Milch" und " milch " als verschieden gelten. */
export const normalizeIngredient = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function ingredients(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new HttpError(400, `Feld "ingredients" muss eine Liste sein.`);
  const out = value.map((v) => (typeof v === "string" ? v.trim() : "")).filter(Boolean);
  if (out.length > 60 || out.some((v) => v.length > 80)) throw new HttpError(400, "Zu viele oder zu lange Zutaten.");
  return out;
}

/**
 * Essensplan + Rezepte. Das Besondere: "Zutaten auf die Einkaufsliste" uebertraegt
 * alle Zutaten der geplanten Gerichte – ohne Doppelte, die schon offen auf der Liste stehen.
 */
export function registerMeals(app: Express, ctx: Ctx) {
  const { db, auth, me, changed } = ctx;

  const ownRecipe = (req: Request, id = req.params.id) => {
    const r = db.recipes.find((x) => x.id === id && x.familyId === me(req).familyId);
    if (!r) throw new HttpError(404, "Rezept nicht gefunden.");
    return r;
  };

  app.get("/recipes", auth, (req, res) => {
    const familyId = me(req).familyId;
    res.json(db.recipes.filter((r) => r.familyId === familyId).sort((a, b) => a.name.localeCompare(b.name, "de")));
  });

  app.post("/recipes", auth, (req, res) => {
    const m = me(req);
    const r = {
      id: randomUUID(),
      familyId: m.familyId,
      name: str(req.body?.name, "name", { max: 80 })!,
      ingredients: ingredients(req.body?.ingredients),
      notes: str(req.body?.notes, "notes", { max: 2000, optional: true }),
      createdBy: m.id,
      createdAt: now(),
    };
    db.recipes.push(r);
    changed(m.familyId, "meals");
    res.status(201).json(r);
  });

  app.patch("/recipes/:id", auth, (req, res) => {
    const r = ownRecipe(req);
    if (req.body?.name !== undefined) r.name = str(req.body.name, "name", { max: 80 })!;
    if (req.body?.ingredients !== undefined) r.ingredients = ingredients(req.body.ingredients);
    if (req.body?.notes !== undefined) r.notes = str(req.body.notes, "notes", { max: 2000, optional: true });
    // Geplante Gerichte uebernehmen einen geaenderten Namen.
    for (const meal of db.meals) if (meal.recipeId === r.id) meal.title = r.name;
    changed(r.familyId, "meals");
    res.json(r);
  });

  app.delete("/recipes/:id", auth, (req, res) => {
    const r = ownRecipe(req);
    db.recipes.splice(db.recipes.indexOf(r), 1);
    for (const meal of db.meals) if (meal.recipeId === r.id) meal.recipeId = undefined;
    changed(r.familyId, "meals");
    res.status(204).end();
  });

  app.get("/meals", auth, (req, res) => {
    const familyId = me(req).familyId;
    const from = day(req.query.from, "from", true);
    const to = day(req.query.to, "to", true);
    res.json(
      db.meals
        .filter((x) => x.familyId === familyId && (!from || x.date >= from) && (!to || x.date <= to))
        .sort((a, b) => a.date.localeCompare(b.date)),
    );
  });

  /** Gericht fuer einen Tag setzen (ersetzt ein vorhandenes). */
  app.put("/meals/:date", auth, (req, res) => {
    const m = me(req);
    const date = day(req.params.date, "date")!;
    const recipe = req.body?.recipeId ? ownRecipe(req, String(req.body.recipeId)) : undefined;
    const title = recipe?.name ?? str(req.body?.title, "title", { max: 80 })!;
    const cookId = req.body?.cookId;
    if (cookId && !db.members.some((x) => x.id === cookId && x.familyId === m.familyId)) {
      throw new HttpError(400, `Feld "cookId": unbekanntes Familienmitglied.`);
    }
    const meal: Meal = { id: randomUUID(), familyId: m.familyId, date, title, recipeId: recipe?.id, cookId: cookId || undefined, createdBy: m.id };
    db.meals = db.meals.filter((x) => !(x.familyId === m.familyId && x.date === date));
    db.meals.push(meal);
    changed(m.familyId, "meals");
    res.json(meal);
  });

  app.delete("/meals/:date", auth, (req, res) => {
    const m = me(req);
    db.meals = db.meals.filter((x) => !(x.familyId === m.familyId && x.date === req.params.date));
    changed(m.familyId, "meals");
    res.status(204).end();
  });

  /** Zutaten aller geplanten Gerichte im Zeitraum auf eine Einkaufsliste setzen. */
  app.post("/meals/to-shopping", auth, (req, res) => {
    const m = me(req);
    const from = day(req.body?.from, "from")!;
    const to = day(req.body?.to, "to")!;
    const list = req.body?.listId
      ? db.lists.find((l) => l.id === req.body.listId && l.familyId === m.familyId)
      : db.lists.find((l) => l.familyId === m.familyId);
    if (!list) throw new HttpError(404, "Keine Einkaufsliste gefunden.");

    const open = new Set(db.items.filter((i) => i.listId === list.id && !i.done).map((i) => normalizeIngredient(i.text)));
    const added: string[] = [];
    let skipped = 0;
    for (const meal of db.meals.filter((x) => x.familyId === m.familyId && x.date >= from && x.date <= to)) {
      const recipe = db.recipes.find((r) => r.id === meal.recipeId);
      for (const ing of recipe?.ingredients ?? []) {
        const key = normalizeIngredient(ing);
        if (open.has(key)) {
          skipped++;
          continue;
        }
        open.add(key);
        added.push(ing);
        db.items.push({ id: randomUUID(), familyId: m.familyId, listId: list.id, text: ing, done: false, addedBy: m.id, createdAt: now() });
      }
    }
    if (added.length) changed(m.familyId, "lists");
    res.json({ listId: list.id, listName: list.name, added, skipped });
  });
}
