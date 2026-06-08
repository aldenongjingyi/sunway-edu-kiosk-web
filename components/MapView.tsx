"use client";
import { useEffect, useRef } from "react";
import { useDataStore } from "@/lib/store";

interface Props {
  destinationId: number | null;
  onClose: () => void;
}

const KIOSK_NODE_KEY = "admin.kiosk.nodeId";
const SCRIPT_URL = "https://maps-sunwayedu.getmallapp.com/wayfinder-map.min.js";
const DATA_URL = "https://sunwayedu3-data.indoorcms.com/datas_v001.json.gz";
const MAP_URL  = "https://sunwayedu3-data.indoorcms.com/maps_v001.json.gz";

// Load the wayfinder custom-element script once per page
function ensureScript() {
  if (document.querySelector('[data-wayfinder-script]')) return;
  const s = document.createElement("script");
  s.type = "module";
  s.setAttribute("data-wayfinder-script", "1");
  s.textContent = `import "${SCRIPT_URL}";`;
  document.head.appendChild(s);
}

export default function MapView({ destinationId, onClose }: Props) {
  const { nodes } = useDataStore();
  const mapRef = useRef<HTMLElement>(null);

  // Load script on first mount
  useEffect(() => { ensureScript(); }, []);

  // Navigate whenever destinationId changes
  useEffect(() => {
    const map = mapRef.current as (HTMLElement & {
      isInitialized: boolean;
      navigateTo: (opts: { from: number; to: number }) => void;
      focusLocation: (id: number) => void;
      clearRoute: () => void;
    }) | null;
    if (!map || !destinationId) return;

    const navigate = () => {
      const rawNodeId = localStorage.getItem(KIOSK_NODE_KEY);
      if (rawNodeId) {
        const kioskNode = nodes.find((n: { id: number; location: number | null }) => n.id === Number(rawNodeId));
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

  return (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col slide-up">
      {/* Back bar */}
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
      </div>

      {/* Map fills remaining height */}
      <wayfinder-map
        ref={mapRef}
        className="flex-1 min-h-0 w-full block"
        data-url={DATA_URL}
        map-url={MAP_URL}
        default-floor="G"
        route-mode="lift"
        enable-rotation=""
        level-selector=""
        desktop-render-scale="1500"
        mobile-render-scale="1200"
        you-are-here-node-id={kioskNodeId}
        control-active-bg-color="#00226B"
        map-marker-end-bg-color="#00226B"
        map-marker-connector-bg-color="#00226B"
      />
    </div>
  );
}
