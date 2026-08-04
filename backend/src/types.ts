/**
 * Gemeinsame Datentypen fuer die Gebrauchtwaren-Meta-Suche.
 *
 * Jede Quelle (Portal) liefert `Listing`-Objekte in genau diesem Format,
 * damit der Aggregator Ergebnisse verschiedener Portale vergleichbar machen kann.
 */

/** Kennung einer Datenquelle. Beim Hinzufuegen eines neuen Adapters hier erweitern. */
export type SourceId = "mock" | "kleinanzeigen" | "marktde";

/** Preisart eines Inserats. `null`-Preis + Typ erlauben "VB", "Verschenken" usw. */
export type PriceType = "fixed" | "negotiable" | "free" | "unknown";

/** Ein einzelnes, quellenuebergreifend normalisiertes Inserat. */
export interface Listing {
  /** Global eindeutige ID, i. d. R. `${source}:${quelleninterneId}`. */
  id: string;
  source: SourceId;
  title: string;
  /** Preis in ganzen EUR. `null`, wenn unbekannt / Verhandlungsbasis / geschenkt. */
  price: number | null;
  currency: string;
  priceType: PriceType;
  location?: string;
  /** ISO-8601 Zeitstempel, wann das Inserat eingestellt wurde (falls bekannt). */
  postedAt?: string;
  imageUrl?: string;
  /** Direktlink zum Original-Inserat auf dem jeweiligen Portal. */
  url: string;
  description?: string;
}

/** Eingehende Suchanfrage (aus Query-Parametern geparst). */
export interface SearchQuery {
  q: string;
  minPrice?: number;
  maxPrice?: number;
  location?: string;
  /** Wie viele Ergebnisse maximal zurueckgegeben werden. */
  limit: number;
  /** Sortierung des zusammengefuehrten Gesamtergebnisses. */
  sort: SortOption;
  /** Welche Quellen abgefragt werden sollen. Leer = alle aktiven. */
  sources: SourceId[];
}

export type SortOption = "price_asc" | "price_desc" | "newest";

/** Status-/Diagnoseinfo pro Quelle fuer eine Suche. */
export interface SourceResult {
  source: SourceId;
  name: string;
  ok: boolean;
  count: number;
  error?: string;
  tookMs: number;
}

/** Antwort der `/search`-Route. */
export interface SearchResponse {
  query: SearchQuery;
  listings: Listing[];
  sources: SourceResult[];
  total: number;
  tookMs: number;
}
