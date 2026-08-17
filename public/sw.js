// Kiosk image cache service worker
// Cache-first strategy for images from known CMS domains.
// Cached images persist across sessions and work offline.

const CACHE_NAME = "kiosk-images-v1";

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

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (!isImageRequest(event.request)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;

      try {
        const response = await fetch(event.request);
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      } catch {
        // Network failed and no cache — return empty 404
        return new Response(null, { status: 404 });
      }
    })
  );
});
