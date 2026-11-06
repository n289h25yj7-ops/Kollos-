/** Datenmodell der Familien-App. Alle Zeitangaben als ISO-Strings. */

export interface Family {
  id: string;
  name: string;
  /** Einladungscode, mit dem weitere Mitglieder beitreten. */
  inviteCode: string;
  createdAt: string;
}

export interface Member {
  id: string;
  familyId: string;
  name: string;
  /** Akzentfarbe fuer Avatar/Kalender. */
  color: string;
  createdAt: string;
}

/** Interner Datensatz inkl. geheimem Token (wird nie an andere Mitglieder ausgeliefert). */
export interface MemberRecord extends Member {
  token: string;
}

export interface CalendarEvent {
  id: string;
  familyId: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  notes?: string;
  /** Fuer wen ist der Termin? Leer = ganze Familie. */
  memberIds: string[];
  createdBy: string;
  createdAt: string;
}

export interface ShoppingList {
  id: string;
  familyId: string;
  name: string;
  createdAt: string;
}

export interface ShoppingItem {
  id: string;
  familyId: string;
  listId: string;
  text: string;
  done: boolean;
  addedBy: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  familyId: string;
  memberId: string;
  text: string;
  createdAt: string;
}

export interface MemberLocation {
  memberId: string;
  familyId: string;
  lat: number;
  lng: number;
  accuracy?: number;
  updatedAt: string;
}

export interface Database {
  families: Family[];
  members: MemberRecord[];
  events: CalendarEvent[];
  lists: ShoppingList[];
  items: ShoppingItem[];
  messages: ChatMessage[];
  locations: MemberLocation[];
}

/** Themen, zu denen der Server Echtzeit-Hinweise verschickt. */
export type Topic = "members" | "events" | "lists" | "messages" | "locations";
