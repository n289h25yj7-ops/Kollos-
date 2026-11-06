import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Database } from "./types.js";

/**
 * Bewusst simpler Speicher: alles im Arbeitsspeicher, verzoegert als JSON-Datei
 * gesichert. Fuer eine Familie voellig ausreichend und ohne Datenbank-Setup.
 * Spaeter laesst sich das hinter derselben Schnittstelle durch SQLite/Postgres ersetzen.
 */
const empty = (): Database => ({
  families: [],
  members: [],
  events: [],
  lists: [],
  items: [],
  messages: [],
  locations: [],
});

export class Store {
  readonly db: Database;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly file: string | null) {
    this.db = empty();
    if (file && existsSync(file)) {
      Object.assign(this.db, JSON.parse(readFileSync(file, "utf8")) as Partial<Database>);
    }
  }

  /** Aenderungen markieren; geschrieben wird gebuendelt nach kurzer Pause. */
  save(): void {
    if (!this.file || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, 300);
  }

  flush(): void {
    if (!this.file) return;
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.db, null, 2));
    renameSync(tmp, this.file);
  }
}
