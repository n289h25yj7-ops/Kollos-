import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { Listing, SortOption } from "../types";
import { search } from "../api";
import { theme } from "../theme";
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brand}>Gebraucht-Radar</Text>
        <Text style={styles.subtitle}>Ein Suchbegriff – alle Portale auf einmal.</Text>
      </View>

      <SearchBar onSubmit={setTerm} />
      <SortSelector value={sort} onChange={setSort} />

      <View style={styles.statusRow}>
        <StatusLine
          isIdle={term.trim().length < 2}
          isLoading={query.isLoading || query.isFetching}
          total={data?.total}
          sources={data?.sources}
        />
      </View>

      <Content
        term={term}
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        listings={data?.listings ?? []}
        onRetry={() => query.refetch()}
        onOpen={setSelected}
      />

      <ListingDetail
        listing={selected}
        visible={selected !== null}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

function StatusLine({
  isIdle,
  isLoading,
  total,
  sources,
}: {
  isIdle: boolean;
  isLoading: boolean;
  total?: number;
  sources?: { name: string; ok: boolean; count: number }[];
}) {
  if (isIdle) return <Text style={styles.statusText}>Gib oben einen Suchbegriff ein.</Text>;
  if (isLoading) return <Text style={styles.statusText}>Durchsuche Portale …</Text>;
  if (total == null) return null;
  const ok = sources?.filter((s) => s.ok).length ?? 0;
  const totalSources = sources?.length ?? 0;
  return (
    <Text style={styles.statusText}>
      {total} Treffer aus {ok}/{totalSources} Quellen
    </Text>
  );
}

function Content({
  term,
  isLoading,
  isError,
  error,
  listings,
  onRetry,
  onOpen,
}: {
  term: string;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  listings: Listing[];
  onRetry: () => void;
  onOpen: (listing: Listing) => void;
}) {
  if (term.trim().length < 2) {
    return <Centered emoji="🔍" text="Starte eine Suche, um Angebote zu vergleichen." />;
  }
  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }
  if (isError) {
    const msg = error instanceof Error ? error.message : "Unbekannter Fehler";
    return (
      <Centered
        emoji="⚠️"
        text={`Suche fehlgeschlagen.\n${msg}`}
        action={{ label: "Erneut versuchen", onPress: onRetry }}
      />
    );
  }
  if (listings.length === 0) {
    return <Centered emoji="🫙" text="Keine Angebote gefunden. Versuch einen anderen Begriff." />;
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

function Centered({
  emoji,
  text,
  action,
}: {
  emoji: string;
  text: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.centerText}>{text}</Text>
      {action ? (
        <Text style={styles.retry} onPress={action.onPress}>
          {action.label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing(4),
    paddingTop: theme.spacing(3),
    paddingBottom: theme.spacing(4),
  },
  brand: { color: "#fff", fontSize: 22, fontWeight: "800" },
  subtitle: { color: "#d1fae5", fontSize: 13, marginTop: 2 },
  statusRow: { paddingHorizontal: theme.spacing(4), paddingVertical: theme.spacing(2) },
  statusText: { color: theme.colors.textMuted, fontSize: 13 },
  listContent: { paddingTop: theme.spacing(1), paddingBottom: theme.spacing(8) },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing(6) },
  emoji: { fontSize: 40, marginBottom: theme.spacing(3) },
  centerText: { color: theme.colors.textMuted, fontSize: 15, textAlign: "center", lineHeight: 22 },
  retry: {
    marginTop: theme.spacing(4),
    color: theme.colors.primary,
    fontWeight: "700",
    fontSize: 15,
  },
});
