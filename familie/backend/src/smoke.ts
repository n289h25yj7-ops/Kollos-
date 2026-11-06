/**
 * End-to-End-Test: startet die API auf einem freien Port (ohne Datei-Speicher),
 * spielt den kompletten Familien-Ablauf durch und prueft die Echtzeit-Hinweise.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket, WebSocketServer } from "ws";
import { createApp } from "./app.js";
import { nextDue } from "./features/tasks.js";
import type { PushMessage } from "./push.js";
import { Store } from "./store.js";

const store = new Store(null);
const received: string[] = [];
let familySocket: WebSocket | undefined;
const pushed: PushMessage[] = [];
const { app, findMemberByToken } = createApp(
  store,
  (_familyId, topic) => {
    familySocket?.readyState === WebSocket.OPEN && familySocket.send(topic);
  },
  { push: async (msgs) => (pushed.push(...msgs), []), uploadsDir: null },
);
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });
wss.on("connection", (ws, req) => {
  const token = new URL(req.url ?? "", "http://x").searchParams.get("token") ?? undefined;
  if (!findMemberByToken(token)) return ws.close(4401);
  familySocket = ws;
});
await new Promise<void>((r) => server.listen(0, r));
const base = `http://localhost:${(server.address() as AddressInfo).port}`;

async function call(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : undefined };
}

const created = await call("POST", "/families", undefined, { familyName: "Familie Muster", memberName: "Mama" });
assert.equal(created.status, 201);
const mama = created.data.token as string;
const code = created.data.family.inviteCode as string;
console.log("Familie erstellt, Code:", code);

const joined = await call("POST", "/families/join", undefined, { inviteCode: code.toLowerCase(), memberName: "Max" });
assert.equal(joined.status, 201);
const max = joined.data.token as string;
assert.equal(joined.data.members.length, 2);
assert.ok(!("token" in joined.data.members[0]), "Tokens anderer Mitglieder duerfen nicht ausgeliefert werden");

assert.equal((await call("POST", "/families/join", undefined, { inviteCode: "XXXXXX", memberName: "A" })).status, 404);
assert.equal((await call("GET", "/me")).status, 401);

// Einladungscodes lassen sich nicht durchprobieren.
for (let i = 0; i < 9; i++) await call("POST", "/families/join", undefined, { inviteCode: `ZZZZZ${i}`, memberName: "A" });
assert.equal((await call("POST", "/families/join", undefined, { inviteCode: code, memberName: "Spaeter" })).status, 429);
console.log("✓ Schutz gegen Code-Raten");

// Echtzeit: Mama hoert zu, Max aendert etwas.
const ws = new WebSocket(`${base.replace("http", "ws")}/ws?token=${mama}`);
ws.on("message", (d) => received.push(d.toString()));
await new Promise((r) => ws.on("open", r));
await new Promise((r) => setTimeout(r, 50));

const lists = await call("GET", "/lists", max);
const listId = lists.data[0].id as string;
const item = await call("POST", `/lists/${listId}/items`, max, { text: "Milch" });
assert.equal(item.status, 201);
await call("PATCH", `/items/${item.data.id}`, mama, { done: true });
await call("POST", `/lists/${listId}/clear-done`, mama);
assert.equal((await call("GET", "/lists", max)).data[0].items.length, 0);

const ev = await call("POST", "/events", mama, {
  title: "Elternabend",
  start: "2026-11-10T18:00:00.000Z",
  end: "2026-11-10T19:30:00.000Z",
  memberIds: [created.data.member.id, "fremd"],
});
assert.equal(ev.status, 201);
assert.deepEqual(ev.data.memberIds, [created.data.member.id]);
assert.equal((await call("POST", "/events", mama, { title: "x", start: "kein Datum" })).status, 400);
const nov = await call("GET", "/events?from=2026-11-01T00:00:00Z&to=2026-11-30T23:59:59Z", max);
assert.equal(nov.data.length, 1);

await call("POST", "/messages", max, { text: "Bin um 6 zuhause" });
assert.equal((await call("GET", "/messages", mama)).data[0].text, "Bin um 6 zuhause");

await call("PUT", "/locations/me", max, { lat: 52.52, lng: 13.405, accuracy: 12 });
assert.equal((await call("GET", "/locations", mama)).data.length, 1);
assert.equal((await call("PUT", "/locations/me", max, { lat: 200, lng: 0 })).status, 400);
await call("DELETE", "/locations/me", max);
assert.equal((await call("GET", "/locations", mama)).data.length, 0);

// Fremde Familie sieht nichts.
const other = await call("POST", "/families", undefined, { familyName: "Andere", memberName: "Eve" });
assert.equal((await call("GET", "/events", other.data.token)).data.length, 0);
assert.equal((await call("DELETE", `/events/${ev.data.id}`, other.data.token)).status, 404);

// Push: Mama meldet ihr Geraet an, Max schreibt -> Mama bekommt Push, Max nicht.
assert.equal((await call("POST", "/me/push-token", mama, { token: "kaputt" })).status, 400);
assert.equal((await call("POST", "/me/push-token", mama, { token: "ExponentPushToken[mama123]" })).status, 204);
await call("POST", "/messages", max, { text: "Pizza heute?" });
assert.ok(pushed.some((p) => p.to === "ExponentPushToken[mama123]" && p.title === "Max" && p.body === "Pizza heute?"));
pushed.length = 0;
await call("POST", "/messages", mama, { text: "Ja!" });
assert.equal(pushed.length, 0, "Absender bekommt keinen Push");
console.log("✓ Push");

// Aufgaben & Punkte
const maxId = joined.data.member.id as string;
const t1 = await call("POST", "/tasks", mama, { title: "Zimmer aufräumen", points: 20, assigneeId: maxId });
assert.equal(t1.status, 201);
assert.equal((await call("POST", "/tasks", mama, { title: "x", assigneeId: "fremd" })).status, 400);
const t2 = await call("POST", "/tasks", mama, { title: "Müll rausbringen", points: 5, repeat: "daily", due: "2026-11-05" });
await call("POST", `/tasks/${t1.data.id}/complete`, max);
assert.equal((await call("POST", `/tasks/${t1.data.id}/complete`, max)).status, 409);
const rep = await call("POST", `/tasks/${t2.data.id}/complete`, mama, { memberId: maxId, today: "2026-11-06" });
assert.equal(rep.data.task.due, "2026-11-07", "taegliche Aufgabe rueckt auf morgen");
assert.equal(rep.data.task.done, false);
let pts = await call("GET", "/points", mama);
assert.equal(pts.data.balances.find((b: { memberId: string }) => b.memberId === maxId).balance, 25);
const rewards = await call("GET", "/rewards", max);
assert.equal(rewards.data.length, 3, "Start-Belohnungen");
const film = rewards.data.find((r: { cost: number }) => r.cost === 20);
assert.equal((await call("POST", `/rewards/${film.id}/redeem`, max)).status, 201);
assert.equal((await call("POST", `/rewards/${film.id}/redeem`, max)).status, 409, "zu wenig Punkte");
await call("POST", `/tasks/${t1.data.id}/uncomplete`, mama);
pts = await call("GET", "/points", mama);
assert.equal(pts.data.balances.find((b: { memberId: string }) => b.memberId === maxId).balance, -15);
assert.equal(nextDue("2026-11-01", "weekly", "2026-11-06"), "2026-11-08");
assert.equal(nextDue(undefined, "daily", "2026-11-06"), "2026-11-07");
console.log("✓ Aufgaben, Punkte & Belohnungen");

// Fotos (winziges 1x1-JPEG)
const jpeg =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
const album = await call("POST", "/albums", mama, { name: "Sommerurlaub" });
assert.equal(album.status, 201);
const up = await call("POST", `/albums/${album.data.id}/photos`, max, { data: jpeg, width: 1, height: 1, caption: "Strand" });
assert.equal(up.status, 201);
assert.ok(!("file" in up.data));
assert.equal((await call("POST", `/albums/${album.data.id}/photos`, max, { data: Buffer.from("hallo").toString("base64") })).status, 415);
const img = await fetch(`${base}/photos/${up.data.id}/file?token=${mama}`);
assert.equal(img.status, 200);
assert.equal(img.headers.get("content-type"), "image/jpeg");
assert.equal((await fetch(`${base}/photos/${up.data.id}/file?token=unbekannt`)).status, 401);
assert.equal((await call("GET", "/albums", mama)).data[0].count, 1);
await call("DELETE", `/albums/${album.data.id}`, mama);
assert.equal((await fetch(`${base}/photos/${up.data.id}/file?token=${mama}`)).status, 404);
console.log("✓ Fotoalben");

await new Promise((r) => setTimeout(r, 100));
for (const topic of ["lists", "events", "messages", "locations", "tasks", "albums"]) {
  assert.ok(received.includes(topic), `Echtzeit-Hinweis "${topic}" fehlt`);
}
console.log("Echtzeit-Hinweise:", [...new Set(received)].join(", "));

ws.close();
server.close();
wss.close();
console.log("✓ Smoke-Test erfolgreich");
process.exit(0);
