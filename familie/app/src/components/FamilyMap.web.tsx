import { createElement, useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { theme } from "../theme";
import type { FamilyMapProps } from "./mapTypes";

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** Dunkler Look fuer die OSM-Kacheln + Pins im App-Stil (einmalig ins Dokument). */
function ensureStyles() {
  if (document.getElementById("familie-map-css")) return;
  const el = document.createElement("style");
  el.id = "familie-map-css";
  el.textContent = `
.familie-map .leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) brightness(.85) contrast(.9) saturate(.4)}
.familie-map{background:${theme.colors.surface}}
.familie-pin{width:32px;height:32px;border-radius:50%;border:2px solid;background:${theme.colors.bg};display:flex;align-items:center;justify-content:center;font:800 14px system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.5)}
.familie-map .leaflet-tooltip{background:${theme.colors.surface2};color:${theme.colors.text};border:1px solid rgba(255,255,255,.12);font:600 12px system-ui,sans-serif}
.familie-map .leaflet-tooltip:before{display:none}
.familie-map .leaflet-control-attribution{background:rgba(0,0,0,.55);color:#888}
.familie-map .leaflet-control-attribution a{color:#aaa}`;
  document.head.appendChild(el);
}

/**
 * Web-Variante: OpenStreetMap + Leaflet (react-native-maps gibt es im Browser
 * nicht). Metro waehlt diese Datei automatisch fuer Web. Leaflet ist mitgebaut,
 * es wird kein fremdes CDN geladen.
 */
export function FamilyMap({ pins, height, focusId }: FamilyMapProps) {
  const el = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    ensureStyles();
    map.current = L.map(el.current, { zoomControl: false, attributionControl: true }).setView([51.16, 10.45], 5);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !layer.current) return;
    layer.current.clearLayers();
    const points: L.LatLngTuple[] = [];
    for (const p of pins) {
      const icon = L.divIcon({
        className: "",
        html: `<div class="familie-pin" style="border-color:${p.color};color:${p.color}">${esc(p.name.charAt(0).toUpperCase())}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      L.marker([p.lat, p.lng], { icon })
        .bindTooltip(`${esc(p.name)} · ${esc(p.subtitle)}`, { direction: "top", offset: [0, -18] })
        .addTo(layer.current);
      points.push([p.lat, p.lng]);
    }
    const focus = pins.find((p) => p.id === focusId);
    if (focus) m.setView([focus.lat, focus.lng], 15);
    else if (points.length === 1) m.setView(points[0]!, 14);
    else if (points.length) m.fitBounds(points, { padding: [50, 50] });
  }, [pins, focusId]);

  return (
    <View style={[styles.wrap, { height }]}>
      {createElement("div", { ref: el, className: "familie-map", style: { width: "100%", height: "100%" } })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: theme.radius, overflow: "hidden", borderWidth: 1, borderColor: theme.colors.hairline, backgroundColor: theme.colors.surface },
});
