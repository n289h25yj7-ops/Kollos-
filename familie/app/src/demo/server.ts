/**
 * Demo-Modus: ein kleines "Backend im Browser". Es bildet die API des echten
 * Servers nach (gleiche Routen, gleiche Antworten), speichert alles nur auf
 * diesem Geraet und bringt eine fertig befuellte Beispiel-Familie mit.
 * Wird nur benutzt, wenn die Server-Adresse DEMO_URL ist.
 */

export const DEMO_URL = "demo://familie";
export const DEMO_CODE = "DEMO42";
const STORAGE_KEY = "familie.demo.db.v1";

export class DemoError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
interface Db {
  families: Rec[];
  members: Rec[];
  events: Rec[];
  lists: Rec[];
  items: Rec[];
  messages: Rec[];
  locations: Rec[];
  albums: Rec[];
  photos: Rec[];
  tasks: Rec[];
  points: Rec[];
  rewards: Rec[];
}

const COLORS = ["#c9a86a", "#8fbf9f", "#8098c9", "#c98a8a", "#b48fc9", "#c9b86a", "#6ab8c9", "#c9906a"];
let seq = 0;
const uid = () => `${Date.now().toString(36)}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const now = () => new Date().toISOString();
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const at = (dayOffset: number, h: number, m = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return ymd(d);
};

// ------------------------------------------------------------ Echtzeit

type Listener = (topic: string) => void;
const listeners = new Set<Listener>();
export function subscribeDemo(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const emit = (topic: string) => {
  persist();
  setTimeout(() => listeners.forEach((l) => l(topic)), 0);
};

// ------------------------------------------------------------ Speicher

let db: Db = load();

function load(): Db {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Db;
  } catch {
    // ohne Speicher geht es auch – dann eben nur bis zum Neuladen
  }
  return seed();
}

function persist() {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Speicher voll (viele Fotos) oder gesperrt: Demo laeuft im Arbeitsspeicher weiter.
  }
}

export function resetDemo() {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // egal
  }
  db = seed();
}

/** Platzhalter-Fotos als SVG (Farbverlauf + Motiv), damit keine Bilddateien noetig sind. */
function svgPhoto(a: string, b: string, emoji: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
<rect width="1200" height="900" fill="url(#g)"/>
<circle cx="930" cy="230" r="120" fill="rgba(255,255,255,0.25)"/>
<text x="600" y="470" font-size="220" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
<text x="600" y="720" font-size="64" font-family="Georgia,serif" fill="rgba(255,255,255,0.9)" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function seed(): Db {
  const d: Db = { families: [], members: [], events: [], lists: [], items: [], messages: [], locations: [], albums: [], photos: [], tasks: [], points: [], rewards: [] };
  const fam = { id: uid(), name: "Familie Muster", inviteCode: DEMO_CODE, createdAt: now() };
  d.families.push(fam);
  const mk = (name: string, i: number) => {
    const m = { id: uid(), familyId: fam.id, name, color: COLORS[i]!, token: `demo-${name}-${uid()}`, createdAt: now() };
    d.members.push(m);
    return m;
  };
  const mama = mk("Mama", 0),
    papa = mk("Papa", 1),
    leon = mk("Leon", 2),
    mia = mk("Mia", 3);
  const f = fam.id;

  const ev = (title: string, by: Rec, start: string, extra: Rec = {}) =>
    d.events.push({ id: uid(), familyId: f, title, start, allDay: false, memberIds: [], createdBy: by.id, createdAt: now(), ...extra });
  ev("Fußballtraining", mama, at(0, 17), { end: at(0, 18, 30), memberIds: [leon.id], notes: "Sportplatz Nord, Trinkflasche!" });
  ev("Elternabend", papa, at(1, 19, 30), { memberIds: [mama.id, papa.id] });
  ev("Oma Geburtstag 🎂", mama, at(3, 0), { allDay: true });
  ev("Zahnarzt", mama, at(5, 9, 15), { memberIds: [mia.id], notes: "Versichertenkarte mitnehmen" });
  ev("Schwimmkurs", papa, at(-2, 15), { end: at(-2, 16), memberIds: [mia.id] });
  ev("Grillen bei Müllers", papa, at(6, 16));
  ev("Fußballtraining", mama, at(7, 17), { end: at(7, 18, 30), memberIds: [leon.id] });

  const list = (name: string) => {
    const l = { id: uid(), familyId: f, name, createdAt: now() };
    d.lists.push(l);
    return l;
  };
  const einkauf = list("Einkauf"),
    drogerie = list("Drogerie");
  const item = (l: Rec, text: string, by: Rec, done = false) =>
    d.items.push({ id: uid(), familyId: f, listId: l.id, text, done, addedBy: by.id, createdAt: now() });
  item(einkauf, "Milch", leon);
  item(einkauf, "Brot", mama);
  item(einkauf, "Bananen", mia);
  item(einkauf, "Käse", papa);
  item(einkauf, "Pizzateig 🍕", mama);
  item(einkauf, "Tomaten", mama);
  item(einkauf, "Kaffee ☕", papa, true);
  item(drogerie, "Zahnpasta", mama);
  item(drogerie, "Sonnencreme", mama);

  const task = (title: string, points: number, extra: Rec = {}) => {
    const t = { id: uid(), familyId: f, title, points, repeat: "none", done: false, createdBy: mama.id, createdAt: now(), ...extra };
    d.tasks.push(t);
    return t;
  };
  const book = (m: Rec, points: number, kind: string, refId: string, title: string) =>
    d.points.push({ id: uid(), familyId: f, memberId: m.id, points, kind, refId, title, at: now() });
  const z = task("Zimmer aufräumen", 20, { assigneeId: leon.id, due: day(0), done: true });
  book(leon, 20, "task", z.id, z.title);
  task("Spülmaschine ausräumen", 10, { assigneeId: mia.id, repeat: "daily", due: day(0) });
  task("Müll rausbringen", 5, { repeat: "weekly", due: day(1) });
  task("Hausaufgaben Mathe", 20, { assigneeId: leon.id, due: day(1) });
  const h = task("Hasen füttern 🐰", 10, { assigneeId: mia.id, repeat: "daily", due: day(1) });
  book(mia, 10, "task", h.id, h.title);
  book(mia, 10, "task", h.id, h.title);
  task("Auto waschen", 50, { due: day(4) });
  task("Rasen mähen", 30, { assigneeId: leon.id, due: day(-1) });
  for (const [title, cost] of [["Film aussuchen", 20], ["30 Min. länger aufbleiben", 30], ["Eis essen gehen", 50], ["Freund zum Übernachten", 100]] as const) {
    d.rewards.push({ id: uid(), familyId: f, title, cost, createdAt: now() });
  }

  const msg = (m: Rec, text: string, minutesAgo: number) =>
    d.messages.push({ id: uid(), familyId: f, memberId: m.id, text, createdAt: new Date(Date.now() - minutesAgo * 60_000).toISOString() });
  msg(mama, "Wer holt heute Leon vom Training ab?", 95);
  msg(papa, "Ich mach das, bin um 18:20 da 🚗", 90);
  msg(leon, "Danke Papa!", 88);
  msg(mia, "Können wir heute Pizza machen? 🍕", 40);
  msg(mama, "Gute Idee – steht schon auf der Einkaufsliste 😉", 35);

  const album = (name: string, by: Rec, photos: [string, string, string, string, string?][]) => {
    const a = { id: uid(), familyId: f, name, createdBy: by.id, createdAt: now() };
    d.albums.push(a);
    for (const [c1, c2, emoji, label, caption] of photos) {
      d.photos.push({ id: uid(), familyId: f, albumId: a.id, url: svgPhoto(c1, c2, emoji, label), mime: "image/svg+xml", width: 1200, height: 900, caption, uploadedBy: by.id, createdAt: now() });
    }
  };
  album("Sommerurlaub an der Ostsee", papa, [
    ["#f6d365", "#fda085", "🏖️", "Strand", "Erster Tag am Strand"],
    ["#84fab0", "#8fd3f4", "⛵", "Segeltörn"],
    ["#a18cd1", "#fbc2eb", "🌅", "Sonnenuntergang", "Was für ein Abend!"],
    ["#ffecd2", "#fcb69f", "🍦", "Eisdiele"],
    ["#89f7fe", "#66a6ff", "🐚", "Muscheln sammeln"],
  ]);
  album("Mias Geburtstag", mia, [
    ["#fccb90", "#d57eeb", "🎂", "8 Jahre!", "Die Torte hat Papa gebacken"],
    ["#fbc2eb", "#a6c1ee", "🎁", "Geschenke"],
    ["#f093fb", "#f5576c", "🎈", "Party"],
  ]);
  album("Wandern im Harz", mama, [
    ["#d4fc79", "#96e6a1", "🥾", "Brocken"],
    ["#c1dfc4", "#deecdd", "🌲", "Im Wald"],
  ]);

  const loc = (m: Rec, lat: number, lng: number, minutesAgo: number) =>
    d.locations.push({ memberId: m.id, familyId: f, lat, lng, accuracy: 20, updatedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString() });
  loc(papa, 52.5096, 13.3759, 3);
  loc(leon, 52.539, 13.424, 12);
  loc(mia, 52.5163, 13.3777, 1);
  loc(mama, 52.5208, 13.4094, 6);
  return d;
}

// ------------------------------------------------------------ Hilfen

const fail = (status: number, message: string): never => {
  throw new DemoError(status, message);
};
const text = (v: unknown, field: string, max = 500, optional = false): string | undefined => {
  if (typeof v !== "string" || !v.trim()) return optional ? undefined : fail(400, `Feld "${field}" fehlt.`);
  if (v.trim().length > max) fail(400, `Feld "${field}" ist zu lang.`);
  return v.trim();
};
const pub = (m: Rec) => {
  const { token: _t, ...rest } = m;
  return rest;
};
const session = (m: Rec) => ({
  token: m.token,
  member: pub(m),
  family: db.families.find((f) => f.id === m.familyId),
  members: db.members.filter((x) => x.familyId === m.familyId).map(pub),
});
const balances = (familyId: string) => {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  return db.members
    .filter((x) => x.familyId === familyId)
    .map((x) => {
      const e = db.points.filter((p) => p.memberId === x.id);
      const earned = e.filter((p) => p.points > 0).reduce((s, p) => s + p.points, 0);
      const spent = -e.filter((p) => p.points < 0).reduce((s, p) => s + p.points, 0);
      const week = e.filter((p) => p.points > 0 && p.at >= weekAgo).reduce((s, p) => s + p.points, 0);
      return { memberId: x.id, earned, spent, balance: earned - spent, week };
    });
};
const addMember = (familyId: string, name: string) => {
  const used = db.members.filter((m) => m.familyId === familyId).length;
  const m = { id: uid(), familyId, name, color: COLORS[used % COLORS.length]!, token: `demo-${uid()}`, createdAt: now() };
  db.members.push(m);
  return m;
};
const find = (coll: Rec[], id: string, familyId: string, what: string) =>
  coll.find((x) => x.id === id && x.familyId === familyId) ?? fail(404, `${what} nicht gefunden.`);
const nextDue = (due: string | undefined, repeat: string, today: string) => {
  const step = repeat === "daily" ? 1 : repeat === "weekly" ? 7 : 0;
  if (!step) return due;
  const add = (s: string, n: number) => {
    const x = new Date(`${s}T12:00:00`);
    x.setDate(x.getDate() + n);
    return ymd(x);
  };
  let next = add(due ?? today, step);
  while (next <= today) next = add(next, step);
  return next;
};

// Antworten der "Familie" auf Chat-Nachrichten, damit sich die Demo lebendig anfuehlt.
const REPLIES = ["Super, danke! 😊", "Bin gleich da!", "Klingt gut 👍", "Kann ich noch Schokolade haben? 🍫", "Okay, mach ich!", "Haha 😄", "Alles klar, bis später!", "❤️"];

// ------------------------------------------------------------ Routen

type Ctx = { me: Rec; body: Rec; query: URLSearchParams; params: string[] };
type Handler = (c: Ctx) => unknown;
const routes: [string, RegExp, Handler, boolean][] = [];
const route = (method: string, pattern: string, h: Handler, open = false) =>
  routes.push([method, new RegExp(`^${pattern.replace(/:\w+/g, "([^/]+)")}$`), h, open]);

route(
  "POST",
  "/families",
  ({ body }) => {
    const fam = { id: uid(), name: text(body.familyName, "familyName", 60)!, inviteCode: Math.random().toString(36).slice(2, 8).toUpperCase(), createdAt: now() };
    db.families.push(fam);
    const m = addMember(fam.id, text(body.memberName, "memberName", 40)!);
    db.lists.push({ id: uid(), familyId: fam.id, name: "Einkauf", createdAt: now() });
    for (const [title, cost] of [["Eis essen gehen", 50], ["30 Min. länger aufbleiben", 30], ["Film aussuchen", 20]] as const) {
      db.rewards.push({ id: uid(), familyId: fam.id, title, cost, createdAt: now() });
    }
    emit("members");
    return session(m);
  },
  true,
);
route(
  "POST",
  "/families/join",
  ({ body }) => {
    const code = String(body.inviteCode ?? "").toUpperCase().replace(/\s+/g, "");
    const fam = db.families.find((f) => f.inviteCode === code) ?? fail(404, `Einladungscode unbekannt. In der Demo lautet er ${DEMO_CODE}.`);
    const m = addMember(fam.id, text(body.memberName, "memberName", 40)!);
    // Begruessung im Chat
    const mama = db.members.find((x) => x.familyId === fam.id && x.name === "Mama");
    if (mama) {
      setTimeout(() => {
        db.messages.push({ id: uid(), familyId: fam.id, memberId: mama.id, text: `Willkommen in der Familie, ${m.name}! 🎉`, createdAt: now() });
        emit("messages");
      }, 2500);
    }
    emit("members");
    return session(m);
  },
  true,
);
route("GET", "/me", ({ me }) => session(me));
route("PATCH", "/me", ({ me, body }) => {
  const name = text(body.name, "name", 40, true);
  if (name) me.name = name;
  emit("members");
  return session(me);
});
route("DELETE", "/me", ({ me }) => {
  db.members = db.members.filter((m) => m.id !== me.id);
  db.locations = db.locations.filter((l) => l.memberId !== me.id);
  emit("members");
});
route("POST", "/me/push-token", () => undefined);
route("DELETE", "/me/push-token", () => undefined);
route("POST", "/family/invite-code", ({ me }) => {
  const fam = db.families.find((f) => f.id === me.familyId)!;
  fam.inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  emit("members");
  return fam;
});

// Kalender
route("GET", "/events", ({ me, query }) => {
  const from = query.get("from"),
    to = query.get("to");
  return db.events
    .filter((e) => e.familyId === me.familyId && (!from || (e.end ?? e.start) >= from) && (!to || e.start <= to))
    .sort((a, b) => a.start.localeCompare(b.start));
});
route("POST", "/events", ({ me, body }) => {
  const e = { id: uid(), familyId: me.familyId, title: text(body.title, "title", 120)!, start: body.start, end: body.end, allDay: !!body.allDay, notes: body.notes, memberIds: body.memberIds ?? [], createdBy: me.id, createdAt: now() };
  if (e.end && e.end < e.start) fail(400, "Ende liegt vor dem Beginn.");
  db.events.push(e);
  emit("events");
  return e;
});
route("PATCH", "/events/:id", ({ me, body, params }) => {
  const e = find(db.events, params[0]!, me.familyId, "Termin");
  Object.assign(e, body);
  emit("events");
  return e;
});
route("DELETE", "/events/:id", ({ me, params }) => {
  const e = find(db.events, params[0]!, me.familyId, "Termin");
  db.events = db.events.filter((x) => x !== e);
  emit("events");
});

// Einkauf
route("GET", "/lists", ({ me }) =>
  db.lists.filter((l) => l.familyId === me.familyId).map((l) => ({ ...l, items: db.items.filter((i) => i.listId === l.id) })),
);
route("POST", "/lists", ({ me, body }) => {
  const l = { id: uid(), familyId: me.familyId, name: text(body.name, "name", 60)!, createdAt: now() };
  db.lists.push(l);
  emit("lists");
  return { ...l, items: [] };
});
route("PATCH", "/lists/:id", ({ me, body, params }) => {
  const l = find(db.lists, params[0]!, me.familyId, "Liste");
  l.name = text(body.name, "name", 60);
  emit("lists");
  return l;
});
route("DELETE", "/lists/:id", ({ me, params }) => {
  const l = find(db.lists, params[0]!, me.familyId, "Liste");
  db.lists = db.lists.filter((x) => x !== l);
  db.items = db.items.filter((i) => i.listId !== l.id);
  emit("lists");
});
route("POST", "/lists/:id/items", ({ me, body, params }) => {
  const l = find(db.lists, params[0]!, me.familyId, "Liste");
  const i = { id: uid(), familyId: me.familyId, listId: l.id, text: text(body.text, "text", 120)!, done: false, addedBy: me.id, createdAt: now() };
  db.items.push(i);
  emit("lists");
  return i;
});
route("POST", "/lists/:id/clear-done", ({ me, params }) => {
  const l = find(db.lists, params[0]!, me.familyId, "Liste");
  db.items = db.items.filter((i) => i.listId !== l.id || !i.done);
  emit("lists");
});
route("PATCH", "/items/:id", ({ me, body, params }) => {
  const i = find(db.items, params[0]!, me.familyId, "Eintrag");
  if (body.done !== undefined) i.done = !!body.done;
  if (body.text !== undefined) i.text = text(body.text, "text", 120);
  emit("lists");
  return i;
});
route("DELETE", "/items/:id", ({ me, params }) => {
  find(db.items, params[0]!, me.familyId, "Eintrag");
  db.items = db.items.filter((i) => i.id !== params[0]);
  emit("lists");
});

// Chat
route("GET", "/messages", ({ me }) => db.messages.filter((m) => m.familyId === me.familyId).slice(-200));
route("POST", "/messages", ({ me, body }) => {
  const m = { id: uid(), familyId: me.familyId, memberId: me.id, text: text(body.text, "text", 2000)!, createdAt: now() };
  db.messages.push(m);
  emit("messages");
  const others = db.members.filter((x) => x.familyId === me.familyId && x.id !== me.id);
  const who = others[Math.floor(Math.random() * others.length)];
  if (who) {
    setTimeout(
      () => {
        db.messages.push({ id: uid(), familyId: me.familyId, memberId: who.id, text: REPLIES[Math.floor(Math.random() * REPLIES.length)]!, createdAt: now() });
        emit("messages");
      },
      1800 + Math.random() * 2000,
    );
  }
  return m;
});

// Standort
route("GET", "/locations", ({ me }) => db.locations.filter((l) => l.familyId === me.familyId));
route("PUT", "/locations/me", ({ me, body }) => {
  const loc = { memberId: me.id, familyId: me.familyId, lat: Number(body.lat), lng: Number(body.lng), accuracy: body.accuracy, updatedAt: now() };
  db.locations = db.locations.filter((l) => l.memberId !== me.id).concat(loc);
  emit("locations");
  return loc;
});
route("DELETE", "/locations/me", ({ me }) => {
  db.locations = db.locations.filter((l) => l.memberId !== me.id);
  emit("locations");
});

// Aufgaben & Punkte
route("GET", "/tasks", ({ me }) => db.tasks.filter((t) => t.familyId === me.familyId));
route("POST", "/tasks", ({ me, body }) => {
  const t = { id: uid(), familyId: me.familyId, title: text(body.title, "title", 120)!, assigneeId: body.assigneeId || undefined, points: Number(body.points) || 0, due: body.due || undefined, repeat: body.repeat ?? "none", done: false, createdBy: me.id, createdAt: now() };
  db.tasks.push(t);
  emit("tasks");
  return t;
});
route("PATCH", "/tasks/:id", ({ me, body, params }) => {
  const t = find(db.tasks, params[0]!, me.familyId, "Aufgabe");
  for (const k of ["title", "points", "repeat"]) if (body[k] !== undefined) t[k] = body[k];
  if (body.assigneeId !== undefined) t.assigneeId = body.assigneeId || undefined;
  if (body.due !== undefined) t.due = body.due || undefined;
  emit("tasks");
  return t;
});
route("DELETE", "/tasks/:id", ({ me, params }) => {
  find(db.tasks, params[0]!, me.familyId, "Aufgabe");
  db.tasks = db.tasks.filter((t) => t.id !== params[0]);
  emit("tasks");
});
route("POST", "/tasks/:id/complete", ({ me, body, params }) => {
  const t = find(db.tasks, params[0]!, me.familyId, "Aufgabe");
  if (t.repeat === "none" && t.done) fail(409, "Aufgabe ist schon erledigt.");
  const who = db.members.find((m) => m.id === body.memberId && m.familyId === me.familyId) ?? me;
  const entry = { id: uid(), familyId: me.familyId, memberId: who.id, points: t.points, kind: "task", refId: t.id, title: t.title, at: now() };
  db.points.push(entry);
  if (t.repeat === "none") t.done = true;
  else t.due = nextDue(t.due, t.repeat, body.today ?? ymd(new Date()));
  emit("tasks");
  return { task: t, entry };
});
route("POST", "/tasks/:id/uncomplete", ({ me, params }) => {
  const t = find(db.tasks, params[0]!, me.familyId, "Aufgabe");
  if (t.repeat !== "none" || !t.done) fail(409, "Nichts rückgängig zu machen.");
  const idx = db.points.map((p) => p.kind === "task" && p.refId === t.id).lastIndexOf(true);
  if (idx >= 0) db.points.splice(idx, 1);
  t.done = false;
  emit("tasks");
  return t;
});
route("GET", "/points", ({ me }) => ({
  balances: balances(me.familyId),
  history: db.points.filter((p) => p.familyId === me.familyId).slice(-40).reverse(),
}));
route("GET", "/rewards", ({ me }) => db.rewards.filter((r) => r.familyId === me.familyId).sort((a, b) => a.cost - b.cost));
route("POST", "/rewards", ({ me, body }) => {
  const r = { id: uid(), familyId: me.familyId, title: text(body.title, "title", 80)!, cost: Number(body.cost) || fail(400, "Punkte fehlen."), createdAt: now() };
  db.rewards.push(r);
  emit("tasks");
  return r;
});
route("DELETE", "/rewards/:id", ({ me, params }) => {
  find(db.rewards, params[0]!, me.familyId, "Belohnung");
  db.rewards = db.rewards.filter((r) => r.id !== params[0]);
  emit("tasks");
});
route("POST", "/rewards/:id/redeem", ({ me, body, params }) => {
  const r = find(db.rewards, params[0]!, me.familyId, "Belohnung");
  const who = db.members.find((m) => m.id === body.memberId && m.familyId === me.familyId) ?? me;
  const bal = balances(me.familyId).find((b) => b.memberId === who.id)?.balance ?? 0;
  if (bal < r.cost) fail(409, `${who.name} hat nur ${bal} von ${r.cost} Punkten.`);
  const entry = { id: uid(), familyId: me.familyId, memberId: who.id, points: -r.cost, kind: "reward", refId: r.id, title: r.title, at: now() };
  db.points.push(entry);
  emit("tasks");
  return entry;
});

// Fotos
route("GET", "/albums", ({ me }) =>
  db.albums
    .filter((a) => a.familyId === me.familyId)
    .map((a) => {
      const ps = db.photos.filter((p) => p.albumId === a.id);
      const latest = ps.at(-1);
      return { ...a, count: ps.length, coverId: latest?.id, updatedAt: latest?.createdAt ?? a.createdAt };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
);
route("POST", "/albums", ({ me, body }) => {
  const a = { id: uid(), familyId: me.familyId, name: text(body.name, "name", 60)!, createdBy: me.id, createdAt: now() };
  db.albums.push(a);
  emit("albums");
  return { ...a, count: 0, updatedAt: a.createdAt };
});
route("PATCH", "/albums/:id", ({ me, body, params }) => {
  const a = find(db.albums, params[0]!, me.familyId, "Album");
  a.name = text(body.name, "name", 60);
  emit("albums");
  return a;
});
route("DELETE", "/albums/:id", ({ me, params }) => {
  const a = find(db.albums, params[0]!, me.familyId, "Album");
  db.albums = db.albums.filter((x) => x !== a);
  db.photos = db.photos.filter((p) => p.albumId !== a.id);
  emit("albums");
});
route("GET", "/albums/:id/photos", ({ me, params }) => {
  const a = find(db.albums, params[0]!, me.familyId, "Album");
  return db.photos.filter((p) => p.albumId === a.id).map(({ url: _u, ...p }) => p);
});
route("POST", "/albums/:id/photos", ({ me, body, params }) => {
  const a = find(db.albums, params[0]!, me.familyId, "Album");
  const data = String(body.data ?? "");
  if (!data) fail(400, "Foto fehlt.");
  const p = { id: uid(), familyId: me.familyId, albumId: a.id, url: `data:image/jpeg;base64,${data}`, mime: "image/jpeg", width: body.width, height: body.height, caption: text(body.caption, "caption", 300, true), uploadedBy: me.id, createdAt: now() };
  db.photos.push(p);
  emit("albums");
  const { url: _u, ...out } = p;
  return out;
});
route("PATCH", "/photos/:id", ({ me, body, params }) => {
  const p = find(db.photos, params[0]!, me.familyId, "Foto");
  p.caption = text(body.caption, "caption", 300, true);
  emit("albums");
  return p;
});
route("DELETE", "/photos/:id", ({ me, params }) => {
  find(db.photos, params[0]!, me.familyId, "Foto");
  db.photos = db.photos.filter((p) => p.id !== params[0]);
  emit("albums");
});

/** Bild-URL eines Demo-Fotos (Data-URL, kein Server noetig). */
export function demoPhotoUrl(id: string): string {
  return db.photos.find((p) => p.id === id)?.url ?? "";
}

/** Entspricht einem HTTP-Aufruf an den echten Server. */
export async function demoRequest(method: string, pathWithQuery: string, token: string | undefined, body: unknown): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 60)); // ein Hauch Netzwerk-Gefuehl
  const [path = "", qs = ""] = pathWithQuery.split("?");
  for (const [m, re, h, open] of routes) {
    if (m !== method) continue;
    const match = path.match(re);
    if (!match) continue;
    const me = db.members.find((x) => x.token === token);
    if (!open && !me) fail(401, "Nicht angemeldet.");
    // Kopie zurueckgeben, damit die App nie direkt im Demo-Speicher schreibt.
    const result = h({ me: me as Rec, body: (body ?? {}) as Rec, query: new URLSearchParams(qs), params: match.slice(1) });
    return result === undefined ? undefined : JSON.parse(JSON.stringify(result));
  }
  return fail(404, "Route nicht gefunden.");
}
