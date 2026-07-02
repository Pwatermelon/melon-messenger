import { getApiUrl } from "../config";

/** Strip signed URLs back to `/uploads/{filename}` before saving to profile. */
export function canonicalStoragePath(path: string): string {
  const trimmed = path.trim().split("?")[0]!.split("#")[0]!;
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

export function isCanonicalStoragePath(path: string | null | undefined): boolean {
  if (!path) return false;
  const c = canonicalStoragePath(path);
  return c.startsWith("/uploads/");
}

function filenameFromMediaPath(path: string): string | null {
  const canonical = canonicalStoragePath(path);
  const m = canonical.match(/^\/uploads\/([^/?#]+)$/);
  return m?.[1] ?? null;
}

/** Публичный URL медиа для in-app fetch (без секретов в query — доступ только с Bearer + grant в чате). */
export function mediaUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("blob:")) return path;

  const filename = filenameFromMediaPath(path);
  if (!filename) {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      const fromHttp = filenameFromMediaPath(path);
      if (fromHttp) return `${getApiUrl()}/media/${encodeURIComponent(fromHttp)}`;
      return path;
    }
    return "";
  }
  return `${getApiUrl()}/media/${encodeURIComponent(filename)}`;
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
