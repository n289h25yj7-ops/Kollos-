import type { Listing, SearchQuery, SourceId } from "../types.js";

/**
 * Ein Provider kapselt den Zugriff auf genau ein Portal (Kleinanzeigen, markt.de, ...).
 *
 * Neue Quellen fuegt man hinzu, indem man dieses Interface implementiert und den
 * Provider in `providers/index.ts` registriert. Der Rest der App bleibt unveraendert.
 */
export interface Provider {
  readonly id: SourceId;
  readonly name: string;
  /**
   * Ob der Provider aktiv abgefragt wird. Echte Scraping-Adapter sind absichtlich
   * standardmaessig deaktiviert (AGB/rechtliche Gruende) und werden ueber Env-Vars
   * scharf geschaltet. Siehe README.
   */
  readonly enabled: boolean;
  /**
   * Fuehrt die Suche auf dem Portal aus und liefert normalisierte Inserate.
   * Muss `signal` respektieren (Timeout/Abbruch durch den Aggregator).
   */
  search(query: SearchQuery, signal: AbortSignal): Promise<Listing[]>;
}
