import { SignJWT, jwtVerify } from "jose";
import { and, eq } from "drizzle-orm";
import { db, mediaChatGrants, mediaFiles, chatMembers } from "../db";
import { uploadsPathFromKey } from "./mediaStorage";
import { sanitizeOriginalFilename } from "../lib/contentDisposition";

const JWT_SECRET_BYTES = new TextEncoder().encode(
  process.env.MEDIA_SIGNING_SECRET ?? process.env.JWT_SECRET ?? "watermelon-dev-secret-change-in-prod"
);
const ACCESS_TTL_SEC = Number(process.env.MEDIA_ACCESS_TTL_SEC) || 3600;

export type MediaVisibility = "chat" | "profile";

export function filenameFromPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const p = path.trim();
  const m = p.match(/\/uploads\/([^/?#]+)/) ?? p.match(/^uploads\/([^/?#]+)/);
  if (m?.[1]) return m[1].replace(/\.\./g, "").replace(/\//g, "");
  if (!p.includes("/") && !p.startsWith("http")) return p.replace(/\.\./g, "").replace(/\//g, "");
  return null;
}

export async function registerMediaFile(
  filename: string,
  ownerId: string,
  visibility: MediaVisibility = "chat",
  originalName?: string | null
): Promise<void> {
  const storedName = originalName ? sanitizeOriginalFilename(originalName) : null;
  await db
    .insert(mediaFiles)
    .values({ filename, ownerId, visibility, originalName: storedName })
    .onConflictDoNothing();
  if (storedName) {
    await db.update(mediaFiles).set({ originalName: storedName }).where(eq(mediaFiles.filename, filename));
  }
}

export async function grantMediaToChat(filename: string, chatId: string): Promise<void> {
  await db.insert(mediaChatGrants).values({ filename, chatId }).onConflictDoNothing();
}

export async function grantMediaFromAttachment(attachmentUrl: string | null | undefined, chatId: string): Promise<void> {
  const filename = filenameFromPath(attachmentUrl);
  if (filename) await grantMediaToChat(filename, chatId);
}

export async function canAccessMedia(userId: string, filename: string): Promise<boolean> {
  const [row] = await db.select().from(mediaFiles).where(eq(mediaFiles.filename, filename)).limit(1);
  if (!row) return false;
  if (row.ownerId === userId) return true;
  if (row.visibility === "profile") return true;

  const [grant] = await db
    .select({ chatId: mediaChatGrants.chatId })
    .from(mediaChatGrants)
    .innerJoin(chatMembers, and(eq(chatMembers.chatId, mediaChatGrants.chatId), eq(chatMembers.userId, userId)))
    .where(eq(mediaChatGrants.filename, filename))
    .limit(1);
  return Boolean(grant);
}

/** Profile / group avatars visible to any authenticated user */
export async function registerProfileMedia(filename: string, ownerId: string, originalName?: string | null): Promise<void> {
  await registerMediaFile(filename, ownerId, "profile", originalName);
}

export async function signMediaAccess(userId: string, filename: string): Promise<string> {
  const token = await new SignJWT({ file: filename })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setExpirationTime(`${ACCESS_TTL_SEC}s`)
    .sign(JWT_SECRET_BYTES);
  return token;
}

export async function verifyMediaAccessToken(
  token: string,
  filename: string
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_BYTES);
    const sub = payload.sub;
    const file = payload.file;
    if (typeof sub !== "string" || file !== filename) return null;
    return sub;
  } catch {
    return null;
  }
}

export async function signMediaPath(path: string | null | undefined, userId: string): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const filename = filenameFromPath(path);
  if (!filename) return null;
  const ok = await canAccessMedia(userId, filename);
  if (!ok) return null;
  const access = await signMediaAccess(userId, filename);
  const base = (process.env.API_PUBLIC_URL ?? "").replace(/\/$/, "") || "";
  const prefix = base || "";
  return `${prefix}/media/${encodeURIComponent(filename)}?access=${access}`;
}

export async function signMediaPaths(
  paths: Array<string | null | undefined>,
  userId: string
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const unique = [...new Set(paths.map((p) => p?.trim()).filter(Boolean))] as string[];
  await Promise.all(
    unique.map(async (path) => {
      const signed = await signMediaPath(path, userId);
      if (signed) out[path] = signed;
    })
  );
  return out;
}

export function collectUserMediaPaths(u: {
  avatarUrl?: string | null;
  coverUrl?: string | null;
  profilePhotos?: string[] | null;
  avatarHistory?: string[] | null;
}): string[] {
  const paths: string[] = [];
  if (u.avatarUrl) paths.push(u.avatarUrl);
  if (u.coverUrl) paths.push(u.coverUrl);
  for (const p of u.profilePhotos ?? []) paths.push(p);
  for (const p of u.avatarHistory ?? []) paths.push(p);
  return paths;
}

/** Sign avatar/cover paths on a user object for a viewer */
export async function signUserMedia<T extends Record<string, unknown>>(user: T, viewerId: string): Promise<T> {
  const paths = collectUserMediaPaths(user as Parameters<typeof collectUserMediaPaths>[0]);
  const signed = await signMediaPaths(paths, viewerId);
  const next = { ...user } as T & {
    avatarUrl?: string | null;
    coverUrl?: string | null;
    profilePhotos?: string[];
    avatarHistory?: string[];
  };
  if (typeof next.avatarUrl === "string" && signed[next.avatarUrl]) next.avatarUrl = signed[next.avatarUrl];
  if (typeof next.coverUrl === "string" && signed[next.coverUrl]) next.coverUrl = signed[next.coverUrl];
  if (Array.isArray(next.profilePhotos)) {
    next.profilePhotos = next.profilePhotos.map((p) => signed[p] ?? p);
  }
  if (Array.isArray(next.avatarHistory)) {
    next.avatarHistory = next.avatarHistory.map((p) => signed[p] ?? p);
  }
  return next as T;
}

export async function ensureProfileMediaRegistered(
  ownerId: string,
  paths: Array<string | null | undefined>
): Promise<void> {
  for (const path of paths) {
    const filename = filenameFromPath(path);
    if (filename) await registerProfileMedia(filename, ownerId);
  }
}

export async function ensureChatAvatarRegistered(chatId: string, avatarUrl: string | null | undefined): Promise<void> {
  const filename = filenameFromPath(avatarUrl);
  if (!filename) return;
  const [admin] = await db
    .select({ userId: chatMembers.userId })
    .from(chatMembers)
    .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.role, "admin")))
    .limit(1);
  await registerMediaFile(filename, admin?.userId ?? chatId, "profile");
}

export { uploadsPathFromKey };
