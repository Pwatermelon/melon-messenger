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
    try {
      const chat = await getChat(id);
      if (!chat) return false;
      setActiveChatId(id);
      sessionStorage.setItem(STORAGE_KEY, id);
      return true;
    } catch {
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
    getChat(stored)
      .then((chat) => {
        if (!chat) {
          sessionStorage.removeItem(STORAGE_KEY);
          setActiveChatId(null);
        }
      })
      .catch(() => {
        sessionStorage.removeItem(STORAGE_KEY);
        setActiveChatId(null);
      });
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
