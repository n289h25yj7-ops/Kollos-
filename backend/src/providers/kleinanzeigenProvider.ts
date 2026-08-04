import * as cheerio from "cheerio";
import type { Listing, SearchQuery } from "../types.js";
import type { Provider } from "./provider.js";
import { fetchHtml, parseGermanPrice } from "./http.js";

/**
 * Adapter fuer Kleinanzeigen.de (ehem. eBay Kleinanzeigen).
 *
 * WICHTIG / RECHTLICHER HINWEIS:
 * Kleinanzeigen.de untersagt in seinen AGB das automatisierte Auslesen (Scraping)
 * und blockt Bots technisch (Captcha, Rate-Limiting). Dieser Adapter ist daher
 * standardmaessig DEAKTIVIERT und dient als Struktur-Vorlage. Fuer den echten Betrieb
 * ist eine offiziell erlaubte Datenquelle noetig (z. B. Partner-/Affiliate-Zugang).
 *
 * Aktivieren nur fuer eigene, erlaubte Tests via Env-Var:  ENABLE_KLEINANZEIGEN=true
 */
export class KleinanzeigenProvider implements Provider {
  readonly id = "kleinanzeigen" as const;
  readonly name = "Kleinanzeigen.de";
  readonly enabled = process.env.ENABLE_KLEINANZEIGEN === "true";

  private buildUrl(query: SearchQuery): string {
    const keyword = encodeURIComponent(query.q.trim());
    // Vereinfachtes URL-Schema der Suche. Reale Filter (Ort/Preis) haengen an
    // portalspezifischen Pfadsegmenten und muessten hier ergaenzt werden.
    return `https://www.kleinanzeigen.de/s-suchanfrage.html?keywords=${keyword}`;
  }

  async search(query: SearchQuery, signal: AbortSignal): Promise<Listing[]> {
    const html = await fetchHtml(this.buildUrl(query), signal);
    const $ = cheerio.load(html);
    const listings: Listing[] = [];

    // Selektoren basieren auf der oeffentlichen Trefferliste ("aditem").
    // Portale aendern ihr Markup regelmaessig -> defensiv parsen.
    $("article.aditem").each((_, el) => {
      const node = $(el);
      const id = node.attr("data-adid") ?? "";
      const relUrl = node.attr("data-href") ?? node.find("a").attr("href") ?? "";
      const title = node.find(".text-module-begin, .ellipsis").first().text().trim();
      const priceText = node.find(".aditem-main--middle--price-shipping--price").first().text().trim();
      const location = node.find(".aditem-main--top--left").first().text().trim();
      const imageUrl = node.find("img").first().attr("src") ?? undefined;

      if (!title || !relUrl) return;
      const { price, priceType } = parseGermanPrice(priceText);
      listings.push({
        id: `kleinanzeigen:${id || relUrl}`,
        source: this.id,
        title,
        price,
        currency: "EUR",
        priceType,
        location: location || undefined,
        imageUrl,
        url: relUrl.startsWith("http") ? relUrl : `https://www.kleinanzeigen.de${relUrl}`,
      });
    });

    return listings;
  }
}
