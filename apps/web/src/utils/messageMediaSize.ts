/** Габариты одиночного медиа в пузыре (должны совпадать с CSS). */
export const MAX_MESSAGE_MEDIA_W = 320;
export const MAX_MESSAGE_MEDIA_H = 360;

export function displayMessageMediaSize(w: number, h: number): { width: number; height: number } {
  let dw = w;
  let dh = h;
  if (dw > MAX_MESSAGE_MEDIA_W) {
    dh = (dh * MAX_MESSAGE_MEDIA_W) / dw;
    dw = MAX_MESSAGE_MEDIA_W;
  }
  if (dh > MAX_MESSAGE_MEDIA_H) {
    dw = (dw * MAX_MESSAGE_MEDIA_H) / dh;
    dh = MAX_MESSAGE_MEDIA_H;
  }
  return { width: Math.max(1, Math.round(dw)), height: Math.max(1, Math.round(dh)) };
}
