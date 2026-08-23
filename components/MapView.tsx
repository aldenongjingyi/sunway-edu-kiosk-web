"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDataStore } from "@/lib/store";
import { BLOCKED_WAYFINDER_LOCATION_IDS } from "@/lib/blocked-locations";
interface Props {
  destinationId: number | null;
  targetFloorCode?: string | null;
  onClose: () => void;
}
const KIOSK_NODE_KEY = "admin.kiosk.nodeId";
const SCRIPT_URL = process.env.NEXT_PUBLIC_WAYFINDER_URL ||
  "/wayfinder-map.min.js";
const DATA_URL  = "https://sunwayedu3-data.indoorcms.com/datas_v001.json.gz";
const MAP_URL   = "https://sunwayedu3-data.indoorcms.com/maps_v001.json.gz";
const PROXY_URL = "https://sunway-kiosk-proxy.sunway-kiosk.workers.dev";
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
  // Refs to always-current values — let the one-time setup effect access current state.
  const navigateFnRef = useRef<(connectorConstraint?: string | null) => void>(() => {});
  const currentDestRef = useRef<number | null>(destinationId);
  // Track current connector mode so we can reset button visuals on new destination.
  const connectorModeRef = useRef<string | null>(null);
  useEffect(() => {
    currentDestRef.current = destinationId;
    connectorModeRef.current = null; // reset connector mode when destination changes
  }, [destinationId]);
  const targetFloorCodeRef = useRef(targetFloorCode);
  useEffect(() => { targetFloorCodeRef.current = targetFloorCode; }, [targetFloorCode]);
  const mapRef = useRef<HTMLElement>(null);
  useEffect(() => { ensureScript(); }, []);

  // Fetch wayfinder data, strip blocked locations, serve as a blob URL so the
  // engine never renders external pins/labels (gates, outdoor locations, etc.).
  // Filtered JSON is cached in localStorage so the map works offline after first load.
  //
  // URL resolved synchronously via lazy useState so wayfinder always gets data-url
  // on first render — avoids "connecting…" state while waiting for a useEffect.
  const WAYFINDER_CACHE_KEY = "kiosk.wayfinder.cache";
  const blobUrlRef = useRef<string>("");
  const [mapDataUrl] = useState<string>(() => {
    if (typeof window === "undefined") return DATA_URL;
    try {
      const cached = localStorage.getItem(WAYFINDER_CACHE_KEY);
      if (cached) {
        const url = URL.createObjectURL(new Blob([cached], { type: "application/json" }));
        blobUrlRef.current = url;
        return url;
      }
    } catch (_) {}
    return DATA_URL;
  });
  useEffect(() => {
    // Fetch fresh data, filter blocked locations, update localStorage for next load.
    // Do NOT update data-url live — changing it causes wayfinder to reinit and lose shadow DOM CSS.
    const fetchUrl = `${PROXY_URL}/?url=${encodeURIComponent(DATA_URL)}&_=${Date.now()}`;
    fetch(fetchUrl)
      .then(r => r.json())
      .then((data: { locations?: Array<{ id: number }> }) => {
        if (Array.isArray(data.locations)) {
          data.locations = data.locations.filter(l => !BLOCKED_WAYFINDER_LOCATION_IDS.has(l.id));
        }
        const json = JSON.stringify(data);
        try { localStorage.setItem(WAYFINDER_CACHE_KEY, json); } catch (_) {}
      })
      .catch(() => {});
    return () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current); };
  }, []);
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

          /* Always show locate controls — new engine hides them until a mode is set */
          .wayfinder-locate-controls {
            display: flex !important;
          }
          /* Show start button — centers on kiosk (route start node) */
          .wayfinder-locate-controls [data-action='locate-start'] {
            display: grid !important;
          }
          /* Hide you-are-here button — requires wayfinder internal node ID which is unreliable */
          .wayfinder-locate-controls [data-action='locate-here'] {
            display: none !important;
          }
          /* Always show lift/escalator connectors */
          .wayfinder-locate-button--connector {
            display: grid !important;
          }

          /* Locate buttons: engine changed to border-radius:12px — restore circle */
          .wayfinder-locate-button {
            border-radius: 50% !important;
          }
          /* Inactive: white background, dark icon */
          .wayfinder-locate-button:not([data-active='true']) {
            background-color: #ffffff !important;
          }
          .wayfinder-locate-button:not([data-active='true']) img {
            filter: brightness(0) !important;
          }
          /* Active (connector toggled on): blue background, white icon */
          .wayfinder-locate-button[data-active='true'] {
            background-color: #6E96FF !important;
          }
          .wayfinder-locate-button[data-active='true'] img {
            filter: brightness(0) invert(1) !important;
          }

          /* Level selector: fill control rail height for scrolling */
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
    const interceptConnectors = () => {
      // Intercept connector button (lift/escalator) clicks at the host element in capture
      // phase. This fires BEFORE the engine's shadow DOM listeners, so stopImmediatePropagation
      // prevents the engine from processing the click with its stale cached destination (#Ts).
      // We handle routing ourselves with the always-current currentDestRef / navigateFnRef.
      map.addEventListener("click", (e: Event) => {
        try {
          const btn = e.composedPath().find((el) => {
            const action = (el as HTMLElement).dataset?.action;
            return action === "nav-connector-lift" || action === "nav-connector-escalator";
          }) as HTMLElement | undefined;
          if (!btn) return;

          e.stopImmediatePropagation();

          const constraint = btn.dataset.action === "nav-connector-lift" ? "lift-only" : "escalator-only";
          const newMode = connectorModeRef.current === constraint ? null : constraint;
          connectorModeRef.current = newMode;

          // Update button active states — engine's #Ur won't run since we stopped the event.
          const shadow = (map as HTMLElement & { shadowRoot: ShadowRoot }).shadowRoot;
          if (shadow) {
            const liftBtn = shadow.querySelector<HTMLElement>('[data-action="nav-connector-lift"]');
            const escBtn  = shadow.querySelector<HTMLElement>('[data-action="nav-connector-escalator"]');
            if (liftBtn) liftBtn.dataset.active = newMode === "lift-only"      ? "true" : "false";
            if (escBtn)  escBtn.dataset.active  = newMode === "escalator-only" ? "true" : "false";
          }

          navigateFnRef.current(newMode);
        } catch (_) {}
      }, true);
    };
    const routeFloorIndicators = () => {
      map.addEventListener("route-found", (e: Event) => {
        try {
          const d = (e as CustomEvent).detail;
          const sf = d?.startNode?.level?.code as string | undefined;
          const ef = d?.endNode?.level?.code as string | undefined;
          const sp = d?.startNode?.point;
          const ep = d?.endNode?.point;
          const startNodeId = d?.startNode?.id;
          if (startNodeId != null) {
            map.setAttribute("you-are-here-node-id", String(startNodeId));
          }
          if (sf && ef && sp && ep && isFinite(sp.x) && isFinite(sp.y) && isFinite(ep.x) && isFinite(ep.y)) {
            const spx = sp.x, spy = sp.y;
            const epx = ep.x, epy = ep.y;
            // If the user picked a specific floor, show that floor centered on the destination.
            // Otherwise show the start floor (you-are-here) first.
            // NOTE: must be called at 0ms (before wayfinder's own post-route centering settles);
            // a longer delay causes setFloor() to reset the route path on Android WebView.
            setTimeout(() => {
              try {
                const el = map as HTMLElement & { setFloor: (c: string) => void; centerOn: (x: number, y: number, o?: object) => void };
                const floorCode = targetFloorCodeRef.current ?? sf;
                const cx = targetFloorCodeRef.current ? epx : spx;
                const cy = targetFloorCodeRef.current ? epy : spy;
                el.setFloor(floorCode);
                el.centerOn(cx, cy, { animate: true, scale: 3 });
              } catch (_) {}
            }, 0);
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
    const applyYouAreHere = () => {
      // Re-apply after ready in case the element was connected before React set the prop.
      const rawNodeId = localStorage.getItem(KIOSK_NODE_KEY);
      if (!rawNodeId) return;
      const kioskNode = nodesRef.current.find(n => n.id === Number(rawNodeId));
      if (!kioskNode) return;
      if (kioskNode.location != null) {
        map.setAttribute("you-are-here-node-id", String(kioskNode.location));
        return;
      }
      const candidates = nodesRef.current
        .filter(n => n.level === kioskNode.level && n.location != null)
        .sort((a, b) =>
          Math.hypot(a.x - kioskNode.x, a.y - kioskNode.y) -
          Math.hypot(b.x - kioskNode.x, b.y - kioskNode.y)
        );
      if (candidates.length > 0) map.setAttribute("you-are-here-node-id", String(candidates[0].location!));
    };
    const setup = () => { applyYouAreHere(); attachTooltips(); interceptConnectors(); routeFloorIndicators(); autoScrollLevel(); };
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
    const navigate = (connectorConstraint?: string | null) => {
      const rawNodeId = localStorage.getItem(KIOSK_NODE_KEY);
      if (rawNodeId) {
        const kioskNode = nodesRef.current.find(n => n.id === Number(rawNodeId));
        if (kioskNode) {
          // Build set of location IDs that are navigable in the wayfinder graph.
          // Not every IndoorCMS location is in the wayfinder graph — only mapped ones are.
          let validLocIds: Set<number> | null = null;
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const wfLocs = (map as any).getLocations() as Array<{ id: number }>;
            if (Array.isArray(wfLocs)) validLocIds = new Set(wfLocs.map(l => l.id));
          } catch (_) {}

          // Prefer the kiosk node's own location if it's in the wayfinder graph.
          // Otherwise find the nearest node on the same level whose location is.
          let fromLocation: number | null =
            kioskNode.location != null && (!validLocIds || validLocIds.has(kioskNode.location))
              ? kioskNode.location
              : null;

          if (!fromLocation) {
            const candidates = nodesRef.current
              .filter(n => n.level === kioskNode.level && n.location != null &&
                           (!validLocIds || validLocIds.has(n.location!)))
              .sort((a, b) =>
                Math.hypot(a.x - kioskNode.x, a.y - kioskNode.y) -
                Math.hypot(b.x - kioskNode.x, b.y - kioskNode.y)
              );
            if (candidates.length > 0) fromLocation = candidates[0].location;
          }

          if (fromLocation) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const navOpts: Record<string, unknown> = { from: fromLocation, to: destinationId };
            // Only include connectorConstraint when a mode is active — passing null explicitly
            // is treated differently from omitting it, causing route failure in the engine.
            if (connectorConstraint != null) navOpts.connectorConstraint = connectorConstraint;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = (map as any).navigateTo(navOpts);
            if (result?.success) {
              // floor-changed handles scroll when floor changes; fall back for same-floor case
              setTimeout(scrollActiveLevel, 100);
              return;
            }
            // Constrained route failed (e.g. no escalator on this path) — reset button state
            // and fall back to unconstrained route so a path is always shown.
            if (connectorConstraint != null) {
              connectorModeRef.current = null;
              try {
                const shadow = (map as HTMLElement & { shadowRoot: ShadowRoot }).shadowRoot;
                if (shadow) {
                  const liftBtn = shadow.querySelector<HTMLElement>('[data-action="nav-connector-lift"]');
                  const escBtn  = shadow.querySelector<HTMLElement>('[data-action="nav-connector-escalator"]');
                  if (liftBtn) liftBtn.dataset.active = "false";
                  if (escBtn)  escBtn.dataset.active  = "false";
                }
              } catch (_) {}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const fallback = (map as any).navigateTo({ from: fromLocation, to: destinationId });
              if (fallback?.success) {
                setTimeout(scrollActiveLevel, 100);
                return;
              }
            }
          }
        }
      }
      map.focusLocation(destinationId);
      // focusLocation only calls setFloor when floor changes, so always scroll after
      setTimeout(scrollActiveLevel, 100);
    };
    navigateFnRef.current = navigate;
    if (map.isInitialized) {
      navigate();
    } else {
      // setTimeout(0) lets the wayfinder's initial ResizeObserver + resetView
      // complete before we call focusLocation/navigateTo, preventing the
      // white canvas on first open.
      map.addEventListener("ready", () => setTimeout(navigate, 0), { once: true });
    }
  }, [destinationId]); // nodesRef used instead of nodes to avoid double-navigation
  // Wayfinder expects a location ID for you-are-here-node-id, not an IndoorCMS node ID.
  // Resolve at render time so the attribute is correct before the element initialises.
  const kioskLocationId = (() => {
    if (typeof window === "undefined") return "";
    const rawNodeId = localStorage.getItem(KIOSK_NODE_KEY);
    if (!rawNodeId) return "";
    const kioskNode = nodes.find(n => n.id === Number(rawNodeId));
    if (!kioskNode) return "";
    if (kioskNode.location != null) return String(kioskNode.location);
    // No location on this node — use nearest node on same level that has one
    const candidates = nodes
      .filter(n => n.level === kioskNode.level && n.location != null)
      .sort((a, b) =>
        Math.hypot(a.x - kioskNode.x, a.y - kioskNode.y) -
        Math.hypot(b.x - kioskNode.x, b.y - kioskNode.y)
      );
    return candidates.length > 0 ? String(candidates[0].location!) : "";
  })();
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
        data-url={mapDataUrl || undefined}
        map-url={mapDataUrl ? MAP_URL : undefined}
        route-mode="lift"
        level-selector=""
        desktop-render-scale="1500"
        mobile-render-scale="1200"
        you-are-here-node-id={kioskLocationId}
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
