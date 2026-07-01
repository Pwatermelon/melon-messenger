const CACHE = "wm-static-v4";
const MEDIA_CACHE = "wm-media-v1";
/** Макс. размер одного файла в SW-кэше медиа (крупные видео не кэшируем) */
const MEDIA_CACHE_MAX_ITEM_BYTES = 5 * 1024 * 1024;
const OFFLINE_URLS = ["/", "/index.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(OFFLINE_URLS).catch(() => undefined))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE && k !== MEDIA_CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function isMediaRequest(url) {
  return /\/media\/[^/?#]+/.test(url.pathname);
}

function mediaCacheKey(url) {
  const m = url.pathname.match(/\/media\/([^/?#]+)/);
  return m ? `/media/${m[1]}` : url.pathname;
}

async function trimMediaCache(cache) {
  const keys = await cache.keys();
  const maxEntries = 400;
  if (keys.length <= maxEntries) return;
  const excess = keys.length - maxEntries;
  await Promise.all(keys.slice(0, excess).map((k) => cache.delete(k)));
}

function shouldCacheMediaResponse(res) {
  const len = Number(res.headers.get("content-length") || 0);
  if (len > MEDIA_CACHE_MAX_ITEM_BYTES) return false;
  const type = (res.headers.get("content-type") || "").toLowerCase();
  if (type.startsWith("video/")) return false;
  return true;
}

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING" || event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isNavigationRequest(request) {
  return request.mode === "navigate" || (request.method === "GET" && request.headers.get("accept")?.includes("text/html"));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/ws")) {
    if (isMediaRequest(url)) {
      const key = mediaCacheKey(url);
      event.respondWith(
        caches.open(MEDIA_CACHE).then(async (cache) => {
          const cached = await cache.match(key);
          const network = fetch(request)
            .then((res) => {
              if (res.ok && shouldCacheMediaResponse(res)) {
                cache.put(key, res.clone()).then(() => trimMediaCache(cache));
              }
              return res;
            })
            .catch(() => cached);
          return cached ?? network;
        })
      );
    }
    return;
  }

  // HTML/навигация: всегда сеть в первую очередь, кэш — только офлайн-запас.
  // Это гарантирует, что после деплоя клиент получит свежий index.html
  // (со ссылками на новые хэшированные бандлы), а не залипнет на старой версии.
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put("/index.html", copy));
          }
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/index.html") || caches.match("/")))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request).then((r) => r || caches.match("/")))
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "Watermelon", body: "Новое сообщение" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "wm-message",
      data: data,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      if (clients[0]) return clients[0].focus();
      return self.clients.openWindow("/");
    })
  );
});
