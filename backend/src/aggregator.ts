import type { Listing, SearchQuery, SearchResponse, SourceResult } from "./types.js";
import { activeProviders } from "./providers/index.js";

const PROVIDER_TIMEOUT_MS = 8000;

/**
 * Fuehrt eine Suche ueber alle aktiven Portale parallel aus, fuehrt die Ergebnisse
 * zusammen, filtert nach Preis, entfernt Duplikate und sortiert.
 *
 * Fehler oder Timeouts einer einzelnen Quelle brechen die Gesamtsuche nicht ab –
 * die Quelle wird nur mit `ok: false` im Diagnoseteil vermerkt.
 */
export async function aggregateSearch(query: SearchQuery): Promise<SearchResponse> {
  const startedAt = Date.now();
  const selected = activeProviders().filter(
    (p) => query.sources.length === 0 || query.sources.includes(p.id),
  );

  const perSource: SourceResult[] = [];
  const settled = await Promise.all(
    selected.map(async (provider): Promise<Listing[]> => {
      const providerStart = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
      try {
        const listings = await provider.search(query, controller.signal);
        perSource.push({
          source: provider.id,
          name: provider.name,
          ok: true,
          count: listings.length,
          tookMs: Date.now() - providerStart,
        });
        return listings;
      } catch (err) {
        perSource.push({
          source: provider.id,
          name: provider.name,
          ok: false,
          count: 0,
          error: err instanceof Error ? err.message : String(err),
          tookMs: Date.now() - providerStart,
        });
        return [];
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  let listings = settled.flat();
  listings = filterByPrice(listings, query);
  listings = dedupe(listings);
  listings = sortListings(listings, query.sort);

  const total = listings.length;
  if (query.limit > 0) {
    listings = listings.slice(0, query.limit);
  }

  return {
    query,
    listings,
    sources: perSource.sort((a, b) => a.source.localeCompare(b.source)),
    total,
    tookMs: Date.now() - startedAt,
  };
}

function filterByPrice(listings: Listing[], query: SearchQuery): Listing[] {
  const { minPrice, maxPrice } = query;
  if (minPrice == null && maxPrice == null) return listings;
  return listings.filter((l) => {
    // Inserate ohne konkreten Preis (VB/unbekannt) bei aktivem Preisfilter behalten,
    // damit Verhandlungsangebote nicht verschwinden.
    if (l.price == null) return true;
    if (minPrice != null && l.price < minPrice) return false;
    if (maxPrice != null && l.price > maxPrice) return false;
    return true;
  });
}

/**
 * Entfernt sehr wahrscheinlich identische Inserate, die auf mehreren Portalen
 * (oder mehrfach) auftauchen. Schluessel: normalisierter Titel + Preis.
 */
function dedupe(listings: Listing[]): Listing[] {
  const seen = new Set<string>();
  const out: Listing[] = [];
  for (const l of listings) {
    const key = `${normalizeTitle(l.title)}|${l.price ?? "x"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }
  return out;
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9äöüß ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sortListings(listings: Listing[], sort: SearchQuery["sort"]): Listing[] {
  const copy = [...listings];
  switch (sort) {
    case "price_asc":
      return copy.sort(byPrice(1));
    case "price_desc":
      return copy.sort(byPrice(-1));
    case "newest":
      return copy.sort((a, b) => dateKey(b) - dateKey(a));
    default:
      return copy;
  }
}

/**
 * Preis-Vergleicher. Inserate ohne konkreten Preis landen IMMER am Ende –
 * unabhaengig von auf- oder absteigender Sortierung.
 */
function byPrice(direction: 1 | -1): (a: Listing, b: Listing) => number {
  return (a, b) => {
    const aNull = a.price == null;
    const bNull = b.price == null;
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;
    return direction * (a.price! - b.price!);
  };
}

function dateKey(l: Listing): number {
  return l.postedAt ? Date.parse(l.postedAt) : 0;
}
