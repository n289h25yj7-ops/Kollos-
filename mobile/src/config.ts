import Constants from "expo-constants";

/**
 * Basis-URL der Backend-API.
 *
 * Standard ist `http://localhost:4000` (aus app.json -> expo.extra.apiBaseUrl).
 * WICHTIG fuer echte Geraete: `localhost` zeigt auf das Handy selbst. Trage dort
 * die LAN-IP deines Rechners ein, z. B. "http://192.168.1.20:4000".
 */
const fromConfig = (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl;

export const API_BASE_URL = fromConfig ?? "http://localhost:4000";
