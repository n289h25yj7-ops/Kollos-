import type { CalendarEvent, ChatMessage, MemberLocation, Session, ShoppingItem, ShoppingList } from "./types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const normalizeUrl = (url: string) => url.trim().replace(/\/+$/, "");

async function request<T>(baseUrl: string, method: string, path: string, token?: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(normalizeUrl(baseUrl) + path, {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Server nicht erreichbar. Stimmt die Server-Adresse?");
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Fehler ${res.status}`);
  return data as T;
}

/** Oeffentliche Aufrufe (vor der Anmeldung). */
export const publicApi = {
  createFamily: (baseUrl: string, familyName: string, memberName: string) =>
    request<Session>(baseUrl, "POST", "/families", undefined, { familyName, memberName }),
  joinFamily: (baseUrl: string, inviteCode: string, memberName: string) =>
    request<Session>(baseUrl, "POST", "/families/join", undefined, { inviteCode, memberName }),
};

/** Angemeldeter Client fuer eine Sitzung. */
export function createApi(baseUrl: string, token: string) {
  const r = <T>(method: string, path: string, body?: unknown) => request<T>(baseUrl, method, path, token, body);
  return {
    me: () => r<Session>("GET", "/me"),
    updateMe: (patch: { name?: string; color?: string }) => r<Session>("PATCH", "/me", patch),
    leave: () => r<void>("DELETE", "/me"),
    newInviteCode: () => r<Session["family"]>("POST", "/family/invite-code"),

    events: (from: string, to: string) =>
      r<CalendarEvent[]>("GET", `/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    createEvent: (e: Omit<CalendarEvent, "id" | "createdBy" | "createdAt">) => r<CalendarEvent>("POST", "/events", e),
    updateEvent: (id: string, e: Partial<CalendarEvent>) => r<CalendarEvent>("PATCH", `/events/${id}`, e),
    deleteEvent: (id: string) => r<void>("DELETE", `/events/${id}`),

    lists: () => r<ShoppingList[]>("GET", "/lists"),
    createList: (name: string) => r<ShoppingList>("POST", "/lists", { name }),
    deleteList: (id: string) => r<void>("DELETE", `/lists/${id}`),
    addItem: (listId: string, text: string) => r<ShoppingItem>("POST", `/lists/${listId}/items`, { text }),
    updateItem: (id: string, patch: { done?: boolean; text?: string }) => r<ShoppingItem>("PATCH", `/items/${id}`, patch),
    deleteItem: (id: string) => r<void>("DELETE", `/items/${id}`),
    clearDone: (listId: string) => r<void>("POST", `/lists/${listId}/clear-done`),

    messages: () => r<ChatMessage[]>("GET", "/messages?limit=200"),
    sendMessage: (text: string) => r<ChatMessage>("POST", "/messages", { text }),

    locations: () => r<MemberLocation[]>("GET", "/locations"),
    shareLocation: (lat: number, lng: number, accuracy?: number) =>
      r<MemberLocation>("PUT", "/locations/me", { lat, lng, accuracy }),
    stopSharing: () => r<void>("DELETE", "/locations/me"),
  };
}

export type Api = ReturnType<typeof createApi>;
