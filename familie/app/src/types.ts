/** Spiegel der Backend-Typen (familie/backend/src/types.ts). */

export interface Place {
  lat: number;
  lng: number;
  label: string;
}

export interface Family {
  id: string;
  name: string;
  home?: Place;
  inviteCode: string;
  createdAt: string;
}

export interface Member {
  id: string;
  familyId: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Session {
  token: string;
  member: Member;
  family: Family;
  members: Member[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  notes?: string;
  memberIds: string[];
  repeat?: EventRepeat;
  repeatUntil?: string;
  createdBy: string;
  createdAt: string;
  /** Nur bei berechneten Vorkommen einer Serie: Beginn/Ende des ersten Termins. */
  seriesStart?: string;
  seriesEnd?: string;
}

export type EventRepeat = "none" | "weekly" | "biweekly" | "monthly" | "yearly";

export interface Recipe {
  id: string;
  name: string;
  ingredients: string[];
  notes?: string;
  createdBy: string;
}

export interface Meal {
  id: string;
  date: string;
  title: string;
  recipeId?: string;
  cookId?: string;
  createdBy: string;
}

export interface Birthday {
  id: string;
  name: string;
  date: string;
  year?: number;
}

export interface ShoppingItem {
  id: string;
  listId: string;
  text: string;
  done: boolean;
  addedBy: string;
  createdAt: string;
}

export interface ShoppingList {
  id: string;
  name: string;
  createdAt: string;
  items: ShoppingItem[];
}

export interface Poll {
  question: string;
  options: { id: string; text: string }[];
  multi: boolean;
  votes: Record<string, string[]>;
  closed: boolean;
}

export type TravelMode = "walk" | "bike" | "car" | "transit";

export interface Eta {
  mode: TravelMode;
  destination: string;
  minutes: number;
  arriveAt: string;
  arrivedAt?: string;
  replaced?: boolean;
}

export interface ChatMessage {
  id: string;
  memberId: string;
  text: string;
  kind?: "text" | "poll" | "eta";
  poll?: Poll;
  eta?: Eta;
  createdAt: string;
}

export interface MemberLocation {
  memberId: string;
  lat: number;
  lng: number;
  accuracy?: number;
  updatedAt: string;
}

export type Topic = "members" | "events" | "lists" | "messages" | "locations" | "albums" | "tasks" | "meals" | "birthdays";

export interface Album {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  count: number;
  coverId?: string;
  updatedAt: string;
}

export interface Photo {
  id: string;
  albumId: string;
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
  title: string;
  assigneeId?: string;
  points: number;
  due?: string;
  repeat: Repeat;
  done: boolean;
  createdBy: string;
  createdAt: string;
}

export interface PointsEntry {
  id: string;
  memberId: string;
  points: number;
  kind: "task" | "reward";
  title: string;
  at: string;
}

export interface Balance {
  memberId: string;
  earned: number;
  spent: number;
  balance: number;
  week: number;
}

export interface Reward {
  id: string;
  title: string;
  cost: number;
}
