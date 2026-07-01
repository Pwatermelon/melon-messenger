const MAX_POSTER_W = 640;

/** First-frame JPEG poster preserving aspect ratio (for inline video messages). */
export async function captureVideoPoster(blob: Blob): Promise<Blob | null> {
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

    const seekTo =
      video.duration && Number.isFinite(video.duration)
        ? Math.min(0.05, video.duration * 0.02)
        : 0.001;
    video.currentTime = seekTo;
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    let cw = vw;
    let ch = vh;
    if (cw > MAX_POSTER_W) {
      ch = Math.round((ch * MAX_POSTER_W) / cw);
      cw = MAX_POSTER_W;
    }

    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, cw, ch);

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.86);
    });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Capture a poster blob URL from a remote/local video src (client cache for old messages). */
export async function captureVideoFramePoster(src: string): Promise<string | null> {
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("load failed"));
      video.src = src;
    });

    const seekTo =
      video.duration && Number.isFinite(video.duration)
        ? Math.min(0.05, video.duration * 0.02)
        : 0.001;
    video.currentTime = seekTo;
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    let cw = vw;
    let ch = vh;
    if (cw > MAX_POSTER_W) {
      ch = Math.round((ch * MAX_POSTER_W) / cw);
      cw = MAX_POSTER_W;
    }

    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, cw, ch);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.86);
    });
    if (!blob) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}
