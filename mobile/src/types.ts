/** Muss mit backend/src/types.ts uebereinstimmen (Vertrag der API). */

export type SourceId = "mock" | "kleinanzeigen" | "marktde";
export type PriceType = "fixed" | "negotiable" | "free" | "unknown";
export type SortOption = "price_asc" | "price_desc" | "newest";

export interface Listing {
  id: string;
  source: SourceId;
  title: string;
  price: number | null;
  currency: string;
  priceType: PriceType;
  location?: string;
  postedAt?: string;
  imageUrl?: string;
  url: string;
  description?: string;
}

export interface SourceResult {
  source: SourceId;
  name: string;
  ok: boolean;
  count: number;
  error?: string;
  tookMs: number;
}

export interface SearchResponse {
  listings: Listing[];
  sources: SourceResult[];
  total: number;
  tookMs: number;
}

export interface SourceInfo {
  id: SourceId;
  name: string;
  enabled: boolean;
}
