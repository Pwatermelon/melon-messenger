const POSTER_PX = 512;

/** Capture first video frame as a square JPEG for circle message poster. */
export async function captureCirclePoster(blob: Blob): Promise<Blob | null> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("video load failed"));
    });

    const seekTo = video.duration && Number.isFinite(video.duration)
      ? Math.min(0.05, video.duration * 0.02)
      : 0.001;
    video.currentTime = seekTo;
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });

    if (!video.videoWidth || !video.videoHeight) return null;

    const canvas = document.createElement("canvas");
    canvas.width = POSTER_PX;
    canvas.height = POSTER_PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const scale = Math.max(POSTER_PX / video.videoWidth, POSTER_PX / video.videoHeight);
    const w = video.videoWidth * scale;
    const h = video.videoHeight * scale;
    ctx.drawImage(video, (POSTER_PX - w) / 2, (POSTER_PX - h) / 2, w, h);

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.88);
    });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
