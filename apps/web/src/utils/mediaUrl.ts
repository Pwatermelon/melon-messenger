import { getApiUrl } from "../config";

/** Strip signed URLs back to `/uploads/{filename}` before saving to profile. */
export function canonicalStoragePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return trimmed;
  const uploads = trimmed.match(/\/uploads\/([^/?#]+)/);
  if (uploads?.[1]) return `/uploads/${uploads[1]}`;
  const media = trimmed.match(/\/media\/([^/?#]+)/);
  if (media?.[1]) {
    try {
      return `/uploads/${decodeURIComponent(media[1])}`;
    } catch {
      return `/uploads/${media[1]}`;
    }
  }
  return trimmed;
}

function isUnsignedUploadPath(path: string): boolean {
  return /\/uploads\/[^/?#]+/.test(path) && !path.includes("access=");
}

/** Turn API-signed or storage path into a browser-loadable URL */
export function mediaUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("blob:")) return path;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    if (isUnsignedUploadPath(path)) return "";
    return path;
  }
  if (path.includes("access=")) {
    if (path.startsWith("/api/")) {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      return `${origin}${path}`;
    }
    if (path.startsWith("/media/")) return `${getApiUrl()}${path}`;
    return path;
  }
  if (path.startsWith("/uploads/") || path.startsWith("uploads/")) {
    return "";
  }
  if (path.startsWith("/media/")) return `${getApiUrl()}${path}`;
  return "";
}

/** Media URL that suggests download with the original filename (server sends Content-Disposition). */
export function mediaDownloadUrl(path: string | null | undefined, fileName?: string | null): string {
  const url = mediaUrl(path);
  if (!url) return "";
  const sep = url.includes("?") ? "&" : "?";
  const params = ["download=1"];
  if (fileName) params.push(`as=${encodeURIComponent(fileName)}`);
  return `${url}${sep}${params.join("&")}`;
}
