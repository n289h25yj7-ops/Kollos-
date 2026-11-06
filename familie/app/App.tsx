import { useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { SessionGate, useSession } from "./src/session";
import { Onboarding } from "./src/screens/Onboarding";
import { CalendarScreen } from "./src/screens/CalendarScreen";
import { ShoppingScreen } from "./src/screens/ShoppingScreen";
import { ChatScreen } from "./src/screens/ChatScreen";
import { LocationScreen } from "./src/screens/LocationScreen";
import { FamilyScreen } from "./src/screens/FamilyScreen";
import { Loading } from "./src/components/ui";
import { theme } from "./src/theme";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
});

type Tab = "calendar" | "shopping" | "chat" | "location" | "family";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "calendar", label: "Kalender", icon: "▦" },
  { id: "shopping", label: "Einkauf", icon: "☰" },
  { id: "chat", label: "Chat", icon: "✉" },
  { id: "location", label: "Standort", icon: "⌖" },
  { id: "family", label: "Familie", icon: "✦" },
];

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <SessionGate loading={<Loading />} fallback={(signIn) => <Onboarding onSignedIn={signIn} />}>
          <Shell />
        </SessionGate>
      </SafeAreaView>
    </QueryClientProvider>
  );
}

function Shell() {
  const [tab, setTab] = useState<Tab>("calendar");
  return (
    <View style={styles.shell}>
      <View style={styles.screen}>
        {tab === "calendar" ? <CalendarScreen /> : null}
        {tab === "shopping" ? <ShoppingScreen /> : null}
        {tab === "chat" ? <ChatScreen /> : null}
        {tab === "location" ? <LocationScreen /> : null}
        {tab === "family" ? <FamilyScreen /> : null}
      </View>
      <TabBar tab={tab} onChange={setTab} />
    </View>
  );
}

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const { api } = useSession();
  // Offene Einkaufs-Eintraege als Zaehler am Tab (wird per Echtzeit aktuell gehalten).
  const lists = useQuery({ queryKey: ["lists"], queryFn: api.lists });
  const openItems = (lists.data ?? []).reduce((n, l) => n + l.items.filter((i) => !i.done).length, 0);

  return (
    <View style={styles.tabBar}>
      {TABS.map((t) => {
        const active = t.id === tab;
        const badge = t.id === "shopping" ? openItems : 0;
        return (
          <Pressable
            key={t.id}
            style={styles.tabItem}
            onPress={() => onChange(t.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <View>
              <Text style={[styles.tabIcon, active && styles.tabActive]}>{t.icon}</Text>
              {badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.tabLabel, active && styles.tabActive]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  shell: { flex: 1, backgroundColor: theme.colors.bg },
  screen: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: theme.colors.hairline,
    backgroundColor: theme.colors.bg,
  },
  tabItem: { flex: 1, alignItems: "center", paddingTop: theme.spacing(3), paddingBottom: theme.spacing(2.5) },
  tabIcon: { fontSize: 19, color: theme.colors.textFaint, textAlign: "center" },
  tabLabel: { fontSize: 9.5, letterSpacing: 1.1, textTransform: "uppercase", color: theme.colors.textFaint, marginTop: 3 },
  tabActive: { color: theme.colors.gold },
  badge: {
    position: "absolute",
    top: -6,
    right: -14,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: theme.colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: theme.colors.onGold, fontSize: 10, fontWeight: "800" },
});
