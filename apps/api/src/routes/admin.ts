import { Elysia, t } from "elysia";
import { and, desc, eq, ilike, isNotNull } from "drizzle-orm";
import { db, users } from "../db";
import { verifyBearerUser } from "./auth";
import { toPrivateProfile } from "../lib/userDto";

export const adminRoutes = new Elysia({ prefix: "/admin" })
  .get(
    "/users",
    async ({ request, query, set }) => {
      const admin = await verifyBearerUser(request);
      if (!admin?.isAdmin) {
        set.status = 403;
        return { error: "Forbidden" };
      }

      const q = query.q?.trim();
      const conditions = [isNotNull(users.yandexId)];
      if (q) {
        conditions.push(ilike(users.yandexLogin, `%${q}%`));
      }

      const list = await db
        .select({
          id: users.id,
          yandexLogin: users.yandexLogin,
          betaApproved: users.betaApproved,
          isAdmin: users.isAdmin,
        })
        .from(users)
        .where(and(...conditions))
        .orderBy(desc(users.createdAt));

      return list.map((u) => ({
        id: u.id,
        yandexLogin: u.yandexLogin ?? "—",
        betaApproved: u.betaApproved,
        isAdmin: u.isAdmin,
      }));
    },
    {
      query: t.Object({
        q: t.Optional(t.String()),
      }),
    }
  )
  .post("/users/:id/approve", async ({ request, params, set }) => {
    const admin = await verifyBearerUser(request);
    if (!admin?.isAdmin) {
      set.status = 403;
      return { error: "Forbidden" };
    }
    const { id } = params;
    const [updated] = await db
      .update(users)
      .set({ betaApproved: true })
      .where(eq(users.id, id))
      .returning();
    if (!updated) {
      set.status = 404;
      return { error: "User not found" };
    }
    return toPrivateProfile(updated);
  })
  .post("/users/:id/revoke", async ({ request, params, set }) => {
    const admin = await verifyBearerUser(request);
    if (!admin?.isAdmin) {
      set.status = 403;
      return { error: "Forbidden" };
    }
    const { id } = params;
    if (id === admin.id) {
      set.status = 400;
      return { error: "Cannot revoke yourself" };
    }
    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!target) {
      set.status = 404;
      return { error: "User not found" };
    }
    if (target.isAdmin) {
      set.status = 400;
      return { error: "Cannot revoke admin" };
    }
    const [updated] = await db
      .update(users)
      .set({ betaApproved: false })
      .where(eq(users.id, id))
      .returning();
    return toPrivateProfile(updated!);
  });
