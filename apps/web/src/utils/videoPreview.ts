export const VIDEO_PREVIEW_TIME = 0.001;

/** Seek to the first decodable frame so paused video shows a preview instead of black. */
export function primeVideoPreviewFrame(video: HTMLVideoElement): void {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
  if (!video.paused) return;
  const t = video.duration && Number.isFinite(video.duration)
    ? Math.min(VIDEO_PREVIEW_TIME, video.duration * 0.01)
    : VIDEO_PREVIEW_TIME;
  if (video.currentTime < 0.05) {
    video.currentTime = t;
  }
}

export function attachVideoPreviewHandlers(
  video: HTMLVideoElement,
  onPreviewReady?: () => void
): () => void {
  const prime = () => {
    primeVideoPreviewFrame(video);
  };
  const onSeeked = () => {
    if (video.paused && video.currentTime < 0.1) onPreviewReady?.();
  };
  video.addEventListener("loadeddata", prime);
  video.addEventListener("loadedmetadata", prime);
  video.addEventListener("seeked", onSeeked);
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) prime();
  return () => {
    video.removeEventListener("loadeddata", prime);
    video.removeEventListener("loadedmetadata", prime);
    video.removeEventListener("seeked", onSeeked);
  };
}
