/** Minimaler Smoke-Test des Aggregators ohne HTTP-Server. Ausfuehren: npm run smoke */
import { aggregateSearch } from "./aggregator.js";
import { parseSearchQuery } from "./query.js";

async function main() {
  const parsed = parseSearchQuery({ q: "iphone 12", sort: "price_asc", maxPrice: "500" });
  if (!parsed.ok) throw new Error(parsed.error);

  const result = await aggregateSearch(parsed.query);

  console.log(`Suche: "${parsed.query.q}"  ->  ${result.total} Treffer in ${result.tookMs} ms`);
  console.log("Quellen:", result.sources.map((s) => `${s.name}=${s.ok ? s.count : "FEHLER"}`).join(", "));

  const prices = result.listings.map((l) => l.price);
  const sorted = prices.every((p, i) => i === 0 || p == null || prices[i - 1] == null || prices[i - 1]! <= p!);
  console.log("Sortierung aufsteigend korrekt:", sorted);

  console.log("\nTop 5:");
  for (const l of result.listings.slice(0, 5)) {
    const price = l.price == null ? "VB/–" : `${l.price} EUR`;
    console.log(`  [${l.source}] ${price.padStart(9)}  ${l.title}  (${l.location ?? "?"})`);
  }

  if (result.total === 0) {
    console.error("FEHLER: keine Treffer.");
    process.exit(1);
  }
  if (!sorted) {
    console.error("FEHLER: Sortierung nicht aufsteigend.");
    process.exit(1);
  }
  console.log("\nSmoke-Test OK.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
