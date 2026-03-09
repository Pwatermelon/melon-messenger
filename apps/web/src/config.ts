/**
 * API и WebSocket URL.
 * Если VITE_* не заданы — используем тот же хост (для Docker за nginx: /api и /ws).
 */
function getOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

function isViteDev(): boolean {
  // Vite injects this flag at build time.
  return Boolean(import.meta.env.DEV);
}

export function getApiUrl(): string {
  const env = import.meta.env.VITE_API_URL;
  if (env && String(env).trim()) return String(env).trim().replace(/\/$/, "");
  // In Vite dev, the frontend runs on :5173 and API usually runs separately on :3000.
  // Without explicit VITE_API_URL, default to localhost:3000 to avoid hitting :5173/api.
  if (isViteDev()) return "http://localhost:3000";
  if (typeof window !== "undefined" && getOrigin()) {
    return `${getOrigin()}/api`;
  }
  return "http://localhost:3000";
}

export function getWsUrl(): string {
  const env = import.meta.env.VITE_WS_URL;
  if (env && String(env).trim()) {
    const s = String(env).trim().replace(/^http/, "ws").replace(/\/$/, "");
    const base = s.startsWith("ws") ? s : `ws://${s}`;
    return base.endsWith("/ws") ? base : `${base.replace(/\/+$/, "")}/ws`;
  }
  // In Vite dev, default WS to the API host.
  if (isViteDev()) return "ws://localhost:3000/ws";
  if (typeof window !== "undefined" && getOrigin()) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const base = `${protocol}//${host}`;
    return base.endsWith("/ws") ? base : `${base.replace(/\/+$/, "")}/ws`;
  }
  return "ws://localhost:3000/ws";
}

/** Базовый URL для картинок/файлов (uploads). При том же хосте — origin. */
export function getUploadsBaseUrl(): string {
  const env = import.meta.env.VITE_API_URL;
  if (env && String(env).trim()) return String(env).replace(/\/$/, "").replace(/\/api$/, "");
  return getOrigin() || "http://localhost:3000";
}
