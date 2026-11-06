/** Spiegel der Backend-Typen (familie/backend/src/types.ts). */

export interface Family {
  id: string;
  name: string;
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
  createdBy: string;
  createdAt: string;
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

export interface ChatMessage {
  id: string;
  memberId: string;
  text: string;
  createdAt: string;
}

export interface MemberLocation {
  memberId: string;
  lat: number;
  lng: number;
  accuracy?: number;
  updatedAt: string;
}

export type Topic = "members" | "events" | "lists" | "messages" | "locations";
