import { Pressable, StyleSheet, Text, View } from "react-native";
import type { SortOption } from "../types";
import { theme } from "../theme";

const OPTIONS: { value: SortOption; label: string }[] = [
  { value: "price_asc", label: "Preis ↑" },
  { value: "price_desc", label: "Preis ↓" },
  { value: "newest", label: "Neueste" },
];

/** Segment-Umschalter fuer die Sortierung des Gesamtergebnisses. */
export function SortSelector({
  value,
  onChange,
}: {
  value: SortOption;
  onChange: (next: SortOption) => void;
}) {
  return (
    <View style={styles.row}>
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
            <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: theme.spacing(2), paddingHorizontal: theme.spacing(4) },
  chip: {
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(2),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  label: { color: theme.colors.textMuted, fontSize: 13, fontWeight: "600" },
  labelActive: { color: "#fff" },
});
