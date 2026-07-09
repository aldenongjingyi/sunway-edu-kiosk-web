# Sunway Edu Kiosk — Web App

Interactive campus kiosk web app for Sunway University MyCampus. Runs as a fullscreen WebView on an Elo Android kiosk device.

---

## How It Works

### Code & Storage
- Source code is mirrored to two GitHub remotes (`aldenongjingyi` and `map711`) on every push
- The built app (static HTML/CSS/JS) is hosted on **DigitalOcean Spaces** (`kiosk-sunwayedu.getmallapp.com` bucket, `sgp1` region)

### Deploy Flow
1. Push to `main`
2. GitHub Action triggers automatically — fetches wayfinder JS, runs `next build`, syncs `out/` to DO Spaces
3. Or deploy manually: `node --env-file=.env.local scripts/deploy.mjs`

### Runtime Flow (on the Elo)
1. Android WebView loads `https://sgp1.digitaloceanspaces.com/kiosk-sunwayedu.getmallapp.com/index.html`
2. Next.js static app boots — CSS/JS assets load from the same DO Spaces path (via `assetPrefix`)
3. Wayfinder map JS loads from `NEXT_PUBLIC_WAYFINDER_URL` (also DO Spaces)
4. Campus data (`indoorcms.com`) and staff data (`izone.sunway.edu.my`) are fetched via a **Cloudflare Worker** (`sunway-kiosk-proxy.sunway-kiosk.workers.dev`) which handles CORS
5. Map renders, screensaver runs, kiosk is live

### Services
| Service | Purpose |
|---|---|
| DigitalOcean Spaces | Hosts the static web app |
| GitHub (×2) | Source control + auto-deploy trigger |
| Cloudflare Worker | CORS proxy for campus/staff APIs |
| ADB over WiFi | Dev access to the Elo kiosk device |

---

## Stack

- **Next.js 16** (App Router, static export)
- **React 19**, TypeScript, Tailwind CSS v4, Zustand

---

## Setup

### Prerequisites
- Node.js 20+
- A `.env.local` file (see below)

### Environment Variables

Create `.env.local` in the project root:

```env
DO_SPACES_KEY=your_key
DO_SPACES_SECRET=your_secret
DO_SPACES_REGION=sgp1
DO_SPACES_BUCKET=kiosk-sunwayedu.getmallapp.com
DO_SPACES_PATH=
NEXT_PUBLIC_WAYFINDER_URL=https://sgp1.digitaloceanspaces.com/kiosk-sunwayedu.getmallapp.com/wayfinder-map.min.js
```

### Install & Run Dev Server

```bash
npm install
npm run dev
```

### Deploy to DO Spaces

```bash
node --env-file=.env.local scripts/deploy.mjs
```

### GitHub Secrets (for auto-deploy)

Add these to `aldenongjingyi/sunway-edu-kiosk-web` → Settings → Secrets → Actions:

| Secret | Value |
|---|---|
| `DO_SPACES_KEY` | DO Spaces access key |
| `DO_SPACES_SECRET` | DO Spaces secret |
| `DO_SPACES_REGION` | `sgp1` |
| `DO_SPACES_BUCKET` | `kiosk-sunwayedu.getmallapp.com` |
| `DO_SPACES_PATH` | (leave empty) |

---

## Elo Kiosk (ADB)

Connect to the Elo device over WiFi:

```bash
~/Library/Android/sdk/platform-tools/adb connect 192.168.100.222:5555
```

If the IP has changed: run `arp -a` and try each IP on port 5555.

Restart the kiosk app:
```bash
adb -s 192.168.100.222:5555 shell am force-stop com.map72.sunwaykiosk
adb -s 192.168.100.222:5555 shell am start -n com.map72.sunwaykiosk/.MainActivity
```

---

## Admin Panel

Access: tap the version string 5 times → enter password `my3245campusx`

- **Data Status** — shows loaded record counts and last fetch times
- **Working Hours** — configures the lockscreen schedule (currently disabled)
- **Refresh API Data** — re-fetches campus and staff data
- **Map Integration** — select which kiosk node this device represents (saves to `localStorage`)

---

## TODO (Before Production)
- Evaluate replacing Cloudflare Worker with DO Functions to consolidate to a single provider
- Enable static website hosting on DO Spaces so the root URL works without `/index.html`

---

## Switching Branches on the Elo

DO Spaces always serves whatever was last deployed. Both `main` and `design/v1` build to the same bucket — whichever was deployed most recently is what the Elo loads.

**Deploy `design/v1`:**
```bash
git checkout design/v1
node --env-file=.env.local scripts/deploy.mjs
git checkout main
```

**Switch back to `main`:**
```bash
git checkout main
node --env-file=.env.local scripts/deploy.mjs
```

The Elo will pick up the change on next app restart (or force-stop + start via ADB).
