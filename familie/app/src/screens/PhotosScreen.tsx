import { useEffect, useRef, useState } from "react";
import { Alert, FlatList, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "../session";
import { brandFont, theme } from "../theme";
import type { Album, Photo } from "../types";
import { Button, Empty, ErrorText, Input, ScreenHeader } from "../components/ui";
import { pickPhotos } from "../photoUpload";

const c = theme.colors;
const MAX_WIDTH = 720;

function confirm(title: string, text: string, yes: string, onYes: () => void) {
  if (Platform.OS === "web") {
    if (globalThis.confirm?.(`${title}\n\n${text}`)) onYes();
    return;
  }
  Alert.alert(title, text, [
    { text: "Abbrechen", style: "cancel" },
    { text: yes, style: "destructive", onPress: onYes },
  ]);
}

export function PhotosScreen() {
  const [open, setOpen] = useState<Album | null>(null);
  return open ? <AlbumView album={open} onBack={() => setOpen(null)} /> : <AlbumList onOpen={setOpen} />;
}

// ---------------------------------------------------------------- Albumliste

function AlbumList({ onOpen }: { onOpen: (a: Album) => void }) {
  const { api, memberById } = useSession();
  const qc = useQueryClient();
  const albums = useQuery({ queryKey: ["albums", "list"], queryFn: api.albums });
  const [name, setName] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const tile = (Math.min(width, MAX_WIDTH) - theme.spacing(4) * 2 - theme.spacing(3)) / 2;

  const create = useMutation({
    mutationFn: (n: string) => api.createAlbum(n),
    onSuccess: (a) => {
      setName(null);
      void qc.invalidateQueries({ queryKey: ["albums"] });
      onOpen(a);
    },
  });

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader eyebrow="Fotoalben" title="Erinnerungen" />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {name === null ? (
          <Button label="+ Neues Album" onPress={() => setName("")} />
        ) : (
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Input value={name} onChangeText={setName} placeholder="z. B. Sommerurlaub 2026" autoFocus maxLength={60} onSubmitEditing={() => name.trim() && create.mutate(name.trim())} />
            </View>
            <Button label="Anlegen" onPress={() => create.mutate(name.trim())} disabled={!name.trim()} loading={create.isPending} />
            <Button variant="ghost" label="✕" onPress={() => setName(null)} />
          </View>
        )}
        <ErrorText error={albums.error ?? create.error} />
        {albums.data?.length === 0 ? <Empty icon="▣" title="Noch keine Alben" text="Leg ein Album an – z. B. für den Urlaub, Geburtstage oder einfach „Alltag“." /> : null}
        <View style={s.albumGrid}>
          {(albums.data ?? []).map((a) => (
            <Pressable key={a.id} onPress={() => onOpen(a)} style={{ width: tile }} accessibilityRole="button" accessibilityLabel={`Album ${a.name}`}>
              <View style={[s.cover, { width: tile, height: tile }]}>
                {a.coverId ? <Image source={{ uri: api.photoUrl(a.coverId) }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Text style={s.coverEmpty}>▣</Text>}
              </View>
              <Text style={s.albumName} numberOfLines={1}>
                {a.name}
              </Text>
              <Text style={s.albumMeta}>
                {a.count} {a.count === 1 ? "Foto" : "Fotos"} · {memberById(a.createdBy)?.name ?? "—"}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------- Album

function AlbumView({ album, onBack }: { album: Album; onBack: () => void }) {
  const { api } = useSession();
  const qc = useQueryClient();
  const photos = useQuery({ queryKey: ["albums", album.id], queryFn: () => api.photos(album.id) });
  const [viewer, setViewer] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const { width } = useWindowDimensions();
  const cols = width > 600 ? 4 : 3;
  const gap = 3;
  const tile = Math.floor((Math.min(width, MAX_WIDTH) - theme.spacing(4) * 2 - gap * (cols - 1)) / cols);

  const add = async (source: "library" | "camera") => {
    setError(null);
    try {
      const picked = await pickPhotos(source);
      if (!picked?.length) return;
      setProgress({ done: 0, total: picked.length });
      for (const [i, p] of picked.entries()) {
        await api.uploadPhoto(album.id, p);
        setProgress({ done: i + 1, total: picked.length });
        void qc.invalidateQueries({ queryKey: ["albums", album.id] });
      }
    } catch (e) {
      setError(e);
    } finally {
      setProgress(null);
      void qc.invalidateQueries({ queryKey: ["albums"] });
    }
  };

  const removeAlbum = useMutation({
    mutationFn: () => api.deleteAlbum(album.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["albums"] });
      onBack();
    },
  });

  const list = photos.data ?? [];

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader eyebrow={`Album · ${list.length} ${list.length === 1 ? "Foto" : "Fotos"}`} title={album.name} />
      <View style={[s.row, { paddingHorizontal: theme.spacing(4), marginBottom: theme.spacing(3) }]}>
        <Button small variant="ghost" label="‹ Alben" onPress={onBack} />
        <View style={{ flex: 1 }} />
        {Platform.OS !== "web" ? <Button small variant="ghost" label="Kamera" onPress={() => void add("camera")} disabled={!!progress} /> : null}
        <Button small label="+ Fotos" onPress={() => void add("library")} loading={!!progress} />
      </View>
      {progress ? (
        <View style={s.progressWrap}>
          <Text style={s.albumMeta}>
            Lade hoch … {progress.done}/{progress.total}
          </Text>
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${(progress.done / progress.total) * 100}%` }]} />
          </View>
        </View>
      ) : null}
      <View style={{ paddingHorizontal: theme.spacing(4) }}>
        <ErrorText error={photos.error ?? error ?? removeAlbum.error} />
      </View>
      <FlatList
        key={cols}
        data={list}
        numColumns={cols}
        keyExtractor={(p) => p.id}
        style={{ alignSelf: "center", width: "100%", maxWidth: MAX_WIDTH }}
        columnWrapperStyle={{ gap }}
        contentContainerStyle={{ paddingHorizontal: theme.spacing(4), gap, paddingBottom: theme.spacing(24) }}
        ListEmptyComponent={<Empty icon="✧" title="Album ist leer" text="Tippe auf „+ Fotos“ und wähle gleich mehrere Bilder aus." />}
        renderItem={({ item, index }) => (
          <Pressable onPress={() => setViewer(index)} accessibilityRole="button" accessibilityLabel={item.caption ?? "Foto öffnen"}>
            <Image source={{ uri: api.photoUrl(item.id) }} style={{ width: tile, height: tile, borderRadius: 4, backgroundColor: c.surface2 }} />
          </Pressable>
        )}
        ListFooterComponent={
          <Text style={s.deleteAlbum} onPress={() => confirm("Album löschen?", `„${album.name}“ und alle Fotos werden für alle gelöscht.`, "Löschen", () => removeAlbum.mutate())}>
            Album löschen
          </Text>
        }
      />
      {viewer !== null && list.length ? <Viewer photos={list} start={Math.min(viewer, list.length - 1)} onClose={() => setViewer(null)} /> : null}
    </View>
  );
}

// ---------------------------------------------------------------- Vollbild

function Viewer({ photos, start, onClose }: { photos: Photo[]; start: number; onClose: () => void }) {
  const { api, memberById } = useSession();
  const qc = useQueryClient();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(start);
  const [caption, setCaption] = useState<string | null>(null);
  const listRef = useRef<FlatList<Photo>>(null);
  const photo = photos[index] ?? photos[0]!;

  useEffect(() => {
    if (index >= photos.length) setIndex(Math.max(0, photos.length - 1));
  }, [photos.length, index]);

  const go = (i: number) => {
    const next = Math.max(0, Math.min(photos.length - 1, i));
    setIndex(next);
    setCaption(null);
    listRef.current?.scrollToIndex({ index: next, animated: true });
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ["albums"] });
  const remove = useMutation({
    mutationFn: (id: string) => api.deletePhoto(id),
    onSuccess: () => {
      if (photos.length <= 1) onClose();
      void refresh();
    },
  });
  const saveCaption = useMutation({
    mutationFn: () => api.updatePhoto(photo.id, caption ?? ""),
    onSuccess: () => {
      setCaption(null);
      void refresh();
    },
  });

  const author = memberById(photo.uploadedBy);
  const date = new Date(photo.createdAt).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} transparent={false}>
      <View style={s.viewer}>
        <FlatList
          ref={listRef}
          data={photos}
          horizontal
          pagingEnabled
          initialScrollIndex={start}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(p) => p.id}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <View style={{ width, height, justifyContent: "center" }}>
              <Image source={{ uri: api.photoUrl(item.id) }} style={{ width, height: height * 0.78 }} resizeMode="contain" />
            </View>
          )}
        />
        <View style={s.viewerTop}>
          <Button small variant="ghost" label="✕ Schließen" onPress={onClose} />
          <Text style={s.viewerCount}>
            {index + 1} / {photos.length}
          </Text>
        </View>
        {photos.length > 1 && Platform.OS === "web" ? (
          <>
            <Pressable style={[s.arrow, { left: 8 }]} onPress={() => go(index - 1)} accessibilityLabel="Vorheriges Foto">
              <Text style={s.arrowText}>‹</Text>
            </Pressable>
            <Pressable style={[s.arrow, { right: 8 }]} onPress={() => go(index + 1)} accessibilityLabel="Nächstes Foto">
              <Text style={s.arrowText}>›</Text>
            </Pressable>
          </>
        ) : null}
        <View style={s.viewerBottom}>
          {caption === null ? (
            <Pressable onPress={() => setCaption(photo.caption ?? "")}>
              <Text style={[s.caption, !photo.caption && { color: c.textFaint }]}>{photo.caption || "Beschreibung hinzufügen …"}</Text>
            </Pressable>
          ) : (
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Input value={caption} onChangeText={setCaption} placeholder="Beschreibung" autoFocus maxLength={300} onSubmitEditing={() => saveCaption.mutate()} />
              </View>
              <Button small label="OK" onPress={() => saveCaption.mutate()} loading={saveCaption.isPending} />
            </View>
          )}
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <Text style={s.albumMeta}>
              {author?.name ?? "Ehemaliges Mitglied"} · {date}
            </Text>
            <Text style={s.deletePhoto} onPress={() => confirm("Foto löschen?", "Das Foto wird für alle gelöscht.", "Löschen", () => remove.mutate(photo.id))}>
              Löschen
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: theme.spacing(4), paddingBottom: theme.spacing(24), gap: theme.spacing(4), width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing(2) },
  albumGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing(3) },
  cover: { borderRadius: theme.radius, overflow: "hidden", backgroundColor: c.surface2, borderWidth: 1, borderColor: c.hairline, alignItems: "center", justifyContent: "center" },
  coverEmpty: { color: c.textFaint, fontSize: 30 },
  albumName: { color: c.text, fontSize: 16, fontFamily: brandFont, marginTop: 8 },
  albumMeta: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  progressWrap: { paddingHorizontal: theme.spacing(4), marginBottom: theme.spacing(3), gap: 6 },
  progressBar: { height: 4, borderRadius: 2, backgroundColor: c.surface3, overflow: "hidden" },
  progressFill: { height: 4, backgroundColor: c.gold },
  deleteAlbum: { color: c.textFaint, textAlign: "center", marginTop: theme.spacing(10), fontSize: 13 },
  viewer: { flex: 1, backgroundColor: "#000" },
  viewerTop: { position: "absolute", top: theme.spacing(10), left: theme.spacing(4), right: theme.spacing(4), flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  viewerCount: { color: c.textMuted, fontSize: 13 },
  viewerBottom: { position: "absolute", bottom: theme.spacing(8), left: theme.spacing(5), right: theme.spacing(5), gap: theme.spacing(2) },
  caption: { color: c.text, fontSize: 16, lineHeight: 22 },
  deletePhoto: { color: c.danger, fontSize: 13 },
  arrow: { position: "absolute", top: "45%", width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  arrowText: { color: c.text, fontSize: 28, marginTop: -3 },
});
