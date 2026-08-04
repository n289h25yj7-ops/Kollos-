import {
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Listing } from "../types";
import { SOURCE_META, theme } from "../theme";
import { formatPostedAt, formatPrice } from "../format";
import { useFavorites } from "../favorites/FavoritesContext";

/** Vollbild-Detailansicht eines Inserats im dunklen, edlen Stil. */
export function ListingDetail({
  listing,
  visible,
  onClose,
}: {
  listing: Listing | null;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {listing ? <DetailContent listing={listing} onClose={onClose} /> : null}
    </Modal>
  );
}

function DetailContent({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const { isFavorite, toggle } = useFavorites();
  const meta = SOURCE_META[listing.source] ?? { label: listing.source, dot: theme.colors.textFaint };
  const posted = formatPostedAt(listing.postedAt);
  const isFree = listing.priceType === "free" || listing.price === 0;
  const fav = isFavorite(listing.id);

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        {listing.imageUrl ? (
          <Image source={{ uri: listing.imageUrl }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={styles.heroPlaceholder}>
            <Text style={styles.heroGlyph}>◈</Text>
          </View>
        )}
        <View style={styles.float}>
          <Pressable style={styles.roundBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Zurueck">
            <Text style={styles.roundIcon}>‹</Text>
          </Pressable>
          <Pressable
            style={styles.roundBtn}
            onPress={() => toggle(listing)}
            accessibilityRole="button"
            accessibilityLabel={fav ? "Aus Merkliste entfernen" : "Zur Merkliste hinzufuegen"}
          >
            <Text style={[styles.roundIcon, fav && styles.heartOn]}>{fav ? "♥" : "♡"}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View style={styles.source}>
            <View style={[styles.dot, { backgroundColor: meta.dot }]} />
            <Text style={styles.sourceText}>{meta.label}</Text>
          </View>

          <Text style={styles.title}>{listing.title}</Text>
          <Text style={[styles.price, isFree && styles.priceFree]}>{formatPrice(listing)}</Text>

          <View style={styles.kv}>
            {listing.location ? <Row label="Ort" value={listing.location} /> : null}
            {posted ? <Row label="Eingestellt" value={posted} /> : null}
            <Row label="Quelle" value={meta.label} last />
          </View>

          {listing.description ? (
            <>
              <Text style={styles.section}>Beschreibung</Text>
              <Text style={styles.description}>{listing.description}</Text>
            </>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={styles.cta}
          onPress={() => Linking.openURL(listing.url).catch(() => undefined)}
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>Auf {meta.label} öffnen</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.k}>{label}</Text>
      <Text style={styles.v}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  hero: { height: 264, backgroundColor: theme.colors.surface3 },
  heroImage: { width: "100%", height: "100%" },
  heroPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  heroGlyph: { fontSize: 72, color: theme.colors.textFaint },
  float: {
    position: "absolute",
    top: theme.spacing(10),
    left: theme.spacing(4),
    right: theme.spacing(4),
    flexDirection: "row",
    justifyContent: "space-between",
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.hairline,
    backgroundColor: "rgba(10,10,12,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  roundIcon: { color: theme.colors.text, fontSize: 20, marginTop: -2 },
  heartOn: { color: theme.colors.gold },
  scroll: { paddingBottom: theme.spacing(6) },
  content: { padding: theme.spacing(5) },
  source: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(1.5),
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: theme.colors.hairline,
    borderRadius: 999,
    paddingHorizontal: theme.spacing(2.5),
    paddingVertical: theme.spacing(1),
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  sourceText: { color: theme.colors.textMuted, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase" },
  title: { marginTop: theme.spacing(3.5), fontSize: 21, fontWeight: "600", color: theme.colors.text, lineHeight: 27 },
  price: { marginTop: theme.spacing(2.5), fontSize: 27, fontWeight: "700", color: theme.colors.text },
  priceFree: { color: theme.colors.sage },
  kv: { marginTop: theme.spacing(5) },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: theme.spacing(3),
    borderTopWidth: 1,
    borderTopColor: theme.colors.hairline,
  },
  rowLast: { borderBottomWidth: 1, borderBottomColor: theme.colors.hairline },
  k: { color: theme.colors.textFaint, fontSize: 13 },
  v: { color: theme.colors.text, fontSize: 13.5, fontWeight: "600" },
  section: {
    marginTop: theme.spacing(6),
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: theme.colors.textFaint,
  },
  description: { marginTop: theme.spacing(2.5), color: "#cfccc4", fontSize: 15, lineHeight: 24 },
  footer: {
    padding: theme.spacing(5),
    borderTopWidth: 1,
    borderTopColor: theme.colors.hairline,
  },
  cta: {
    height: 52,
    borderRadius: 14,
    backgroundColor: theme.colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { color: theme.colors.onGold, fontSize: 15, fontWeight: "700" },
});
