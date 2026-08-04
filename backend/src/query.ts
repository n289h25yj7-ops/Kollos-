import type { SearchQuery, SortOption, SourceId } from "./types.js";
import { ALL_PROVIDERS } from "./providers/index.js";

const VALID_SORTS: SortOption[] = ["price_asc", "price_desc", "newest"];
const VALID_SOURCES = new Set<SourceId>(ALL_PROVIDERS.map((p) => p.id));

type ParseResult =
  | { ok: true; query: SearchQuery }
  | { ok: false; error: string };

/** Validiert und normalisiert die rohen Query-Parameter der `/search`-Route. */
export function parseSearchQuery(raw: Record<string, unknown>): ParseResult {
  const q = typeof raw.q === "string" ? raw.q.trim() : "";
  if (q.length < 2) {
    return { ok: false, error: "Parameter 'q' muss mindestens 2 Zeichen haben." };
  }

  const minPrice = parseOptionalNumber(raw.minPrice);
  const maxPrice = parseOptionalNumber(raw.maxPrice);
  if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
    return { ok: false, error: "'minPrice' darf nicht groesser als 'maxPrice' sein." };
  }

  const sort: SortOption = VALID_SORTS.includes(raw.sort as SortOption)
    ? (raw.sort as SortOption)
    : "price_asc";

  const sources = parseSources(raw.sources);
  const limitRaw = parseOptionalNumber(raw.limit);
  const limit = limitRaw != null && limitRaw > 0 ? Math.min(limitRaw, 200) : 60;

  return {
    ok: true,
    query: {
      q,
      minPrice: minPrice ?? undefined,
      maxPrice: maxPrice ?? undefined,
      location: typeof raw.location === "string" ? raw.location.trim() || undefined : undefined,
      limit,
      sort,
      sources,
    },
  };
}

function parseOptionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Erlaubt `sources=kleinanzeigen,marktde`; ungueltige Werte werden ignoriert. */
function parseSources(value: unknown): SourceId[] {
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is SourceId => VALID_SOURCES.has(s as SourceId));
}
