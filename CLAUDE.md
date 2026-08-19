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

Matches the iOS kiosk (`DataManager.swift` + `ContentViewController.swift`) and Flutter MyCampus app (`datas.dart` + `categories_list.dart`). Currently 822 of 1,204 locations pass. NodePickerMap is unaffected — it renders all nodes regardless of kind.

### NodePickerMap (`components/NodePickerMap.tsx`)
- Pure SVG floor plan — fetches `maps_v001.json.gz` via CF proxy. No wayfinder dependency.
- ViewBox-based pan/zoom (no CSS transforms). Node dots sized in SVG units.
- Level tabs: 24px circles, no text label (self-closing `<button />`), styled to match wayfinder engine default: white bg, `border: 1px solid rgba(15,23,42,0.2)`, active = `#6E96FF`.

### MapView (`components/MapView.tsx`) — Shadow DOM Overrides
Applied via `adoptedStyleSheets` after the `ready` event. Do not remove these without testing on Elo:
- **Show `locate-here`, hide `locate-start`**: current configuration. `locate-start` was tested but caused white canvas on Elo along with the `navigateFromYouAreHere` change — reverted together.
- **Locate button shape**: `border-radius: 50% !important` — engine changed this to `12px` in one update.
- **Locate button icons**: `filter: brightness(0) !important` — dark icons on white bg.
- **Connector buttons**: `display: grid !important` — always show lift/escalator.
- **Level selector**: `align-self: stretch; overflow-y: auto; max-height: none` — full-height scrolling.

### Navigation
Use `map.navigateTo({ from: fromLocation, to: destinationId })`. **DO NOT use `engine.navigateFromYouAreHere`** — causes white canvas on Elo. If the kiosk node has no location or its location isn't in the wayfinder graph, call `map.getLocations()` and find the nearest node on the same level whose location IS valid. Falls back to `focusLocation(destinationId)` if navigateTo fails.

### route-found handler — CRITICAL
`setFloor()` and `centerOn()` MUST be called at `setTimeout(..., 0)`. Any delay >0ms causes the route path to disappear on Android WebView.

### When the engine updates — checklist
1. Download new bundle: `curl -sL "https://maps-sunwayedu.getmallapp.com/wayfinder-map.min.js" -o public/wayfinder-map.min.js`
2. Grep for key shadow DOM class names — engine may rename them: `wayfinder-locate-button`, `wayfinder-locate-controls`, `wayfinder-level-selector`, `wayfinder-level-button`
3. Verify `locate-start` still centers correctly on Elo (not `locate-here`)
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
