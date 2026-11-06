import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { brandFont, theme } from "../theme";
import type { Member } from "../types";
import { useNav } from "../nav";
import { useSession } from "../session";

const c = theme.colors;

export function ScreenHeader({
  eyebrow,
  title,
  right,
  hideFamily,
}: {
  eyebrow?: string;
  title: string;
  right?: ReactNode;
  /** Avatar-Knopf (oeffnet Familie & Einstellungen) ausblenden. */
  hideFamily?: boolean;
}) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {right}
      {hideFamily ? null : <FamilyButton />}
    </View>
  );
}

function FamilyButton() {
  const { session } = useSession();
  const { openFamily } = useNav();
  return (
    <Pressable onPress={openFamily} accessibilityRole="button" accessibilityLabel="Familie & Einstellungen" hitSlop={8}>
      <Avatar member={session.member} size={36} />
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  variant = "gold",
  disabled,
  loading,
  small,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: "gold" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        variant === "gold" ? styles.btnGold : variant === "danger" ? styles.btnDanger : styles.btnGhost,
        off && { opacity: 0.45 },
        pressed && { opacity: 0.75 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "gold" ? c.onGold : c.gold} />
      ) : (
        <Text
          style={[
            styles.btnText,
            small && { fontSize: 13 },
            { color: variant === "gold" ? c.onGold : variant === "danger" ? c.danger : c.gold },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Input(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput placeholderTextColor={c.textFaint} selectionColor={c.gold} style={[styles.input, style]} {...rest} />
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Avatar({ member, size = 34 }: { member?: Member; size?: number }) {
  const initial = member?.name.trim().charAt(0).toUpperCase() ?? "?";
  const color = member?.color ?? c.textFaint;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color + "26",
        borderWidth: 1,
        borderColor: color + "88",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color, fontWeight: "700", fontSize: size * 0.42 }}>{initial}</Text>
    </View>
  );
}

export function Chip({ label, active, onPress, color }: { label: string; active: boolean; onPress: () => void; color?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && { backgroundColor: c.goldDim, borderColor: c.gold }]}
    >
      {color ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      <Text style={[styles.chipText, active && { color: c.goldBright }]}>{label}</Text>
    </Pressable>
  );
}

/** Von unten einfahrendes Bearbeitungs-Fenster. */
export function Sheet({ eyebrow, title, onClose, children }: { eyebrow: string; title?: string; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ScrollView style={styles.sheet} contentContainerStyle={{ gap: theme.spacing(4), paddingBottom: theme.spacing(8) }} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          {title ? <Text style={styles.sheetTitle}>{title}</Text> : null}
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Empty({ icon, title, text }: { icon: string; title: string; text?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {text ? <Text style={styles.emptyText}>{text}</Text> : null}
    </View>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  return <Text style={styles.error}>{error instanceof Error ? error.message : String(error)}</Text>;
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg }}>
      <ActivityIndicator color={c.gold} />
    </View>
  );
}

export const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: theme.spacing(5),
    paddingTop: theme.spacing(5),
    paddingBottom: theme.spacing(3),
    gap: theme.spacing(3),
  },
  eyebrow: { color: c.gold, fontSize: 11, letterSpacing: 2.2, textTransform: "uppercase", marginBottom: 4 },
  title: { color: c.text, fontSize: 30, fontFamily: brandFont },
  btn: {
    minHeight: 48,
    borderRadius: theme.radiusSm,
    paddingHorizontal: theme.spacing(5),
    alignItems: "center",
    justifyContent: "center",
  },
  btnSmall: { minHeight: 36, paddingHorizontal: theme.spacing(3.5) },
  btnGold: { backgroundColor: c.gold },
  btnGhost: { borderWidth: 1, borderColor: c.hairlineStrong },
  btnDanger: { borderWidth: 1, borderColor: c.danger + "66" },
  btnText: { fontWeight: "700", fontSize: 15, letterSpacing: 0.3 },
  label: { color: c.textMuted, fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase" },
  input: {
    minHeight: 48,
    backgroundColor: c.surface2,
    borderRadius: theme.radiusSm,
    borderWidth: 1,
    borderColor: c.hairline,
    paddingHorizontal: theme.spacing(4),
    color: c.text,
    fontSize: 16,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: c.hairline,
    padding: theme.spacing(4),
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: theme.spacing(3.5),
    paddingVertical: theme.spacing(2),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.hairline,
    backgroundColor: c.surface,
  },
  chipText: { color: c.textMuted, fontSize: 13, fontWeight: "600" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  empty: { alignItems: "center", paddingVertical: theme.spacing(12), paddingHorizontal: theme.spacing(8), gap: 8 },
  emptyIcon: { fontSize: 34, color: c.gold, marginBottom: 4 },
  emptyTitle: { color: c.text, fontSize: 17, fontFamily: brandFont, textAlign: "center" },
  emptyText: { color: c.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
  error: { color: c.danger, fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "92%",
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    backgroundColor: c.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: c.hairline,
    padding: theme.spacing(5),
  },
  sheetTitle: { color: c.text, fontSize: 22, fontWeight: "600", marginTop: -8 },
});
