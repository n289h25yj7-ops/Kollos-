import { randomUUID } from "node:crypto";
import type { Express, Request } from "express";
import type { Ctx } from "../context.js";
import { HttpError, day, int, now, str } from "../http.js";
import type { PointsEntry, Repeat, Task } from "../types.js";

const REPEATS: Repeat[] = ["none", "daily", "weekly"];
const STEP: Record<Repeat, number> = { none: 0, daily: 1, weekly: 7 };

const todayStr = () => new Date().toLocaleDateString("sv-SE", { timeZone: process.env.TZ || "Europe/Berlin" });

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Naechster Termin einer wiederkehrenden Aufgabe – immer nach "heute". */
export function nextDue(due: string | undefined, repeat: Repeat, today: string): string | undefined {
  const step = STEP[repeat];
  if (!step) return due;
  let next = addDays(due ?? today, step);
  while (next <= today) next = addDays(next, step);
  return next;
}

/**
 * Aufgaben & Aemtchen mit Punkten. Erledigte Aufgaben bringen Punkte,
 * Belohnungen kosten Punkte. Alles wird als Buchung (PointsEntry) gefuehrt,
 * damit der Kontostand jederzeit nachvollziehbar ist.
 */
export function registerTasks(app: Express, ctx: Ctx) {
  const { db, auth, me, changed, notify } = ctx;

  const familyMember = (familyId: string, id: unknown, field: string) => {
    if (id === undefined || id === null || id === "") return undefined;
    const m = db.members.find((x) => x.id === id && x.familyId === familyId);
    if (!m) throw new HttpError(400, `Feld "${field}": unbekanntes Familienmitglied.`);
    return m;
  };

  const ownTask = (req: Request) => {
    const t = db.tasks.find((x) => x.id === req.params.id && x.familyId === me(req).familyId);
    if (!t) throw new HttpError(404, "Aufgabe nicht gefunden.");
    return t;
  };

  const readTask = (body: Record<string, unknown>, familyId: string, partial: boolean): Partial<Task> => {
    const out: Partial<Task> = {};
    if (!partial || body.title !== undefined) out.title = str(body.title, "title", { max: 120 });
    if (!partial || body.points !== undefined) out.points = int(body.points ?? 10, "points", { min: 0, max: 1000 });
    if (body.assigneeId !== undefined) out.assigneeId = familyMember(familyId, body.assigneeId, "assigneeId")?.id;
    if (body.due !== undefined) out.due = day(body.due, "due", true);
    if (body.repeat !== undefined) {
      if (!REPEATS.includes(body.repeat as Repeat)) throw new HttpError(400, `Feld "repeat" muss none, daily oder weekly sein.`);
      out.repeat = body.repeat as Repeat;
    }
    return out;
  };

  app.get("/tasks", auth, (req, res) => {
    const familyId = me(req).familyId;
    res.json(db.tasks.filter((t) => t.familyId === familyId));
  });

  app.post("/tasks", auth, (req, res) => {
    const m = me(req);
    const data = readTask(req.body ?? {}, m.familyId, false);
    const task: Task = {
      id: randomUUID(),
      familyId: m.familyId,
      title: data.title!,
      assigneeId: data.assigneeId,
      points: data.points!,
      due: data.due,
      repeat: data.repeat ?? "none",
      done: false,
      createdBy: m.id,
      createdAt: now(),
    };
    db.tasks.push(task);
    changed(m.familyId, "tasks");
    if (task.assigneeId && task.assigneeId !== m.id) {
      notify(m.familyId, {
        only: [task.assigneeId],
        title: "✅ Neue Aufgabe für dich",
        body: `${task.title} (+${task.points} Punkte) – von ${m.name}`,
        data: { tab: "tasks" },
      });
    }
    res.status(201).json(task);
  });

  app.patch("/tasks/:id", auth, (req, res) => {
    const t = ownTask(req);
    Object.assign(t, readTask(req.body ?? {}, t.familyId, true));
    changed(t.familyId, "tasks");
    res.json(t);
  });

  app.delete("/tasks/:id", auth, (req, res) => {
    const t = ownTask(req);
    db.tasks.splice(db.tasks.indexOf(t), 1);
    changed(t.familyId, "tasks");
    res.status(204).end();
  });

  /** Erledigen: Punkte gehen an `memberId` (z. B. Eltern haken fuer ein Kind ab) oder an mich. */
  app.post("/tasks/:id/complete", auth, (req, res) => {
    const m = me(req);
    const t = ownTask(req);
    if (t.repeat === "none" && t.done) throw new HttpError(409, "Aufgabe ist schon erledigt.");
    const who = familyMember(t.familyId, req.body?.memberId, "memberId") ?? m;
    const today = day(req.body?.today, "today", true) ?? todayStr();
    const entry: PointsEntry = { id: randomUUID(), familyId: t.familyId, memberId: who.id, points: t.points, kind: "task", refId: t.id, title: t.title, at: now() };
    db.points.push(entry);
    if (t.repeat === "none") t.done = true;
    else t.due = nextDue(t.due, t.repeat, today);
    changed(t.familyId, "tasks");
    notify(t.familyId, { except: m.id, title: "🎉 Erledigt", body: `${who.name}: ${t.title}${t.points ? ` (+${t.points})` : ""}`, data: { tab: "tasks" } });
    res.json({ task: t, entry });
  });

  /** Rueckgaengig (nur einmalige Aufgaben): letzte Buchung zur Aufgabe wird storniert. */
  app.post("/tasks/:id/uncomplete", auth, (req, res) => {
    const t = ownTask(req);
    if (t.repeat !== "none" || !t.done) throw new HttpError(409, "Nichts rückgängig zu machen.");
    const idx = db.points.findLastIndex((p) => p.kind === "task" && p.refId === t.id);
    if (idx >= 0) db.points.splice(idx, 1);
    t.done = false;
    changed(t.familyId, "tasks");
    res.json(t);
  });

  // ---------- Punkte & Belohnungen ----------
  const balances = (familyId: string) => {
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    return db.members
      .filter((x) => x.familyId === familyId)
      .map((x) => {
        const entries = db.points.filter((p) => p.memberId === x.id);
        const earned = entries.filter((p) => p.points > 0).reduce((s, p) => s + p.points, 0);
        const spent = -entries.filter((p) => p.points < 0).reduce((s, p) => s + p.points, 0);
        const week = entries.filter((p) => p.points > 0 && p.at >= weekAgo).reduce((s, p) => s + p.points, 0);
        return { memberId: x.id, earned, spent, balance: earned - spent, week };
      });
  };

  app.get("/points", auth, (req, res) => {
    const familyId = me(req).familyId;
    const history = db.points.filter((p) => p.familyId === familyId).slice(-40).reverse();
    res.json({ balances: balances(familyId), history });
  });

  app.get("/rewards", auth, (req, res) => {
    const familyId = me(req).familyId;
    res.json(db.rewards.filter((r) => r.familyId === familyId).sort((a, b) => a.cost - b.cost));
  });

  app.post("/rewards", auth, (req, res) => {
    const m = me(req);
    const reward = {
      id: randomUUID(),
      familyId: m.familyId,
      title: str(req.body?.title, "title", { max: 80 })!,
      cost: int(req.body?.cost, "cost", { min: 1, max: 100_000 }),
      createdAt: now(),
    };
    db.rewards.push(reward);
    changed(m.familyId, "tasks");
    res.status(201).json(reward);
  });

  const ownReward = (req: Request) => {
    const r = db.rewards.find((x) => x.id === req.params.id && x.familyId === me(req).familyId);
    if (!r) throw new HttpError(404, "Belohnung nicht gefunden.");
    return r;
  };

  app.delete("/rewards/:id", auth, (req, res) => {
    const r = ownReward(req);
    db.rewards.splice(db.rewards.indexOf(r), 1);
    changed(r.familyId, "tasks");
    res.status(204).end();
  });

  app.post("/rewards/:id/redeem", auth, (req, res) => {
    const m = me(req);
    const r = ownReward(req);
    const who = familyMember(r.familyId, req.body?.memberId, "memberId") ?? m;
    const balance = balances(r.familyId).find((b) => b.memberId === who.id)?.balance ?? 0;
    if (balance < r.cost) throw new HttpError(409, `${who.name} hat nur ${balance} von ${r.cost} Punkten.`);
    const entry: PointsEntry = { id: randomUUID(), familyId: r.familyId, memberId: who.id, points: -r.cost, kind: "reward", refId: r.id, title: r.title, at: now() };
    db.points.push(entry);
    changed(r.familyId, "tasks");
    notify(r.familyId, { except: m.id, title: "🎁 Belohnung eingelöst", body: `${who.name}: ${r.title} (−${r.cost})`, data: { tab: "tasks" } });
    res.status(201).json(entry);
  });
}
