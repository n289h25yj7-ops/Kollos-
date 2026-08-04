import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { Listing } from "../types";
import { theme } from "../theme";
import { useFavorites } from "../favorites/FavoritesContext";
import { ListingCard } from "../components/ListingCard";
import { ListingDetail } from "./ListingDetail";

/** Merklisten-Ansicht: alle gemerkten Inserate, mit Detailansicht und "Alle entfernen". */
export function FavoritesScreen() {
  const { favorites, count, clear } = useFavorites();
  const [selected, setSelected] = useState<Listing | null>(null);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>Merkliste</Text>
          <Text style={styles.subtitle}>
            {count === 0 ? "Noch nichts gemerkt" : `${count} gemerkte${count === 1 ? "s" : ""} Angebot${count === 1 ? "" : "e"}`}
          </Text>
        </View>
        {count > 0 ? (
          <Pressable onPress={clear} hitSlop={8} accessibilityRole="button">
            <Text style={styles.clear}>Alle entfernen</Text>
          </Pressable>
        ) : null}
      </View>

      {count === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emoji}>♡</Text>
          <Text style={styles.centerText}>
            Tippe bei einem Angebot auf das Herz, um es hier zu merken.
          </Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ListingCard listing={item} onPress={setSelected} />}
          contentContainerStyle={styles.listContent}
        />
      )}

      <ListingDetail
        listing={selected}
        visible={selected !== null}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing(4),
    paddingTop: theme.spacing(3),
    paddingBottom: theme.spacing(4),
  },
  brand: { color: "#fff", fontSize: 22, fontWeight: "800" },
  subtitle: { color: "#d1fae5", fontSize: 13, marginTop: 2 },
  clear: { color: "#fff", fontSize: 13, fontWeight: "600", textDecorationLine: "underline" },
  listContent: { paddingTop: theme.spacing(3), paddingBottom: theme.spacing(8) },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing(6) },
  emoji: { fontSize: 44, color: theme.colors.danger, marginBottom: theme.spacing(3) },
  centerText: { color: theme.colors.textMuted, fontSize: 15, textAlign: "center", lineHeight: 22 },
});
