import { Elysia } from "elysia";
import { eq } from "drizzle-orm";
import { db, payments } from "../db";
import { verifyBearerUser } from "./auth";
import {
  createPlatinumPayment,
  confirmDevPayment,
  handleYookassaWebhook,
  isYookassaConfigured,
} from "../services/yookassa";
import { toPrivateProfile } from "../lib/userDto";
import { users } from "../db";

export const paymentRoutes = new Elysia({ prefix: "/payments" })
  .post("/platinum", async ({ request, set }) => {
    const u = await verifyBearerUser(request);
    if (!u) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    if (u.subscriptionTier === "platinum" && u.subscriptionExpiresAt && u.subscriptionExpiresAt > new Date()) {
      return { user: toPrivateProfile(u), message: "Platinum уже активен" };
    }
    try {
      const result = await createPlatinumPayment(u.id);
      if (!isYookassaConfigured()) {
        const user = await confirmDevPayment(result.paymentId, u.id);
        return { user, devMode: true, message: "Platinum активирован (dev)" };
      }
      return {
        paymentId: result.paymentId,
        confirmationUrl: result.confirmationUrl,
        amount: result.amount,
        currency: "RUB",
      };
    } catch (e) {
      set.status = 500;
      return { error: e instanceof Error ? e.message : "Payment failed" };
    }
  })
  .get("/platinum/:paymentId", async ({ request, params, set }) => {
    const u = await verifyBearerUser(request);
    if (!u) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, params.paymentId))
      .limit(1);
    if (!payment || payment.userId !== u.id) {
      set.status = 404;
      return { error: "Not found" };
    }
    const [freshUser] = await db.select().from(users).where(eq(users.id, u.id)).limit(1);
    return {
      status: payment.status,
      user: freshUser ? toPrivateProfile(freshUser) : toPrivateProfile(u),
    };
  })
  .post("/webhook/yookassa", async ({ request, set }) => {
    try {
      const body = (await request.json()) as Parameters<typeof handleYookassaWebhook>[0];
      await handleYookassaWebhook(body);
      return { ok: true };
    } catch (e) {
      console.error("[YooKassa webhook]", e);
      set.status = 400;
      return { error: "Webhook error" };
    }
  });
