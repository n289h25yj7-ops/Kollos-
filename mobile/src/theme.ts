/** Zentrale Farb- und Abstands-Definitionen fuer ein konsistentes UI. */
export const theme = {
  colors: {
    primary: "#0f766e",
    primaryDark: "#115e59",
    accent: "#f59e0b",
    background: "#f8fafc",
    surface: "#ffffff",
    border: "#e2e8f0",
    text: "#0f172a",
    textMuted: "#64748b",
    danger: "#dc2626",
    free: "#16a34a",
  },
  spacing: (n: number) => n * 4,
  radius: 12,
} as const;

/** Anzeige-Metadaten pro Quelle (Kurzname + Farbe fuer Badges). */
export const SOURCE_META: Record<
  string,
  { label: string; color: string }
> = {
  mock: { label: "Demo", color: "#64748b" },
  kleinanzeigen: { label: "Kleinanzeigen", color: "#16a34a" },
  marktde: { label: "markt.de", color: "#2563eb" },
};
