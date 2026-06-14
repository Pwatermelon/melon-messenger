/**
 * E2E-only routes. Mounted when E2E_TEST_SECRET is set.
 * NEVER enable in production without a strong secret.
 */
import { Elysia } from "elysia";
import * as jose from "jose";
import { eq } from "drizzle-orm";
import { db, users } from "../db";
import { toPrivateProfile } from "../lib/userDto";

const E2E_TEST_SECRET = process.env.E2E_TEST_SECRET ?? "";
const JWT_SECRET = process.env.JWT_SECRET ?? "watermelon-dev-secret-change-in-prod";

function assertE2e(request: Request, set: { status?: number | string }) {
  const secret = request.headers.get("x-e2e-secret");
  if (!E2E_TEST_SECRET || secret !== E2E_TEST_SECRET) {
    set.status = 403;
    return false;
  }
  return true;
}

async function signToken(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return new jose.SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1d")
    .sign(secret);
}

export const e2eRoutes = new Elysia({ prefix: "/e2e" })
  .post("/session", async ({ request, set }) => {
    if (!assertE2e(request, set)) return { error: "Forbidden" };
    const body = (await request.json()) as {
      username?: string;
      email?: string;
      betaApproved?: boolean;
      isAdmin?: boolean;
    };
    const username = (body.username ?? "e2e-user").trim().slice(0, 100);
    const email = (body.email ?? `${username}@e2e.test`).trim().toLowerCase();
    const yandexLogin = username.toLowerCase();

    let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      [user] = await db
        .insert(users)
        .values({
          email,
          username,
          yandexId: `e2e-${username}`,
          yandexLogin,
          subscriptionTier: "free",
          betaApproved: body.betaApproved ?? false,
          isAdmin: body.isAdmin ?? false,
        })
        .returning();
    } else {
      const updates: Partial<typeof users.$inferInsert> = {};
      if (body.betaApproved !== undefined) updates.betaApproved = body.betaApproved;
      if (body.isAdmin !== undefined) updates.isAdmin = body.isAdmin;
      if (!user.yandexLogin) updates.yandexLogin = yandexLogin;
      if (Object.keys(updates).length > 0) {
        [user] = await db.update(users).set(updates).where(eq(users.id, user.id)).returning();
      }
    }

    const token = await signToken(user!.id);
    return { token, user: toPrivateProfile(user!) };
  })
  .post("/approve/:userId", async ({ request, params, set }) => {
    if (!assertE2e(request, set)) return { error: "Forbidden" };
    const [updated] = await db
      .update(users)
      .set({ betaApproved: true })
      .where(eq(users.id, params.userId))
      .returning();
    if (!updated) {
      set.status = 404;
      return { error: "User not found" };
    }
    return { user: toPrivateProfile(updated) };
  })
  .delete("/users/:email", async ({ request, params, set }) => {
    if (!assertE2e(request, set)) return { error: "Forbidden" };
    const email = decodeURIComponent(params.email).toLowerCase();
    await db.delete(users).where(eq(users.email, email));
    return { ok: true };
  });

export function isE2eEnabled(): boolean {
  return Boolean(E2E_TEST_SECRET);
}
