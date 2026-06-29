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

  // Когда новый service worker берёт управление (после деплоя новой версии),
  // перезагружаем страницу, чтобы клиент гарантированно перешёл на свежий код.
  // Это решает проблему "залипшей" версии в PWA на iOS, где обычного обновления
  // страницы нет, а приложение восстанавливается из памяти.
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => {
      const promoteWaiting = () => {
        if (reg.waiting) reg.waiting.postMessage("SKIP_WAITING");
      };
      // Если новая версия уже ждёт активации — активируем сразу.
      promoteWaiting();
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          // Новая версия установлена и есть активный контроллер => это обновление.
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            promoteWaiting();
          }
        });
      });

      // iOS standalone PWA не проверяет обновления при возврате из фона сам —
      // инициируем проверку при каждом показе приложения.
      const checkForUpdate = () => {
        if (document.visibilityState === "visible") void reg.update().catch(() => undefined);
      };
      document.addEventListener("visibilitychange", checkForUpdate);
      window.addEventListener("focus", checkForUpdate);
    })
    .catch((err) => {
      console.warn("[SW] registration failed:", err);
    });
}
