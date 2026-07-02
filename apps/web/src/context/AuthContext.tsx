import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { User } from "@melon/shared";
import { getApiUrl } from "../config";
import { syncAuthTokenToServiceWorker } from "../utils/authToken";

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loginWithYandex: () => void;
  setSession: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "wm_token";
const USER_KEY = "wm_user";

function migrateLegacyStorage() {
  const legacyToken = localStorage.getItem("melon_token");
  const legacyUser = localStorage.getItem("melon_user");
  if (legacyToken && !localStorage.getItem(TOKEN_KEY)) {
    localStorage.setItem(TOKEN_KEY, legacyToken);
    localStorage.removeItem("melon_token");
  }
  if (legacyUser && !localStorage.getItem(USER_KEY)) {
    localStorage.setItem(USER_KEY, legacyUser);
    localStorage.removeItem("melon_user");
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    migrateLegacyStorage();
    try {
      const s = localStorage.getItem(USER_KEY);
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => {
    migrateLegacyStorage();
    return localStorage.getItem(TOKEN_KEY);
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setIsLoading(true);
    fetch(`${getApiUrl()}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (cancelled) return;
        if (u) {
          setUser(u);
          localStorage.setItem(USER_KEY, JSON.stringify(u));
        } else {
          setToken(null);
          setUser(null);
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    syncAuthTokenToServiceWorker(token);
  }, [token]);

  const loginWithYandex = useCallback(() => {
    window.location.href = `${getApiUrl()}/auth/yandex`;
  }, []);

  const setSession = useCallback((nextToken: string, nextUser: User) => {
    setToken(nextToken);
    setUser(nextUser);
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  const updateUser = useCallback((next: User) => {
    setUser(next);
    localStorage.setItem(USER_KEY, JSON.stringify(next));
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loginWithYandex, setSession, logout, updateUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
