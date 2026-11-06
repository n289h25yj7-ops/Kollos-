import { useEffect, useRef } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { theme } from "../theme";
import type { FamilyMapProps } from "./mapTypes";

/** Dunkler Kartenstil fuer Google Maps (Android); iOS nutzt den Dark Mode von Apple Maps. */
const DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1c1b21" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9d9aa4" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b0b0d" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2b2930" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f1418" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
];

/** Native Karte (Apple Maps / Google Maps) mit einem Pin pro Familienmitglied. */
export function FamilyMap({ pins, height, focusId }: FamilyMapProps) {
  const ref = useRef<MapView>(null);

  const fit = () => {
    if (!pins.length) return;
    ref.current?.fitToCoordinates(
      pins.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true },
    );
  };

  useEffect(() => {
    const target = pins.find((p) => p.id === focusId);
    if (target) {
      ref.current?.animateToRegion({ latitude: target.lat, longitude: target.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 400);
    } else {
      fit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, pins.length]);

  const first = pins[0];
  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        userInterfaceStyle="dark"
        customMapStyle={Platform.OS === "android" ? DARK_STYLE : undefined}
        onMapReady={fit}
        initialRegion={{
          latitude: first?.lat ?? 51.16,
          longitude: first?.lng ?? 10.45,
          latitudeDelta: first ? 0.08 : 8,
          longitudeDelta: first ? 0.08 : 8,
        }}
      >
        {pins.map((p) => (
          <Marker key={p.id} coordinate={{ latitude: p.lat, longitude: p.lng }} title={p.name} description={p.subtitle}>
            <View style={[styles.pin, { borderColor: p.color, backgroundColor: theme.colors.bg }]}>
              <Text style={[styles.pinText, { color: p.color }]}>{p.name.charAt(0).toUpperCase()}</Text>
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: theme.radius, overflow: "hidden", borderWidth: 1, borderColor: theme.colors.hairline, backgroundColor: theme.colors.surface },
  pin: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  pinText: { fontWeight: "800", fontSize: 15 },
});
