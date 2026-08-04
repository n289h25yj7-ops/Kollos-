import * as cheerio from "cheerio";
import type { Listing, SearchQuery } from "../types.js";
import type { Provider } from "./provider.js";
import { fetchHtml, parseGermanPrice } from "./http.js";

/**
 * Adapter fuer markt.de.
 *
 * WICHTIG / RECHTLICHER HINWEIS: siehe KleinanzeigenProvider. Auch markt.de
 * untersagt automatisiertes Auslesen. Standardmaessig DEAKTIVIERT, Struktur-Vorlage.
 *
 * Aktivieren nur fuer eigene, erlaubte Tests via Env-Var:  ENABLE_MARKTDE=true
 */
export class MarktDeProvider implements Provider {
  readonly id = "marktde" as const;
  readonly name = "markt.de";
  readonly enabled = process.env.ENABLE_MARKTDE === "true";

  private buildUrl(query: SearchQuery): string {
    const keyword = encodeURIComponent(query.q.trim());
    return `https://www.markt.de/suche/?query=${keyword}`;
  }

  async search(query: SearchQuery, signal: AbortSignal): Promise<Listing[]> {
    const html = await fetchHtml(this.buildUrl(query), signal);
    const $ = cheerio.load(html);
    const listings: Listing[] = [];

    // Defensive, generische Selektoren fuer eine Trefferkachel.
    $("[class*='clsy-c-result'], article").each((_, el) => {
      const node = $(el);
      const linkEl = node.find("a[href]").first();
      const relUrl = linkEl.attr("href") ?? "";
      const title = node.find("h2, h3, [class*='title']").first().text().trim();
      const priceText = node.find("[class*='price']").first().text().trim();
      const location = node.find("[class*='location'], [class*='city']").first().text().trim();
      const imageUrl = node.find("img").first().attr("src") ?? undefined;

      if (!title || !relUrl) return;
      const { price, priceType } = parseGermanPrice(priceText);
      listings.push({
        id: `marktde:${relUrl}`,
        source: this.id,
        title,
        price,
        currency: "EUR",
        priceType,
        location: location || undefined,
        imageUrl,
        url: relUrl.startsWith("http") ? relUrl : `https://www.markt.de${relUrl}`,
      });
    });

    return listings;
  }
}
