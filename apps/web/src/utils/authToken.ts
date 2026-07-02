const TOKEN_KEY = "wm_token";
const LEGACY_TOKEN_KEY = "melon_token";

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(LEGACY_TOKEN_KEY);
}

export function authMediaHeaders(): HeadersInit {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function syncAuthTokenToServiceWorker(token: string | null): void {
  if (!("serviceWorker" in navigator)) return;
  const msg = { type: "AUTH_TOKEN", token };
  navigator.serviceWorker.controller?.postMessage(msg);
  void navigator.serviceWorker.ready.then((reg) => {
    reg.active?.postMessage(msg);
  });
}
