const BASE = (process.env.MELON_PAYMENT_URL ?? "").replace(/\/$/, "");
const API_KEY = process.env.MELON_PAYMENT_API_KEY ?? "";

export function isMelonPaymentConfigured(): boolean {
  return Boolean(BASE && API_KEY);
}

export async function fetchCoinBalance(externalUserId: string): Promise<number | null> {
  if (!isMelonPaymentConfigured()) return null;
  const res = await fetch(`${BASE}/v1/balance/${encodeURIComponent(externalUserId)}`, {
    headers: { "X-Melon-Api-Key": API_KEY },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { coins?: number };
  return typeof data.coins === "number" ? data.coins : null;
}
