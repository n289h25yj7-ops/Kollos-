import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { Listing, SortOption } from "../types";
import { search } from "../api";
import { brandFont, theme } from "../theme";
import { SearchBar } from "../components/SearchBar";
import { SortSelector } from "../components/SortSelector";
import { ListingCard } from "../components/ListingCard";
import { ListingDetail } from "./ListingDetail";

export function SearchScreen() {
  const [term, setTerm] = useState<string>("");
  const [sort, setSort] = useState<SortOption>("price_asc");
  const [selected, setSelected] = useState<Listing | null>(null);

  const query = useQuery({
    queryKey: ["search", term, sort],
    queryFn: ({ signal }) => search({ q: term, sort }, signal),
    enabled: term.trim().length >= 2,
  });

  const data = query.data;
  const isIdle = term.trim().length < 2;

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <Text style={styles.mark}>
          GEBRAUCHT<Text style={styles.markDot}>·</Text>RADAR
        </Text>
        <Text style={styles.ctx}>Meta-Suche</Text>
      </View>

      <SearchBar onSubmit={setTerm} />
      <View style={styles.sortWrap}>
        <SortSelector value={sort} onChange={setSort} />
      </View>

      {!isIdle ? (
        <Text style={styles.status}>
          {query.isLoading || query.isFetching ? (
            "Durchsuche Portale …"
          ) : data ? (
            <>
              <Text style={styles.statusStrong}>{data.total}</Text>
              {` Treffer aus ${data.sources.filter((s) => s.ok).length}/${data.sources.length} Quellen`}
            </>
          ) : null}
        </Text>
      ) : null}

      <Content
        term={term}
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        listings={data?.listings ?? []}
        onRetry={() => query.refetch()}
        onOpen={setSelected}
        onSuggest={setTerm}
      />

      <ListingDetail listing={selected} visible={selected !== null} onClose={() => setSelected(null)} />
    </View>
  );
}

const SUGGESTIONS = ["iPhone 12", "Rennrad", "Sofa", "PlayStation 5", "Kinderwagen"];

function Content({
  term,
  isLoading,
  isError,
  error,
  listings,
  onRetry,
  onOpen,
  onSuggest,
}: {
  term: string;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  listings: Listing[];
  onRetry: () => void;
  onOpen: (listing: Listing) => void;
  onSuggest: (term: string) => void;
}) {
  if (term.trim().length < 2) {
    return (
      <View style={styles.center}>
        <Text style={styles.emoji}>⌕</Text>
        <Text style={styles.centerText}>
          Ein Suchbegriff durchsucht alle Portale und macht die Preise vergleichbar.
        </Text>
        <Text style={styles.suggestLabel}>Beliebte Suchen</Text>
        <View style={styles.suggestions}>
          {SUGGESTIONS.map((s) => (
            <Pressable key={s} style={styles.suggestChip} onPress={() => onSuggest(s)}>
              <Text style={styles.suggestText}>{s}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }
  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.gold} size="large" />
      </View>
    );
  }
  if (isError) {
    const msg = error instanceof Error ? error.message : "Unbekannter Fehler";
    return (
      <View style={styles.center}>
        <Text style={styles.emoji}>⚠︎</Text>
        <Text style={styles.centerText}>{`Suche fehlgeschlagen.\n${msg}`}</Text>
        <Pressable style={styles.retryBtn} onPress={onRetry}>
          <Text style={styles.retryText}>Erneut versuchen</Text>
        </Pressable>
      </View>
    );
  }
  if (listings.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emoji}>∅</Text>
        <Text style={styles.centerText}>Keine Angebote gefunden. Versuch einen anderen Begriff.</Text>
      </View>
    );
  }
  return (
    <FlatList
      data={listings}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ListingCard listing={item} onPress={onOpen} />}
      contentContainerStyle={styles.listContent}
      keyboardDismissMode="on-drag"
    />
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
  mark: {
    fontFamily: brandFont,
    fontSize: 13,
    letterSpacing: 3,
    color: theme.colors.text,
  },
  markDot: { color: theme.colors.gold },
  ctx: { fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", color: theme.colors.textFaint },
  sortWrap: { paddingTop: theme.spacing(3.5) },
  status: { paddingHorizontal: theme.spacing(4.5), paddingTop: theme.spacing(3), fontSize: 12, color: theme.colors.textFaint },
  statusStrong: { color: theme.colors.textMuted, fontWeight: "700" },
  listContent: { paddingTop: theme.spacing(3), paddingBottom: theme.spacing(8) },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing(7) },
  emoji: { fontSize: 40, color: theme.colors.textFaint, marginBottom: theme.spacing(4) },
  centerText: { color: theme.colors.textMuted, fontSize: 15, textAlign: "center", lineHeight: 22 },
  suggestLabel: {
    marginTop: theme.spacing(6),
    marginBottom: theme.spacing(3),
    fontSize: 10.5,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: theme.colors.textFaint,
  },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing(2), justifyContent: "center" },
  suggestChip: {
    borderWidth: 1,
    borderColor: theme.colors.hairline,
    backgroundColor: theme.colors.surface,
    borderRadius: 999,
    paddingHorizontal: theme.spacing(3.5),
    paddingVertical: theme.spacing(2),
  },
  suggestText: { color: theme.colors.text, fontSize: 12.5, fontWeight: "500" },
  retryBtn: {
    marginTop: theme.spacing(5),
    borderWidth: 1,
    borderColor: theme.colors.gold,
    borderRadius: 999,
    paddingHorizontal: theme.spacing(5),
    paddingVertical: theme.spacing(2.5),
  },
  retryText: { color: theme.colors.goldBright, fontWeight: "700", fontSize: 14 },
});
