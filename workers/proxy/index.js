/**
 * Cloudflare Worker — CORS proxy for Sunway Edu Kiosk
 * Proxies indoorcms.com and izone.sunway.edu.my which don't allow cross-origin requests.
 *
 * Usage: GET /?url=<encoded_url>
 *
 * izone.sunway.edu.my rate-limits Cloudflare edge IPs and returns a captcha page.
 * The Worker caches successful JSON responses and serves from cache when blocked.
 */

const ALLOWED_ORIGINS = [
  "https://sgp1.digitaloceanspaces.com",
  "https://kiosk-sunwayedu.getmallapp.com.sgp1.cdn.digitaloceanspaces.com",
  "https://sunway-edu-kiosk-web.vercel.app",
  "https://maps-sunwayedu.getmallapp.com",
  "http://localhost:3000",
];

const ALLOWED_HOSTS = [
  "sunwayedu3-data.indoorcms.com",
  "izone.sunway.edu.my",
  "maps-sunwayedu.getmallapp.com",
];

// Stable cache key for the staff endpoint (strip cache-busting query params).
function stableCacheKey(url) {
  const u = new URL(url);
  u.search = "";
  return new Request(u.toString());
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") ?? "";
    const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": corsOrigin,
          "Access-Control-Allow-Methods": "GET",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const { searchParams } = new URL(request.url);
    const target = searchParams.get("url");

    if (!target) {
      return new Response("Missing ?url= parameter", { status: 400 });
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return new Response("Invalid URL", { status: 400 });
    }

    if (!ALLOWED_HOSTS.includes(targetUrl.hostname)) {
      return new Response(`Host not allowed: ${targetUrl.hostname}`, { status: 403 });
    }

    const isIzone = targetUrl.hostname === "izone.sunway.edu.my";
    const cache = caches.default;
    const cacheReq = isIzone ? stableCacheKey(target) : null;

    const upstream = await fetch(targetUrl.toString(), {
      headers: { "User-Agent": "SunwayKiosk/1.0" },
    });

    // Detect captcha: izone returns text/html with <html> when blocked.
    // A valid staff response is JSON (large array).
    const isCaptcha = isIzone && (
      upstream.headers.get("content-type")?.includes("text/html") ||
      !upstream.ok
    );

    if (isCaptcha) {
      // Try serving from edge cache
      const cached = await cache.match(cacheReq);
      if (cached) {
        const headers = new Headers(cached.headers);
        headers.set("Access-Control-Allow-Origin", corsOrigin);
        headers.set("X-Cache", "HIT-captcha-fallback");
        return new Response(cached.body, { status: 200, headers });
      }
      // No cache — nothing we can do
      return new Response("Staff endpoint blocked (captcha), no cache available", {
        status: 502,
        headers: { "Access-Control-Allow-Origin": corsOrigin },
      });
    }

    const headers = new Headers(upstream.headers);
    headers.set("Access-Control-Allow-Origin", corsOrigin);
    headers.delete("Content-Encoding"); // let CF handle encoding
    headers.delete("Content-Length"); // upstream uses chunked; avoid CF setting wrong length

    // Cache successful izone responses at the edge (1 hour TTL)
    if (isIzone && upstream.ok) {
      const body = await upstream.arrayBuffer();
      const cacheHeaders = new Headers(headers);
      cacheHeaders.set("Cache-Control", "public, max-age=3600");
      cacheHeaders.set("Content-Type", "application/json");
      await cache.put(cacheReq, new Response(body, { status: 200, headers: cacheHeaders }));
      return new Response(body, { status: 200, headers });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  },
};
