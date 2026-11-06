import { randomUUID } from "node:crypto";
import type { Express, Request } from "express";
import type { Ctx } from "../context.js";
import { HttpError, now, str } from "../http.js";

/** Prueft "MM-DD" (29. Februar ist erlaubt). */
function monthDay(value: unknown): string {
  const s = typeof value === "string" ? value.trim() : "";
  const m = s.match(/^(\d{2})-(\d{2})$/);
  const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (!m || Number(m[1]) < 1 || Number(m[1]) > 12 || Number(m[2]) < 1 || Number(m[2]) > days[Number(m[1]) - 1]!) {
    throw new HttpError(400, `Feld "date" muss Monat-Tag sein, z. B. 03-21.`);
  }
  return s;
}

function year(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const y = Number(value);
  if (!Number.isInteger(y) || y < 1900 || y > new Date().getFullYear()) throw new HttpError(400, `Feld "year" ist ungueltig.`);
  return y;
}

/** Geburtstage & Jahrestage; Kalender und Erinnerungen berechnet die App. */
export function registerBirthdays(app: Express, ctx: Ctx) {
  const { db, auth, me, changed } = ctx;

  const own = (req: Request) => {
    const b = db.birthdays.find((x) => x.id === req.params.id && x.familyId === me(req).familyId);
    if (!b) throw new HttpError(404, "Geburtstag nicht gefunden.");
    return b;
  };

  app.get("/birthdays", auth, (req, res) => {
    const familyId = me(req).familyId;
    res.json(db.birthdays.filter((b) => b.familyId === familyId).sort((a, b) => a.date.localeCompare(b.date)));
  });

  app.post("/birthdays", auth, (req, res) => {
    const m = me(req);
    const b = {
      id: randomUUID(),
      familyId: m.familyId,
      name: str(req.body?.name, "name", { max: 60 })!,
      date: monthDay(req.body?.date),
      year: year(req.body?.year),
      createdAt: now(),
    };
    db.birthdays.push(b);
    changed(m.familyId, "birthdays");
    res.status(201).json(b);
  });

  app.patch("/birthdays/:id", auth, (req, res) => {
    const b = own(req);
    if (req.body?.name !== undefined) b.name = str(req.body.name, "name", { max: 60 })!;
    if (req.body?.date !== undefined) b.date = monthDay(req.body.date);
    if (req.body?.year !== undefined) b.year = year(req.body.year);
    changed(b.familyId, "birthdays");
    res.json(b);
  });

  app.delete("/birthdays/:id", auth, (req, res) => {
    const b = own(req);
    db.birthdays.splice(db.birthdays.indexOf(b), 1);
    changed(b.familyId, "birthdays");
    res.status(204).end();
  });
}
