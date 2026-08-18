# HyperDX Tracking

Service name: `sunway-edu-kiosk`
Dashboard: https://www.hyperdx.io

All events are sent manually via `hdx.addAction()` — no auto-instrumentation. See `lib/hdx.ts`.

---

## Events

### Session

| Event | Source | Props | Notes |
|---|---|---|---|
| `record init` | HyperDX SDK | — | Automatic — fires once per session on SDK init |
| `ui.shell.mounted` | `KioskShell.tsx` | — | Fires once on app mount |

### Screensaver

| Event | Source | Props | Notes |
|---|---|---|---|
| `ui.screensaver.expand` | `KioskShell.tsx` | `source`, `idleSeconds` | Idle timeout fired — `source`: `"main"` (20s) or `"map"` (120s) |
| `ui.screensaver.dismiss` | `KioskShell.tsx` | — | User taps to dismiss screensaver |

### Navigation

| Event | Source | Props | Notes |
|---|---|---|---|
| `ui.tab.change` | `KioskShell.tsx` | `tab`, `index` | User switches between top-level tabs |

### Search

| Event | Source | Props | Notes |
|---|---|---|---|
| `ui.search.typed` | `KioskShell.tsx` | `query` | Fires on every keystroke |
| `ui.search.clear` | `KioskShell.tsx` | `query` | User clears the search bar |
| `ui.search.popular` | `KioskShell.tsx` | `query` | User taps a trending/popular search chip |
| `ui.search.category` | `KioskShell.tsx` | `category`, `categoryId` | User filters by category |
| `ui.search.department` | `KioskShell.tsx` | `department` | User filters by department (staff tab) |

### Locations & Map

| Event | Source | Props | Notes |
|---|---|---|---|
| `ui.location.tap` | `KioskShell.tsx` | `locationId`, `locationTitle` | User taps a location (always — even if floor picker is cancelled) |
| `ui.map.navigate` | `KioskShell.tsx` | `destinationId`, `locationTitle`, `floorCode`? | Map actually opened — `floorCode` present only when floor picker was used |
| `ui.map.close` | `KioskShell.tsx` | — | User closes the map panel |

### Staff

| Event | Source | Props | Notes |
|---|---|---|---|
| `ui.staff.select` | `KioskShell.tsx` | `staffName`, `department`, `designation` | User taps a staff member |

### Pull-to-Refresh

| Event | Source | Props | Notes |
|---|---|---|---|
| `ui.refresh.pull` | `KioskShell.tsx` | — | User triggers pull-to-refresh |

### Data / API

| Event | Source | Props | Notes |
|---|---|---|---|
| `api.fetch.success` | `lib/store.ts` | `url`, `status`, `ms` | Successful CORS proxy fetch |
| `api.fetch.error` | `lib/store.ts` | `url`, `status`, `ms` | Failed CORS proxy fetch |
| `data.loaded.live` | `lib/store.ts` | `locations`, `highlights`, `trendings`, `nodes` | Campus data loaded from API |
| `data.loaded.cache` | `lib/store.ts` | same | Campus data loaded from localStorage (offline) |
| `data.load.failed` | `lib/store.ts` | `error` | Campus API fetch failed (before cache fallback) |
| `data.cache.miss` | `lib/store.ts` | — | API failed and no localStorage cache found |
| `data.cache.error` | `lib/store.ts` | `error` | Cache read/parse failed |
| `staff.loaded.live` | `lib/store.ts` | `count` | Staff data loaded from API |
| `staff.loaded.cache` | `lib/store.ts` | `count` | Staff data loaded from localStorage (offline) |
| `staff.load.failed` | `lib/store.ts` | `error` | Staff API fetch failed (before cache fallback) |
| `staff.cache.miss` | `lib/store.ts` | — | Staff API failed and no localStorage cache found |
| `staff.cache.error` | `lib/store.ts` | `error` | Staff cache read/parse failed |

---

## SDK Configuration

```ts
// lib/hdx.ts
HyperDX.init({
  apiKey: "...",                   // hardcoded — browser telemetry key, not a secret
  service: "sunway-edu-kiosk",
  tracePropagationTargets: [],     // no backend OTel — disable trace header injection
  consoleCapture: false,
  advancedNetworkCapture: false,
  instrumentations: {
    document: false,   // kills documentLoad/documentFetch/resourceFetch (page load timing)
    postload: false,   // kills resourceFetch (ongoing resources e.g. wayfinder map tiles)
    fetch: false,      // kills fetch() spans
    xhr: false,        // kills XHR spans
    interactions: false,
    longtask: false,
    webvitals: false,
  },
});
```

All auto-instrumentation is disabled. Only explicit `hdx.addAction()` calls send data.

`suppressImgErrors()` is called before `HyperDX.init()` to register a capture-phase listener that blocks `HTMLImageElement` error events from reaching the HyperDX error listener — prevents staff photo failures (vine.sunway.edu.my) from flooding the event log.

---

## Adding New Events

```ts
import { hdx } from "@/lib/hdx";

hdx.addAction("event.name", { key: "value" });
```

Props must be `string | number | boolean`. Use dot-notation names: `noun.verb` (e.g. `ui.tab.change`, `data.loaded.live`).

---

## TODO

- [ ] **`ui.search.result.select`** — currently `ui.location.select` fires for both tapping a search result and navigating directly to a location. Add a separate event (or a `source: "search" | "direct"` prop) to distinguish intent.
- [x] **`ui.screensaver.expand`** — implemented with `source: "main" | "map"` and `idleSeconds` props.
- [ ] **Kiosk device identity** — call `HyperDX.setGlobalAttributes({ kioskNodeId })` after reading `localStorage.getItem("admin.kiosk.nodeId")` on app mount. Lets you filter all HyperDX events by physical device when multiple kiosks are deployed.
