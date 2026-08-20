// Kiosk service worker
//
// Two caching strategies:
//
// 1. App shell (HTML, JS, CSS, wayfinder script) — NETWORK FIRST
//    Always tries the network. On success: serve + update cache.
//    On failure: serve from cache so the app loads offline.
//    This means updates are always picked up when online.
//
// 2. CMS images — CACHE FIRST
//    Images rarely change. Served from cache instantly; fetched and cached
//    on first request. Works offline after first load.

const APP_CACHE  = "kiosk-app-v1";
const IMG_CACHE  = "kiosk-images-v1";

const IMAGE_ORIGINS = [
  "sunwayedu3-data.indoorcms.com",
  "izone.sunway.edu.my",
];

function isImageRequest(request) {
  const url = new URL(request.url);
  if (!IMAGE_ORIGINS.includes(url.hostname)) return false;
  return /\.(jpe?g|png|gif|webp|svg)(\?.*)?$/i.test(url.pathname) ||
    request.destination === "image";
}

function isSameOriginGet(request) {
  return request.method === "GET" && new URL(request.url).origin === self.location.origin;
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  // --- CMS images: cache-first
  if (isImageRequest(event.request)) {
    event.respondWith(
      caches.open(IMG_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        } catch {
          return new Response(null, { status: 404 });
        }
      })
    );
    return;
  }

  // --- App shell (same origin): network-first, cache fallback
  // Timeout after 5s so offline fallback is fast rather than waiting for TCP to give up.
  if (isSameOriginGet(event.request)) {
    event.respondWith((async () => {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 5000)
      );
      try {
        const response = await Promise.race([fetch(event.request), timeout]);
        if (response.ok) {
          caches.open(APP_CACHE).then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      } catch {
        const cached = await caches.match(event.request);
        return cached ?? new Response("Offline", { status: 503, statusText: "Offline" });
      }
    })());
  }
});
