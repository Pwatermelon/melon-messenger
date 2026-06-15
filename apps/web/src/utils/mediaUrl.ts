import { getApiUrl } from "../config";

/** Turn API-signed or storage path into a browser-loadable URL */
export function mediaUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.includes("access=")) {
    if (path.startsWith("/api/")) {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      return `${origin}${path}`;
    }
    if (path.startsWith("/media/")) return `${getApiUrl()}${path}`;
    return path;
  }
  // Unsigned legacy path — should be signed by API; fallback won't load
  const base = getApiUrl().replace(/\/api\/?$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
