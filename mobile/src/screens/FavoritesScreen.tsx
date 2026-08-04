import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { Listing } from "../types";
import { brandFont, theme } from "../theme";
import { useFavorites } from "../favorites/FavoritesContext";
import { ListingCard } from "../components/ListingCard";
import { ListingDetail } from "./ListingDetail";

/** Merkliste im dunklen Stil: gemerkte Inserate, Detailansicht, "Leeren". */
export function FavoritesScreen() {
  const { favorites, count, clear } = useFavorites();
  const [selected, setSelected] = useState<Listing | null>(null);

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <Text style={styles.mark}>
          GEBRAUCHT<Text style={styles.markDot}>·</Text>RADAR
        </Text>
        {count > 0 ? (
          <Pressable onPress={clear} hitSlop={8} accessibilityRole="button">
            <Text style={styles.clear}>Leeren</Text>
          </Pressable>
        ) : (
          <Text style={styles.ctx}>Merkliste</Text>
        )}
      </View>

      <View style={styles.subhead}>
        <Text style={styles.subheadText}>
          {count === 0
            ? "Noch nichts gemerkt"
            : `${count} gemerkte${count === 1 ? "s" : ""} Angebot${count === 1 ? "" : "e"}`}
        </Text>
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

      <ListingDetail listing={selected} visible={selected !== null} onClose={() => setSelected(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing(4.5),
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(3.5),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.hairline,
  },
  mark: { fontFamily: brandFont, fontSize: 13, letterSpacing: 3, color: theme.colors.text },
  markDot: { color: theme.colors.gold },
  ctx: { fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", color: theme.colors.textFaint },
  clear: { fontSize: 12.5, color: theme.colors.gold },
  subhead: { paddingHorizontal: theme.spacing(4.5), paddingTop: theme.spacing(3.5), paddingBottom: theme.spacing(1) },
  subheadText: { fontSize: 13, color: theme.colors.textMuted },
  listContent: { paddingTop: theme.spacing(3), paddingBottom: theme.spacing(8) },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing(7) },
  emoji: { fontSize: 44, color: theme.colors.gold, marginBottom: theme.spacing(4) },
  centerText: { color: theme.colors.textMuted, fontSize: 15, textAlign: "center", lineHeight: 22 },
});
