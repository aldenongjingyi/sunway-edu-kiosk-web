# NodePickerMap — Rotation & Zoom Persistence Implementation Plan

## Architecture overview

NodePickerMap uses a pure SVG `viewBox` for pan/zoom — `view.x/y/w/h` — with no CSS transforms. Rotation can't be done via viewBox directly, so it's applied as a CSS `transform: rotate(Rdeg)` on the `<svg>` element. Everything else (node clicks, SVG rendering) works automatically with CSS rotation because the browser handles hit-testing on rotated elements. The only thing that breaks is gesture coordinate math, which must be corrected.

---

## 1. State and refs

Add `rotation` state (float, degrees):
```ts
const [rotation, setRotation] = useState(() =>
  parseFloat(localStorage.getItem("admin.nodePickerMap.rotation") ?? "0")
);
```

Extend `lastTouchRef` to include `angle` (for tracking two-finger rotation):
```ts
const lastTouchRef = useRef<{ x: number; y: number; dist: number; angle: number } | null>(null);
```

---

## 2. SVG CSS rotation

Add to the `<svg>` element:
```tsx
style={{ display: "block", transform: `rotate(${rotation}deg)`, transformOrigin: "center" }}
```

No changes needed to SVG content, viewBox, or node dot positions. Clicks on `<g>` elements continue to work because the browser applies CSS transform hit-testing.

---

## 3. Coordinate correction helpers

All gesture handlers pass screen coords into viewBox math. With a rotated SVG, a screen delta `(dx, dy)` must be un-rotated by `-R` before being applied:

```ts
function unrotateDelta(dx: number, dy: number, rotDeg: number) {
  const r = (rotDeg * Math.PI) / 180;
  return {
    dx: dx * Math.cos(r) + dy * Math.sin(r),
    dy: -dx * Math.sin(r) + dy * Math.cos(r),
  };
}
```

For zoom pivot (a screen point, not a delta), un-rotate around the SVG center:
```ts
function unrotatePoint(screenX: number, screenY: number, rotDeg: number, rect: DOMRect) {
  const r = -(rotDeg * Math.PI) / 180;
  const cx = rect.width / 2, cy = rect.height / 2;
  const px = screenX - cx, py = screenY - cy;
  return {
    x: px * Math.cos(r) - py * Math.sin(r) + cx,
    y: px * Math.sin(r) + py * Math.cos(r) + cy,
  };
}
```

---

## 4. Gesture handler changes

### `onTouchStart` (2 fingers)
Add initial angle to `lastTouchRef`:
```ts
angle: Math.atan2(
  e.touches[0].clientY - e.touches[1].clientY,
  e.touches[0].clientX - e.touches[1].clientX
)
```

### `onTouchMove` (1 finger pan)
Wrap `(dx, dy)` with `unrotateDelta` before applying to viewBox.

### `onTouchMove` (2 fingers)
- Compute current angle → `deltaAngle = currentAngle - prevAngle` → `setRotation(r => r + deltaAngle * (180/Math.PI))`
- Un-rotate the pinch midpoint with `unrotatePoint` before the existing SVG pivot math
- Update `lastTouchRef.angle = currentAngle`

### `onTouchEnd`
Persist both rotation and zoom to localStorage.

### `handleWheel`
Un-rotate `(e.clientX - rect.left, e.clientY - rect.top)` with `unrotatePoint` before the existing zoom pivot calculation.

---

## 5. Zoom persistence

Zoom level is `initialViewRef.current.w / view.w` (1 = full extent, up to 20x in). Persist on `touchEnd` and wheel end (debounced 300ms):
```ts
localStorage.setItem("admin.nodePickerMap.zoomRatio", String(initialViewRef.current.w / view.w));
```

Restore on mount, after the level loads and `initialViewRef.current` is set:
```ts
const savedZoom = parseFloat(localStorage.getItem("admin.nodePickerMap.zoomRatio") ?? "1");
const newW = initialViewRef.current.w / savedZoom;
setView({ x: 0, y: 0, w: newW, h: newW * (activeMap.height / activeMap.width) });
```

---

## 6. Reset button

Small button near the back button or level tabs — resets rotation to 0, clears localStorage:
```ts
onClick={() => { setRotation(0); localStorage.removeItem("admin.nodePickerMap.rotation"); }}
```

Displays a compass/reset icon (e.g. a north arrow or rotation symbol) to be recognizable.

---

## 7. localStorage keys

| Key | Type | Description |
|-----|------|-------------|
| `admin.nodePickerMap.rotation` | float (degrees) | Map rotation angle |
| `admin.nodePickerMap.zoomRatio` | float (1–20) | Zoom level; 1 = full extent, >1 = zoomed in |

---

## What does NOT need changes

- SVG floor plan rendering — rotates with the element automatically
- Node dot positions — unaffected
- Node `onClick` selection — browser hit-testing handles rotated elements correctly
- Level tabs — positioned outside the SVG, unaffected
- Bottom info panel — outside the SVG, unaffected

---

## Risk / complexity rating: medium

The coordinate correction math is the only real complexity. Everything else is wiring. The `unrotateDelta` and `unrotatePoint` helpers cover all three gesture paths (pan, pinch, wheel). Total estimated change: ~60–80 lines of new/modified code.
