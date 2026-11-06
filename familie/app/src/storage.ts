import AsyncStorage from "@react-native-async-storage/async-storage";

/** Kleiner, fehlertoleranter Wrapper um AsyncStorage fuer JSON-Werte. */
export async function load<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function save(key: string, value: unknown): Promise<void> {
  try {
    if (value === null || value === undefined) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Speichern ist "best effort" – die App funktioniert auch ohne.
  }
}
