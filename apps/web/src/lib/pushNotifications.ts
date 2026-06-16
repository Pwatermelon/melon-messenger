import { getApiUrl } from "../config";

export type PushSubscribeResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "server_unconfigured" | "subscribe_failed" | "permission_denied" };

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function getVapidPublicKey(): Promise<string | null> {
  const res = await fetch(`${getApiUrl()}/push/vapid-public-key`);
  if (!res.ok) return null;
  const data = (await res.json()) as { publicKey?: string | null; enabled?: boolean };
  return data.enabled && data.publicKey ? data.publicKey : null;
}

export async function isPushServerConfigured(): Promise<boolean> {
  return (await getVapidPublicKey()) !== null;
}

export async function subscribeToPush(token: string): Promise<PushSubscribeResult> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, reason: "unsupported" };
  }

  const vapidKey = await getVapidPublicKey();
  if (!vapidKey) return { ok: false, reason: "server_unconfigured" };

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  }

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, reason: "subscribe_failed" };
  }

  const res = await fetch(`${getApiUrl()}/push/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    }),
  });
  return res.ok ? { ok: true } : { ok: false, reason: "subscribe_failed" };
}

export async function unsubscribeFromPush(token: string): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await fetch(`${getApiUrl()}/push/subscribe`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
  }
}

export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch((err) => {
    console.warn("[SW] registration failed:", err);
  });
}
