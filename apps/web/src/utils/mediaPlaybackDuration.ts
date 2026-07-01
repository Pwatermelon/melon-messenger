/** Длительность для UI/прогресса: метаданные сообщения надёжнее WebM из MediaRecorder. */
export function resolvePlaybackDuration(meta?: number, media?: number): number {
  const metaOk = meta != null && meta > 0 && Number.isFinite(meta);
  const mediaOk = media != null && media > 0 && Number.isFinite(media);
  if (metaOk && mediaOk) return Math.max(meta, media);
  if (metaOk) return meta;
  if (mediaOk) return media;
  return 0;
}

export function probeBlobDuration(blob: Blob, kind: "audio" | "video"): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const el = document.createElement(kind);
    el.preload = "metadata";
    el.muted = true;
    if (kind === "video") (el as HTMLVideoElement).playsInline = true;

    const cleanup = () => {
      el.removeAttribute("src");
      el.load();
      URL.revokeObjectURL(url);
    };

    el.onloadedmetadata = () => {
      const d = el.duration;
      cleanup();
      resolve(Number.isFinite(d) && d > 0 ? d : 0);
    };
    el.onerror = () => {
      cleanup();
      resolve(0);
    };
    el.src = url;
  });
}

export function finalizeRecordedDuration(wallSeconds: number, probedSeconds: number): number {
  const wall = Math.max(1, Math.round(wallSeconds));
  if (probedSeconds > 0 && Number.isFinite(probedSeconds)) {
    return Math.max(wall, Math.ceil(probedSeconds));
  }
  return wall;
}
