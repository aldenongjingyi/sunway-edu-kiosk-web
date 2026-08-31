"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import { useDataStore } from "@/lib/store";

// shapes: [[x, y], [x, y], ...] — coordinate arrays (not {x,y} objects)
interface MapLayer {
  layer_name: string;
  stroke_width: number;
  stroke_color: string;
  fill_color: string;
  shapes: number[][][];
}
interface MapLevelData {
  code: string;
  width: number;
  height: number;
  ordinal: number;
  layers: MapLayer[];
}

interface Props {
  onClose: () => void;
}

const MAP_URL = "https://sunwayedu3-data.indoorcms.com/maps_v001.json.gz";
const PROXY   = "https://sunway-kiosk-proxy.sunway-kiosk.workers.dev";
const KIOSK_NODE_KEY = "admin.kiosk.nodeId";
const ROTATION_KEY   = "admin.nodePickerMap.rotation";

// Coordinate correction helpers for rotated SVG.
// When the SVG is CSS-rotated by R radians, screen deltas must be un-rotated
// before being applied to the SVG viewBox coordinate system.
function unrotateDelta(dx: number, dy: number, rotRad: number) {
  const c = Math.cos(rotRad), s = Math.sin(rotRad);
  return { dx: dx * c + dy * s, dy: -dx * s + dy * c };
}

// Un-rotate a screen point around the container center.
// Used to find where a screen point (e.g. pinch midpoint, wheel cursor) maps
// to in the un-rotated SVG coordinate frame, so viewBox zoom pivots correctly.
function unrotatePoint(screenX: number, screenY: number, rotRad: number, rect: DOMRect) {
  const r = -rotRad;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const px = screenX - cx, py = screenY - cy;
  return {
    x: px * Math.cos(r) - py * Math.sin(r) + cx,
    y: px * Math.sin(r) + py * Math.cos(r) + cy,
  };
}

export default function NodePickerMap({ onClose }: Props) {
  const { nodes, locations, levels } = useDataStore();

  const [mapData, setMapData]     = useState<MapLevelData[]>([]);
  const [loading, setLoading]     = useState(true);
  const [savedId, setSavedId]     = useState(() => localStorage.getItem(KIOSK_NODE_KEY) ?? "");
  const [pendingId, setPendingId] = useState(savedId);
  const [activeLevelCode, setActiveLevelCode] = useState("");

  // Rotation state — radians, persisted in localStorage so admin sees the same
  // angle on re-open and so MapView can read and match it.
  const [rotation, setRotationState] = useState(() => {
    const v = parseFloat(localStorage.getItem(ROTATION_KEY) ?? "0");
    return isFinite(v) ? v : 0;
  });
  // rotationRef is always-current so gesture closures don't capture a stale value.
  const rotationRef = useRef(rotation);
  const setRotation = (r: number) => {
    rotationRef.current = r;
    setRotationState(r);
  };

  // ViewBox-based pan/zoom — no CSS transforms, SVG re-renders at screen DPI, never pixelates
  const [view, setView]         = useState({ x: 0, y: 0, w: 1, h: 1.857 });
  const initialViewRef          = useRef({ w: 1, h: 1.857 });
  const containerRef            = useRef<HTMLDivElement>(null);
  const lastTouchRef            = useRef<{ x: number; y: number; dist: number; angle: number } | null>(null);
  const isPinchingRef           = useRef(false);

  useEffect(() => {
    const url = `${PROXY}/?url=${encodeURIComponent(MAP_URL)}&_=${Date.now()}`;
    fetch(url, { cache: "no-store" })
      .then(r => r.json())
      .then((data: MapLevelData[]) => {
        const sorted = [...data].sort((a, b) => b.ordinal - a.ordinal);
        setMapData(sorted);
        const currentNode = nodes.find(n => String(n.id) === pendingId);
        const currentLevel = currentNode ? Object.values(levels).find(l => l.id === currentNode.level) : undefined;
        const defaultCode = currentLevel?.code ?? sorted.find(m => m.code === "G")?.code ?? sorted[0]?.code ?? "";
        setActiveLevelCode(defaultCode);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeMap = mapData.find(m => m.code === activeLevelCode);

  // Reset view to full extent whenever the level changes
  useEffect(() => {
    if (!activeMap) return;
    const v = { x: 0, y: 0, w: activeMap.width, h: activeMap.height };
    setView(v);
    initialViewRef.current = { w: activeMap.width, h: activeMap.height };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLevelCode]);

  const levelTabs = useMemo(() => mapData.map(m => ({ code: m.code, label: m.code })), [mapData]);

  const activeNodes = useMemo(() => {
    if (!activeLevelCode || !activeMap) return [];
    const { width: mw, height: mh } = activeMap;
    return nodes
      .filter(n => levels[n.level]?.code === activeLevelCode)
      .filter(n => n.x >= 0 && n.x <= mw && n.y >= 0 && n.y <= mh)
      .map(n => {
        const loc = n.location != null ? locations.find(l => l.id === n.location) : undefined;
        return { nodeId: n.id, x: n.x, y: n.y, hasLocation: n.location != null, title: loc?.title ?? "" };
      });
  }, [nodes, locations, levels, activeLevelCode, activeMap]);

  const pendingNode = useMemo(() => {
    const n = nodes.find(n => String(n.id) === pendingId);
    if (!n) return null;
    const loc = n.location != null ? locations.find(l => l.id === n.location) : undefined;
    const lvl = levels[n.level];
    return { nodeId: n.id, title: loc?.title ?? "", levelTitle: lvl?.title ?? "" };
  }, [nodes, locations, levels, pendingId]);

  const getRect = () =>
    containerRef.current?.getBoundingClientRect() ??
    { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight } as DOMRect;

  // Scroll-to-zoom — cursor position is un-rotated before computing SVG pivot
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const scaleDelta = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      // Un-rotate the cursor so the zoom pivot is correct in map space
      const up = unrotatePoint(e.clientX, e.clientY, rotationRef.current, rect);
      setView(v => {
        const svgMidX = v.x + ((up.x - rect.left) / rect.width)  * v.w;
        const svgMidY = v.y + ((up.y - rect.top)  / rect.height) * v.h;
        const ratio = v.h / v.w;
        const newW = Math.min(Math.max(v.w / scaleDelta, initialViewRef.current.w / 20), initialViewRef.current.w);
        const newH = newW * ratio;
        return {
          x: svgMidX - ((up.x - rect.left) / rect.width)  * newW,
          y: svgMidY - ((up.y - rect.top)  / rect.height) * newH,
          w: newW,
          h: newH,
        };
      });
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, dist: 0, angle: 0 };
      isPinchingRef.current = false;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchRef.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        dist: Math.hypot(dx, dy),
        angle: Math.atan2(dy, dx),
      };
      isPinchingRef.current = true;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!lastTouchRef.current) return;
    const rect = getRect();

    if (e.touches.length === 1 && !isPinchingRef.current) {
      // Pan: un-rotate the screen delta so it applies correctly in map space
      const screenDx = e.touches[0].clientX - lastTouchRef.current.x;
      const screenDy = e.touches[0].clientY - lastTouchRef.current.y;
      const { dx, dy } = unrotateDelta(screenDx, screenDy, rotationRef.current);
      setView(v => ({
        ...v,
        x: v.x - (dx / rect.width)  * v.w,
        y: v.y - (dy / rect.height) * v.h,
      }));
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, dist: 0, angle: 0 };

    } else if (e.touches.length === 2) {
      const dx   = e.touches[0].clientX - e.touches[1].clientX;
      const dy   = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const currentAngle = Math.atan2(dy, dx);

      // Rotation: delta angle drives CSS rotation on the SVG
      const deltaAngle = currentAngle - lastTouchRef.current.angle;
      const newRotation = rotationRef.current + deltaAngle;
      setRotation(newRotation);

      // Pinch-zoom: un-rotate midpoint so pivot is correct in map space
      const scaleDelta = lastTouchRef.current.dist > 0 ? dist / lastTouchRef.current.dist : 1;
      const panDx      = midX - lastTouchRef.current.x;
      const panDy      = midY - lastTouchRef.current.y;

      // Un-rotate midpoint around container centre to get its position in map-frame screen coords
      const up = unrotatePoint(midX, midY, newRotation, rect);

      setView(v => {
        const svgMidX = v.x + ((up.x - rect.left) / rect.width)  * v.w;
        const svgMidY = v.y + ((up.y - rect.top)  / rect.height) * v.h;
        const ratio = v.h / v.w;
        const newW  = Math.min(Math.max(v.w / scaleDelta, initialViewRef.current.w / 20), initialViewRef.current.w);
        const newH  = newW * ratio;
        // Un-rotate pan delta too
        const { dx: panSvgDxRaw, dy: panSvgDyRaw } = unrotateDelta(panDx, panDy, newRotation);
        const panSvgDx = -(panSvgDxRaw / rect.width)  * newW;
        const panSvgDy = -(panSvgDyRaw / rect.height) * newH;
        return {
          x: svgMidX - ((up.x - rect.left) / rect.width)  * newW + panSvgDx,
          y: svgMidY - ((up.y - rect.top)  / rect.height) * newH + panSvgDy,
          w: newW,
          h: newH,
        };
      });

      lastTouchRef.current = { x: midX, y: midY, dist, angle: currentAngle };
    }
  };

  const onTouchEnd = () => {
    isPinchingRef.current = false;
    lastTouchRef.current = null;
    // Persist rotation so MapView can read the same angle
    localStorage.setItem(ROTATION_KEY, String(rotationRef.current));
  };

  const handleSave = () => {
    localStorage.setItem(KIOSK_NODE_KEY, pendingId);
    setSavedId(pendingId);
    onClose();
  };

  const handleResetRotation = () => {
    setRotation(0);
    localStorage.setItem(ROTATION_KEY, "0");
  };

  const vw = activeMap?.width  ?? 1;
  const vh = activeMap?.height ?? 1;
  // iOS NodeView: 33pt diameter, position = node.x * 3072, so radius in map units = 16.5 / 3072
  const dotR      = 16.5 / 3072;  // ≈ 0.00537 — exact iOS match
  const dotStroke = 1.0  / 3072;  // 1pt border in map units
  const hitR      = dotR * 3;     // tap target ~3× dot radius

  const isDirty = pendingId !== savedId;
  const hasRotation = Math.abs(rotation) > 0.001;

  return (
    <div className="fixed inset-0 z-[110] bg-[#e8e4dc] overflow-hidden">

      {/* Full-screen SVG map — rotation applied as CSS transform on the SVG only.
          Back button, level tabs, and bottom panel live OUTSIDE the SVG and are unaffected. */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ touchAction: "none" }}
      >
        {loading ? (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-[#8e8e93] text-[15px]">Loading map…</p>
          </div>
        ) : !activeMap ? (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-[#8e8e93] text-[15px]">Map unavailable</p>
          </div>
        ) : (
          <svg
            viewBox={`${view.x - view.w / 2} ${view.y - view.h / 2} ${view.w * 2} ${view.h * 2}`}
            style={{
              position: "absolute", display: "block",
              left: "-50%", top: "-50%", width: "200%", height: "200%",
              transform: `rotate(${rotation}rad)`, transformOrigin: "center",
            }}
          >
            {/* Background covers the full expanded viewBox so no gaps appear outside the floor plan */}
            <rect x={view.x - view.w / 2} y={view.y - view.h / 2} width={view.w * 2} height={view.h * 2} fill="#e8e4dc" />

            {/* Floor plan vector layers */}
            {activeMap.layers.map((layer, li) => (
              <g key={li}>
                {layer.shapes.map((shape, si) => {
                  if (shape.length < 2) return null;
                  const d = shape
                    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`)
                    .join(" ") + " Z";
                  return (
                    <path
                      key={si}
                      d={d}
                      fill={layer.fill_color || "none"}
                      stroke={layer.stroke_color || "none"}
                      strokeWidth={layer.stroke_width * vw / 3000}
                      strokeLinejoin="round"
                    />
                  );
                })}
              </g>
            ))}

            {/* Node dots — filtered to map bounds, matching iOS UIScrollView contentSize clipping */}
            {activeNodes.map(n => {
              const isSelected = String(n.nodeId) === pendingId;
              return (
                <g key={n.nodeId} onClick={() => setPendingId(String(n.nodeId))} style={{ cursor: "pointer" }}>
                  <circle cx={n.x} cy={n.y} r={hitR} fill="transparent" />
                  <circle
                    cx={n.x} cy={n.y}
                    r={dotR}
                    fill={isSelected ? "#00226B" : n.hasLocation ? "#6E96FF" : "none"}
                    stroke={isSelected ? "#fff" : n.hasLocation ? "#00226B" : "#999"}
                    strokeWidth={dotStroke}
                  />
                  {isSelected && (
                    <circle
                      cx={n.x} cy={n.y} r={dotR * 1.6}
                      fill="none" stroke="#00226B" strokeWidth={dotStroke} opacity={0.4}
                    />
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Back button — top-left floating */}
      <button
        onClick={onClose}
        className="absolute flex items-center justify-center rounded-full bg-white shadow-md"
        style={{ top: 25, left: 25, width: 56, height: 56, zIndex: 10 }}
      >
        <svg width="10" height="17" viewBox="0 0 9 15" fill="none">
          <path d="M8 1L1.5 7.5 8 14" stroke="#00226B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Reset rotation button — shown only when rotated, top-left below back button */}
      {hasRotation && (
        <button
          onClick={handleResetRotation}
          className="absolute flex items-center justify-center rounded-full bg-white shadow-md"
          style={{ top: 25 + 56 + 12, left: 25, width: 56, height: 56, zIndex: 10 }}
          title="Reset rotation"
        >
          {/* Compass/reset icon */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#00226B" strokeWidth="1.8"/>
            <polygon points="12,4 14.5,11 12,10 9.5,11" fill="#e74c3c"/>
            <polygon points="12,20 9.5,13 12,14 14.5,13" fill="#00226B"/>
            <circle cx="12" cy="12" r="1.5" fill="#00226B"/>
          </svg>
        </button>
      )}

      {/* Level buttons — right side floating vertical stack */}
      {levelTabs.length > 0 && (
        <div
          className="absolute flex flex-col gap-2 items-center"
          style={{ top: "50%", right: 25, transform: "translateY(-50%)", zIndex: 10, maxHeight: "70vh", overflowY: "auto" }}
        >
          {levelTabs.map(tab => (
            <button
              key={tab.code}
              onClick={() => setActiveLevelCode(tab.code)}
              className="flex items-center justify-center rounded-full shrink-0"
              style={{
                width: 24, height: 24,
                minWidth: 24, minHeight: 24,
                backgroundColor: tab.code === activeLevelCode ? "#6E96FF" : "#fff",
                border: `1px solid ${tab.code === activeLevelCode ? "#6E96FF" : "rgba(15,23,42,0.2)"}`,
                boxShadow: "0 6px 18px -12px rgba(15,23,42,0.5)",
              }}
            />
          ))}
        </div>
      )}

      {/* Bottom info panel */}
      <div className="absolute left-0 right-0 bottom-0 bg-white border-t border-[#e5e5ea]" style={{ zIndex: 10 }}>
        <div className="px-6 py-4">
          {pendingId ? (
            <div className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-[#8e8e93]">Selected node</p>
                <p className="text-[22px] font-bold text-black leading-tight">#{pendingId}</p>
                {pendingNode?.title && (
                  <p className="text-[13px] text-[#8e8e93] truncate">{pendingNode.title} · {pendingNode.levelTitle}</p>
                )}
              </div>
              <button
                onClick={handleSave}
                className="shrink-0 px-6 py-3 rounded-2xl text-white font-semibold text-[15px] shadow"
                style={{ backgroundColor: isDirty ? "#00226B" : "#8e8e93" }}
              >
                {isDirty ? "Save" : "Saved"}
              </button>
            </div>
          ) : (
            <p className="text-[17px] font-semibold text-[#00226B] text-center py-1">
              Tap a node to set kiosk location
            </p>
          )}
          <div className="flex items-center justify-center gap-4 mt-2">
            <span className="flex items-center gap-1.5 text-[11px] text-[#8e8e93]">
              <span className="inline-block w-3 h-3 rounded-full bg-[#6E96FF] border border-[#00226B] shrink-0" />
              Has location
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-[#8e8e93]">
              <span className="inline-block w-3 h-3 rounded-full bg-transparent border border-[#999] shrink-0" />
              No location
            </span>
            <span className="text-[11px] text-[#c7c7cc]">· Pinch &amp; twist to rotate</span>
          </div>
        </div>
      </div>
    </div>
  );
}
