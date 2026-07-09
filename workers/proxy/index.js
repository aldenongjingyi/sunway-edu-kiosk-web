/**
 * Cloudflare Worker — CORS proxy for Sunway Edu Kiosk
 * Proxies indoorcms.com and izone.sunway.edu.my which don't allow cross-origin requests.
 *
 * Usage: GET /?url=<encoded_url>
 *
 * TODO (before production): evaluate moving to DO Functions to consolidate infrastructure.
 */

const ALLOWED_ORIGINS = [
  "https://sgp1.digitaloceanspaces.com",
  "https://sunway-edu-kiosk-web.vercel.app",
  "http://localhost:3000",
];

const ALLOWED_HOSTS = [
  "sunwayedu3-data.indoorcms.com",
  "izone.sunway.edu.my",
  "maps-sunwayedu.getmallapp.com",
];

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

    const upstream = await fetch(targetUrl.toString(), {
      headers: { "User-Agent": "SunwayKiosk/1.0" },
    });

    const headers = new Headers(upstream.headers);
    headers.set("Access-Control-Allow-Origin", corsOrigin);
    headers.delete("Content-Encoding"); // let CF handle encoding

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  },
};
