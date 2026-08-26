@AGENTS.md

## Working Rules

- **Always push to both GitHub remotes** — `git push origin --all` covers both `aldenongjingyi` and `map711`
- **Deploy to DO Spaces after any functional change** — `node --env-file=.env.local scripts/deploy.mjs`
- **Do NOT auto-commit** — only commit when explicitly asked

## Map Engine & Node Provisioner

### Location Filtering (`lib/store.ts` → `processKioskData`)
All three filters applied at the data layer — all UI (search, categories, departments) inherits automatically:
1. `latitude === 0 && longitude === 0` — indoor only
2. `kind === "FACILITY"` — excludes STAIR (221) and LIFT (107) kinds
3. Has at least one node — excludes unmapped locations that cannot be navigated to

Matches the iOS kiosk (`DataManager.swift` + `ContentViewController.swift`) and Flutter MyCampus app (`datas.dart` + `categories_list.dart`). NodePickerMap is unaffected — it renders all nodes regardless of kind.

Note: iOS only applies filter #1 (lat/lng). The kiosk adds kind + node filters intentionally — STAIR/LIFT locations can't be navigated to. Blocked locations (`lib/blocked-locations.ts`) are stripped from the wayfinder map canvas AND from search — only block locations that should be invisible in both places.

### NodePickerMap (`components/NodePickerMap.tsx`)
- Pure SVG floor plan — fetches `maps_v001.json.gz` via CF proxy. No wayfinder dependency.
- ViewBox-based pan/zoom (no CSS transforms). Node dots sized in SVG units.
- Level tabs: 24px circles, no text label (self-closing `<button />`), styled to match wayfinder engine default: white bg, `border: 1px solid rgba(15,23,42,0.2)`, active = `#6E96FF`.

### MapView (`components/MapView.tsx`) — Shadow DOM Overrides
Applied via `adoptedStyleSheets` after the `ready` event. Do not remove these without testing on Elo:
- **Show `locate-start`, hide `locate-here`**: current configuration. `locate-start` centers on the route's start node (= kiosk position) — always correct regardless of provisioned node. `locate-here` uses `you-are-here-node-id` which requires wayfinder's internal routing node ID (not IndoorCMS IDs) and was unreliable. Previous attempt to show `locate-here` was reverted.
- **Locate button shape**: `border-radius: 50% !important` — engine changed this to `12px` in one update.
- **Locate button icons**: `filter: brightness(0) !important` — dark icons on white bg.
- **Connector buttons**: `display: grid !important` — always show lift/escalator.
- **Level selector**: `align-self: stretch; overflow-y: auto; max-height: none` — full-height scrolling.

### Blocking External Locations from the Map (`lib/blocked-locations.ts`)
The Wayfinder engine renders every location in its `data-url` as a label/pin on the canvas — there is no API to filter by location ID. To hide locations, `MapView.tsx` fetches the data via the CF proxy, strips blocked IDs from `data.locations`, creates a `Blob` URL with the filtered JSON, and passes that as `data-url`. The wayfinder accepts plain JSON (tries `response.json()` before gzip decompression). Falls back to the direct `DATA_URL` on fetch failure.

**IMPORTANT**: Blocked IDs are hidden from BOTH the map canvas AND search results. Only block locations that should be fully invisible (outdoor lat/lng≠0 locations, external buildings). Indoor locations with nodes should NOT be blocked — they should be searchable to match iOS behaviour. Currently blocked: outdoor/external locations (lat/lng≠0) and two link bridges (SUN-U Link Bridge, SUN-U Residence Link Bridge).

### Navigation
Use `map.navigateTo({ from: fromLocation, to: destinationId })`. **DO NOT use `engine.navigateFromYouAreHere`** — causes white canvas on Elo. If the kiosk node has no location or its location isn't in the wayfinder graph, call `map.getLocations()` and find the nearest node on the same level whose location IS valid. Falls back to `focusLocation(destinationId)` if navigateTo fails.

### route-found handler — CRITICAL
`setFloor()` and `centerOn()` MUST be called at `setTimeout(..., 0)`. Any delay >0ms causes the route path to disappear on Android WebView.

### When the engine updates — checklist
1. Download new bundle: `curl -sL "https://maps-sunwayedu.getmallapp.com/wayfinder-map.min.js" -o public/wayfinder-map.min.js`
2. Grep for key shadow DOM class names — engine may rename them: `wayfinder-locate-button`, `wayfinder-locate-controls`, `wayfinder-level-selector`, `wayfinder-level-button`
3. Verify `locate-start` button still centers on kiosk (route start) — this is the preferred button, NOT `locate-here`
4. Verify route path renders on Elo (Android WebView) — may pass in Chrome but fail on device
5. Verify level selector auto-scrolls to active floor tab
6. Always re-download the script before `vercel --prod` — Vercel does not do this automatically

---

## Screensaver Architecture (`components/Screensaver.tsx`)

**Do not change the animation/layout structure without explicit instruction — this is the approved working design.**

The container must ALWAYS spring between `expandedGeometry` ↔ `collapsedGeometry` (card-sized). Never make the container `position:fixed; inset:0` when expanded — this causes a zoomed-in crop effect during collapse (container shrinks but inner card stays fixed, visible area crops the image center instead of scaling naturally).

### Correct structure (portal → document.body)
```
backdrop div (position:fixed, zIndex:48)
full-screen clip parent (position:fixed, inset:0, overflow:hidden, pointer-events:none, zIndex:50)
  └── card container (position:absolute, springs expandedGeometry ↔ collapsedGeometry)
        └── carousel content
```

- **Full-screen parent**: `overflow:hidden` clips expanded slides at screen edges. `pointer-events:none` lets events reach the card container below.
- **Card container**: `position:absolute` (not fixed, so it IS clipped by parent). `overflow:visible` when expanded (slides extend ±vp.w, parent clips them → screen-edge swipe). `overflow:hidden` when collapsed (thumbnail clips carousel).
- **Expanded carousel**: prev/next slide wrappers at `left: -vp.w` / `left: +vp.w` (pixels). Each wrapper has `overflow:hidden; borderRadius:RADIUS`.
- **Collapsed carousel**: images at `left:"-100%"`, `left:0`, `left:"100%"` — fill the thumbnail container directly.
- **Slide distance**: `vp.w` when expanded, `containerRef.current?.offsetWidth` when collapsed. Check `isExpandedRef.current` in both `triggerSlide` and `handlePointerUp`.
- **`isSizingRef`**: ref (not state) set `true` in `useLayoutEffect` on `isExpanded` change, cleared in container `onTransitionEnd` when `propertyName === "width"`. Blocks drag during resize animation without triggering an extra render.
- **`SPRING`**: `"0.4s cubic-bezier(0.4, 0, 0.2, 1)"` — no overshoot (y never exceeds 1). Do NOT use bezier curves with y > 1.
- **`useLayoutEffect`** (not `useEffect`) for resetting slide state on expand/collapse — fires before paint, prevents layout flash.
