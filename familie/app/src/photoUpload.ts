import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

export interface PreparedPhoto {
  data: string;
  width: number;
  height: number;
}

const MAX_SIDE = 1600;

/**
 * Fotos auswaehlen (Galerie oder Kamera) und vor dem Hochladen auf max. 1600 px
 * verkleinern + als JPEG komprimieren. Spart Datenvolumen und Speicherplatz,
 * und entfernt nebenbei die meisten Metadaten (z. B. GPS-Position aus EXIF).
 */
export async function pickPhotos(source: "library" | "camera"): Promise<PreparedPhoto[] | null> {
  const perm =
    source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted && Platform.OS !== "web") {
    throw new Error(source === "camera" ? "Kein Zugriff auf die Kamera erlaubt." : "Kein Zugriff auf die Fotos erlaubt.");
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, exif: false };
  const res =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync({ ...opts, allowsMultipleSelection: true, selectionLimit: 30 });
  if (res.canceled) return null;
  return Promise.all(res.assets.map(prepare));
}

async function prepare(asset: ImagePicker.ImagePickerAsset): Promise<PreparedPhoto> {
  if (Platform.OS === "web") return prepareWeb(asset.uri);
  const { width, height } = asset;
  const scale = Math.min(1, MAX_SIDE / Math.max(width || MAX_SIDE, height || MAX_SIDE));
  const actions = scale < 1 ? [{ resize: width >= height ? { width: Math.round(width * scale) } : { height: Math.round(height * scale) } }] : [];
  const out = await ImageManipulator.manipulateAsync(asset.uri, actions, {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  if (!out.base64) throw new Error("Foto konnte nicht gelesen werden.");
  return { data: out.base64, width: out.width, height: out.height };
}

/**
 * Web: expo-image-manipulator ignoriert dort das JPEG-Format und liefert PNG
 * (5-10x groesser). Deshalb selbst per Canvas verkleinern und als JPEG kodieren.
 */
async function prepareWeb(uri: string): Promise<PreparedPhoto> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new window.Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Foto konnte nicht gelesen werden."));
    el.src = uri;
  });
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Foto konnte nicht verarbeitet werden.");
  ctx.drawImage(img, 0, 0, width, height);
  const data = canvas.toDataURL("image/jpeg", 0.8).split(",")[1] ?? "";
  if (!data) throw new Error("Foto konnte nicht verarbeitet werden.");
  return { data, width, height };
}
