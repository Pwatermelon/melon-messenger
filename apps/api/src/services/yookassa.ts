/**
 * YooKassa API v3 — https://yookassa.ru/developers
 */
import { db, payments, users } from "../db";
import { eq } from "drizzle-orm";
import { toPrivateProfile } from "../lib/userDto";

const SHOP_ID = process.env.YOOKASSA_SHOP_ID ?? "";
const SECRET_KEY = process.env.YOOKASSA_SECRET_KEY ?? "";
const PLATINUM_PRICE_RUB = process.env.PLATINUM_PRICE_RUB ?? "299";
const WEB_URL = process.env.WEB_URL ?? "http://localhost:5173";
const API_PUBLIC_URL = process.env.API_PUBLIC_URL ?? process.env.WEB_URL ?? "http://localhost:3000";

export function isYookassaConfigured(): boolean {
  return Boolean(SHOP_ID && SECRET_KEY);
}

function authHeader(): string {
  return "Basic " + Buffer.from(`${SHOP_ID}:${SECRET_KEY}`).toString("base64");
}

interface YooPaymentResponse {
  id: string;
  status: string;
  confirmation?: { confirmation_url?: string };
}

export async function createPlatinumPayment(userId: string): Promise<{
  paymentId: string;
  confirmationUrl: string | null;
  amount: string;
}> {
  const amount = PLATINUM_PRICE_RUB;
  const idempotenceKey = crypto.randomUUID();

  if (!isYookassaConfigured()) {
    const [row] = await db
      .insert(payments)
      .values({ userId, amount, currency: "RUB", status: "dev_pending", plan: "platinum" })
      .returning();
    return { paymentId: row!.id, confirmationUrl: null, amount };
  }

  const returnUrl = `${WEB_URL}/platinum?payment=return`;
  const res = await fetch("https://api.yookassa.ru/v3/payments", {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      "Idempotence-Key": idempotenceKey,
    },
    body: JSON.stringify({
      amount: { value: amount, currency: "RUB" },
      capture: true,
      confirmation: { type: "redirect", return_url: returnUrl },
      description: "Watermelon Platinum — 1 месяц",
      metadata: { userId, plan: "platinum" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[YooKassa] create payment failed:", text);
    throw new Error("Не удалось создать платёж");
  }

  const data = (await res.json()) as YooPaymentResponse;
  const [row] = await db
    .insert(payments)
    .values({
      userId,
      yookassaPaymentId: data.id,
      amount,
      currency: "RUB",
      status: data.status,
      plan: "platinum",
    })
    .returning();

  return {
    paymentId: row!.id,
    confirmationUrl: data.confirmation?.confirmation_url ?? null,
    amount,
  };
}

export async function activatePlatinum(userId: string, months = 1): Promise<typeof users.$inferSelect> {
  const expires = new Date();
  expires.setMonth(expires.getMonth() + months);
  const [updated] = await db
    .update(users)
    .set({ subscriptionTier: "platinum", subscriptionExpiresAt: expires })
    .where(eq(users.id, userId))
    .returning();
  if (!updated) throw new Error("User not found");
  return updated;
}

export async function handleYookassaWebhook(body: {
  event?: string;
  object?: { id?: string; status?: string; metadata?: { userId?: string; plan?: string } };
}): Promise<void> {
  if (body.event !== "payment.succeeded" && body.object?.status !== "succeeded") return;
  const yookassaId = body.object?.id;
  if (!yookassaId) return;

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.yookassaPaymentId, yookassaId))
    .limit(1);
  if (!payment || payment.status === "succeeded") return;

  await db.update(payments).set({ status: "succeeded" }).where(eq(payments.id, payment.id));
  await activatePlatinum(payment.userId);
}

export async function confirmDevPayment(paymentId: string, userId: string) {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!payment || payment.userId !== userId) throw new Error("Payment not found");
  if (payment.status === "succeeded") {
    const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return u ? toPrivateProfile(u) : null;
  }
  await db.update(payments).set({ status: "succeeded" }).where(eq(payments.id, paymentId));
  const updated = await activatePlatinum(userId);
  return toPrivateProfile(updated);
}

export function getWebhookUrl(): string {
  const base = API_PUBLIC_URL.replace(/\/$/, "").replace(/\/api$/, "");
  return `${base}/api/payments/webhook/yookassa`;
}
