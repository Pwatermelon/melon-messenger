export type VideoMeta = {
  width: number;
  height: number;
  duration?: number;
};

const STORAGE_KEY = "wm_video_meta_v1";

export function videoMetaCacheKey(src: string): string {
  try {
    const u = new URL(src, window.location.origin);
    return u.pathname;
  } catch {
    const q = src.indexOf("?");
    return q >= 0 ? src.slice(0, q) : src;
  }
}

function loadAll(): Record<string, VideoMeta> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, VideoMeta>;
  } catch {
    return {};
  }
}

function saveAll(data: Record<string, VideoMeta>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota */
  }
}

export function getVideoMetaCache(src: string): VideoMeta | null {
  return loadAll()[videoMetaCacheKey(src)] ?? null;
}

export function setVideoMetaCache(src: string, meta: VideoMeta) {
  const all = loadAll();
  all[videoMetaCacheKey(src)] = meta;
  saveAll(all);
}

export function probeVideoMeta(src: string): Promise<VideoMeta | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };

    video.onloadedmetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      const duration = video.duration && Number.isFinite(video.duration) ? video.duration : undefined;
      cleanup();
      if (width > 0 && height > 0) {
        const meta = { width, height, duration };
        setVideoMetaCache(src, meta);
        resolve(meta);
      } else {
        resolve(null);
      }
    };
    video.onerror = () => {
      cleanup();
      resolve(null);
    };
    video.src = src;
  });
}

const posterBlobCache = new Map<string, string>();

export function getVideoPosterCache(src: string): string | null {
  return posterBlobCache.get(videoMetaCacheKey(src)) ?? null;
}

export function setVideoPosterCache(src: string, blobUrl: string) {
  const key = videoMetaCacheKey(src);
  const prev = posterBlobCache.get(key);
  if (prev && prev !== blobUrl) URL.revokeObjectURL(prev);
  posterBlobCache.set(key, blobUrl);
}
