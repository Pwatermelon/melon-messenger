import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getChat } from "../api";

const STORAGE_KEY = "wm:active-chat";

type ActiveChatContextValue = {
  activeChatId: string | null;
  openChat: (id: string) => Promise<boolean>;
  closeChat: () => void;
};

const ActiveChatContext = createContext<ActiveChatContextValue | null>(null);

export function ActiveChatProvider({ children }: { children: ReactNode }) {
  const [activeChatId, setActiveChatId] = useState<string | null>(
    () => sessionStorage.getItem(STORAGE_KEY)
  );

  const openChat = useCallback(async (id: string) => {
    setActiveChatId(id);
    sessionStorage.setItem(STORAGE_KEY, id);
    try {
      const chat = await getChat(id);
      if (!chat) {
        setActiveChatId((current) => (current === id ? null : current));
        if (sessionStorage.getItem(STORAGE_KEY) === id) {
          sessionStorage.removeItem(STORAGE_KEY);
        }
        return false;
      }
      return true;
    } catch {
      setActiveChatId((current) => (current === id ? null : current));
      if (sessionStorage.getItem(STORAGE_KEY) === id) {
        sessionStorage.removeItem(STORAGE_KEY);
      }
      return false;
    }
  }, []);

  const closeChat = useCallback(() => {
    setActiveChatId(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    let cancelled = false;
    getChat(stored)
      .then((chat) => {
        if (cancelled) return;
        if (!chat) {
          sessionStorage.removeItem(STORAGE_KEY);
          setActiveChatId((current) => (current === stored ? null : current));
        }
      })
      .catch(() => {
        if (cancelled) return;
        sessionStorage.removeItem(STORAGE_KEY);
        setActiveChatId((current) => (current === stored ? null : current));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ActiveChatContext.Provider value={{ activeChatId, openChat, closeChat }}>
      {children}
    </ActiveChatContext.Provider>
  );
}

export function useActiveChat(): ActiveChatContextValue {
  const ctx = useContext(ActiveChatContext);
  if (!ctx) throw new Error("useActiveChat must be used within ActiveChatProvider");
  return ctx;
}
