import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { db, users } from "./db";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET ?? "melon-dev-secret-change-in-prod";

export const authPlugin = new Elysia({ name: "auth" })
  .use(
    jwt({
      name: "jwt",
      secret: JWT_SECRET,
      exp: "7d",
    })
  )
  .derive({ as: "global" }, async ({ jwt, headers, set }) => {
    const authHeader = headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return { user: null };
    try {
      const payload = await jwt.verify(token);
      if (!payload || typeof payload.sub !== "string") return { user: null };
      const [u] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
      return { user: u ?? null };
    } catch {
      return { user: null };
    }
  });

export function requireAuth(set: { status?: number }) {
  return (user: { id: string } | null) => {
    if (!user) {
      set.status = 401;
      throw new Error("Unauthorized");
    }
    return user;
  };
}
