import { useEffect, useRef, useCallback, useState } from "react";
import type { WSClientMessage, WSServerMessage } from "@melon/shared";
import { getWsUrl } from "../config";

export type ConnectionStatus = "connecting" | "ready" | "auth_failed" | "failed";

export function useWebSocket(token: string | null, onMessage: (msg: WSServerMessage) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [retryKey, setRetryKey] = useState(0);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const send = useCallback((msg: WSClientMessage) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const reconnect = useCallback(() => setRetryKey((k) => k + 1), []);

  const closedByReconnectRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus("connecting");
      return;
    }
    closedByReconnectRef.current = false;
    setStatus("connecting");
    setReady(false);
    const url = getWsUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    let timeoutId: ReturnType<typeof setTimeout>;
    timeoutId = window.setTimeout(() => {
      setStatus((s) => (s === "connecting" ? "failed" : s));
    }, 12000);

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as WSServerMessage;
        if (msg.type === "auth_ok") {
          window.clearTimeout(timeoutId);
          setReady(true);
          setStatus("ready");
        }
        if (msg.type === "auth_error") setStatus("auth_failed");
        onMessageRef.current(msg);
      } catch {}
    };

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "auth", token } as WSClientMessage));
    };

    ws.onclose = () => {
      setReady(false);
      if (!closedByReconnectRef.current) setStatus("failed");
    };

    ws.onerror = () => {
      if (!closedByReconnectRef.current) setStatus("failed");
    };

    return () => {
      closedByReconnectRef.current = true;
      window.clearTimeout(timeoutId);
      ws.close();
      wsRef.current = null;
    };
  }, [token, retryKey]);

  return { send, ready, status, reconnect };
}
