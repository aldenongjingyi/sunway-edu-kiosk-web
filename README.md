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

Working hours scheduling is handled by Hexnode MDM — not the web app.

---

## Admin Panel

Trigger: type `my3245campusx` into the search bar.

The admin panel exposes **only kiosk node provisioning** — no other settings. This prevents students from tampering with kiosk behaviour.

| Key | Storage | Purpose |
|---|---|---|
| `admin.kiosk.nodeId` | `localStorage` | Kiosk node ID for Wayfinder "you are here" — set once per device |

### Hardcoded settings (change in source, not via UI)

These are intentionally not in any UI. Edit the noted file and redeploy to change them.

#### `components/KioskShell.tsx`

| Constant | Default | Purpose |
|---|---|---|
| `DESIGN` | `"default"` | UI layout — `"default"` (iOS-style) or `"v1"` (airport-kiosk style) |
| `ADMIN_CODE` | `"my3245campusx"` | Secret code typed into search bar to open node provisioning |
| `IDLE_SECONDS` | `20` | Seconds of inactivity before screensaver expands |
| `RELOAD_INTERVAL_MS` | `900000` (15 min) | How often data auto-refreshes while screensaver is active (idle only) |

#### `components/Screensaver.tsx`

| Constant | Default | Purpose |
|---|---|---|
| `VARIANT` | `3` | Visual style — `1` black bg + card, `2` flush to edge, `3` dimmed scrim, `4` colour-wash blur |
| `THUMB_PX` | `120` | Collapsed thumbnail width in px |
| Auto-advance interval | `5000` ms | How often the carousel slides (inside `restartTimer`) |

#### `app/build.gradle.kts` (Android shell)

| Field | Default | Purpose |
|---|---|---|
| `KIOSK_URL` | Vercel / DO Spaces URL | URL the WebView loads — set per branch (`main` = DO Spaces, `vercel-dev` = Vercel) |

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

---

## Troubleshooting

### Remote debugging the Elo kiosk via ADB

Connect ADB wirelessly (requires platform-tools 35.0.2+):
```sh
adb mdns services              # find kiosk IP/port after reboot
adb pair <ip>:<pairing-port> <6-digit-code>
adb connect <ip>:<connection-port>
adb devices                    # confirm connected
```

After connecting, open Chrome DevTools remotely:
```sh
# Find the WebView PID
adb shell "cat /proc/net/unix | grep devtools"
# Output: ...webview_devtools_remote_<PID>

# Forward the DevTools port
adb forward tcp:9222 localabstract:webview_devtools_remote_<PID>
```

Then open `chrome://inspect` in your desktop Chrome, or connect via WebSocket at `ws://localhost:9222`. You can inspect the DOM, run JS, monitor network requests, and check localStorage directly on the device.

To read localStorage from DevTools console:
```js
localStorage.getItem("kiosk.data.cache")?.length    // campus data size in chars
localStorage.getItem("kiosk.staff.cache")?.length   // staff data size (~949KB expected)
```

---

### Production vs staging: which device loads what

| Environment | URL | Used by |
|---|---|---|
| **Production** | `https://sgp1.digitaloceanspaces.com/kiosk-sunwayedu.getmallapp.com` | Elo kiosk (ADB), Hexnode-managed devices |
| **Staging** | Vercel deployment URL | Browser testing only |

The Android shell's `KIOSK_URL` is set at build time in `app/build.gradle.kts`. The `main` branch APK points to DO Spaces. **Deploying to Vercel has no effect on the physical kiosk or Hexnode devices** — only `scripts/deploy.mjs` (DO Spaces) does.

---

### Staff tab eternally loading / spinner never goes away

**Root cause**: Staff data failed to fetch AND localStorage cache is empty (or was wiped by `pm clear`).

`pm clear com.map72.sunwaykiosk` wipes all app data: localStorage, service worker cache, WebView HTTP cache. After this, on first boot the app must fetch fresh data. If the fetch fails silently, the spinner loops forever.

**Diagnosing**: Check what the CORS proxy returns for the staff endpoint:
```sh
curl -v "https://sunway-kiosk-proxy.sunway-kiosk.workers.dev/?url=https%3A%2F%2Fizone.sunway.edu.my%2Fsegfeeds%2Fstaff%2Fmycampus%2F<token>"
```
Look for `content-length` in the response headers. If it's `0` or missing when the body is non-empty, the Worker has the content-length bug (see below).

**Recovery**: Pull-to-refresh or tap "Refresh API Data" in the admin panel. If the fetch succeeds, data is cached in localStorage and subsequent boots load from cache.

---

### Cloudflare Worker `content-length: 0` bug

**What happened**: `izone.sunway.edu.my` (staff API) returns `Transfer-Encoding: chunked` with no `Content-Length` header. When the Cloudflare Worker copied upstream headers with `new Headers(upstream.headers)` and passed the body via `new Response(upstream.body, ...)`, Cloudflare set `content-length: 0` on the outgoing response.

**Why Android broke but curl didn't**: Android WebView (like most strict HTTP clients) reads exactly as many bytes as `Content-Length` says — 0 bytes. `response.json()` then fails on the empty body, the catch block runs, and staff never loads. `curl` by contrast reads until the connection closes, ignoring a bogus `Content-Length: 0`.

**The fix** (in `workers/proxy/index.js`):
```js
headers.delete("Content-Encoding"); // let CF handle encoding
headers.delete("Content-Length");   // upstream uses chunked; avoid CF setting wrong length
```

Deleting `Content-Length` lets Cloudflare re-derive the correct length from the actual body.

**Deploying the Worker** requires an interactive Cloudflare login. The Worker is on the **aldenongjingyi GitHub-linked Cloudflare account** — there are multiple accounts on this machine so make sure you're logged into the right one.

Run in your terminal (not in Claude's shell):
```sh
# Verify correct account first:
npx wrangler whoami   # should show aldenongjingyi/GitHub account

# If wrong account:
npx wrangler logout
npx wrangler login    # sign in with GitHub

cd workers/proxy
npx wrangler deploy
```
The Worker deploys globally — all devices (Elo, Hexnode) pick up the fix immediately without any APK or web build changes.

---

### Staff loads on Elo but not in browser (CORS origin mismatch)

The Elo APK loads from the direct DO Spaces URL (`https://sgp1.digitaloceanspaces.com/...`). When you open the link the deploy script prints (`https://kiosk-sunwayedu.getmallapp.com.sgp1.cdn.digitaloceanspaces.com/...`), the browser sends a different `Origin` header — the CDN subdomain. If only the direct URL is in `ALLOWED_ORIGINS`, the Worker returns the wrong `Access-Control-Allow-Origin` and the browser blocks the fetch.

**Fix**: ensure both origins are in `ALLOWED_ORIGINS` in `workers/proxy/index.js`:
```js
"https://sgp1.digitaloceanspaces.com",
"https://kiosk-sunwayedu.getmallapp.com.sgp1.cdn.digitaloceanspaces.com",
```
Then redeploy the Worker.

---

### Staff photo avatars not showing

**Symptom**: Staff list shows gray placeholder circles for every staff member, even after data loads.

**Known causes**:

1. **`vine.sunway.edu.my` is internal-only** — staff photo URLs often point to `vine.sunway.edu.my`, which only resolves inside Sunway's campus network. Photos will fail to load from outside campus. This is expected and not a bug — `AvatarPlaceholder` shows the gray placeholder on `onError`.

2. **React `onError` not firing** — if any JavaScript in the page calls `event.stopImmediatePropagation()` on `window` during the capture phase for `error` events, the event never reaches the `<img>` element and React's `onError` handler never runs. The image stays `opacity: 0` (invisible) indefinitely. Check `HyperDXInit.tsx` and any other global event listeners for this pattern.

3. **Invisible placeholder** — if the placeholder div has `bg-white` background it's invisible on the white page. The placeholder uses `bg-[#e5e5ea]` (gray) to match the iOS app's behavior.

**`AvatarPlaceholder` 3-state logic**:
- `"loading"` — shows gray circle + person icon, image rendered at `opacity: 0`
- `"loaded"` — image fades in (`opacity: 1`), gray circle hidden
- `"error"` — shows gray circle + person icon (same as no `src`)

---

### HyperDX not receiving events — GitHub Actions overwriting deploy without API key

**Symptom**: HyperDX shows no events after a `git push`, even though the local deploy worked fine and events were visible before pushing.

**Root cause**: `.github/workflows/deploy.yml` triggers on every push to `main` and runs `node scripts/deploy.mjs` without `NEXT_PUBLIC_HYPERDX_API_KEY` in its environment. GitHub Actions rebuilds the app and overwrites DO Spaces with a build where the API key is undefined — silently breaking HyperDX init.

This was compounded by a Turbopack behaviour: `process.env.NEXT_PUBLIC_*` is only statically inlined when the module ends up in a client-only chunk. When small code changes shift the module into a shared (server+client) chunk, the env var falls back to a runtime process polyfill that resolves to `undefined` in the browser.

**Fix**: hardcode the HyperDX API key directly in `lib/hdx.ts`. It is a browser telemetry key — it is intentionally public, visible to anyone in DevTools, and has no elevated privileges. There is no security benefit to keeping it in an env var.

```ts
HyperDX.init({
  apiKey: "8b23c3a0-4a71-41d8-bf96-a8fbf2490313",
  ...
});
```

**Alternative** (if you want to keep it in env): add `NEXT_PUBLIC_HYPERDX_API_KEY` to the repo's GitHub Secrets and pass it in `deploy.yml`:
```yaml
- run: node scripts/deploy.mjs
  env:
    NEXT_PUBLIC_HYPERDX_API_KEY: ${{ secrets.NEXT_PUBLIC_HYPERDX_API_KEY }}
    # ...other vars
```

---

### HyperDX flooded with `resourceFetch` spans — auto-instrumentation noise

**Symptom**: HyperDX is full of `resourceFetch`, `documentFetch`, and `documentLoad` events, drowning out `ui.*` tracking events. The Wayfinder map triggers a burst of ~20 `resourceFetch` spans every time it loads map tiles.

**Root cause**: The HyperDX SDK ships with several auto-instrumentation layers enabled by default:

| Instrumentation key | What it emits | Source |
|---|---|---|
| `document` | `documentLoad`, `documentFetch`, `resourceFetch` (initial page load) | PerformanceTiming API |
| `postload` | `resourceFetch` (ongoing — every JS/CSS/image after load) | PerformanceObserver |
| `fetch` | span per `fetch()` call | Monkey-patched `window.fetch` |
| `xhr` | span per `XMLHttpRequest` | Monkey-patched `XMLHttpRequest` |

`tracePropagationTargets: []` only controls which requests receive the `traceparent` header — it does **not** disable span creation. Setting it to `[]` does not stop the flood.

**Fix**: explicitly disable all auto-instrumentation in `lib/hdx.ts`:

```ts
HyperDX.init({
  ...
  tracePropagationTargets: [],
  instrumentations: {
    document: false,   // kills documentLoad/documentFetch/resourceFetch (page load)
    postload: false,   // kills resourceFetch (ongoing resources, e.g. wayfinder map tiles)
    fetch: false,      // kills fetch() spans
    xhr: false,        // kills XHR spans
    interactions: false,
    longtask: false,
    webvitals: false,
  },
});
```

After this, HyperDX only receives events explicitly sent via `hdx.addAction()`.
