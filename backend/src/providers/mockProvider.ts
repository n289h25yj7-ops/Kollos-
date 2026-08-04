import type { Listing, SearchQuery } from "../types.js";
import type { Provider } from "./provider.js";

/**
 * Demo-Quelle mit realistischen, aber erfundenen Inseraten.
 *
 * Damit funktioniert die App sofort end-to-end, ohne echte Portale abzufragen
 * (die Scraping verbieten). Die Daten sind deterministisch aus der Suchanfrage
 * abgeleitet, damit dieselbe Suche stabile Ergebnisse liefert.
 */

const CITIES = [
  "Berlin",
  "Hamburg",
  "Muenchen",
  "Koeln",
  "Frankfurt am Main",
  "Stuttgart",
  "Leipzig",
  "Dortmund",
];

const CONDITIONS = ["Neuwertig", "Sehr gut", "Gut", "Gebraucht", "Defekt/Bastler"];

/** Kleiner deterministischer Hash, um aus Strings stabile Pseudozufallszahlen zu ziehen. */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: readonly T[], seed: number): T {
  return arr[seed % arr.length]!;
}

export class MockProvider implements Provider {
  readonly id = "mock" as const;
  readonly name = "Demo-Quelle";
  readonly enabled = true;

  async search(query: SearchQuery, _signal: AbortSignal): Promise<Listing[]> {
    const term = query.q.trim() || "Artikel";
    const base = hash(term.toLowerCase());
    // Grober Basispreis aus dem Suchbegriff (10-810 EUR), damit teure Begriffe teurer wirken.
    const basePrice = 10 + (base % 800);

    const count = 12;
    const listings: Listing[] = [];
    for (let i = 0; i < count; i++) {
      const seed = hash(`${term}:${i}`);
      const spread = (seed % 60) - 20; // -20% .. +40%
      let price: Listing["price"] = Math.max(1, Math.round((basePrice * (100 + spread)) / 100));
      const conditionSeed = seed % CONDITIONS.length;
      let priceType: Listing["priceType"] = seed % 4 === 0 ? "negotiable" : "fixed";
      if (conditionSeed === CONDITIONS.length - 1 && seed % 7 === 0) {
        // Bastler-Teile ab und zu zum Verschenken
        price = 0;
        priceType = "free";
      }
      const city = pick(CITIES, seed);
      const daysAgo = seed % 21;
      const postedAt = new Date(Date.now() - daysAgo * 86_400_000).toISOString();

      listings.push({
        id: `mock:${base}:${i}`,
        source: this.id,
        title: `${capitalize(term)} – ${pick(CONDITIONS, conditionSeed)} (Angebot ${i + 1})`,
        price: priceType === "free" ? 0 : price,
        currency: "EUR",
        priceType,
        location: city,
        postedAt,
        imageUrl: `https://picsum.photos/seed/${base + i}/400/300`,
        url: `https://example.com/inserat/${base}-${i}`,
        description: `${capitalize(term)} in Zustand "${pick(
          CONDITIONS,
          conditionSeed,
        )}". Abholung in ${city} oder Versand moeglich.`,
      });
    }
    return listings;
  }
}

function capitalize(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}
