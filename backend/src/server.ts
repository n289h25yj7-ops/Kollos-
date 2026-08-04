import express from "express";
import cors from "cors";
import { aggregateSearch } from "./aggregator.js";
import { ALL_PROVIDERS } from "./providers/index.js";
import { parseSearchQuery } from "./query.js";

const app = express();
app.use(cors());
app.use(express.json());

/** Health-Check. */
app.get("/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

/** Liste aller Portale und ob sie aktiv sind (fuer die Filter-UI in der App). */
app.get("/sources", (_req, res) => {
  res.json(
    ALL_PROVIDERS.map((p) => ({ id: p.id, name: p.name, enabled: p.enabled })),
  );
});

/**
 * Meta-Suche ueber alle aktiven Portale.
 * Beispiel: /search?q=iphone%2012&sort=price_asc&maxPrice=400
 */
app.get("/search", async (req, res) => {
  const parsed = parseSearchQuery(req.query);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  try {
    const result = await aggregateSearch(parsed.query);
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unbekannter Serverfehler",
    });
  }
});

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? "0.0.0.0";
app.listen(PORT, HOST, () => {
  const active = ALL_PROVIDERS.filter((p) => p.enabled).map((p) => p.name);
  console.log(`Gebraucht-Aggregator API laeuft auf http://${HOST}:${PORT}`);
  console.log(`Aktive Quellen: ${active.join(", ") || "(keine)"}`);
});
