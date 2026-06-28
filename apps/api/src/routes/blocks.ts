import { Elysia } from "elysia";
import { and, desc, eq } from "drizzle-orm";
import { authPlugin, requireAuth } from "../auth";
import { legalRequiredPlugin } from "../plugins/legalRequired";
import { db, userBlocks, users } from "../db";
import { toPublicProfile } from "../lib/userDto";
import { signUserMedia } from "../services/mediaAccess";

export const blockRoutes = new Elysia({ prefix: "/blocks" })
  .use(authPlugin)
  .use(legalRequiredPlugin)
  .get("/check/:userId", async ({ user, params, set }) => {
    const me = requireAuth(set)(user);
    const userId = (params as { userId?: string }).userId?.trim();
    if (!userId) {
      set.status = 400;
      return { blocked: false };
    }
    const [row] = await db
      .select({ blockerId: userBlocks.blockerId })
      .from(userBlocks)
      .where(and(eq(userBlocks.blockerId, me.id), eq(userBlocks.blockedId, userId)))
      .limit(1);
    return { blocked: Boolean(row) };
  })
  .get("/", async ({ user, set }) => {
    const me = requireAuth(set)(user);
    const rows = await db
      .select({ user: users })
      .from(userBlocks)
      .innerJoin(users, eq(users.id, userBlocks.blockedId))
      .where(eq(userBlocks.blockerId, me.id))
      .orderBy(desc(userBlocks.createdAt));
    return Promise.all(rows.map((r) => signUserMedia(toPublicProfile(r.user, r.user.birthdayVisible), me.id)));
  })
  .post("/:userId", async ({ user, params, set }) => {
    const me = requireAuth(set)(user);
    const blockedId = (params as { userId?: string }).userId?.trim();
    if (!blockedId || blockedId === me.id) {
      set.status = 400;
      return { error: "Invalid user" };
    }
    const [target] = await db.select().from(users).where(eq(users.id, blockedId)).limit(1);
    if (!target) {
      set.status = 404;
      return { error: "User not found" };
    }
    await db
      .insert(userBlocks)
      .values({ blockerId: me.id, blockedId })
      .onConflictDoNothing();
    return { ok: true };
  })
  .delete("/:userId", async ({ user, params, set }) => {
    const me = requireAuth(set)(user);
    const blockedId = (params as { userId?: string }).userId?.trim();
    if (!blockedId) {
      set.status = 400;
      return { error: "Invalid user" };
    }
    await db
      .delete(userBlocks)
      .where(and(eq(userBlocks.blockerId, me.id), eq(userBlocks.blockedId, blockedId)));
    return { ok: true };
  });
