import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { WSClientMessage, WSServerMessage } from "@melon/shared";
import { getWsUrl } from "../config";

export type ConnectionStatus = "connecting" | "ready" | "auth_failed" | "failed";

type Listener = (msg: WSServerMessage) => void;

type WebSocketContextValue = {
  send: (msg: WSClientMessage) => void;
  ready: boolean;
  status: ConnectionStatus;
  reconnect: () => void;
  subscribe: (fn: Listener) => () => void;
};

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

const MAX_AUTO_RETRIES = 3;
const AUTO_RETRY_DELAY_MS = 2500;

export function WebSocketProvider({ children, token }: { children: ReactNode; token: string | null }) {
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [retryKey, setRetryKey] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Set<Listener>>(new Set());
  const tokenRef = useRef(token);
  const autoRetryCountRef = useRef(0);
  const autoRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  tokenRef.current = token;

  const subscribe = useCallback((fn: Listener) => {
    listenersRef.current.add(fn);
    return () => {
      listenersRef.current.delete(fn);
    };
  }, []);

  const reconnect = useCallback(() => {
    if (autoRetryTimeoutRef.current) {
      clearTimeout(autoRetryTimeoutRef.current);
      autoRetryTimeoutRef.current = null;
    }
    autoRetryCountRef.current = 0;
    setRetryKey((k) => k + 1);
  }, []);

  const send = useCallback((msg: WSClientMessage) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  useEffect(() => {
    if (!token) {
      setStatus("connecting");
      setReady(false);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    setStatus("connecting");
    setReady(false);
    const url = getWsUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    let timeoutId = window.setTimeout(() => {
      setStatus((s) => (s === "connecting" ? "failed" : s));
    }, 12000);

    const notify = (msg: WSServerMessage) => {
      listenersRef.current.forEach((fn) => {
        try {
          fn(msg);
        } catch (_) {}
      });
    };

    const parse = (raw: string) => {
      try {
        const msg = JSON.parse(raw) as WSServerMessage;
        if (msg.type === "auth_ok") {
          window.clearTimeout(timeoutId);
          const retry = (ws as WebSocket & { _authRetry?: number })._authRetry;
          if (retry) window.clearInterval(retry);
          autoRetryCountRef.current = 0;
          setReady(true);
          setStatus("ready");
        }
        if (msg.type === "auth_error") setStatus("auth_failed");
        notify(msg);
      } catch {
        // ignore
      }
    };

    ws.onmessage = (e: MessageEvent) => {
      if (typeof e.data === "string") parse(e.data);
      else if (e.data instanceof Blob) e.data.text().then(parse).catch(() => {});
      else parse(String(e.data));
    };

    const sendAuth = () => {
      if (ws.readyState === WebSocket.OPEN && tokenRef.current) {
        ws.send(JSON.stringify({ type: "auth", token: tokenRef.current } as WSClientMessage));
      }
    };

    ws.onopen = () => {
      sendAuth();
      const authRetry = window.setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) return;
        setReady((r) => {
          if (r) return r;
          sendAuth();
          return r;
        });
      }, 1500);
      (ws as WebSocket & { _authRetry?: number })._authRetry = authRetry;
    };

    ws.onclose = () => {
      const retry = (ws as WebSocket & { _authRetry?: number })._authRetry;
      if (retry) window.clearInterval(retry);
      setReady(false);
      if (wsRef.current === ws) {
        setStatus("failed");
        wsRef.current = null;
        if (autoRetryCountRef.current < MAX_AUTO_RETRIES && tokenRef.current) {
          autoRetryCountRef.current += 1;
          autoRetryTimeoutRef.current = window.setTimeout(() => {
            autoRetryTimeoutRef.current = null;
            setRetryKey((k) => k + 1);
          }, AUTO_RETRY_DELAY_MS);
        }
      } else {
        wsRef.current = null;
      }
    };

    ws.onerror = () => {
      if (wsRef.current === ws) setStatus("failed");
    };

    return () => {
      if (autoRetryTimeoutRef.current) {
        clearTimeout(autoRetryTimeoutRef.current);
        autoRetryTimeoutRef.current = null;
      }
      const retry = (ws as WebSocket & { _authRetry?: number })._authRetry;
      if (retry) window.clearInterval(retry);
      window.clearTimeout(timeoutId);
      ws.close();
      wsRef.current = null;
    };
  }, [token, retryKey]);

  const value: WebSocketContextValue = {
    send,
    ready,
    status,
    reconnect,
    subscribe,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error("useWebSocketContext must be used within WebSocketProvider");
  return ctx;
}
