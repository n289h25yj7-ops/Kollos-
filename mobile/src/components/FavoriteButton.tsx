import { Pressable, StyleSheet, Text } from "react-native";
import type { Listing } from "../types";
import { useFavorites } from "../favorites/FavoritesContext";
import { theme } from "../theme";

/** Herz-Button zum Merken/Entfernen. Aktiv = Champagner-Gold. */
export function FavoriteButton({
  listing,
  size = 22,
}: {
  listing: Listing;
  size?: number;
}) {
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(listing.id);

  return (
    <Pressable
      onPress={() => toggle(listing)}
      hitSlop={8}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel={active ? "Aus Merkliste entfernen" : "Zur Merkliste hinzufuegen"}
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.heart, { fontSize: size }, active && styles.heartActive]}>
        {active ? "♥" : "♡"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { padding: 4 },
  heart: { color: theme.colors.textFaint },
  heartActive: { color: theme.colors.gold },
});
