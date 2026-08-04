import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Listing } from "../types";
import { loadJSON, saveJSON } from "../storage";

const STORAGE_KEY = "gebrauchtradar.favorites.v1";

interface FavoritesContextValue {
  /** Gemerkte Inserate, neueste zuerst. */
  favorites: Listing[];
  count: number;
  isFavorite: (id: string) => boolean;
  /** Fuegt hinzu oder entfernt – je nachdem, ob schon gemerkt. */
  toggle: (listing: Listing) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

/**
 * Haelt die Merkliste im Zustand und spiegelt sie nach AsyncStorage,
 * damit Favoriten einen App-Neustart ueberleben.
 */
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<Listing[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Beim Start aus dem Speicher laden.
  useEffect(() => {
    let active = true;
    loadJSON<Listing[]>(STORAGE_KEY, []).then((stored) => {
      if (active) {
        setFavorites(stored);
        setHydrated(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Nach jeder Aenderung (erst nach dem initialen Laden) persistieren.
  useEffect(() => {
    if (hydrated) void saveJSON(STORAGE_KEY, favorites);
  }, [favorites, hydrated]);

  const isFavorite = useCallback(
    (id: string) => favorites.some((f) => f.id === id),
    [favorites],
  );

  const toggle = useCallback((listing: Listing) => {
    setFavorites((prev) =>
      prev.some((f) => f.id === listing.id)
        ? prev.filter((f) => f.id !== listing.id)
        : [listing, ...prev],
    );
  }, []);

  const remove = useCallback((id: string) => {
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clear = useCallback(() => setFavorites([]), []);

  const value = useMemo<FavoritesContextValue>(
    () => ({ favorites, count: favorites.length, isFavorite, toggle, remove, clear }),
    [favorites, isFavorite, toggle, remove, clear],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites muss innerhalb von <FavoritesProvider> genutzt werden.");
  return ctx;
}
