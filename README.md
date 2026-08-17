# Sunway Education Kiosk — Web App

Next.js 16 static export served to an Elo touchscreen kiosk running an Android WebView shell (`com.map72.sunwaykiosk`).

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.6, React 19.2.4, TypeScript |
| Styling | Tailwind CSS |
| State | Zustand |
| Output | Static export (`output: "export"`) |
| Hosting (prod) | DigitalOcean Spaces CDN |
| Hosting (staging) | Vercel |
| Android shell | Kotlin WebView (`cacheMode = LOAD_NO_CACHE`) |

---

## Architecture

```
IndoorCMS API ─────┐
                   ▼
            CORS Proxy (CF Worker)
                   │
                   ▼
           Zustand store (lib/store.ts)
           ├── on success → save to localStorage cache
           └── on failure → load from localStorage cache
                   │
                   ▼
              React UI
```

- **CORS proxy**: `https://sunway-kiosk-proxy.sunway-kiosk.workers.dev/?url=<encoded>`
- **Campus data**: `https://sunwayedu3-data.indoorcms.com/datas_v001.json.gz`
- **Staff data**: `https://izone.sunway.edu.my/segfeeds/staff/mycampus/<token>`
- API calls always include `&_=<timestamp>` to bust CDN/proxy caches
- Data is **never filtered by device time** — all filtering uses API-provided fields only

---

## Data Flow

### Online
1. `fetchGzip(url)` fetches via CORS proxy with `cache: "no-store"`
2. On success: save raw JSON to `localStorage` (`kiosk.data.cache` / `kiosk.staff.cache`)
3. Process data into Zustand store → UI reads from store
4. `lastRefreshed` set to `new Date()`

### Offline / API failure
1. Load from `localStorage` cache
2. Process same way into Zustand store → UI unchanged
3. `lastRefreshed` set to `null` → "cached version" watermark shown at bottom of screen

### Refresh
- **Pull-to-refresh**: swipe down anywhere → calls `refreshData()` (force re-fetches both campus + staff)
- **Admin panel**: "Refresh API Data" button → same `refreshData()`
- **Periodic**: soft refresh triggered when screensaver is expanded (idle state)

---

## Key Files

| File | Purpose |
|---|---|
| `app/page.tsx` | Entry point → renders `<KioskShell />` |
| `components/KioskShell.tsx` | Main shell — all state (tab, search, map, screensaver, admin, pull-to-refresh) |
| `components/MapView.tsx` | Wayfinder indoor map embed |
| `components/Screensaver.tsx` | Idle overlay — static (n=1) or carousel (n≥2), nothing if n=0 |
| `components/AdminPanel.tsx` | Admin settings (triggered by typing `my3245campusx`) |
| `lib/store.ts` | Zustand store — data loading, caching, design toggle |
| `lib/types.ts` | TypeScript types |
| `next.config.ts` | Static export config, conditional `assetPrefix` |
| `scripts/deploy.mjs` | Deploy script → DO Spaces |

---

## Screensaver Behaviour

| Highlights count | Behaviour |
|---|---|
| 0 | Nothing rendered |
| 1 | Static image — no carousel, no auto-advance |
| ≥2 | Swipeable carousel, auto-advances every 5 s |

Outside working hours: black fullscreen overlay that cannot be dismissed.

---

## Admin Panel

Trigger: type `my3245campusx` into the search bar.

Settings stored in `localStorage`:

| Key | Default | Purpose |
|---|---|---|
| `admin.design` | `"default"` | UI layout (`"default"` or `"v1"`) |
| `admin.kiosk.nodeId` | `""` | Kiosk node ID for Wayfinder "you are here" |
| `admin.working.start` | `450` (7:30) | Working hours start (minutes from midnight) |
| `admin.working.end` | `1170` (19:30) | Working hours end (minutes from midnight) |

---

## Asset Prefix Logic

```ts
// next.config.ts
assetPrefix: (process.env.LOCAL_BUILD || process.env.VERCEL || process.env.NODE_ENV !== "production")
  ? ""
  : "https://sgp1.digitaloceanspaces.com/kiosk-sunwayedu.getmallapp.com"
```

- Vercel and local builds get an empty prefix (serve their own assets)
- DO Spaces production builds use the CDN prefix

---

## Deployment

### Staging (Vercel)
```sh
vercel build
vercel deploy --prebuilt
vercel promote <deployment-url>
```

### Production (DO Spaces)
```sh
node --env-file=.env.local scripts/deploy.mjs
```

### Git
```sh
git push origin --all   # pushes to both aldenongjingyi and map711 remotes
```

---

## Android Shell

- Package: `com.map72.sunwaykiosk`
- `cacheMode = WebSettings.LOAD_NO_CACHE` — always loads fresh HTML/JS, prevents stale WebView cache
- On load error: shows `offline.html`, retries every 5 s
- Back button swallowed (kiosk cannot be exited)
- Fullscreen immersive sticky mode

---

## Wayfinder Map API

```js
navigateTo({ from: locationId, to: locationId })  // route between two locations
focusLocation(id)                                  // pan to location (no route)
resetView()                                        // clear route and reset camera
setFloor(floorId)                                  // switch floor
// Note: centerOn() is a no-op while a route is active — use resetView() instead
```

- Kiosk node ID stored in `admin.kiosk.nodeId` drives the `you-are-here-node-id` attribute
- Route mode: `lift`

---

## Browser Target

```
chrome >= 87
android >= 87
```
