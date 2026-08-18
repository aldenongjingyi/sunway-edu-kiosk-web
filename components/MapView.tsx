"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useDataStore } from "@/lib/store";
interface Props {
  destinationId: number | null;
  targetFloorCode?: string | null;
  onClose: () => void;
}
const KIOSK_NODE_KEY = "admin.kiosk.nodeId";
// Default node used when no kiosk location is provisioned (testing only)
const DEFAULT_NODE_ID = "3107";
const SCRIPT_URL = process.env.NEXT_PUBLIC_WAYFINDER_URL ||
  "/wayfinder-map.min.js";
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
export default function MapView({ destinationId, targetFloorCode, onClose }: Props) {
  const { nodes } = useDataStore();
  const nodesRef = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  const targetFloorCodeRef = useRef(targetFloorCode);
  useEffect(() => { targetFloorCodeRef.current = targetFloorCode; }, [targetFloorCode]);
  const mapRef = useRef<HTMLElement>(null);
  useEffect(() => { ensureScript(); }, []);
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
      // Inject kiosk overrides into wayfinder shadow DOM.
      // useEffect(..., []) ensures this runs only once per mount.
      const shadow = (map as HTMLElement & { shadowRoot: ShadowRoot }).shadowRoot;
      if (shadow) {
        const cssText = `
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

          /* Level buttons: styled as small neutral indicator dots — no labels,
             no implied numbering (campus has multiple buildings with different floor names). */
          .wayfinder-level-button {
            width: 10px !important;
            height: 10px !important;
            min-width: 10px !important;
            min-height: 10px !important;
            border-radius: 50% !important;
            background-color: rgba(0, 0, 0, 0.18) !important;
            border: none !important;
            font-size: 0 !important;
            color: transparent !important;
            padding: 0 !important;
            overflow: hidden !important;
          }
          .wayfinder-level-button[data-active='true'] {
            background-color: rgba(0, 0, 0, 0.6) !important;
            width: 10px !important;
            height: 10px !important;
          }

          /* Always show locate controls — new engine hides them until a mode is set */
          .wayfinder-locate-controls {
            display: flex !important;
          }
          /* Show you-are-here button (new engine hides by default; old engine always showed it) */
          .wayfinder-locate-controls [data-action='locate-here'] {
            display: grid !important;
          }
          /* Hide start button — redundant with you-are-here (same kiosk node location) */
          .wayfinder-locate-controls [data-action='locate-start'] {
            display: none !important;
          }
          /* Always show lift/escalator connectors */
          .wayfinder-locate-button--connector {
            display: grid !important;
          }

          /* Locate buttons: engine changed to border-radius:12px — restore circle */
          .wayfinder-locate-button {
            border-radius: 50% !important;
            background-color: #ffffff !important;
          }
          /* Force icons dark on white background */
          .wayfinder-locate-button img {
            filter: brightness(0) !important;
          }

          /* Level selector: fill control rail height for scrolling; tighten for dot style */
          .wayfinder-level-selector {
            align-self: stretch !important;
            max-height: none !important;
            overflow-y: auto !important;
            gap: 8px !important;
            padding: 8px 0 !important;
          }
        `;
        try {
          // adoptedStyleSheets is supported in all modern browsers (Chrome 73+)
          const sheet = new CSSStyleSheet();
          sheet.replaceSync(cssText);
          shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, sheet];
        } catch (_) {
          // Fallback: append a <style> element
          try {
            const style = document.createElement("style");
            style.textContent = cssText;
            shadow.appendChild(style);
          } catch (__) { /* non-critical */ }
        }
      }
      try {
        const scrollActiveLevel = () => {
          try {
            const btn = shadow?.querySelector<HTMLElement>(".wayfinder-level-button[data-active='true']");
            btn?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          } catch (_) {}
        };
        shadow.querySelectorAll<HTMLButtonElement>("button[data-action]").forEach(btn => {
          const action = btn.dataset.action ?? "";
          const label = LABELS[action];
          if (!label) return;
          btn.title = label;
          // Scroll level selector to active floor after locate buttons are tapped
          if (action === "locate-focus" || action === "locate-here" || action === "locate-start") {
            btn.addEventListener("click", () => setTimeout(scrollActiveLevel, 100), { passive: true });
          }
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
    const routeFloorIndicators = () => {
      map.addEventListener("route-found", (e: Event) => {
        try {
          const d = (e as CustomEvent).detail;
          const sf = d?.startNode?.level?.code as string | undefined;
          const ef = d?.endNode?.level?.code as string | undefined;
          const sp = d?.startNode?.point;
          const ep = d?.endNode?.point;
          if (sf && ef && sp && ep && isFinite(sp.x) && isFinite(sp.y) && isFinite(ep.x) && isFinite(ep.y)) {
            const spx = sp.x, spy = sp.y;
            const epx = ep.x, epy = ep.y;
            // If the user picked a specific floor, show that floor centered on the destination.
            // Otherwise show the start floor (you-are-here) first.
            // Delay lets wayfinder finish its own post-route centering before we override.
            setTimeout(() => {
              try {
                const el = map as HTMLElement & { setFloor: (c: string) => void; centerOn: (x: number, y: number, o?: object) => void };
                const floorCode = targetFloorCodeRef.current ?? sf;
                const cx = targetFloorCodeRef.current ? epx : spx;
                const cy = targetFloorCodeRef.current ? epy : spy;
                el.setFloor(floorCode);
                el.centerOn(cx, cy, { animate: true, scale: 3 });
              } catch (_) {}
            }, 600);
          }
        } catch (_) {}
      });
    };
    const autoScrollLevel = () => {
      map.addEventListener("floor-changed", () => {
        try {
          const shadow = (map as HTMLElement & { shadowRoot: ShadowRoot }).shadowRoot;
          const btn = shadow?.querySelector<HTMLElement>(".wayfinder-level-button[data-active='true']");
          btn?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        } catch (_) {}
      });
    };
    const setup = () => { attachTooltips(); routeFloorIndicators(); autoScrollLevel(); };
    if ((map as HTMLElement & { isInitialized?: boolean }).isInitialized) {
      setup();
    } else {
      map.addEventListener("ready", setup, { once: true });
    }
  }, []);
  useEffect(() => {
    const map = mapRef.current as (HTMLElement & {
      isInitialized: boolean;
      navigateTo: (opts: { from: number; to: number }) => void;
      focusLocation: (id: number) => void;
      setFloor: (code: string) => void;
      centerOn: (x: number, y: number, opts?: { animate?: boolean; scale?: number }) => void;
    }) | null;
    if (!map || !destinationId) return;
    const scrollActiveLevel = () => {
      try {
        const shadow = (map as HTMLElement & { shadowRoot: ShadowRoot }).shadowRoot;
        const btn = shadow?.querySelector<HTMLElement>(".wayfinder-level-button[data-active='true']");
        btn?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } catch (_) {}
    };
    const navigate = () => {
      const rawNodeId = localStorage.getItem(KIOSK_NODE_KEY) ?? DEFAULT_NODE_ID;
      if (rawNodeId) {
        const kioskNode = nodesRef.current.find(n => n.id === Number(rawNodeId));
        if (kioskNode?.location) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = (map as any).navigateTo({ from: kioskNode.location, to: destinationId });
          if (result?.success) {
            // floor-changed handles scroll when floor changes; fall back for same-floor case
            setTimeout(scrollActiveLevel, 100);
            return;
          }
        }
      }
      map.focusLocation(destinationId);
      // focusLocation only calls setFloor when floor changes, so always scroll after
      setTimeout(scrollActiveLevel, 100);
    };
    if (map.isInitialized) {
      navigate();
    } else {
      // setTimeout(0) lets the wayfinder's initial ResizeObserver + resetView
      // complete before we call focusLocation/navigateTo, preventing the
      // white canvas on first open.
      map.addEventListener("ready", () => setTimeout(navigate, 0), { once: true });
    }
  }, [destinationId]); // nodesRef used instead of nodes to avoid double-navigation
  const kioskNodeId = typeof window !== "undefined"
    ? (localStorage.getItem(KIOSK_NODE_KEY) ?? DEFAULT_NODE_ID)
    : DEFAULT_NODE_ID;
  const content = (
    <div
      className="fixed inset-0 z-[60] bg-white"
      style={{
        visibility: destinationId ? "visible" : "hidden",
        pointerEvents: destinationId ? "auto" : "none",
      }}
    >
      {/* Back button — floating circle, matches wayfinder control style */}
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: 16, left: 16, zIndex: 10,
          width: 44, height: 44, borderRadius: "50%",
          background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "none", cursor: "pointer",
        }}
      >
        <svg width="9" height="15" viewBox="0 0 9 15" fill="none">
          <path d="M8 1L1.5 7.5 8 14" stroke="#00226B" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <wayfinder-map
        ref={mapRef}
        className="absolute inset-0 block"
        data-url={DATA_URL}
        map-url={MAP_URL}
        route-mode="lift"
        level-selector=""
        desktop-render-scale="1500"
        mobile-render-scale="1200"
        you-are-here-node-id={kioskNodeId}
        control-active-bg-color="#6E96FF"
        control-active-fg-color="#ffffff"
        map-marker-end-bg-color="#00226B"
        map-marker-connector-bg-color="#6E96FF"
        map-label-background-color="transparent"
      />
    </div>
  );
  return createPortal(content, document.body);
}
