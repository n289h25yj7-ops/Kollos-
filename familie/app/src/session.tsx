import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, createApi, type Api } from "./api";
import { load, save } from "./storage";
import type { Member, Session, Topic } from "./types";

const STORAGE_KEY = "familie.session.v1";

interface Stored {
  serverUrl: string;
  token: string;
}

interface SessionValue {
  api: Api;
  session: Session;
  members: Member[];
  memberById: (id: string) => Member | undefined;
  /** true, solange die Echtzeit-Verbindung steht. */
  live: boolean;
  serverUrl: string;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession ausserhalb von SessionProvider");
  return v;
}

/** Laedt die gespeicherte Anmeldung; zeigt bis dahin `loading`, ohne Anmeldung `fallback`. */
export function SessionGate({
  loading,
  fallback,
  children,
}: {
  loading: ReactNode;
  fallback: (signIn: (serverUrl: string, s: Session) => Promise<void>) => ReactNode;
  children: ReactNode;
}) {
  const [stored, setStored] = useState<Stored | null | undefined>(undefined);
  const queryClient = useQueryClient();

  useEffect(() => {
    load<Stored>(STORAGE_KEY).then(setStored);
  }, []);

  const signIn = useCallback(
    async (serverUrl: string, s: Session) => {
      const next = { serverUrl, token: s.token };
      queryClient.clear();
      queryClient.setQueryData(["me"], s);
      await save(STORAGE_KEY, next);
      setStored(next);
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    await save(STORAGE_KEY, null);
    queryClient.clear();
    setStored(null);
  }, [queryClient]);

  if (stored === undefined) return <>{loading}</>;
  if (stored === null) return <>{fallback(signIn)}</>;
  return (
    <SessionProvider stored={stored} signOut={signOut} loading={loading}>
      {children}
    </SessionProvider>
  );
}

function SessionProvider({
  stored,
  signOut,
  loading,
  children,
}: {
  stored: Stored;
  signOut: () => Promise<void>;
  loading: ReactNode;
  children: ReactNode;
}) {
  const api = useMemo(() => createApi(stored.serverUrl, stored.token), [stored]);
  const live = useRealtime(stored);
  const me = useQuery({ queryKey: ["me"], queryFn: api.me, retry: (n, e) => !(e instanceof ApiError && e.status === 401) && n < 2 });

  // Token ungueltig (z. B. Familie verlassen auf anderem Geraet) -> abmelden.
  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) void signOut();
  }, [me.error, signOut]);

  const value = useMemo<SessionValue | null>(() => {
    if (!me.data) return null;
    const members = me.data.members;
    return {
      api,
      session: me.data,
      members,
      memberById: (id) => members.find((m) => m.id === id),
      live,
      serverUrl: stored.serverUrl,
      signOut,
    };
  }, [api, me.data, live, stored.serverUrl, signOut]);

  if (!value) return <>{loading}</>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Welche Abfragen bei welchem Echtzeit-Hinweis neu geladen werden. */
const TOPIC_KEYS: Record<Topic, string> = {
  members: "me",
  events: "events",
  lists: "lists",
  messages: "messages",
  locations: "locations",
};

/**
 * Haelt eine WebSocket-Verbindung zum Server. Der Server schickt nur
 * "etwas hat sich geaendert"-Hinweise; die App laedt dann gezielt nach.
 * Bei Verbindungsabbruch wird mit wachsender Pause neu verbunden.
 */
function useRealtime(stored: Stored): boolean {
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);
  const retry = useRef(0);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = () => {
      const url = stored.serverUrl.replace(/^http/, "ws").replace(/\/+$/, "") + `/ws?token=${stored.token}`;
      ws = new WebSocket(url);
      ws.onopen = () => {
        retry.current = 0;
        setLive(true);
        // Nach (Wieder-)Verbindung alles auffrischen, falls etwas verpasst wurde.
        void queryClient.invalidateQueries();
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(String(e.data)) as { type: string; topic?: Topic };
          if (msg.type === "changed" && msg.topic) {
            void queryClient.invalidateQueries({ queryKey: [TOPIC_KEYS[msg.topic]] });
          }
        } catch {
          // unbekannte Nachricht ignorieren
        }
      };
      ws.onclose = () => {
        setLive(false);
        if (stopped) return;
        const delay = Math.min(30_000, 1000 * 2 ** retry.current++);
        timer = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      ws?.close();
    };
  }, [stored, queryClient]);

  return live;
}
