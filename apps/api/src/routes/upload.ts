import { Elysia } from "elysia";
import { extname, join } from "path";
import { authPlugin, requireAuth } from "../auth";
import { legalRequiredPlugin } from "../plugins/legalRequired";
import { checkRateLimit, clientKey } from "../middleware/rateLimit";
import { getMediaStorage, uploadsPathFromKey } from "../services/mediaStorage";
import { registerMediaFile, registerProfileMedia } from "../services/mediaAccess";

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(import.meta.dir, "../../uploads");

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

function extFromMime(mime: string): string {
  const base = mime.split(";")[0].trim().toLowerCase();
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
    "video/x-msvideo": ".avi",
    "video/x-matroska": ".mkv",
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/aac": ".aac",
    "application/pdf": ".pdf",
    "application/zip": ".zip",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  };
  return map[base] ?? "";
}

export const uploadRoutes = new Elysia({ prefix: "/upload" })
  .use(authPlugin)
  .use(legalRequiredPlugin)
  .post("/", async ({ user, request, set }) => {
    const ip = clientKey(request);
    const ok = await checkRateLimit(`upload:${ip}`, 60, 20);
    if (!ok) {
      set.status = 429;
      return { error: "Too many uploads. Try again later." };
    }
    const u = requireAuth(set)(user);
    const formData = await request.formData();
    const file = formData.get("file") as File | Blob | null;
    const purpose = String(formData.get("purpose") ?? "chat").toLowerCase();
    if (!file || typeof (file as Blob).arrayBuffer !== "function") {
      set.status = 400;
      return { error: "Missing file" };
    }
    if (file.size > MAX_FILE_SIZE) {
      set.status = 400;
      return { error: "File too large" };
    }
    const ext = extFromMime(file.type) || (file.name ? extname(file.name) : "");
    const filename = `${crypto.randomUUID()}${ext}`;
    const contentType = file.type || "application/octet-stream";
    const storage = getMediaStorage();
    const bytes = new Uint8Array(await file.arrayBuffer());
    await storage.put(filename, bytes, contentType);

    if (purpose === "profile" || purpose === "sticker" || purpose === "report") {
      await registerProfileMedia(filename, u.id, file.name);
    } else {
      await registerMediaFile(filename, u.id, "chat", file.name);
    }

    const url = uploadsPathFromKey(filename);
    return { url, fileName: file.name, mimeType: file.type, size: file.size };
  });
