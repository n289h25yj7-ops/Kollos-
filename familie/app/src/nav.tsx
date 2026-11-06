import { createContext, useContext } from "react";

export type Tab = "today" | "calendar" | "shopping" | "tasks" | "chat" | "photos" | "map";

export interface Nav {
  tab: Tab;
  setTab: (t: Tab) => void;
  openFamily: () => void;
}

export const NavContext = createContext<Nav>({ tab: "today", setTab: () => {}, openFamily: () => {} });
export const useNav = () => useContext(NavContext);
