"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDataStore } from "@/lib/store";

interface Props {
  destinationId: number | null;
  onClose: () => void;
}

const KIOSK_NODE_KEY = "admin.kiosk.nodeId";
const SCRIPT_URL = "/api/proxy?url=https%3A%2F%2Fmaps-sunwayedu.getmallapp.com%2Fwayfinder-map.min.js";
const DATA_URL = "https://sunwayedu3-data.indoorcms.com/datas_v001.json.gz";
const MAP_URL  = "https://sunwayedu3-data.indoorcms.com/maps_v001.json.gz";

function ensureScript() {
  if (document.querySelector('[data-wayfinder-script]')) return;
  const s = document.createElement("script");
  s.type = "module";
  s.src = SCRIPT_URL;
  s.setAttribute("data-wayfinder-script", "1");
  document.head.appendChild(s);
}

interface RouteInfo {
  startFloor: string;
  endFloor: string;
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
}

export default function MapView({ destinationId, onClose }: Props) {
  const { nodes } = useDataStore();
  const mapRef = useRef<HTMLElement>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  useEffect(() => { ensureScript(); }, []);

  // Add hover + long-press tooltips to wayfinder shadow DOM buttons
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const LABELS: Record<string, string> = {
      "locate-here":             "You Are Here",
      "locate-start":            "Start",
      "locate-focus":            "Destination",
      "nav-connector-lift":      "Lift Only",
      "nav-connector-escalator": "Escalator Only",
    };

    const attachTooltips = () => {
      try {
      const shadow = (map as HTMLElement & { shadowRoot: ShadowRoot }).shadowRoot;
      if (!shadow) return;

      // Inject tooltip style into shadow root once
      if (!shadow.querySelector("#wf-tooltip-style")) {
        const style = document.createElement("style");
        style.id = "wf-tooltip-style";
        style.textContent = `
          .wf-tooltip {
            position: absolute;
            right: calc(100% + 10px);
            top: 50%;
            transform: translateY(-50%);
            background: rgba(0,0,0,0.75);
            color: #fff;
            font-size: 13px;
            white-space: nowrap;
            padding: 4px 8px;
            border-radius: 6px;
            pointer-events: none;
            z-index: 9999;
          }
          .wayfinder-locate-button { position: relative; }
        `;
        shadow.appendChild(style);
      }

      shadow.querySelectorAll<HTMLButtonElement>("button[data-action]").forEach(btn => {
        const action = btn.dataset.action ?? "";
        const label = LABELS[action];
        if (!label) return;

        // Hover tooltip (desktop/dev)
        btn.title = label;

        // Long-press tooltip (touch/kiosk)
        let timer: ReturnType<typeof setTimeout> | null = null;
        let tip: HTMLDivElement | null = null;

        const show = () => {
          if (tip) return;
          tip = document.createElement("div");
          tip.className = "wf-tooltip";
          tip.textContent = label;
          btn.appendChild(tip);
        };
        const hide = () => {
          if (timer) { clearTimeout(timer); timer = null; }
          tip?.remove();
          tip = null;
        };

        btn.addEventListener("touchstart", () => { timer = setTimeout(show, 400); }, { passive: true });
        btn.addEventListener("touchend",   hide, { passive: true });
        btn.addEventListener("touchmove",  hide, { passive: true });
      });
      } catch (_) { /* tooltip attachment is non-critical */ }
    };

    const enforceMinZoom = () => {
      const el = map as HTMLElement & {
        getViewState?: () => { scale: number };
        engine?: { zoom: (f: number) => void };
      };
      // Compute min zoom so the floor width (~1.0 world unit) fills the canvas
      const canvasWidth = map.getBoundingClientRect().width || window.innerWidth;
      const minZoom = canvasWidth * 0.95; // 95% of canvas width = floor almost fills viewport

      map.addEventListener("view-changed", (e: Event) => {
        const detail = (e as CustomEvent).detail?.viewState;
        if (detail && detail.scale < minZoom) {
          const factor = minZoom / detail.scale;
          el.engine?.zoom(factor);
        }
      });
    };

    const routeFloorIndicators = () => {
      map.addEventListener("route-found", (e: Event) => {
        try {
          const d = (e as CustomEvent).detail;
          const sf = d?.startNode?.level?.code as string | undefined;
          const ef = d?.endNode?.level?.code as string | undefined;
          const sp = d?.startNode?.point;
          const ep = d?.endNode?.point;
          if (sf && ef && sp && ep && isFinite(sp.x) && isFinite(sp.y) && isFinite(ep.x) && isFinite(ep.y)) {
            setRouteInfo({ startFloor: sf, endFloor: ef, startPoint: { x: sp.x, y: sp.y }, endPoint: { x: ep.x, y: ep.y } });
          }
        } catch (_) {}
      });
      map.addEventListener("route-cleared", () => setRouteInfo(null));
    };

    const panToContent = () => {
      const el = map as HTMLElement & {
        centerOn: (x: number, y: number, opts?: { animate?: boolean }) => void;
      };

      map.addEventListener("floor-changed", (e: Event) => {
        try {
          const floorCode = (e as CustomEvent).detail?.floor as string | undefined;
          if (!floorCode) return;

          const { nodes: currentNodes, levels } = useDataStore.getState();
          const matchingLevel = Object.values(levels).find(l => l.code === floorCode);
          if (!matchingLevel) return;

          const validNodes = currentNodes.filter(n => n.level === matchingLevel.id && isFinite(n.x) && isFinite(n.y));
          if (!validNodes.length) return;

          const cx = validNodes.reduce((s, n) => s + n.x, 0) / validNodes.length;
          const cy = validNodes.reduce((s, n) => s + n.y, 0) / validNodes.length;
          el.centerOn(cx, cy, { animate: false });
        } catch (_) {}
      });
    };

    const setup = () => { attachTooltips(); enforceMinZoom(); panToContent(); routeFloorIndicators(); };

    if ((map as HTMLElement & { isInitialized?: boolean }).isInitialized) {
      setup();
    } else {
      map.addEventListener("ready", setup, { once: true });
    }
  }, []);

  useEffect(() => { setRouteInfo(null); }, [destinationId]);

  useEffect(() => {
    const map = mapRef.current as (HTMLElement & {
      isInitialized: boolean;
      navigateTo: (opts: { from: number; to: number }) => void;
      focusLocation: (id: number) => void;
    }) | null;
    if (!map || !destinationId) return;

    const navigate = () => {
      const rawNodeId = localStorage.getItem(KIOSK_NODE_KEY);
      if (rawNodeId) {
        const kioskNode = nodes.find(n => n.id === Number(rawNodeId));
        if (kioskNode?.location) {
          map.navigateTo({ from: kioskNode.location, to: destinationId });
          return;
        }
      }
      map.focusLocation(destinationId);
    };

    if (map.isInitialized) {
      navigate();
    } else {
      map.addEventListener("ready", navigate, { once: true });
    }
  }, [destinationId, nodes]);

  const kioskNodeId = typeof window !== "undefined"
    ? (localStorage.getItem(KIOSK_NODE_KEY) ?? undefined)
    : undefined;

  const jumpToFloor = (floorCode: string, point: { x: number; y: number }) => {
    const el = mapRef.current as (HTMLElement & {
      setFloor: (code: string) => void;
      centerOn: (x: number, y: number, opts?: { animate?: boolean }) => void;
    }) | null;
    if (!el) return;
    el.setFloor(floorCode);
    el.centerOn(point.x, point.y, { animate: true });
  };

  const content = (
    <div
      className="fixed inset-0 z-[60] bg-white flex flex-col slide-up"
      style={{ display: destinationId ? "flex" : "none" }}
    >
      <div
        className="flex items-center px-4 flex-shrink-0"
        style={{ paddingTop: 14, paddingBottom: 14, borderBottom: "0.5px solid #e5e5ea" }}
      >
        <button
          onClick={onClose}
          className="flex items-center gap-2"
          style={{ color: "var(--navy)" }}
        >
          <svg width="9" height="15" viewBox="0 0 9 15" fill="none">
            <path d="M8 1L1.5 7.5 8 14" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[17px]">Back</span>
        </button>

        {routeInfo && (
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => jumpToFloor(routeInfo.startFloor, routeInfo.startPoint)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-white text-[13px] font-medium"
              style={{ backgroundColor: "var(--navy)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="3"/>
                <path d="M9 14l-2 6h2l1-3 2 2 1 3h2l-2-6 1-2h4v-2H9v2h2l-1 2z"/>
              </svg>
              <span>{routeInfo.startFloor}</span>
            </button>
            <button
              onClick={() => jumpToFloor(routeInfo.endFloor, routeInfo.endPoint)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-white text-[13px] font-medium"
              style={{ backgroundColor: "#007aff" }}
            >
              <svg width="12" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              <span>{routeInfo.endFloor}</span>
            </button>
          </div>
        )}
      </div>

      <wayfinder-map
        ref={mapRef}
        className="flex-1 min-h-0 w-full block"
        data-url={DATA_URL}
        map-url={MAP_URL}
        route-mode="lift"
        enable-rotation=""
        level-selector=""
        desktop-render-scale="1500"
        mobile-render-scale="1200"
        desktop-min-zoom="1300"
        mobile-min-zoom="700"
        you-are-here-node-id={kioskNodeId}
        control-active-bg-color="#00226B"
        map-marker-end-bg-color="#00226B"
        map-marker-connector-bg-color="#00226B"
      />
    </div>
  );

  return createPortal(content, document.body);
}
