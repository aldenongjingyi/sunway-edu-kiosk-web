// Kiosk service worker
//
// 1. App shell (HTML, JS, CSS) — NETWORK FIRST, cache fallback
//    Always tries network. On success: serve + update cache.
//    On failure with cache: serve cached version (offline works after first load).
//    On failure without cache: reject (no synthetic 503) so Android WebView's
//    native onReceivedError fires and shows offline.html until network returns.
//    No timeout — a premature timeout returning 503 was found to trigger
//    onReceivedError in Android WebView 150, causing an infinite retry loop.
//
// 2. CMS images — CACHE FIRST
//    Images rarely change. Served from cache instantly; fetched and cached
//    on first request. Works offline after first load.

const APP_CACHE = "kiosk-app-v1";
const IMG_CACHE = "kiosk-images-v1";

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

  // --- App shell (same origin): network-first, cache fallback, no synthetic error
  if (isSameOriginGet(event.request)) {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          caches.open(APP_CACHE).then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      } catch {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // No cache and no network — let the promise reject so Android WebView's
        // native error handling takes over (shows offline.html, retries every 5s).
        throw new Error("offline, no cache");
      }
    })());
  }
});
