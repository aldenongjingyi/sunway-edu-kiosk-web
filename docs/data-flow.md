# Data Flow Diagrams

## 1. Previous Setup (Vercel / Next.js server)

The browser never talked to external APIs directly.
The Next.js server acted as the middle man for everything.

```mermaid
sequenceDiagram
    participant Elo as Elo Kiosk (Browser)
    participant Vercel as Next.js Server (Vercel)
    participant CMS as indoorcms.com
    participant Staff as izone.sunway.edu.my

    Elo->>Vercel: Load page
    Vercel-->>Elo: HTML / CSS / JS

    Elo->>Vercel: GET /api/proxy?url=indoorcms.com/...
    Vercel->>CMS: Fetch campus data (server-to-server, no CORS)
    CMS-->>Vercel: Campus data
    Vercel-->>Elo: Campus data

    Elo->>Vercel: GET /api/proxy?url=izone.sunway.edu.my/...
    Vercel->>Staff: Fetch staff data (server-to-server, no CORS)
    Staff-->>Vercel: Staff data
    Vercel-->>Elo: Staff data
```

---

## 2. Current Setup (DO Spaces + Cloudflare Worker)

The app is now static files — no Next.js server. The browser fetches APIs directly, but needs a relay for CORS.

```mermaid
sequenceDiagram
    participant Elo as Elo Kiosk (Browser)
    participant DO as DO Spaces (Static Files)
    participant CF as Cloudflare Worker (CORS Proxy)
    participant CMS as indoorcms.com
    participant Staff as izone.sunway.edu.my

    Elo->>DO: Load page
    DO-->>Elo: HTML / CSS / JS

    Elo->>CF: GET /?url=indoorcms.com/... (cross-origin, but CF allows it)
    CF->>CMS: Fetch campus data (server-to-server, no CORS)
    CMS-->>CF: Campus data
    CF-->>Elo: Campus data + Access-Control-Allow-Origin header

    Elo->>CF: GET /?url=izone.sunway.edu.my/... (cross-origin, but CF allows it)
    CF->>Staff: Fetch staff data (server-to-server, no CORS)
    Staff-->>CF: Staff data
    CF-->>Elo: Staff data + Access-Control-Allow-Origin header
```

---

## 3. Option A — Enable CORS on indoorcms.com (recommended quick win)

Add `Access-Control-Allow-Origin: *` to the CMS API responses.
The browser can fetch campus data directly. Staff data still needs a relay.

```mermaid
sequenceDiagram
    participant Elo as Elo Kiosk (Browser)
    participant DO as DO Spaces (Static Files)
    participant CMS as indoorcms.com
    participant CF as Cloudflare Worker (CORS Proxy)
    participant Staff as izone.sunway.edu.my

    Elo->>DO: Load page
    DO-->>Elo: HTML / CSS / JS

    Elo->>CMS: GET campus data (CORS now allowed ✓)
    CMS-->>Elo: Campus data + Access-Control-Allow-Origin: *

    Elo->>CF: GET /?url=izone.sunway.edu.my/...
    CF->>Staff: Fetch staff data (server-to-server)
    Staff-->>CF: Staff data
    CF-->>Elo: Staff data + Access-Control-Allow-Origin header
```

---

## 4. Option B — Host on indoorcms.com (Django)

The kiosk app is served from the same origin as the CMS.
No CORS issues for campus data. Staff data proxied by Django.

```mermaid
sequenceDiagram
    participant Elo as Elo Kiosk (Browser)
    participant Django as indoorcms.com (Django)
    participant Staff as izone.sunway.edu.my

    Elo->>Django: Load page
    Django-->>Elo: HTML / CSS / JS (static files served by Django)

    Elo->>Django: GET /api/campus-data (same origin, no CORS)
    Django-->>Elo: Campus data (served directly from DB or CMS)

    Elo->>Django: GET /api/staff-proxy (same origin, no CORS)
    Django->>Staff: Fetch staff data (server-to-server)
    Staff-->>Django: Staff data
    Django-->>Elo: Staff data
```

---

## 5. Option C — Next.js server on DO App Platform

Back to a server, but hosted on DigitalOcean instead of Vercel.
Same pattern as the original Vercel setup, everything in one place.

```mermaid
sequenceDiagram
    participant Elo as Elo Kiosk (Browser)
    participant DO as Next.js Server (DO App Platform)
    participant CMS as indoorcms.com
    participant Staff as izone.sunway.edu.my

    Elo->>DO: Load page
    DO-->>Elo: HTML / CSS / JS

    Elo->>DO: GET /api/proxy?url=indoorcms.com/...
    DO->>CMS: Fetch campus data (server-to-server, no CORS)
    CMS-->>DO: Campus data
    DO-->>Elo: Campus data

    Elo->>DO: GET /api/proxy?url=izone.sunway.edu.my/...
    DO->>Staff: Fetch staff data (server-to-server, no CORS)
    Staff-->>DO: Staff data
    DO-->>Elo: Staff data
```

---

## Summary

| Setup | Hosting | Campus Data | Staff Data | Extra Services |
|---|---|---|---|---|
| Previous (Vercel) | Vercel (server) | Proxied via Next.js | Proxied via Next.js | None |
| Current (DO Spaces) | DO Spaces (static) | Cloudflare Worker | Cloudflare Worker | Cloudflare |
| Option A (CORS fix) | DO Spaces (static) | Direct fetch | Cloudflare Worker | Cloudflare (staff only) |
| Option B (Django) | indoorcms.com | Same origin | Proxied via Django | None |
| Option C (DO App) | DO App Platform (server) | Proxied via Next.js | Proxied via Next.js | None |
| Option F (DO CDN + Functions) | DO Spaces CDN (static) | DO Function | DO Function | None (all DO) |

---

## 6. Option F — DO Spaces CDN + DO Functions (recommended for production)

Everything stays within DigitalOcean. CDN serves the static app faster globally.
DO Function replaces Cloudflare Worker as the CORS proxy.

```mermaid
sequenceDiagram
    participant Elo as Elo Kiosk (Browser)
    participant CDN as DO Spaces CDN (Static Files)
    participant Fn as DO Function (CORS Proxy)
    participant CMS as indoorcms.com
    participant Staff as izone.sunway.edu.my

    Elo->>CDN: Load page (served from edge)
    CDN-->>Elo: HTML / CSS / JS

    Elo->>Fn: GET /?url=indoorcms.com/... (cross-origin, but Fn allows it)
    Fn->>CMS: Fetch campus data (server-to-server, no CORS)
    CMS-->>Fn: Campus data
    Fn-->>Elo: Campus data + Access-Control-Allow-Origin header

    Elo->>Fn: GET /?url=izone.sunway.edu.my/... (cross-origin, but Fn allows it)
    Fn->>Staff: Fetch staff data (server-to-server, no CORS)
    Staff-->>Fn: Staff data
    Fn-->>Elo: Staff data + Access-Control-Allow-Origin header
```
