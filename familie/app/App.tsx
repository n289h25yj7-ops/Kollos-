import { useCallback, useMemo, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { SessionGate, useSession } from "./src/session";
import { NavContext, type Tab } from "./src/nav";
import { NotificationsProvider } from "./src/notifications";
import { LocationSharingProvider } from "./src/locationSharing";
import { Onboarding } from "./src/screens/Onboarding";
import { TodayScreen } from "./src/screens/TodayScreen";
import { CalendarScreen } from "./src/screens/CalendarScreen";
import { ShoppingScreen } from "./src/screens/ShoppingScreen";
import { TasksScreen } from "./src/screens/TasksScreen";
import { ChatScreen } from "./src/screens/ChatScreen";
import { PhotosScreen } from "./src/screens/PhotosScreen";
import { LocationScreen } from "./src/screens/LocationScreen";
import { FamilyScreen } from "./src/screens/FamilyScreen";
import { Loading } from "./src/components/ui";
import { ConfirmHost } from "./src/components/confirm";
import { dayKey } from "./src/format";
import { theme } from "./src/theme";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
});

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "today", label: "Heute", icon: "☀" },
  { id: "calendar", label: "Kalender", icon: "▦" },
  { id: "shopping", label: "Einkauf", icon: "☰" },
  { id: "tasks", label: "Aufgaben", icon: "✓" },
  { id: "chat", label: "Chat", icon: "✉" },
  { id: "photos", label: "Fotos", icon: "▣" },
];
/** Bildschirme ohne eigenen Tab (erreichbar ueber "Heute" bzw. Benachrichtigungen). */
const EXTRA_SCREENS: Tab[] = ["map"];

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <SessionGate loading={<Loading />} fallback={(signIn) => <Onboarding onSignedIn={signIn} />}>
          <Shell />
        </SessionGate>
        <ConfirmHost />
      </SafeAreaView>
    </QueryClientProvider>
  );
}

function Shell() {
  const [tab, setTabState] = useState<Tab>("today");
  const [familyOpen, setFamilyOpen] = useState(false);
  const setTab = useCallback((t: Tab) => {
    setFamilyOpen(false);
    setTabState(TABS.some((x) => x.id === t) || EXTRA_SCREENS.includes(t) ? t : "today");
  }, []);
  const nav = useMemo(() => ({ tab, setTab, openFamily: () => setFamilyOpen(true) }), [tab, setTab]);

  return (
    <NavContext.Provider value={nav}>
      <NotificationsProvider onOpenTab={setTab}>
        <LocationSharingProvider>
          <View style={styles.shell}>
            <View style={styles.screen}>
              {familyOpen ? (
                <FamilyScreen onClose={() => setFamilyOpen(false)} />
              ) : (
                <>
                  {tab === "today" ? <TodayScreen /> : null}
                  {tab === "calendar" ? <CalendarScreen /> : null}
                  {tab === "shopping" ? <ShoppingScreen /> : null}
                  {tab === "tasks" ? <TasksScreen /> : null}
                  {tab === "chat" ? <ChatScreen /> : null}
                  {tab === "photos" ? <PhotosScreen /> : null}
                  {tab === "map" ? <LocationScreen /> : null}
                </>
              )}
            </View>
            <TabBar tab={familyOpen ? null : tab} onChange={setTab} />
          </View>
        </LocationSharingProvider>
      </NotificationsProvider>
    </NavContext.Provider>
  );
}

function TabBar({ tab, onChange }: { tab: Tab | null; onChange: (t: Tab) => void }) {
  const { api, session } = useSession();
  // Zaehler an den Tabs (werden per Echtzeit aktuell gehalten).
  const lists = useQuery({ queryKey: ["lists"], queryFn: api.lists });
  const tasks = useQuery({ queryKey: ["tasks", "list"], queryFn: api.tasks });
  const openItems = (lists.data ?? []).reduce((n, l) => n + l.items.filter((i) => !i.done).length, 0);
  const today = dayKey(new Date());
  const dueTasks = (tasks.data ?? []).filter(
    (t) => !t.done && t.due && t.due <= today && (!t.assigneeId || t.assigneeId === session.member.id),
  ).length;
  const badges: Partial<Record<Tab, number>> = { shopping: openItems, tasks: dueTasks };

  return (
    <View style={styles.tabBar}>
      {TABS.map((t) => {
        const active = t.id === tab;
        const badge = badges[t.id] ?? 0;
        return (
          <Pressable
            key={t.id}
            style={styles.tabItem}
            onPress={() => onChange(t.id)}
            accessibilityRole="button"
            accessibilityLabel={t.label}
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
            <Text style={[styles.tabLabel, active && styles.tabActive]} numberOfLines={1}>
              {t.label}
            </Text>
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
  tabLabel: { fontSize: 9, letterSpacing: 0.6, textTransform: "uppercase", color: theme.colors.textFaint, marginTop: 3 },
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
