import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Duenne, fehlertolerante Persistenz-Schicht ueber AsyncStorage.
 * Faellt der Speicher aus, wird nicht geworfen – die App laeuft dann ohne Persistenz weiter.
 */
export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function saveJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // bewusst ignoriert – Persistenz ist "best effort"
  }
}
