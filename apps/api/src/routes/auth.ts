import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import * as jose from "jose";
import { db, users } from "../db";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET ?? "melon-dev-secret-change-in-prod";

function toUserResponse(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    avatarUrl: u.avatarUrl,
    publicKey: u.publicKey ?? null,
    createdAt: u.createdAt?.toISOString?.(),
  };
}

export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(jwt({ name: "jwt", secret: JWT_SECRET, exp: "7d" }))
  .post("/register", async ({ body, jwt, set }) => {
    const { email, password, username } = body as {
      email?: string;
      password?: string;
      username?: string;
    };
    if (!email || !password || !username) {
      set.status = 400;
      return { error: "email, password and username are required" };
    }
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length) {
      set.status = 409;
      return { error: "Email already registered" };
    }
    const passwordHash = await Bun.password.hash(password, { algorithm: "bcrypt", cost: 10 });
    const [inserted] = await db
      .insert(users)
      .values({ email, passwordHash, username })
      .returning();
    const token = await jwt.sign({ sub: inserted.id });
    return { user: toUserResponse(inserted), token };
  })
  .post("/login", async ({ body, jwt, set }) => {
    const { email, password } = body as { email?: string; password?: string };
    if (!email || !password) {
      set.status = 400;
      return { error: "email and password are required" };
    }
    const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!u) {
      set.status = 401;
      return { error: "Invalid credentials" };
    }
    const ok = await Bun.password.verify(password, u.passwordHash, "bcrypt");
    if (!ok) {
      set.status = 401;
      return { error: "Invalid credentials" };
    }
    const token = await jwt.sign({ sub: u.id });
    return { user: toUserResponse(u), token };
  })
  .put("/me", async ({ request, set }) => {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "melon-dev-secret-change-in-prod");
      const { payload } = await jose.jwtVerify(token, secret);
      const userId = payload.sub as string;
      if (!userId) {
        set.status = 401;
        return { error: "Invalid token" };
      }
      const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!u) {
        set.status = 401;
        return { error: "User not found" };
      }
      const body = (await request.json()) as { username?: string; avatarUrl?: string | null };
      const updates: { username?: string; avatarUrl?: string | null } = {};
      if (typeof body.username === "string" && body.username.trim().length > 0) {
        updates.username = body.username.trim().slice(0, 100);
      }
      if (body.avatarUrl !== undefined) {
        updates.avatarUrl = typeof body.avatarUrl === "string" ? body.avatarUrl.trim() || null : null;
      }
      if (Object.keys(updates).length === 0) {
        return toUserResponse(u);
      }
      const [updated] = await db.update(users).set(updates).where(eq(users.id, u.id)).returning();
      return toUserResponse(updated!);
    } catch {
      set.status = 401;
      return { error: "Invalid token" };
    }
  })
  .put("/me/public-key", async ({ request, set }) => {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "melon-dev-secret-change-in-prod");
      const { payload } = await jose.jwtVerify(token, secret);
      const userId = payload.sub as string;
      if (!userId) {
        set.status = 401;
        return { error: "Invalid token" };
      }
      const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!u) {
        set.status = 401;
        return { error: "User not found" };
      }
      const body = (await request.json()) as { publicKey?: string };
      const publicKey = body?.publicKey;
      if (typeof publicKey !== "string" || !publicKey.trim()) {
        set.status = 400;
        return { error: "publicKey required" };
      }
      await db.update(users).set({ publicKey: publicKey.trim() }).where(eq(users.id, u.id));
      return { ok: true };
    } catch {
      set.status = 401;
      return { error: "Invalid token" };
    }
  });
