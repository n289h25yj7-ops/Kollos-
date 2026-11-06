import Constants from "expo-constants";

/**
 * Standard-Server aus app.json (expo.extra.apiBaseUrl). Kann beim Einrichten
 * in der App ueberschrieben werden – wichtig fuer echte Handys, dort muss die
 * LAN-IP des Rechners stehen (z. B. http://192.168.1.20:4100).
 */
const fromConfig = (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl;

export const DEFAULT_SERVER_URL = fromConfig ?? "http://localhost:4100";
