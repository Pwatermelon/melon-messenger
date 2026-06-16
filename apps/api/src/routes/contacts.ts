import { Elysia } from "elysia";
import { eq, desc, and } from "drizzle-orm";
import { authPlugin, requireAuth } from "../auth";
import { db, users, userContacts } from "../db";
import { toPublicProfile } from "../lib/userDto";
import { signUserMedia } from "../services/mediaAccess";

export const contactRoutes = new Elysia({ prefix: "/contacts" })
  .use(authPlugin)
  .get("/", async ({ user, set }) => {
    const me = requireAuth(set)(user);
    const rows = await db
      .select({ user: users })
      .from(userContacts)
      .innerJoin(users, eq(users.id, userContacts.contactUserId))
      .where(eq(userContacts.userId, me.id))
      .orderBy(desc(userContacts.createdAt));
    return Promise.all(rows.map((r) => signUserMedia(toPublicProfile(r.user, r.user.birthdayVisible), me.id)));
  })
  .post("/:userId", async ({ user, params, set }) => {
    const me = requireAuth(set)(user);
    const contactId = (params as { userId?: string }).userId?.trim();
    if (!contactId || contactId === me.id) {
      set.status = 400;
      return { error: "Invalid contact" };
    }
    const [target] = await db.select().from(users).where(eq(users.id, contactId)).limit(1);
    if (!target) {
      set.status = 404;
      return { error: "User not found" };
    }
    await db
      .insert(userContacts)
      .values({ userId: me.id, contactUserId: contactId })
      .onConflictDoNothing();
    return signUserMedia(toPublicProfile(target, target.birthdayVisible), me.id);
  })
  .delete("/:userId", async ({ user, params, set }) => {
    const me = requireAuth(set)(user);
    const contactId = (params as { userId?: string }).userId?.trim();
    if (!contactId) {
      set.status = 400;
      return { error: "Invalid contact" };
    }
    await db
      .delete(userContacts)
      .where(and(eq(userContacts.userId, me.id), eq(userContacts.contactUserId, contactId)));
    return { ok: true };
  });
