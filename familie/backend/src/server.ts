import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { WebSocket, WebSocketServer } from "ws";
import { createApp } from "./app.js";
import { createExpoPushSender } from "./push.js";
import { Store } from "./store.js";
import type { Topic } from "./types.js";

const PORT = Number(process.env.PORT ?? 4100);
const DATA_DIR = resolve(process.env.DATA_DIR ?? "data");
const WEB_DIR = process.env.WEB_DIR ? resolve(process.env.WEB_DIR) : null;
const PUSH = process.env.PUSH !== "off";

const store = new Store(join(DATA_DIR, "db.json"));

/** Offene WebSocket-Verbindungen je Familie. */
const sockets = new Map<string, Set<WebSocket>>();

const broadcast = (familyId: string, topic: Topic) => {
  const payload = JSON.stringify({ type: "changed", topic });
  for (const ws of sockets.get(familyId) ?? []) {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  }
};

const { app, findMemberByToken } = createApp(store, broadcast, {
  push: PUSH ? createExpoPushSender() : undefined,
  uploadsDir: join(DATA_DIR, "photos"),
  webDir: WEB_DIR,
});
const server = createServer(app);

// Echtzeit: Clients verbinden sich mit ws://host/ws?token=... und bekommen
// Hinweise wie {"type":"changed","topic":"lists"}, woraufhin sie neu laden.
const wss = new WebSocketServer({ server, path: "/ws" });
wss.on("connection", (ws, req) => {
  const token = new URL(req.url ?? "", "http://x").searchParams.get("token") ?? undefined;
  const member = findMemberByToken(token);
  if (!member) return ws.close(4401, "unauthorized");

  const set = sockets.get(member.familyId) ?? new Set();
  set.add(ws);
  sockets.set(member.familyId, set);
  ws.send(JSON.stringify({ type: "hello", memberId: member.id }));

  // Verbindung lebendig halten (Proxies/Mobilfunk trennen sonst stille Sockets).
  const ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.ping(), 25_000);
  ws.on("close", () => {
    clearInterval(ping);
    set.delete(ws);
  });
});

server.listen(PORT, () => {
  console.log(`Familien-App-Backend laeuft auf http://localhost:${PORT}`);
  console.log(`  Daten: ${DATA_DIR}${WEB_DIR ? ` · Web-App: ${WEB_DIR}` : ""} · Push: ${PUSH ? "an" : "aus"}`);
});

const shutdown = () => {
  store.flush();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
