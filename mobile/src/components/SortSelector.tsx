import { Pressable, StyleSheet, Text, View } from "react-native";
import type { SortOption } from "../types";
import { theme } from "../theme";

const OPTIONS: { value: SortOption; label: string }[] = [
  { value: "price_asc", label: "Preis ↑" },
  { value: "price_desc", label: "Preis ↓" },
  { value: "newest", label: "Neueste" },
];

/** Sortier-Umschalter als dezente Pills; aktiv = Gold-Akzent. */
export function SortSelector({
  value,
  onChange,
}: {
  value: SortOption;
  onChange: (next: SortOption) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>Sortieren</Text>
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(2),
    paddingHorizontal: theme.spacing(4),
  },
  label: {
    fontSize: 10.5,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: theme.colors.textFaint,
    marginRight: 2,
  },
  chip: {
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(1.5),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.hairline,
    backgroundColor: "transparent",
  },
  chipActive: { backgroundColor: theme.colors.goldDim, borderColor: "rgba(201,168,106,0.55)" },
  chipText: { color: theme.colors.textMuted, fontSize: 12.5, fontWeight: "600" },
  chipTextActive: { color: theme.colors.goldBright },
});
