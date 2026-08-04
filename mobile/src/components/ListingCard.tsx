import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { Listing } from "../types";
import { SOURCE_META, theme } from "../theme";
import { formatPostedAt, formatPrice } from "../format";
import { FavoriteButton } from "./FavoriteButton";

/** Ergebniskachel im dunklen, edlen Stil. Tap oeffnet die Detailansicht. */
export function ListingCard({
  listing,
  onPress,
}: {
  listing: Listing;
  onPress: (listing: Listing) => void;
}) {
  const meta = SOURCE_META[listing.source] ?? { label: listing.source, dot: theme.colors.textFaint };
  const posted = formatPostedAt(listing.postedAt);
  const isFree = listing.priceType === "free" || listing.price === 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => onPress(listing)}
      accessibilityRole="button"
      accessibilityLabel={`${listing.title}, ${formatPrice(listing)}`}
    >
      {listing.imageUrl ? (
        <Image source={{ uri: listing.imageUrl }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Text style={styles.placeholderText}>–</Text>
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.title} numberOfLines={2}>
            {listing.title}
          </Text>
          <FavoriteButton listing={listing} />
        </View>

        <Text style={[styles.price, isFree && styles.priceFree]}>{formatPrice(listing)}</Text>

        <View style={styles.metaRow}>
          <View style={styles.chip}>
            <View style={[styles.dot, { backgroundColor: meta.dot }]} />
            <Text style={styles.chipText}>{meta.label}</Text>
          </View>
          <Text style={styles.metaText} numberOfLines={1}>
            {[listing.location, posted].filter(Boolean).join(" · ")}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: theme.spacing(3),
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.colors.hairline,
    marginHorizontal: theme.spacing(4),
    marginBottom: theme.spacing(2.5),
    padding: theme.spacing(2.5),
  },
  pressed: { backgroundColor: theme.colors.surface2, borderColor: theme.colors.hairlineStrong },
  image: {
    width: 92,
    height: 92,
    borderRadius: theme.radiusSm,
    borderWidth: 1,
    borderColor: theme.colors.hairline,
    backgroundColor: theme.colors.surface3,
  },
  imagePlaceholder: { alignItems: "center", justifyContent: "center" },
  placeholderText: { color: theme.colors.textFaint, fontSize: 20 },
  body: { flex: 1, minWidth: 0 },
  topRow: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing(2) },
  title: { flex: 1, fontSize: 15, fontWeight: "600", color: theme.colors.text, lineHeight: 20 },
  price: {
    marginTop: theme.spacing(2),
    fontSize: 17,
    fontWeight: "700",
    color: theme.colors.text,
  },
  priceFree: { color: theme.colors.sage, fontSize: 15 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: theme.spacing(2.5),
    gap: theme.spacing(2),
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(1.5),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.hairline,
    paddingHorizontal: theme.spacing(2),
    paddingVertical: 3,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { color: theme.colors.textMuted, fontSize: 11 },
  metaText: { color: theme.colors.textFaint, fontSize: 12, flexShrink: 1 },
});
