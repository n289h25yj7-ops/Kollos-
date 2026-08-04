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
import { FavoriteButton } from "../components/FavoriteButton";

/** Vollbild-Detailansicht eines Inserats, als Modal ueber die Liste gelegt. */
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
  const meta = SOURCE_META[listing.source] ?? { label: listing.source, color: theme.colors.textMuted };
  const posted = formatPostedAt(listing.postedAt);
  const isFree = listing.priceType === "free" || listing.price === 0;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Zurueck">
          <Text style={styles.close}>‹ Zurück</Text>
        </Pressable>
        <FavoriteButton listing={listing} size={26} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {listing.imageUrl ? (
          <Image source={{ uri: listing.imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.placeholderText}>kein Bild</Text>
          </View>
        )}

        <View style={styles.content}>
          <View style={[styles.badge, { backgroundColor: meta.color }]}>
            <Text style={styles.badgeText}>{meta.label}</Text>
          </View>

          <Text style={styles.title}>{listing.title}</Text>
          <Text style={[styles.price, isFree && styles.priceFree]}>{formatPrice(listing)}</Text>

          <View style={styles.metaBlock}>
            {listing.location ? <MetaRow label="Ort" value={listing.location} /> : null}
            {posted ? <MetaRow label="Eingestellt" value={posted} /> : null}
            <MetaRow label="Quelle" value={meta.label} />
          </View>

          {listing.description ? (
            <>
              <Text style={styles.sectionTitle}>Beschreibung</Text>
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

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing(4),
    paddingTop: theme.spacing(10),
    paddingBottom: theme.spacing(2),
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  close: { color: theme.colors.primary, fontSize: 16, fontWeight: "600" },
  scroll: { paddingBottom: theme.spacing(6) },
  image: { width: "100%", height: 260, backgroundColor: theme.colors.border },
  imagePlaceholder: { alignItems: "center", justifyContent: "center" },
  placeholderText: { color: theme.colors.textMuted },
  content: { padding: theme.spacing(4) },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingHorizontal: theme.spacing(2),
    paddingVertical: 2,
    marginBottom: theme.spacing(2),
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
  price: { marginTop: theme.spacing(2), fontSize: 26, fontWeight: "800", color: theme.colors.primary },
  priceFree: { color: theme.colors.free },
  metaBlock: {
    marginTop: theme.spacing(4),
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: theme.spacing(2),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  metaLabel: { color: theme.colors.textMuted, fontSize: 14 },
  metaValue: { color: theme.colors.text, fontSize: 14, fontWeight: "600" },
  sectionTitle: {
    marginTop: theme.spacing(5),
    marginBottom: theme.spacing(2),
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
  },
  description: { color: theme.colors.text, fontSize: 15, lineHeight: 22 },
  footer: {
    padding: theme.spacing(4),
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  cta: {
    height: 50,
    borderRadius: theme.radius,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
