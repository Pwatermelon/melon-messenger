import { Elysia } from "elysia";
import { authPlugin, requireAuth } from "../auth";
import { mkdir } from "fs/promises";
import { join } from "path";

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(import.meta.dir, "../../uploads");
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/mpeg": ".mp3",
  };
  return map[mime] ?? "";
}

export const uploadRoutes = new Elysia({ prefix: "/upload" })
  .use(authPlugin)
  .post("/", async ({ user, request, set }) => {
    const u = requireAuth(set)(user);
    await ensureUploadDir();
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof File)) {
      set.status = 400;
      return { error: "Missing file" };
    }
    if (file.size > MAX_FILE_SIZE) {
      set.status = 400;
      return { error: "File too large" };
    }
    const ext = extFromMime(file.type) || (file.name ? "." + file.name.split(".").pop() : "");
    const filename = `${crypto.randomUUID()}${ext}`;
    const path = join(UPLOAD_DIR, filename);
    await Bun.write(path, file);
    const url = `/uploads/${filename}`;
    return { url, fileName: file.name, mimeType: file.type, size: file.size };
  });
