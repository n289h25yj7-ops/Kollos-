/**
 * End-to-End-Test: startet die API auf einem freien Port (ohne Datei-Speicher),
 * spielt den kompletten Familien-Ablauf durch und prueft die Echtzeit-Hinweise.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket, WebSocketServer } from "ws";
import { createApp } from "./app.js";
import { Store } from "./store.js";

const store = new Store(null);
const received: string[] = [];
let familySocket: WebSocket | undefined;
const { app, findMemberByToken } = createApp(store, (_familyId, topic) => {
  familySocket?.readyState === WebSocket.OPEN && familySocket.send(topic);
});
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

await new Promise((r) => setTimeout(r, 100));
for (const topic of ["lists", "events", "messages", "locations"]) {
  assert.ok(received.includes(topic), `Echtzeit-Hinweis "${topic}" fehlt`);
}
console.log("Echtzeit-Hinweise:", [...new Set(received)].join(", "));

ws.close();
server.close();
wss.close();
console.log("✓ Smoke-Test erfolgreich");
process.exit(0);
