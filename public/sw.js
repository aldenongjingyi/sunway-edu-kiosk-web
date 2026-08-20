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
//
// 3. Map floor plan (maps_v001.json.gz) — CACHE FIRST
//    Fetched by the wayfinder engine directly (cross-origin). Cached so the
//    map renders offline after first use. Keyed without query string so
//    cache-busting params don't create duplicate entries.

const APP_CACHE = "kiosk-app-v1";
const IMG_CACHE = "kiosk-images-v1";
const MAP_CACHE = "kiosk-map-v1";

const MAP_DATA_URL = "https://sunwayedu3-data.indoorcms.com/maps_v001.json.gz";

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

self.addEventListener("install", (event) => {
  self.skipWaiting();
  // Pre-cache the wayfinder script so the map works offline even before
  // the user has ever opened the map view (it's lazy-loaded, so it wouldn't
  // otherwise be in the app cache until the map is opened while online).
  event.waitUntil(
    caches.open(APP_CACHE).then(cache => cache.add("/wayfinder-map.min.js").catch(() => {}))
  );
});
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  // --- Map floor plan: cache-first, keyed without query string
  if (event.request.method === "GET" && event.request.url.startsWith(MAP_DATA_URL)) {
    event.respondWith(
      caches.open(MAP_CACHE).then(async (cache) => {
        const cached = await cache.match(MAP_DATA_URL);
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          if (response.ok) cache.put(MAP_DATA_URL, response.clone());
          return response;
        } catch {
          return new Response(null, { status: 404 });
        }
      })
    );
    return;
  }

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
