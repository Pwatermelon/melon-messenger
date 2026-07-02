/** Габариты одиночного медиа в пузыре (должны совпадать с CSS). */
export const MAX_MESSAGE_MEDIA_W = 320;
export const MAX_MESSAGE_MEDIA_H = 360;

/** Габариты медиа в лайтбоксе / fullscreen. */
export const MAX_LIGHTBOX_MEDIA_W = 960;
export const MAX_LIGHTBOX_MEDIA_H = 720;

export function displayMessageMediaSize(w: number, h: number): { width: number; height: number } {
  return fitMediaBox(w, h, MAX_MESSAGE_MEDIA_W, MAX_MESSAGE_MEDIA_H);
}

/** Размер видео в лайтбоксе: заполнить viewport (не копировать размер из чата). */
export function lightboxViewportMediaSize(
  w: number,
  h: number,
  viewportW = typeof window !== "undefined" ? window.innerWidth : 1280,
  viewportH = typeof window !== "undefined" ? window.innerHeight : 900
): { width: number; height: number } {
  const safeW = Math.max(1, w);
  const safeH = Math.max(1, h);
  const maxW = Math.min(viewportW * 0.96, 1280);
  const maxH = Math.min(viewportH * 0.85, 920);
  let dw = maxW;
  let dh = (dw * safeH) / safeW;
  if (dh > maxH) {
    dh = maxH;
    dw = (dh * safeW) / safeH;
  }
  return { width: Math.max(1, Math.round(dw)), height: Math.max(1, Math.round(dh)) };
}

function fitMediaBox(w: number, h: number, maxW: number, maxH: number): { width: number; height: number } {
  let dw = w;
  let dh = h;
  if (dw > maxW) {
    dh = (dh * maxW) / dw;
    dw = maxW;
  }
  if (dh > maxH) {
    dw = (dw * maxH) / dh;
    dh = maxH;
  }
  return { width: Math.max(1, Math.round(dw)), height: Math.max(1, Math.round(dh)) };
}
