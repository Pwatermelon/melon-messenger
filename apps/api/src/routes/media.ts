import { Elysia } from "elysia";
import { extname } from "path";
import { eq } from "drizzle-orm";
import { authPlugin, requireAuth } from "../auth";
import { legalRequiredPlugin } from "../plugins/legalRequired";
import { db, mediaFiles } from "../db";
import { getMediaStorage } from "../services/mediaStorage";
import { canAccessMedia, signMediaPath, signMediaPaths } from "../services/mediaAccess";
import { buildContentDisposition, defaultMediaDisposition, sanitizeOriginalFilename } from "../lib/contentDisposition";

const UPLOAD_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
};

export const mediaRoutes = new Elysia({ prefix: "/media" })
  .use(authPlugin)
  .use(legalRequiredPlugin)
  .post("/sign", async ({ user, body, set }) => {
    const u = requireAuth(set)(user);
    const payload = body as { paths?: string[] };
    const paths = Array.isArray(payload.paths) ? payload.paths : [];
    const urls = await signMediaPaths(paths, u.id);
    return { urls };
  })
  .get("/:filename", async ({ params, query, set, user }) => {
    const u = requireAuth(set)(user);
    const filename = decodeURIComponent(params.filename).replace(/\.\./g, "").replace(/\//g, "");
    if (!filename) {
      set.status = 400;
      return "Bad request";
    }
    const allowed = await canAccessMedia(u.id, filename);
    if (!allowed) {
      set.status = 403;
      return "Forbidden";
    }
    const storage = getMediaStorage();
    const file = await storage.get(filename);
    if (!file) {
      set.status = 404;
      return "Not found";
    }
    const [meta] = await db.select().from(mediaFiles).where(eq(mediaFiles.filename, filename)).limit(1);
    const ext = extname(filename).toLowerCase();
    const contentType = UPLOAD_MIME[ext] ?? file.contentType ?? "application/octet-stream";
    const forceDownload = query.download === "1" || query.download === "true";
    const disposition = defaultMediaDisposition(ext, forceDownload);
    const queryName = typeof query.as === "string" ? sanitizeOriginalFilename(query.as) : null;
    const displayName = meta?.originalName || queryName || filename;
    const visibility = meta?.visibility ?? "chat";
    const cacheControl = visibility === "profile" ? "private, max-age=86400" : "private, no-store";
    return new Response(file.body, {
      headers: {
        "Cache-Control": cacheControl,
        Vary: "Authorization",
        "Content-Type": contentType,
        "Content-Disposition": buildContentDisposition(displayName, disposition),
      },
    });
  });
