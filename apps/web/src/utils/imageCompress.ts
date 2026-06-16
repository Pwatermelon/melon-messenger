/**
 * Сжимает изображение через canvas: ресайз по макс. стороне + JPEG quality.
 * GIF и другие анимированные форматы не трогаем — canvas убивает анимацию.
 */
const MAX_SIDE = 1200;
const JPEG_QUALITY = 0.82;

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
