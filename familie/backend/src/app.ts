import { randomBytes, randomUUID } from "node:crypto";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import type { Store } from "./store.js";
import type { CalendarEvent, Member, MemberRecord, Topic } from "./types.js";

export type Broadcast = (familyId: string, topic: Topic) => void;

const COLORS = ["#c9a86a", "#8fbf9f", "#8098c9", "#c98a8a", "#b48fc9", "#c9b86a", "#6ab8c9", "#c9906a"];
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ohne 0/O/1/I
const MAX_MESSAGES = 5000;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const now = () => new Date().toISOString();

function inviteCode(): string {
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

function publicMember({ token: _token, ...m }: MemberRecord): Member {
  return m;
}

function str(value: unknown, field: string, { max = 500, optional = false } = {}): string | undefined {
  if (value === undefined || value === null || value === "") {
    if (optional) return undefined;
    throw new HttpError(400, `Feld "${field}" fehlt.`);
  }
  if (typeof value !== "string") throw new HttpError(400, `Feld "${field}" muss Text sein.`);
  const trimmed = value.trim();
  if (!trimmed && !optional) throw new HttpError(400, `Feld "${field}" darf nicht leer sein.`);
  if (trimmed.length > max) throw new HttpError(400, `Feld "${field}" ist zu lang (max. ${max}).`);
  return trimmed || undefined;
}

function isoDate(value: unknown, field: string, optional = false): string | undefined {
  const s = str(value, field, { max: 40, optional });
  if (s === undefined) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, `Feld "${field}" ist kein gueltiges Datum.`);
  return d.toISOString();
}

type Authed = Request & { member: MemberRecord };

export function createApp(store: Store, broadcast: Broadcast) {
  const { db } = store;
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "100kb" }));

  const findMemberByToken = (token: string | undefined) =>
    token ? db.members.find((m) => m.token === token) : undefined;

  const auth = (req: Request, _res: Response, next: NextFunction) => {
    const header = req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : undefined;
    const member = findMemberByToken(token);
    if (!member) return next(new HttpError(401, "Nicht angemeldet."));
    (req as Authed).member = member;
    next();
  };

  const me = (req: Request) => (req as Authed).member;

  const changed = (familyId: string, topic: Topic) => {
    store.save();
    broadcast(familyId, topic);
  };

  const addMember = (familyId: string, name: string): MemberRecord => {
    const used = db.members.filter((m) => m.familyId === familyId).length;
    const member: MemberRecord = {
      id: randomUUID(),
      familyId,
      name,
      color: COLORS[used % COLORS.length]!,
      token: randomBytes(24).toString("hex"),
      createdAt: now(),
    };
    db.members.push(member);
    return member;
  };

  const session = (member: MemberRecord) => {
    const family = db.families.find((f) => f.id === member.familyId)!;
    return {
      token: member.token,
      member: publicMember(member),
      family,
      members: db.members.filter((m) => m.familyId === family.id).map(publicMember),
    };
  };

  // ---------- Allgemein ----------
  app.get("/health", (_req, res) => res.json({ ok: true, app: "familie" }));

  // ---------- Familie & Mitglieder ----------
  app.post("/families", (req, res) => {
    const familyName = str(req.body?.familyName, "familyName", { max: 60 })!;
    const memberName = str(req.body?.memberName, "memberName", { max: 40 })!;
    const family = { id: randomUUID(), name: familyName, inviteCode: inviteCode(), createdAt: now() };
    db.families.push(family);
    const member = addMember(family.id, memberName);
    // Eine Start-Einkaufsliste, damit der Tab nicht leer ist.
    db.lists.push({ id: randomUUID(), familyId: family.id, name: "Einkauf", createdAt: now() });
    store.save();
    res.status(201).json(session(member));
  });

  app.post("/families/join", (req, res) => {
    const code = str(req.body?.inviteCode, "inviteCode", { max: 12 })!.toUpperCase().replace(/\s+/g, "");
    const memberName = str(req.body?.memberName, "memberName", { max: 40 })!;
    const family = db.families.find((f) => f.inviteCode === code);
    if (!family) throw new HttpError(404, "Einladungscode unbekannt.");
    const member = addMember(family.id, memberName);
    changed(family.id, "members");
    res.status(201).json(session(member));
  });

  app.get("/me", auth, (req, res) => res.json(session(me(req))));

  app.patch("/me", auth, (req, res) => {
    const m = me(req);
    const name = str(req.body?.name, "name", { max: 40, optional: true });
    if (name) m.name = name;
    if (typeof req.body?.color === "string" && /^#[0-9a-f]{6}$/i.test(req.body.color)) m.color = req.body.color;
    changed(m.familyId, "members");
    res.json(session(m));
  });

  /** Familie verlassen: Mitglied und dessen Standort werden geloescht. */
  app.delete("/me", auth, (req, res) => {
    const m = me(req);
    db.members.splice(db.members.indexOf(m), 1);
    db.locations = db.locations.filter((l) => l.memberId !== m.id);
    changed(m.familyId, "members");
    broadcast(m.familyId, "locations");
    res.status(204).end();
  });

  app.post("/family/invite-code", auth, (req, res) => {
    const family = db.families.find((f) => f.id === me(req).familyId)!;
    family.inviteCode = inviteCode();
    changed(family.id, "members");
    res.json(family);
  });

  // ---------- Kalender ----------
  const readEvent = (body: Record<string, unknown>, familyId: string, partial: boolean) => {
    const out: Partial<CalendarEvent> = {};
    if (!partial || body.title !== undefined) out.title = str(body.title, "title", { max: 120 });
    if (!partial || body.start !== undefined) out.start = isoDate(body.start, "start");
    if (body.end !== undefined) out.end = isoDate(body.end, "end", true);
    if (body.allDay !== undefined) out.allDay = Boolean(body.allDay);
    if (body.notes !== undefined) out.notes = str(body.notes, "notes", { max: 2000, optional: true });
    if (body.memberIds !== undefined) {
      if (!Array.isArray(body.memberIds)) throw new HttpError(400, `Feld "memberIds" muss eine Liste sein.`);
      const valid = new Set(db.members.filter((m) => m.familyId === familyId).map((m) => m.id));
      out.memberIds = body.memberIds.filter((id): id is string => typeof id === "string" && valid.has(id));
    }
    return out;
  };

  app.get("/events", auth, (req, res) => {
    const familyId = me(req).familyId;
    const from = isoDate(req.query.from, "from", true);
    const to = isoDate(req.query.to, "to", true);
    const events = db.events
      .filter((e) => e.familyId === familyId)
      .filter((e) => !from || (e.end ?? e.start) >= from)
      .filter((e) => !to || e.start <= to)
      .sort((a, b) => a.start.localeCompare(b.start));
    res.json(events);
  });

  app.post("/events", auth, (req, res) => {
    const m = me(req);
    const data = readEvent(req.body ?? {}, m.familyId, false);
    const event: CalendarEvent = {
      id: randomUUID(),
      familyId: m.familyId,
      title: data.title!,
      start: data.start!,
      end: data.end,
      allDay: data.allDay ?? false,
      notes: data.notes,
      memberIds: data.memberIds ?? [],
      createdBy: m.id,
      createdAt: now(),
    };
    if (event.end && event.end < event.start) throw new HttpError(400, "Ende liegt vor dem Beginn.");
    db.events.push(event);
    changed(m.familyId, "events");
    res.status(201).json(event);
  });

  const ownEvent = (req: Request) => {
    const e = db.events.find((x) => x.id === req.params.id && x.familyId === me(req).familyId);
    if (!e) throw new HttpError(404, "Termin nicht gefunden.");
    return e;
  };

  app.patch("/events/:id", auth, (req, res) => {
    const e = ownEvent(req);
    Object.assign(e, readEvent(req.body ?? {}, e.familyId, true));
    if (e.end && e.end < e.start) throw new HttpError(400, "Ende liegt vor dem Beginn.");
    changed(e.familyId, "events");
    res.json(e);
  });

  app.delete("/events/:id", auth, (req, res) => {
    const e = ownEvent(req);
    db.events.splice(db.events.indexOf(e), 1);
    changed(e.familyId, "events");
    res.status(204).end();
  });

  // ---------- Einkaufslisten ----------
  app.get("/lists", auth, (req, res) => {
    const familyId = me(req).familyId;
    const lists = db.lists
      .filter((l) => l.familyId === familyId)
      .map((l) => ({ ...l, items: db.items.filter((i) => i.listId === l.id) }));
    res.json(lists);
  });

  app.post("/lists", auth, (req, res) => {
    const m = me(req);
    const list = { id: randomUUID(), familyId: m.familyId, name: str(req.body?.name, "name", { max: 60 })!, createdAt: now() };
    db.lists.push(list);
    changed(m.familyId, "lists");
    res.status(201).json({ ...list, items: [] });
  });

  const ownList = (req: Request, id = req.params.id) => {
    const l = db.lists.find((x) => x.id === id && x.familyId === me(req).familyId);
    if (!l) throw new HttpError(404, "Liste nicht gefunden.");
    return l;
  };

  app.patch("/lists/:id", auth, (req, res) => {
    const l = ownList(req);
    l.name = str(req.body?.name, "name", { max: 60 })!;
    changed(l.familyId, "lists");
    res.json(l);
  });

  app.delete("/lists/:id", auth, (req, res) => {
    const l = ownList(req);
    db.lists.splice(db.lists.indexOf(l), 1);
    db.items = db.items.filter((i) => i.listId !== l.id);
    changed(l.familyId, "lists");
    res.status(204).end();
  });

  app.post("/lists/:id/items", auth, (req, res) => {
    const l = ownList(req);
    const item = {
      id: randomUUID(),
      familyId: l.familyId,
      listId: l.id,
      text: str(req.body?.text, "text", { max: 120 })!,
      done: false,
      addedBy: me(req).id,
      createdAt: now(),
    };
    db.items.push(item);
    changed(l.familyId, "lists");
    res.status(201).json(item);
  });

  /** Erledigte Eintraege einer Liste entfernen. */
  app.post("/lists/:id/clear-done", auth, (req, res) => {
    const l = ownList(req);
    db.items = db.items.filter((i) => i.listId !== l.id || !i.done);
    changed(l.familyId, "lists");
    res.status(204).end();
  });

  const ownItem = (req: Request) => {
    const i = db.items.find((x) => x.id === req.params.id && x.familyId === me(req).familyId);
    if (!i) throw new HttpError(404, "Eintrag nicht gefunden.");
    return i;
  };

  app.patch("/items/:id", auth, (req, res) => {
    const i = ownItem(req);
    if (req.body?.done !== undefined) i.done = Boolean(req.body.done);
    if (req.body?.text !== undefined) i.text = str(req.body.text, "text", { max: 120 })!;
    changed(i.familyId, "lists");
    res.json(i);
  });

  app.delete("/items/:id", auth, (req, res) => {
    const i = ownItem(req);
    db.items.splice(db.items.indexOf(i), 1);
    changed(i.familyId, "lists");
    res.status(204).end();
  });

  // ---------- Chat ----------
  app.get("/messages", auth, (req, res) => {
    const familyId = me(req).familyId;
    const limit = Math.min(Number(req.query.limit) || 100, 300);
    const all = db.messages.filter((m) => m.familyId === familyId);
    res.json(all.slice(-limit));
  });

  app.post("/messages", auth, (req, res) => {
    const m = me(req);
    const msg = { id: randomUUID(), familyId: m.familyId, memberId: m.id, text: str(req.body?.text, "text", { max: 2000 })!, createdAt: now() };
    db.messages.push(msg);
    if (db.messages.length > MAX_MESSAGES) db.messages.splice(0, db.messages.length - MAX_MESSAGES);
    changed(m.familyId, "messages");
    res.status(201).json(msg);
  });

  // ---------- Standort ----------
  app.get("/locations", auth, (req, res) => {
    const familyId = me(req).familyId;
    res.json(db.locations.filter((l) => l.familyId === familyId));
  });

  app.put("/locations/me", auth, (req, res) => {
    const m = me(req);
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new HttpError(400, "Ungueltige Koordinaten.");
    }
    const accuracy = Number.isFinite(Number(req.body?.accuracy)) ? Number(req.body.accuracy) : undefined;
    const loc = { memberId: m.id, familyId: m.familyId, lat, lng, accuracy, updatedAt: now() };
    db.locations = db.locations.filter((l) => l.memberId !== m.id);
    db.locations.push(loc);
    changed(m.familyId, "locations");
    res.json(loc);
  });

  /** Standort-Teilen beenden: letzter Standort wird geloescht. */
  app.delete("/locations/me", auth, (req, res) => {
    const m = me(req);
    db.locations = db.locations.filter((l) => l.memberId !== m.id);
    changed(m.familyId, "locations");
    res.status(204).end();
  });

  // ---------- Fehlerbehandlung ----------
  app.use((_req, _res, next) => next(new HttpError(404, "Route nicht gefunden.")));
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err instanceof SyntaxError) return res.status(400).json({ error: "Ungueltiges JSON." });
    console.error(err);
    res.status(500).json({ error: "Interner Fehler." });
  });

  return { app, findMemberByToken };
}
