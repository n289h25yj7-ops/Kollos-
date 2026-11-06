import { Platform } from "react-native";

/**
 * Design-System der Familien-App: derselbe edle Schwarz/Gold-Look wie
 * Gebraucht-Radar. Alle Screens stylen ausschliesslich ueber diese Tokens.
 */
export const theme = {
  colors: {
    bg: "#0b0b0d",
    surface: "#151418",
    surface2: "#1c1b21",
    surface3: "#232128",
    hairline: "rgba(255,255,255,0.09)",
    hairlineStrong: "rgba(255,255,255,0.17)",

    text: "#f4f2ee",
    textMuted: "#9d9aa4",
    textFaint: "#6f6d78",

    gold: "#c9a86a",
    goldBright: "#e6cf9c",
    goldDim: "rgba(201,168,106,0.14)",
    onGold: "#17140c",

    sage: "#8fbf9f",
    danger: "#d98080",
  },
  spacing: (n: number) => n * 4,
  radius: 16,
  radiusSm: 12,
} as const;

export const brandFont = Platform.select({ ios: "Georgia", android: "serif", default: "serif" });
