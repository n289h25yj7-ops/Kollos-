import { useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SearchScreen } from "./src/screens/SearchScreen";
import { FavoritesScreen } from "./src/screens/FavoritesScreen";
import { FavoritesProvider, useFavorites } from "./src/favorites/FavoritesContext";
import { theme } from "./src/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

type Tab = "search" | "favorites";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <FavoritesProvider>
        <SafeAreaView style={styles.safe}>
          <StatusBar style="light" />
          <Shell />
        </SafeAreaView>
      </FavoritesProvider>
    </QueryClientProvider>
  );
}

function Shell() {
  const [tab, setTab] = useState<Tab>("search");
  return (
    <View style={styles.shell}>
      <View style={styles.screen}>
        {tab === "search" ? <SearchScreen /> : <FavoritesScreen />}
      </View>
      <TabBar tab={tab} onChange={setTab} />
    </View>
  );
}

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const { count } = useFavorites();
  return (
    <View style={styles.tabBar}>
      <TabItem label="Suche" icon="🔍" active={tab === "search"} onPress={() => onChange("search")} />
      <TabItem
        label="Merkliste"
        icon="♥"
        badge={count}
        active={tab === "favorites"}
        onPress={() => onChange("favorites")}
      />
    </View>
  );
}

function TabItem({
  label,
  icon,
  active,
  badge,
  onPress,
}: {
  label: string;
  icon: string;
  active: boolean;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.tabItem} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }}>
      <View>
        <Text style={[styles.tabIcon, active && styles.tabActive]}>{icon}</Text>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.tabLabel, active && styles.tabActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.primary },
  shell: { flex: 1, backgroundColor: theme.colors.background },
  screen: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: theme.spacing(2) },
  tabIcon: { fontSize: 20, color: theme.colors.textMuted, textAlign: "center" },
  tabLabel: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  tabActive: { color: theme.colors.primary },
  badge: {
    position: "absolute",
    top: -4,
    right: -12,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: theme.colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});
