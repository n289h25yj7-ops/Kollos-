export interface MapPin {
  id: string;
  name: string;
  color: string;
  lat: number;
  lng: number;
  /** z. B. "vor 5 Min." */
  subtitle: string;
}

export interface FamilyMapProps {
  pins: MapPin[];
  height: number;
  /** Wechselt der Wert, wird auf diese Person gezoomt. */
  focusId?: string | null;
}
