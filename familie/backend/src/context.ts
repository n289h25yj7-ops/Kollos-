import type { Request, RequestHandler } from "express";
import type { Store } from "./store.js";
import type { Database, MemberRecord, Topic } from "./types.js";

export interface NotifyOptions {
  title: string;
  body: string;
  /** Diese Person nicht benachrichtigen (meist der Ausloeser selbst). */
  except?: string;
  /** Nur diese Personen benachrichtigen. */
  only?: string[];
  data?: Record<string, unknown>;
}

/** Was die einzelnen Feature-Module vom Kern brauchen. */
export interface Ctx {
  db: Database;
  store: Store;
  auth: RequestHandler;
  me: (req: Request) => MemberRecord;
  changed: (familyId: string, topic: Topic) => void;
  notify: (familyId: string, opts: NotifyOptions) => void;
  /** Ordner fuer Foto-Dateien; null = nur im Speicher (Tests). */
  uploadsDir: string | null;
}
