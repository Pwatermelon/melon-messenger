import { Elysia } from "elysia";
import { eq, and } from "drizzle-orm";
import { db, pushSubscriptions } from "../db";
import { verifyBearerUser } from "./auth";
import { notifyUser, isWebPushConfigured } from "../services/webPush";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";

export { notifyUser };

export const pushRoutes = new Elysia({ prefix: "/push" })
  .get("/vapid-public-key", () => ({
    publicKey: VAPID_PUBLIC_KEY || null,
    enabled: isWebPushConfigured(),
  }))
  .post("/subscribe", async ({ request, set }) => {
    const u = await verifyBearerUser(request);
    if (!u) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    const body = (await request.json()) as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      set.status = 400;
      return { error: "Invalid subscription" };
    }

    await db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, u.id), eq(pushSubscriptions.endpoint, body.endpoint)));

    await db.insert(pushSubscriptions).values({
      userId: u.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    });

    return { ok: true };
  })
  .delete("/subscribe", async ({ request, set }) => {
    const u = await verifyBearerUser(request);
    if (!u) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    const body = (await request.json().catch(() => ({}))) as { endpoint?: string };
    if (body.endpoint) {
      await db
        .delete(pushSubscriptions)
        .where(and(eq(pushSubscriptions.userId, u.id), eq(pushSubscriptions.endpoint, body.endpoint)));
    } else {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, u.id));
    }
    return { ok: true };
  });
