/**
 * Сжимает изображение через canvas: ресайз по макс. стороне + JPEG quality.
 * GIF и другие анимированные форматы не трогаем — canvas убивает анимацию.
 */
const MAX_SIDE = 1200;
const JPEG_QUALITY = 0.82;

/** Telegram-style sticker canvas (all stickers normalized to this square). */
export const STICKER_CANVAS_PX = 512;

export function isGifFile(file: File): boolean {
  return file.type === "image/gif" || /\.gif$/i.test(file.name);
}

export async function isGifFileDeep(file: File): Promise<boolean> {
  if (isGifFile(file)) return true;
  try {
    const head = new Uint8Array(await file.slice(0, 3).arrayBuffer());
    return head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46;
  } catch {
    return false;
  }
}

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (await isGifFileDeep(file)) return file;
  return new Promise<File>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w <= MAX_SIDE && h <= MAX_SIDE && file.size < 500_000) {
        resolve(file);
        return;
      }
      const scale = Math.min(MAX_SIDE / w, MAX_SIDE / h, 1);
      const cw = Math.round(w * scale);
      const ch = Math.round(h * scale);
      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, cw, ch);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg") || "photo.jpg", { type: "image/jpeg" }));
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

/** Fit image into a square canvas with transparent padding (512×512, like Telegram). */
export async function normalizeStickerImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Нужно изображение");
  }
  return new Promise<File>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const size = STICKER_CANVAS_PX;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Не удалось обработать изображение"));
        return;
      }
      ctx.clearRect(0, 0, size, size);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w < 1 || h < 1) {
        reject(new Error("Пустое изображение"));
        return;
      }
      const scale = Math.min(size / w, size / h);
      const dw = w * scale;
      const dh = h * scale;
      ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);

      const baseName = file.name.replace(/\.[^.]+$/, "") || "sticker";
      canvas.toBlob(
        (webpBlob) => {
          if (webpBlob) {
            resolve(new File([webpBlob], `${baseName}.webp`, { type: "image/webp" }));
            return;
          }
          canvas.toBlob(
            (pngBlob) => {
              if (!pngBlob) {
                reject(new Error("Не удалось сохранить стикер"));
                return;
              }
              resolve(new File([pngBlob], `${baseName}.png`, { type: "image/png" }));
            },
            "image/png"
          );
        },
        "image/webp",
        0.92
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось прочитать изображение"));
    };
    img.src = url;
  });
}
