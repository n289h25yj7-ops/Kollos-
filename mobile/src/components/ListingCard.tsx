import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { Listing } from "../types";
import { SOURCE_META, theme } from "../theme";
import { formatPostedAt, formatPrice } from "../format";
import { FavoriteButton } from "./FavoriteButton";

/** Eine Ergebniskachel: Bild, Titel, Preis, Ort, Quelle, Merken-Herz. Tap oeffnet Details. */
export function ListingCard({
  listing,
  onPress,
}: {
  listing: Listing;
  onPress: (listing: Listing) => void;
}) {
  const meta = SOURCE_META[listing.source] ?? { label: listing.source, color: theme.colors.textMuted };
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
          <Text style={styles.placeholderText}>kein Bild</Text>
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
          <View style={[styles.badge, { backgroundColor: meta.color }]}>
            <Text style={styles.badgeText}>{meta.label}</Text>
          </View>
          {listing.location ? (
            <Text style={styles.metaText} numberOfLines={1}>
              {listing.location}
            </Text>
          ) : null}
          {posted ? <Text style={styles.metaText}>· {posted}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginHorizontal: theme.spacing(4),
    marginBottom: theme.spacing(3),
    overflow: "hidden",
  },
  pressed: { opacity: 0.7 },
  image: { width: 104, height: 104, backgroundColor: theme.colors.border },
  imagePlaceholder: { alignItems: "center", justifyContent: "center" },
  placeholderText: { color: theme.colors.textMuted, fontSize: 12 },
  body: { flex: 1, padding: theme.spacing(3) },
  topRow: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing(2) },
  title: { flex: 1, fontSize: 15, fontWeight: "600", color: theme.colors.text },
  price: {
    marginTop: theme.spacing(1),
    fontSize: 17,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  priceFree: { color: theme.colors.free },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: theme.spacing(2),
    gap: theme.spacing(2),
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: theme.spacing(2),
    paddingVertical: 2,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  metaText: { color: theme.colors.textMuted, fontSize: 12, flexShrink: 1 },
});
