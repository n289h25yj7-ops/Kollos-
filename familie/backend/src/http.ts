/** Gemeinsame Helfer fuer Validierung und Fehler. */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const now = () => new Date().toISOString();

export function str(value: unknown, field: string, { max = 500, optional = false } = {}): string | undefined {
  if (value === undefined || value === null || value === "") {
    if (optional) return undefined;
    throw new HttpError(400, `Feld "${field}" fehlt.`);
  }
  if (typeof value !== "string") throw new HttpError(400, `Feld "${field}" muss Text sein.`);
  const trimmed = value.trim();
  if (!trimmed && !optional) throw new HttpError(400, `Feld "${field}" darf nicht leer sein.`);
  if (trimmed.length > max) throw new HttpError(400, `Feld "${field}" ist zu lang (max. ${max}).`);
  return trimmed || undefined;
}

export function isoDate(value: unknown, field: string, optional = false): string | undefined {
  const s = str(value, field, { max: 40, optional });
  if (s === undefined) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, `Feld "${field}" ist kein gueltiges Datum.`);
  return d.toISOString();
}

/** Kalendertag im Format YYYY-MM-DD (ohne Uhrzeit/Zeitzone). */
export function day(value: unknown, field: string, optional = false): string | undefined {
  const s = str(value, field, { max: 10, optional });
  if (s === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(new Date(`${s}T00:00:00Z`).getTime())) {
    throw new HttpError(400, `Feld "${field}" muss ein Datum wie 2026-11-06 sein.`);
  }
  return s;
}

export function int(value: unknown, field: string, { min = 0, max = 1_000_000 } = {}): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, `Feld "${field}" muss eine Zahl von ${min} bis ${max} sein.`);
  return n;
}
