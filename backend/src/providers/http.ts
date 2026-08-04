/** Kleiner HTTP-Helfer fuer die Scraper-Adapter (browseraehnlicher User-Agent, Timeout). */

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export async function fetchHtml(url: string, signal: AbortSignal): Promise<string> {
  const res = await fetch(url, {
    signal,
    headers: {
      "User-Agent": DEFAULT_UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} bei ${url}`);
  }
  return res.text();
}

/** Wandelt einen deutschen Preistext ("1.299 € VB", "Zu verschenken") in Zahl + Typ. */
export function parseGermanPrice(text: string | undefined | null): {
  price: number | null;
  priceType: "fixed" | "negotiable" | "free" | "unknown";
} {
  if (!text) return { price: null, priceType: "unknown" };
  const t = text.toLowerCase();
  if (t.includes("verschenk") || t.includes("zu verschenken")) {
    return { price: 0, priceType: "free" };
  }
  const negotiable = t.includes("vb") || t.includes("verhandlungsbasis");
  // Deutsche Zahl: Punkt = Tausender, Komma = Dezimal.
  const match = text.replace(/\./g, "").replace(/,/g, ".").match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return { price: null, priceType: negotiable ? "negotiable" : "unknown" };
  }
  const price = Math.round(Number(match[1]));
  return { price, priceType: negotiable ? "negotiable" : "fixed" };
}
