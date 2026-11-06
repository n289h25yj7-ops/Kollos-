import { Platform } from "react-native";
import Constants from "expo-constants";
import { DEMO_URL } from "./demo/server";

/** Demo-Build (EXPO_PUBLIC_DEMO=1): alles laeuft im Browser, ohne Server. */
export const IS_DEMO = process.env.EXPO_PUBLIC_DEMO === "1";

/**
 * Welcher Server ist voreingestellt? (Kann beim Einrichten in der App geaendert werden.)
 *
 * 1. EXPO_PUBLIC_API_URL beim Bauen, z. B. https://familie.example.de
 * 2. Im Browser, wenn das Backend die Web-App selbst ausliefert: dieselbe Adresse.
 * 3. app.json -> expo.extra.apiBaseUrl (Entwicklung: http://localhost:4100).
 *
 * Echte Handys im WLAN brauchen die LAN-IP des Rechners, z. B. http://192.168.1.20:4100.
 */
const fromConfig = (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl;
const fromEnv = process.env.EXPO_PUBLIC_API_URL;

function servedByBackend(): string | undefined {
  if (Platform.OS !== "web" || typeof window === "undefined") return undefined;
  const { origin, port } = window.location;
  // 8081/19006 = Expo-Entwicklungsserver, dort laeuft das Backend separat.
  return port === "8081" || port === "19006" ? undefined : origin;
}

export const DEFAULT_SERVER_URL = IS_DEMO ? DEMO_URL : fromEnv || servedByBackend() || fromConfig || "http://localhost:4100";
