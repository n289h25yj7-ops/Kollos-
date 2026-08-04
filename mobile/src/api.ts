import { API_BASE_URL } from "./config";
import type { SearchResponse, SortOption, SourceId, SourceInfo } from "./types";

export interface SearchParams {
  q: string;
  sort: SortOption;
  minPrice?: number;
  maxPrice?: number;
  sources?: SourceId[];
}

/**
 * Baut einen Query-String aus Key/Value-Paaren.
 * Bewusst manuell (nicht ueber URLSearchParams), da dessen RN-Polyfill unvollstaendig ist.
 */
function toQueryString(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

/** Ruft die Meta-Suche des Backends auf. */
export async function search(
  params: SearchParams,
  signal?: AbortSignal,
): Promise<SearchResponse> {
  const qs = toQueryString({
    q: params.q,
    sort: params.sort,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    sources: params.sources && params.sources.length > 0 ? params.sources.join(",") : undefined,
  });

  const res = await fetch(`${API_BASE_URL}/search${qs}`, { signal });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Serverfehler (${res.status})`);
  }
  return (await res.json()) as SearchResponse;
}

/** Laedt die Liste der verfuegbaren Quellen (fuer die Filter-Chips). */
export async function fetchSources(signal?: AbortSignal): Promise<SourceInfo[]> {
  const res = await fetch(`${API_BASE_URL}/sources`, { signal });
  if (!res.ok) throw new Error(`Quellen konnten nicht geladen werden (${res.status})`);
  return (await res.json()) as SourceInfo[];
}
