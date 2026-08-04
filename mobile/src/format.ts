import type { Listing } from "./types";

/** Formatiert den Preis eines Inserats als anzeigefertigen Text. */
export function formatPrice(listing: Listing): string {
  if (listing.priceType === "free" || listing.price === 0) return "Zu verschenken";
  if (listing.price == null) return "VB";
  const value = new Intl.NumberFormat("de-DE").format(listing.price);
  return listing.priceType === "negotiable" ? `${value} € VB` : `${value} €`;
}

/** "vor 3 Tagen" / "heute" aus einem ISO-Zeitstempel. */
export function formatPostedAt(iso?: string): string | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "heute";
  if (days === 1) return "gestern";
  return `vor ${days} Tagen`;
}
