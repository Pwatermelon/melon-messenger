import { Elysia } from "elysia";
import { extname } from "path";
import { authPlugin, requireAuth } from "../auth";
import { getMediaStorage } from "../services/mediaStorage";
import {
  canAccessMedia,
  signMediaPath,
  signMediaPaths,
  verifyMediaAccessToken,
} from "../services/mediaAccess";

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
};

export const mediaRoutes = new Elysia({ prefix: "/media" })
  .use(authPlugin)
  .post("/sign", async ({ user, body, set }) => {
    const u = requireAuth(set)(user);
    const payload = body as { paths?: string[] };
    const paths = Array.isArray(payload.paths) ? payload.paths : [];
    const urls = await signMediaPaths(paths, u.id);
    return { urls };
  })
  .get("/:filename", async ({ params, query, set }) => {
    const filename = decodeURIComponent(params.filename).replace(/\.\./g, "").replace(/\//g, "");
    if (!filename) {
      set.status = 400;
      return "Bad request";
    }
    const access = typeof query.access === "string" ? query.access : "";
    if (!access) {
      set.status = 401;
      return "Unauthorized";
    }
    const userId = await verifyMediaAccessToken(access, filename);
    if (!userId) {
      set.status = 401;
      return "Unauthorized";
    }
    const allowed = await canAccessMedia(userId, filename);
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
    const ext = extname(filename).toLowerCase();
    const contentType = UPLOAD_MIME[ext] ?? file.contentType ?? "application/octet-stream";
    return new Response(file.body, {
      headers: {
        "Cache-Control": "private, max-age=300",
        "Content-Type": contentType,
      },
    });
  });
