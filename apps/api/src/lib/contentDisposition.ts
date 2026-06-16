export function sanitizeOriginalFilename(name: string): string {
  const trimmed = name.replace(/[\r\n\0]/g, "").trim();
  const safe = trimmed.replace(/[/\\?%*:|"<>]/g, "_");
  return safe.slice(0, 200) || "file";
}

export function buildContentDisposition(filename: string, disposition: "inline" | "attachment"): string {
  const safe = sanitizeOriginalFilename(filename);
  const ascii = safe.replace(/[^\x20-\x7E]/g, "_") || "download";
  const encoded = encodeURIComponent(safe).replace(/['()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

const INLINE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".mp4",
  ".webm",
  ".mov",
  ".m4a",
  ".aac",
  ".ogg",
  ".mp3",
]);

export function defaultMediaDisposition(ext: string, forceDownload: boolean): "inline" | "attachment" {
  if (forceDownload) return "attachment";
  return INLINE_EXTENSIONS.has(ext) ? "inline" : "attachment";
}
