import { distanceKm } from "./format";
import type { TravelMode } from "./types";

export const MODES: Record<TravelMode, { icon: string; label: string; kmh: number; overhead: number }> = {
  walk: { icon: "🚶", label: "Zu Fuß", kmh: 4.5, overhead: 0 },
  bike: { icon: "🚲", label: "Fahrrad", kmh: 14, overhead: 1 },
  car: { icon: "🚗", label: "Auto", kmh: 30, overhead: 3 },
  transit: { icon: "🚌", label: "Bus & Bahn", kmh: 20, overhead: 6 },
};

/** Umweg-Faktor: Strassen sind laenger als die Luftlinie. */
const DETOUR = 1.3;

/** Grobe Fahrzeit-Schaetzung in Minuten (Luftlinie x Umweg / Tempo + Parken/Warten). */
export function estimateMinutes(from: { lat: number; lng: number }, to: { lat: number; lng: number }, mode: TravelMode): { minutes: number; km: number } {
  const km = distanceKm(from, to);
  const m = MODES[mode];
  const minutes = Math.max(1, Math.round(((km * DETOUR) / m.kmh) * 60 + (km > 0.3 ? m.overhead : 0)));
  return { minutes, km };
}

/** Ab dieser Entfernung (km) gilt man als angekommen. */
export const ARRIVAL_RADIUS_KM = 0.15;
