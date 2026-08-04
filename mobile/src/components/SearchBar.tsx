import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { theme } from "../theme";

/** Sucheingabe als edle, dunkle Pill mit Lupen-Glyph und Gold-Button. */
export function SearchBar({
  initialValue = "",
  onSubmit,
}: {
  initialValue?: string;
  onSubmit: (term: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [focused, setFocused] = useState(false);

  const submit = () => {
    const trimmed = value.trim();
    if (trimmed.length >= 2) onSubmit(trimmed);
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.field, focused && styles.fieldFocused]}>
        <Text style={styles.glass}>⌕</Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={setValue}
          placeholder="Was suchst du? z. B. iPhone 12 …"
          placeholderTextColor={theme.colors.textFaint}
          returnKeyType="search"
          onSubmitEditing={submit}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCorrect={false}
          autoCapitalize="none"
        />
        <Pressable style={styles.button} onPress={submit} accessibilityRole="button">
          <Text style={styles.buttonText}>Suchen</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: theme.spacing(4), paddingTop: theme.spacing(4) },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(2),
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.hairline,
    backgroundColor: theme.colors.surface2,
    paddingLeft: theme.spacing(3.5),
    paddingRight: theme.spacing(1.5),
  },
  fieldFocused: { borderColor: theme.colors.gold },
  glass: { color: theme.colors.textMuted, fontSize: 20, marginTop: -2 },
  input: { flex: 1, color: theme.colors.text, fontSize: 15, height: "100%" },
  button: {
    height: 40,
    paddingHorizontal: theme.spacing(4),
    borderRadius: 11,
    backgroundColor: theme.colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: theme.colors.onGold, fontWeight: "700", fontSize: 14 },
});
