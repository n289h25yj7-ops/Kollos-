import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { theme } from "../theme";

/** Sucheingabe mit Button. Loest die Suche beim Absenden aus. */
export function SearchBar({
  initialValue = "",
  onSubmit,
}: {
  initialValue?: string;
  onSubmit: (term: string) => void;
}) {
  const [value, setValue] = useState(initialValue);

  const submit = () => {
    const trimmed = value.trim();
    if (trimmed.length >= 2) onSubmit(trimmed);
  };

  return (
    <View style={styles.row}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={setValue}
        placeholder="Was suchst du? z. B. iPhone 12, Rennrad …"
        placeholderTextColor={theme.colors.textMuted}
        returnKeyType="search"
        onSubmitEditing={submit}
        autoCorrect={false}
        autoCapitalize="none"
      />
      <Pressable style={styles.button} onPress={submit} accessibilityRole="button">
        <Text style={styles.buttonText}>Suchen</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: theme.spacing(2),
    paddingHorizontal: theme.spacing(4),
    paddingVertical: theme.spacing(3),
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing(3),
    color: theme.colors.text,
    fontSize: 15,
  },
  button: {
    height: 44,
    paddingHorizontal: theme.spacing(4),
    borderRadius: theme.radius,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
