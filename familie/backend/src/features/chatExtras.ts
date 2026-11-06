import { randomUUID } from "node:crypto";
import type { Express, Request } from "express";
import type { Ctx } from "../context.js";
import { HttpError, int, now, str } from "../http.js";
import type { ChatMessage, TravelMode } from "../types.js";

const MODES: Record<TravelMode, string> = { walk: "🚶", bike: "🚲", car: "🚗", transit: "🚌" };

/**
 * Chat-Extras: Abstimmungen und "Bin gleich da" (Ankunftszeit + Ankunftsmeldung),
 * dazu das Zuhause der Familie.
 */
export function registerChatExtras(app: Express, ctx: Ctx) {
  const { db, auth, me, changed, notify } = ctx;

  const ownMessage = (req: Request) => {
    const msg = db.messages.find((x) => x.id === req.params.id && x.familyId === me(req).familyId);
    if (!msg) throw new HttpError(404, "Nachricht nicht gefunden.");
    return msg;
  };
  const push = (msg: ChatMessage) => {
    db.messages.push(msg);
    changed(msg.familyId, "messages");
  };

  // ---------- Zuhause ----------
  app.put("/family/home", auth, (req, res) => {
    const m = me(req);
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new HttpError(400, "Ungueltige Koordinaten.");
    }
    const family = db.families.find((f) => f.id === m.familyId)!;
    family.home = { lat, lng, label: str(req.body?.label, "label", { max: 40, optional: true }) ?? "Zuhause" };
    changed(m.familyId, "members");
    res.json(family);
  });

  app.delete("/family/home", auth, (req, res) => {
    const family = db.families.find((f) => f.id === me(req).familyId)!;
    family.home = undefined;
    changed(family.id, "members");
    res.status(204).end();
  });

  // ---------- Abstimmungen ----------
  app.post("/polls", auth, (req, res) => {
    const m = me(req);
    const question = str(req.body?.question, "question", { max: 200 })!;
    const raw: unknown[] = Array.isArray(req.body?.options) ? req.body.options : [];
    const options = raw
      .map((o) => (typeof o === "string" ? o.trim() : ""))
      .filter(Boolean)
      .map((text) => {
        if (text.length > 80) throw new HttpError(400, "Antwort ist zu lang (max. 80).");
        return { id: randomUUID().slice(0, 8), text };
      });
    if (options.length < 2 || options.length > 8) throw new HttpError(400, "Eine Abstimmung braucht 2 bis 8 Antworten.");
    const msg: ChatMessage = {
      id: randomUUID(),
      familyId: m.familyId,
      memberId: m.id,
      text: `📊 ${question}`,
      kind: "poll",
      poll: { question, options, multi: Boolean(req.body?.multi), votes: {}, closed: false },
      createdAt: now(),
    };
    push(msg);
    notify(m.familyId, { except: m.id, title: `📊 ${m.name} fragt`, body: question, data: { tab: "chat" } });
    res.status(201).json(msg);
  });

  /** Eigene Stimme setzen (komplette Auswahl; leer = Stimme zurueckziehen). */
  app.post("/messages/:id/vote", auth, (req, res) => {
    const m = me(req);
    const msg = ownMessage(req);
    const poll = msg.poll ?? (() => { throw new HttpError(400, "Das ist keine Abstimmung."); })();
    if (poll.closed) throw new HttpError(409, "Die Abstimmung ist beendet.");
    const ids: unknown[] = Array.isArray(req.body?.optionIds) ? req.body.optionIds : [];
    const valid = [...new Set(ids.filter((id): id is string => typeof id === "string" && poll.options.some((o) => o.id === id)))];
    if (!poll.multi && valid.length > 1) throw new HttpError(400, "Hier ist nur eine Antwort möglich.");
    if (valid.length) poll.votes[m.id] = valid;
    else delete poll.votes[m.id];
    changed(m.familyId, "messages");
    res.json(msg);
  });

  app.post("/messages/:id/close", auth, (req, res) => {
    const m = me(req);
    const msg = ownMessage(req);
    if (!msg.poll) throw new HttpError(400, "Das ist keine Abstimmung.");
    if (msg.memberId !== m.id) throw new HttpError(403, "Nur wer gefragt hat, kann die Abstimmung beenden.");
    msg.poll.closed = true;
    changed(m.familyId, "messages");
    res.json(msg);
  });

  // ---------- Bin gleich da ----------
  app.post("/messages/eta", auth, (req, res) => {
    const m = me(req);
    const mode = req.body?.mode as TravelMode;
    if (!(mode in MODES)) throw new HttpError(400, `Feld "mode" muss walk, bike, car oder transit sein.`);
    const minutes = int(req.body?.minutes, "minutes", { min: 1, max: 600 });
    const destination = str(req.body?.destination, "destination", { max: 40, optional: true }) ?? "zuhause";
    // Eine neue Ankunftszeit ersetzt eine noch offene alte.
    for (const old of db.messages) {
      if (old.memberId === m.id && old.eta && !old.eta.arrivedAt) old.eta.replaced = true;
    }
    const arriveAt = new Date(Date.now() + minutes * 60_000).toISOString();
    const msg: ChatMessage = {
      id: randomUUID(),
      familyId: m.familyId,
      memberId: m.id,
      text: `${MODES[mode]} Bin in ca. ${minutes} Min. ${destination}`,
      kind: "eta",
      eta: { mode, destination, minutes, arriveAt },
      createdAt: now(),
    };
    push(msg);
    const at = new Date(arriveAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: process.env.TZ || "Europe/Berlin" });
    notify(m.familyId, { except: m.id, title: `${MODES[mode]} ${m.name} ist unterwegs`, body: `In ca. ${minutes} Min. ${destination} (gegen ${at})`, data: { tab: "chat" } });
    res.status(201).json(msg);
  });

  app.post("/messages/:id/arrived", auth, (req, res) => {
    const m = me(req);
    const msg = ownMessage(req);
    if (!msg.eta) throw new HttpError(400, "Das ist keine Ankunftsmeldung.");
    if (msg.memberId !== m.id) throw new HttpError(403, "Nur die unterwegs ist, kann die Ankunft melden.");
    if (!msg.eta.arrivedAt) {
      msg.eta.arrivedAt = now();
      notify(m.familyId, { except: m.id, title: "🏠 Angekommen", body: `${m.name} ist ${msg.eta.destination === "zuhause" ? "zuhause" : msg.eta.destination} angekommen`, data: { tab: "chat" } });
    }
    changed(m.familyId, "messages");
    res.json(msg);
  });
}
