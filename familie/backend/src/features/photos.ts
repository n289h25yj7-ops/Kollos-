import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Express, Request } from "express";
import type { Ctx } from "../context.js";
import { HttpError, now, str } from "../http.js";
import type { Photo } from "../types.js";

const MAX_BYTES = 10 * 1024 * 1024;

/** Bildtyp anhand der ersten Bytes erkennen – Dateiendungen/Angaben des Clients zaehlen nicht. */
function sniff(buf: Buffer): { mime: string; ext: string } | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}

/**
 * Fotoalben. Bilder kommen als Base64 im JSON (funktioniert identisch auf iOS,
 * Android und Web), werden auf der Platte abgelegt und nur an angemeldete
 * Familienmitglieder ausgeliefert.
 */
export function registerPhotos(app: Express, ctx: Ctx) {
  const { db, auth, me, changed, notify, uploadsDir } = ctx;
  /** Ohne Upload-Ordner (Tests) bleiben die Bytes im Speicher. */
  const memoryFiles = new Map<string, Buffer>();
  /** Nicht bei jedem einzelnen Foto pushen: hoechstens einmal pro Album/Person in 5 Minuten. */
  const lastPush = new Map<string, number>();

  if (uploadsDir) mkdirSync(uploadsDir, { recursive: true });

  const ownAlbum = (req: Request, id = req.params.id) => {
    const a = db.albums.find((x) => x.id === id && x.familyId === me(req).familyId);
    if (!a) throw new HttpError(404, "Album nicht gefunden.");
    return a;
  };
  const ownPhoto = (req: Request) => {
    const p = db.photos.find((x) => x.id === req.params.id && x.familyId === me(req).familyId);
    if (!p) throw new HttpError(404, "Foto nicht gefunden.");
    return p;
  };
  const removeFile = (p: Photo) => {
    memoryFiles.delete(p.file);
    if (uploadsDir) rmSync(join(uploadsDir, p.file), { force: true });
  };

  app.get("/albums", auth, (req, res) => {
    const familyId = me(req).familyId;
    const albums = db.albums
      .filter((a) => a.familyId === familyId)
      .map((a) => {
        const photos = db.photos.filter((p) => p.albumId === a.id);
        const latest = photos.at(-1);
        return { ...a, count: photos.length, coverId: latest?.id, updatedAt: latest?.createdAt ?? a.createdAt };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    res.json(albums);
  });

  app.post("/albums", auth, (req, res) => {
    const m = me(req);
    const album = { id: randomUUID(), familyId: m.familyId, name: str(req.body?.name, "name", { max: 60 })!, createdBy: m.id, createdAt: now() };
    db.albums.push(album);
    changed(m.familyId, "albums");
    res.status(201).json({ ...album, count: 0, updatedAt: album.createdAt });
  });

  app.patch("/albums/:id", auth, (req, res) => {
    const a = ownAlbum(req);
    a.name = str(req.body?.name, "name", { max: 60 })!;
    changed(a.familyId, "albums");
    res.json(a);
  });

  app.delete("/albums/:id", auth, (req, res) => {
    const a = ownAlbum(req);
    for (const p of db.photos.filter((x) => x.albumId === a.id)) removeFile(p);
    db.photos = db.photos.filter((x) => x.albumId !== a.id);
    db.albums.splice(db.albums.indexOf(a), 1);
    changed(a.familyId, "albums");
    res.status(204).end();
  });

  app.get("/albums/:id/photos", auth, (req, res) => {
    const a = ownAlbum(req);
    res.json(db.photos.filter((p) => p.albumId === a.id).map(({ file: _f, ...p }) => p));
  });

  app.post("/albums/:id/photos", auth, (req, res) => {
    const m = me(req);
    const a = ownAlbum(req);
    const raw = typeof req.body?.data === "string" ? req.body.data.replace(/^data:[^,]*,/, "") : "";
    const buf = Buffer.from(raw, "base64");
    if (!buf.length) throw new HttpError(400, `Feld "data" (Base64-Bild) fehlt.`);
    if (buf.length > MAX_BYTES) throw new HttpError(413, "Foto ist zu gross (max. 10 MB).");
    const type = sniff(buf);
    if (!type) throw new HttpError(415, "Nur JPEG, PNG oder WebP werden unterstuetzt.");

    const id = randomUUID();
    const file = `${id}.${type.ext}`;
    if (uploadsDir) writeFileSync(join(uploadsDir, file), buf);
    else memoryFiles.set(file, buf);

    const dim = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 && (v as number) < 100_000 ? (v as number) : undefined);
    const photo: Photo = {
      id,
      familyId: a.familyId,
      albumId: a.id,
      file,
      mime: type.mime,
      width: dim(req.body?.width),
      height: dim(req.body?.height),
      caption: str(req.body?.caption, "caption", { max: 300, optional: true }),
      uploadedBy: m.id,
      createdAt: now(),
    };
    db.photos.push(photo);
    changed(a.familyId, "albums");

    const key = `${a.id}:${m.id}`;
    if (Date.now() - (lastPush.get(key) ?? 0) > 5 * 60_000) {
      lastPush.set(key, Date.now());
      notify(a.familyId, { except: m.id, title: `📸 ${a.name}`, body: `${m.name} hat neue Fotos hinzugefügt`, data: { tab: "photos" } });
    }
    const { file: _f, ...out } = photo;
    res.status(201).json(out);
  });

  app.patch("/photos/:id", auth, (req, res) => {
    const p = ownPhoto(req);
    p.caption = str(req.body?.caption, "caption", { max: 300, optional: true });
    changed(p.familyId, "albums");
    res.json(p);
  });

  app.delete("/photos/:id", auth, (req, res) => {
    const p = ownPhoto(req);
    removeFile(p);
    db.photos.splice(db.photos.indexOf(p), 1);
    changed(p.familyId, "albums");
    res.status(204).end();
  });

  app.get("/photos/:id/file", auth, (req, res) => {
    const p = ownPhoto(req);
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.type(p.mime);
    if (!uploadsDir) {
      const buf = memoryFiles.get(p.file);
      if (!buf) throw new HttpError(404, "Datei fehlt.");
      return res.send(buf);
    }
    res.sendFile(join(uploadsDir, p.file), { dotfiles: "deny" }, (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: "Datei fehlt." });
    });
  });
}
