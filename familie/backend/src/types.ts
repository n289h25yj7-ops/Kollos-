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
  /** Expo-Push-Tokens der Geraete dieses Mitglieds. */
  pushTokens?: string[];
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
  /** Wiederholung; die einzelnen Vorkommen berechnet die App (in ihrer Zeitzone). */
  repeat?: EventRepeat;
  /** Letzter Tag der Serie (YYYY-MM-DD), optional. */
  repeatUntil?: string;
  createdBy: string;
  createdAt: string;
}

export type EventRepeat = "none" | "weekly" | "biweekly" | "monthly" | "yearly";

export interface Recipe {
  id: string;
  familyId: string;
  name: string;
  ingredients: string[];
  notes?: string;
  createdBy: string;
  createdAt: string;
}

/** Ein Gericht im Essensplan – eins pro Tag. */
export interface Meal {
  id: string;
  familyId: string;
  date: string;
  title: string;
  recipeId?: string;
  cookId?: string;
  createdBy: string;
}

export interface Birthday {
  id: string;
  familyId: string;
  name: string;
  /** Monat und Tag (MM-DD) */
  date: string;
  /** Geburtsjahr, optional – dann zeigt die App das Alter. */
  year?: number;
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

export interface Album {
  id: string;
  familyId: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

export interface Photo {
  id: string;
  familyId: string;
  albumId: string;
  /** Dateiname im Upload-Ordner. */
  file: string;
  mime: string;
  width?: number;
  height?: number;
  caption?: string;
  uploadedBy: string;
  createdAt: string;
}

export type Repeat = "none" | "daily" | "weekly";

export interface Task {
  id: string;
  familyId: string;
  title: string;
  /** Zustaendig; leer = wer zuerst kommt. */
  assigneeId?: string;
  points: number;
  /** Faellig am (YYYY-MM-DD). */
  due?: string;
  repeat: Repeat;
  /** Nur bei einmaligen Aufgaben; wiederkehrende ruecken stattdessen weiter. */
  done: boolean;
  createdBy: string;
  createdAt: string;
}

/** Punkte-Buchung: positiv = erledigte Aufgabe, negativ = eingeloeste Belohnung. */
export interface PointsEntry {
  id: string;
  familyId: string;
  memberId: string;
  points: number;
  kind: "task" | "reward";
  refId: string;
  title: string;
  at: string;
}

export interface Reward {
  id: string;
  familyId: string;
  title: string;
  cost: number;
  createdAt: string;
}

export interface Database {
  families: Family[];
  members: MemberRecord[];
  events: CalendarEvent[];
  lists: ShoppingList[];
  items: ShoppingItem[];
  messages: ChatMessage[];
  locations: MemberLocation[];
  albums: Album[];
  photos: Photo[];
  tasks: Task[];
  points: PointsEntry[];
  rewards: Reward[];
  recipes: Recipe[];
  meals: Meal[];
  birthdays: Birthday[];
}

/** Themen, zu denen der Server Echtzeit-Hinweise verschickt. */
export type Topic = "members" | "events" | "lists" | "messages" | "locations" | "albums" | "tasks" | "meals" | "birthdays";
