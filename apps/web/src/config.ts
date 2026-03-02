/**
 * API и WebSocket URL.
 * Если VITE_* не заданы — используем тот же хост (для Docker за nginx: /api и /ws).
 */
function getOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function getApiUrl(): string {
  const env = import.meta.env.VITE_API_URL;
  if (env && String(env).trim()) return String(env).replace(/\/$/, "");
  const origin = getOrigin();
  return origin ? `${origin}/api` : "http://localhost:3000";
}

export function getWsUrl(): string {
  const env = import.meta.env.VITE_WS_URL;
  if (env && String(env).trim()) {
    const s = String(env).replace(/^http/, "ws").replace(/\/$/, "");
    return s.startsWith("ws") ? s : `ws://${s}`;
  }
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws`;
  }
  return "ws://localhost:3000/ws";
}

/** Базовый URL для картинок/файлов (uploads). При том же хосте — origin. */
export function getUploadsBaseUrl(): string {
  const env = import.meta.env.VITE_API_URL;
  if (env && String(env).trim()) return String(env).replace(/\/$/, "").replace(/\/api$/, "");
  return getOrigin() || "http://localhost:3000";
}
