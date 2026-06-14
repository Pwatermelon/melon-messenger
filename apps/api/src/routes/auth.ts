import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import * as jose from "jose";
import { db, users } from "../db";
import { eq } from "drizzle-orm";
import { toPrivateProfile } from "../lib/userDto";
import {
  buildYandexAuthorizeUrl,
  createOAuthState,
  exchangeYandexCode,
  getOAuthConfig,
  isYandexConfigured,
  resolveRedirectUri,
  verifyOAuthState,
  YANDEX_REDIRECT_URI,
} from "../services/yandexOAuth";

const WEB_URL = process.env.WEB_URL ?? "http://localhost:5173";
const JWT_SECRET = process.env.JWT_SECRET ?? "watermelon-dev-secret-change-in-prod";

export async function verifyBearerUser(request: Request): Promise<typeof users.$inferSelect | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);
    const userId = payload.sub as string;
    if (!userId) return null;
    const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return u ?? null;
  } catch {
    return null;
  }
}

export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(jwt({ name: "jwt", secret: JWT_SECRET, exp: "30d" }))
  .get("/yandex/config", () => getOAuthConfig())
  .get("/yandex", async ({ query, set }) => {
    if (!isYandexConfigured()) {
      set.status = 503;
      return { error: "Yandex OAuth не настроен (YANDEX_CLIENT_ID)" };
    }
    try {
      const q = query as { redirect_uri?: string; platform?: string };
      const redirectUri = resolveRedirectUri(q.redirect_uri);
      const state = await createOAuthState();
      const url = buildYandexAuthorizeUrl(redirectUri, state);

      if (q.platform === "native") {
        return { authorizeUrl: url, redirectUri, state };
      }

      set.redirect = url;
    } catch (e) {
      set.status = 400;
      return { error: e instanceof Error ? e.message : "Invalid redirect_uri" };
    }
  })
  .post("/yandex/exchange", async ({ request, set }) => {
    if (!isYandexConfigured()) {
      set.status = 503;
      return { error: "Yandex OAuth не настроен" };
    }
    const body = (await request.json()) as { code?: string; redirect_uri?: string; state?: string };
    if (!body.code?.trim()) {
      set.status = 400;
      return { error: "code required" };
    }
    try {
      const redirectUri = resolveRedirectUri(body.redirect_uri);
      if (body.state && !(await verifyOAuthState(body.state))) {
        set.status = 400;
        return { error: "Invalid state" };
      }
      return await exchangeYandexCode(body.code.trim(), redirectUri);
    } catch (e) {
      console.error("[Yandex OAuth exchange]", e);
      set.status = 401;
      return { error: e instanceof Error ? e.message : "OAuth failed" };
    }
  })
  .get("/yandex/callback", async ({ query, set }) => {
    const q = query as { code?: string; state?: string; error?: string };
    if (q.error || !q.code) {
      set.redirect = `${WEB_URL}/login?error=yandex_denied`;
      return;
    }
    if (!(await verifyOAuthState(q.state))) {
      set.redirect = `${WEB_URL}/login?error=yandex_failed`;
      return;
    }
    if (!isYandexConfigured()) {
      set.redirect = `${WEB_URL}/login?error=yandex_not_configured`;
      return;
    }
    try {
      const { token } = await exchangeYandexCode(q.code, YANDEX_REDIRECT_URI);
      set.redirect = `${WEB_URL}/auth/callback?token=${encodeURIComponent(token)}`;
    } catch (e) {
      console.error("[Yandex OAuth callback]", e);
      set.redirect = `${WEB_URL}/login?error=yandex_failed`;
    }
  })
  .get("/me", async ({ request, set }) => {
    const u = await verifyBearerUser(request);
    if (!u) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    return toPrivateProfile(u);
  })
  .put("/me", async ({ request, set }) => {
    const u = await verifyBearerUser(request);
    if (!u) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    const body = (await request.json()) as {
      username?: string;
      avatarUrl?: string | null;
      coverUrl?: string | null;
      bio?: string | null;
      profilePhotos?: string[];
    };
    const updates: Partial<typeof users.$inferInsert> = {};
    if (typeof body.username === "string" && body.username.trim().length > 0) {
      updates.username = body.username.trim().slice(0, 100);
    }
    if (body.avatarUrl !== undefined) {
      updates.avatarUrl = typeof body.avatarUrl === "string" ? body.avatarUrl.trim() || null : null;
    }
    if (body.coverUrl !== undefined) {
      updates.coverUrl = typeof body.coverUrl === "string" ? body.coverUrl.trim() || null : null;
    }
    if (body.bio !== undefined) {
      updates.bio = typeof body.bio === "string" ? body.bio.trim().slice(0, 500) || null : null;
    }
    if (Array.isArray(body.profilePhotos)) {
      updates.profilePhotos = JSON.stringify(
        body.profilePhotos.filter((p) => typeof p === "string").slice(0, 12)
      );
    }
    if (Object.keys(updates).length === 0) return toPrivateProfile(u);
    const [updated] = await db.update(users).set(updates).where(eq(users.id, u.id)).returning();
    return toPrivateProfile(updated!);
  })
  .post("/logout", () => ({ ok: true }));
