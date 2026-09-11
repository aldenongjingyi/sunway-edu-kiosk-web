"use client";
import { useCallback, useDeferredValue, useEffect, useRef, startTransition, useState } from "react";
import { createPortal } from "react-dom";
import { useDataStore } from "@/lib/store";
import { hdx } from "@/lib/hdx";
import { BLOCKED_WAYFINDER_LOCATION_IDS } from "@/lib/blocked-locations";
import PopularTab from "./PopularTab";
import FacilitiesTab from "./FacilitiesTab";
import DepartmentsTab from "./DepartmentsTab";

import SearchResults from "./SearchResults";
import Screensaver from "./Screensaver";
import NodePickerMap from "./NodePickerMap";
import MapView from "./MapView";
import type { Category, Staff } from "@/lib/types";

const IDLE_SECONDS = 120;
const MAP_IDLE_SECONDS = 120; // longer timeout while map is open
const RELOAD_INTERVAL_MS = 30 * 60 * 1000; // check for new build every 30 min while screensaver is active
const ADMIN_CODE = "my3245campusx";
const KIOSK_NODE_KEY = "admin.kiosk.nodeId";

const TABS_DEFAULT = ["Popular Searches", "Facilities / Offices", "Departments / Staffs"] as const;
const TABS_V1 = ["Popular Searches", "Facilities / Offices", "Departments"] as const;
const TAB_LINES_V1: string[][] = [
  ["Popular", "Searches"],
  ["Facilities /", "Offices"],
  ["Departments"],
];

// UI design variant: "default" (iOS-style) or "v1" (airport-kiosk style)
const DESIGN: "default" | "v1" = "default";

function formatTimestamp(date: Date | null): string {
  if (!date) return "—";
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const y = date.getFullYear();
  const mo = String(date.getMonth()+1).padStart(2,"0");
  const d = String(date.getDate()).padStart(2,"0");
  const h = date.getHours() % 12 || 12;
  const mi = String(date.getMinutes()).padStart(2,"0");
  const ap = date.getHours() >= 12 ? "PM" : "AM";
  return `${days[date.getDay()]} ${y}-${mo}-${d} ${h}:${mi} ${ap}`;
}

// Returns true when the kiosk should be in off-hours black screen mode (KL time, UTC+8).
// TEST: working hours 6:30am–11:50am. Production: change END to 20 * 60 (8pm).
function isOffHoursKL(): boolean {
  const now = new Date();
  const klH = (now.getUTCHours() + 8) % 24;
  const totalMin = klH * 60 + now.getUTCMinutes();
  const START = 6 * 60 + 30;  // 6:30am
  const END   = 17 * 60 + 30; // 5:30pm — TEST (production: 20 * 60)
  return totalMin < START || totalMin >= END;
}

function formatKLTime(date: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const kl = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const h = String(kl.getUTCHours()).padStart(2, "0");
  const m = String(kl.getUTCMinutes()).padStart(2, "0");
  return `${days[kl.getUTCDay()]} ${kl.getUTCDate()} ${months[kl.getUTCMonth()]} ${h}:${m}`;
}

interface FloorOption {
  levelId: number;
  title: string;
  label: string;
  code: string;
}

const BANNER_QR_URL = "https://qr.scanto.app/sunway-mycampus/";

function FooterBanner() {
  const [qrExpanded, setQrExpanded] = useState(false);

  return (
    <>
      {/* Enlarged QR dialog — auto-closes after 15s (matches Pyramid behaviour) */}
      {qrExpanded && portalMountedGlobal && createPortal(
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 400,
            background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={() => setQrExpanded(false)}
        >
          <div
            style={{
              background: "#fff", borderRadius: 20, padding: 28,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
            }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ fontSize: 15, fontWeight: 700, color: "#00226B", textAlign: "center" }}>
              Navigate on your phone
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/banner-qr.png" alt="QR" style={{ width: 280, height: 280 }} />
            <p style={{ fontSize: 12, color: "#6b7280", textAlign: "center", maxWidth: 260 }}>
              Scan this QR code to get live indoor navigation on your phone.
            </p>
            <button
              onClick={() => setQrExpanded(false)}
              style={{
                padding: "8px 32px", borderRadius: 20,
                background: "#00226B", color: "#fff",
                fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>,
        document.body
      )}

      <div style={{
        flexShrink: 0,
        background: "linear-gradient(to bottom, #00226B, #1a5fc8)",
        display: "flex", alignItems: "center",
        padding: "14px 20px", gap: 16,
        fontFamily: "var(--font-body)",
      }}>
        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", lineHeight: 1.3, marginBottom: 5 }}>
            Navigate using your phone!
          </p>
          <p style={{ fontSize: 12, fontWeight: 300, color: "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>
            Scan and download our MyCampus Mobile App now!
          </p>
        </div>

        {/* App icon */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mycampus-icon.png"
          alt="MyCampus"
          style={{ width: 62, height: 62, flexShrink: 0 }}
        />

        {/* QR code — tap to enlarge (Pyramid behaviour) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/banner-qr.png"
          alt="QR"
          style={{ width: 62, height: 62, flexShrink: 0, cursor: "pointer" }}
          onClick={() => setQrExpanded(true)}
        />
      </div>
    </>
  );
}

// Tracks whether the portal root (document.body) is mounted — set once on first KioskShell mount.
let portalMountedGlobal = false;

export default function KioskShell() {
  const { loadData, loadStaff, locations, nodes, levels, lastRefreshed, lastStaffRefreshed, loaded } = useDataStore();

  // Parse ?from=<nodeId>&to=<locationId> URL params in useEffect so the initial
  // render matches the SSR output (no map) — avoids React hydration mismatch #418
  // which caused the map to render against an unstable iOS Safari viewport on first scan.
  const [urlParams, setUrlParams] = useState<{ from: string; to: number } | null>(null);
  // Synchronous ref so the async loadData callback can check URL params without closure issues.
  // useState is set in a useEffect (deferred), so it's always null inside the loadData callback.
  const hasQrParamsRef = useRef(
    typeof window !== "undefined"
      ? (() => { const p = new URLSearchParams(window.location.search); return !!(p.get("from") && p.get("to")); })()
      : false
  );

  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<number | null>(null);
  const [filterDepartment, setFilterDepartment] = useState<string | null>(null);
  const [screensaverExpanded, setScreensaverExpanded] = useState(false);
  const [isOffHours, setIsOffHours] = useState(() => isOffHoursKL());
  const [showResults, setShowResults] = useState(false);
  const [showNodePicker, setShowNodePicker] = useState(false);
  const [mapDestinationId, setMapDestinationId] = useState<number | null>(null);
  const [mapTargetFloorCode, setMapTargetFloorCode] = useState<string | null>(null);
  const [mapMounted, setMapMounted] = useState(false);
  const [notProvisionedAlert, setNotProvisionedAlert] = useState(false);
  const [noNodeAlert, setNoNodeAlert] = useState(false);
  const [floorPicker, setFloorPicker] = useState<{ locationId: number; floors: FloorOption[] } | null>(null);
  const [pageLoadTime] = useState(() => new Date());

  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilterCategory, setSearchFilterCategory] = useState<number | null>(null);
  const [searchFilterDepartment, setSearchFilterDepartment] = useState<string | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deferredSearchFilterCategory = useDeferredValue(searchFilterCategory);
  const deferredSearchFilterDepartment = useDeferredValue(searchFilterDepartment);
  const searchDebounce300Ref = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchDebounce300Ref.current) clearTimeout(searchDebounce300Ref.current);
    searchDebounce300Ref.current = setTimeout(() => {
      startTransition(() => {
        setSearchQuery(query);
        setSearchFilterCategory(filterCategory);
        setSearchFilterDepartment(filterDepartment);
      });
      if (query.length === 0) setShowResults(false);
    }, 300);
    return () => { if (searchDebounce300Ref.current) clearTimeout(searchDebounce300Ref.current); };
  }, [query, filterCategory, filterDepartment]);

  const inputRef = useRef<HTMLInputElement>(null);
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapOpenRef = useRef(false);
  const initialHtmlRef = useRef<string | null>(null);

  // ── Pull to refresh ────────────────────────────────────────────────────────
  const PULL_THRESHOLD = 100;
  const pullStartY = useRef<number | null>(null);
  const pullProgressRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const pullEnabledRef = useRef(true);
  const pullSpinnerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [portalMounted, setPortalMounted] = useState(false);
  const MAX_TRANSLATE = 72;

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (isRefreshingRef.current || !pullEnabledRef.current) return;
      // Don't intercept if touch is inside a scrolled element — let it scroll back up.
      let el = e.target as HTMLElement | null;
      while (el) {
        if (el.scrollTop > 0) return;
        el = el.parentElement;
      }
      pullStartY.current = e.touches[0].clientY;
    };

    const onMove = (e: TouchEvent) => {
      if (pullStartY.current === null || isRefreshingRef.current) return;
      const delta = e.touches[0].clientY - pullStartY.current;
      if (delta <= 0) { pullProgressRef.current = 0; return; }
      e.preventDefault();
      pullProgressRef.current = Math.min(delta / PULL_THRESHOLD, 1);
      // Rubber-band: page follows finger with dampening, capped at MAX_TRANSLATE
      const translate = Math.min(delta * 0.55, MAX_TRANSLATE);
      if (pageRef.current) pageRef.current.style.transform = `translateY(${translate}px)`;
      // Spinner fades in and rotates as progress builds
      if (pullSpinnerRef.current) {
        pullSpinnerRef.current.style.opacity = String(Math.min(pullProgressRef.current * 1.5, 1));
        (pullSpinnerRef.current.firstElementChild as HTMLElement | null)
          ?.style.setProperty("transform", `rotate(${pullProgressRef.current * 270}deg)`);
      }
    };

    const onEnd = () => {
      if (pullStartY.current === null) return;
      pullStartY.current = null;
      const committed = pullProgressRef.current >= 1;
      pullProgressRef.current = 0;
      if (committed && !isRefreshingRef.current) {
        isRefreshingRef.current = true;
        if (pullSpinnerRef.current) {
          pullSpinnerRef.current.style.opacity = "1";
          const icon = pullSpinnerRef.current.firstElementChild as HTMLElement | null;
          if (icon) icon.style.animation = "spin 0.75s linear infinite";
        }
        hdx.addAction("ui.refresh.pull");
        if (pageRef.current) {
          pageRef.current.style.transition = "transform 0.3s ease-out";
          pageRef.current.style.transform = "translateY(0)";
        }
        setTimeout(() => {
          // On Android: use the native bridge so the stall watchdog and disk-cache
          // fallback work correctly (offline pull-to-refresh shows cached version).
          // On browser/Vercel: fall back to a regular page reload.
          const bridge = (window as { _KioskCache?: { reload?: () => void } })._KioskCache;
          if (bridge?.reload) bridge.reload();
          else window.location.reload();
        }, 300);
      } else {
        // Not committed — snap page back
        if (pageRef.current) {
          pageRef.current.style.transition = "transform 0.2s ease-out";
          pageRef.current.style.transform = "translateY(0)";
          setTimeout(() => { if (pageRef.current) pageRef.current.style.transition = "none"; }, 220);
        }
        if (pullSpinnerRef.current) pullSpinnerRef.current.style.opacity = "0";
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  useEffect(() => { setPortalMounted(true); portalMountedGlobal = true; }, []);
  // ──────────────────────────────────────────────────────────────────────────

  const isV1 = DESIGN === "v1";

  // Load data on mount, expand screensaver once highlights are ready
  // Also reopen admin panel if we just reloaded after saving a kiosk node
  // Read URL params after mount — deferred so first render matches SSR output,
  // avoiding React hydration mismatch that caused layout issues on iOS Safari first scan.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const from = p.get("from");
    const to = p.get("to");
    if (from && to) {
      const toId = parseInt(to, 10);
      if (!isNaN(toId) && toId > 0) {
        // Provision browser with this kiosk node so navigation works after closing the map.
        localStorage.setItem(KIOSK_NODE_KEY, from);
        setUrlParams({ from, to: toId });
        setMapDestinationId(toId);
        setMapMounted(true);
      }
    }
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem("admin.reopen")) {
      sessionStorage.removeItem("admin.reopen");
      setShowNodePicker(true);
    }
    hdx.addAction("ui.shell.mounted");
    loadData().then(() => {
      loadStaff();
      // Skip screensaver when launched via QR URL param — user wants the map immediately.
      // During off-hours, also skip immediate expansion — let the idle timer trigger the
      // black screen after 30s of no interaction instead of showing it on every load/refresh.
      if (!hasQrParamsRef.current && !isOffHoursKL()) setScreensaverExpanded(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData, loadStaff]);

  // Fetch and store the initial index.html so we can detect when a new build is deployed.
  useEffect(() => {
    fetch(window.location.href, { cache: "no-store" })
      .then(r => r.text())
      .then(html => { initialHtmlRef.current = html; })
      .catch(() => {});
  }, []);

  // While screensaver is active, check every 30 min for a new build.
  // Reloads only if index.html changed (new JS bundle hashes) — skips if offline or same build.
  useEffect(() => {
    if (!screensaverExpanded) return;
    const check = setInterval(() => {
      if (!initialHtmlRef.current) return;
      fetch(window.location.href, { cache: "no-store" })
        .then(r => r.text())
        .then(html => {
          if (html === initialHtmlRef.current) return;
          const bridge = (window as { _KioskCache?: { reload?: () => void } })._KioskCache;
          if (bridge?.reload) bridge.reload();
          else window.location.reload();
        })
        .catch(() => {}); // offline — skip
    }, RELOAD_INTERVAL_MS);
    return () => clearInterval(check);
  }, [screensaverExpanded]);

  // Re-check off-hours every 30s so the black screen appears/disappears at the boundary.
  useEffect(() => {
    const tick = setInterval(() => setIsOffHours(isOffHoursKL()), 30_000);
    return () => clearInterval(tick);
  }, []);

  // Dim the screen backlight when the off-hours black overlay is active.
  // The Android bridge controls WindowManager.LayoutParams.screenBrightness.
  useEffect(() => {
    const bridge = (window as { _KioskCache?: { setBrightness?: (v: number) => void } })._KioskCache;
    if (!bridge?.setBrightness) return;
    bridge.setBrightness(isOffHours && screensaverExpanded ? 0 : 1);
  }, [isOffHours, screensaverExpanded]);

  // Keep mapOpenRef in sync so resetIdle can read current map state without deps
  useEffect(() => { mapOpenRef.current = mapDestinationId !== null; }, [mapDestinationId]);

  // Disable pull-to-refresh when map/node picker is open or off-hours black screen is showing
  useEffect(() => {
    pullEnabledRef.current = mapDestinationId === null && !showNodePicker && !(isOffHours && screensaverExpanded);
  }, [mapDestinationId, showNodePicker, isOffHours, screensaverExpanded]);

  // Reset idle timer — uses longer timeout while map is open
  const resetIdle = useCallback(() => {
    if (idleRef.current) clearTimeout(idleRef.current);
    const seconds = mapOpenRef.current ? MAP_IDLE_SECONDS : IDLE_SECONDS;
    idleRef.current = setTimeout(() => {
      hdx.addAction("ui.screensaver.expand", { source: mapOpenRef.current ? "map" : "main", idleSeconds: seconds });
      setScreensaverExpanded(true);
      setQuery("");
      setFilterCategory(null);
      setFilterDepartment(null);
      setShowResults(false);
      setTab(0);
      setMapDestinationId(null); // close map on idle
      setShowNodePicker(false);
      setNotProvisionedAlert(false);
      setFloorPicker(null);
      inputRef.current?.blur();
    }, seconds * 1000);
  }, []);

  // Track any user interaction
  useEffect(() => {
    const events = ["touchstart", "mousedown", "keydown", "mousemove", "input"];
    events.forEach(e => window.addEventListener(e, resetIdle, { passive: true }));
    resetIdle();
    return () => events.forEach(e => window.removeEventListener(e, resetIdle));
  }, [resetIdle]);

  // Pre-cache filtered wayfinder location data on every page load so the map
  // works offline with the correct blocked-locations list even if the map was
  // never opened in the current session.
  useEffect(() => {
    const DATA_URL = "https://sunwayedu3-data.indoorcms.com/datas_v001.json.gz";
    const PROXY_URL = "https://sunway-kiosk-proxy.sunway-kiosk.workers.dev";
    const CACHE_KEY = "kiosk.wayfinder.cache";
    fetch(`${PROXY_URL}/?url=${encodeURIComponent(DATA_URL)}&_=${Date.now()}`)
      .then(r => r.json())
      .then((data: { locations?: Array<{ id: number }> }) => {
        if (Array.isArray(data.locations)) {
          data.locations = data.locations.filter(l => !BLOCKED_WAYFINDER_LOCATION_IDS.has(l.id));
        }
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (_) {}
      })
      .catch(() => {});
  }, []);

  const handleScreensaverTap = () => {
    setScreensaverExpanded(prev => {
      if (prev) hdx.addAction("ui.screensaver.dismiss");
      return !prev;
    });
    resetIdle();
  };

  const handleQueryChange = (val: string) => {
    if (val === ADMIN_CODE) {
      setShowNodePicker(true);
      setQuery("");
      setShowResults(false);
      inputRef.current?.blur();
      resetIdle();
      return;
    }
    setQuery(val);
    setFilterCategory(null);
    setFilterDepartment(null);
    if (val.length > 0) startTransition(() => setShowResults(true));
    resetIdle();
    // Debounce typed search tracking — fire 1s after user stops typing
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (val.length > 1) {
      searchDebounceRef.current = setTimeout(() => {
        hdx.addAction("ui.search.typed", { query: val });
      }, 1000);
    }
  };

  const handleClear = () => {
    if (query.length > 0) hdx.addAction("ui.search.clear", { query });
    setQuery("");
    setFilterCategory(null);
    setFilterDepartment(null);
    setShowResults(false);
    inputRef.current?.blur();
    resetIdle();
  };

  const handlePopularSelect = (text: string) => {
    hdx.addAction("ui.search.popular", { query: text });
    setQuery(text);
    setFilterCategory(null);
    setFilterDepartment(null);
    setShowResults(true);
    resetIdle();
  };

  const handleCategorySelect = (cat: Category) => {
    hdx.addAction("ui.search.category", { category: cat.title, categoryId: cat.id });
    setQuery(cat.title);
    setFilterCategory(cat.id);
    setFilterDepartment(null);
    setShowResults(true);
    resetIdle();
  };

  const handleDepartmentSelect = (dept: string) => {
    hdx.addAction("ui.search.department", { department: dept });
    setQuery(dept);
    setFilterDepartment(dept);
    setFilterCategory(null);
    setShowResults(true);
    resetIdle();
  };

  const openMap = (locationId: number, locationTitle: string) => {
    // Check kiosk is provisioned
    const rawNodeId = typeof window !== "undefined" ? localStorage.getItem(KIOSK_NODE_KEY) : null;
    if (!rawNodeId) {
      setNotProvisionedAlert(true);
      return;
    }

    // Find unique floors for this location
    const locationNodes = nodes.filter(n => n.location === locationId);
    const seenLevels = new Set<number>();
    const floors: FloorOption[] = [];
    for (const node of locationNodes) {
      if (!seenLevels.has(node.level)) {
        seenLevels.add(node.level);
        const level = levels[node.level];
        if (level) floors.push({ levelId: node.level, title: level.title, label: level.label, code: level.code });
      }
    }

    if (floors.length >= 2) {
      setFloorPicker({ locationId, floors });
    } else {
      hdx.addAction("ui.map.navigate", { destinationId: locationId, locationTitle });
      setMapDestinationId(locationId);
      setMapMounted(true);
    }
    resetIdle();
  };

  const handleLocationSelect = (id: number) => {
    const loc = locations.find(l => l.id === id);
    const locationTitle = loc?.title ?? "";
    hdx.addAction("ui.location.tap", { locationId: id, locationTitle });
    openMap(id, locationTitle);
  };

  const handleStaffSelect = (s: Staff) => {
    hdx.addAction("ui.staff.select", { staffName: s.fullName, department: s.department, designation: s.designation });
    const loc = locations.find(l => l.venue === s.lotID);
    if (loc) {
      hdx.addAction("ui.location.tap", { locationId: loc.id, locationTitle: loc.title });
      openMap(loc.id, loc.title);
    } else {
      setNoNodeAlert(true);
    }
    resetIdle();
  };

  const handleMapClose = () => {
    hdx.addAction("ui.map.close");
    setMapDestinationId(null);
    setMapTargetFloorCode(null);
    resetIdle();
  };

  const handleTabChange = (i: number) => {
    hdx.addAction("ui.tab.change", { tab: TABS_DEFAULT[i], index: i });
    setTab(i);
    handleClear();
  };

  const cacheWatermark = loaded && lastRefreshed === null && (
    <div style={{
      position: "fixed", bottom: 6, left: 0, right: 0, zIndex: 89,
      textAlign: "center", fontSize: 10, color: "#aaa",
      pointerEvents: "none", letterSpacing: 0.3,
    }}>
      cached version
    </div>
  );

  const pullIndicator = portalMounted ? createPortal(
    <div
      ref={pullSpinnerRef}
      style={{
        position: "fixed", top: 18, left: 0, right: 0,
        display: "flex", justifyContent: "center",
        opacity: 0, zIndex: 9999, pointerEvents: "none",
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        border: "3px solid #dce3f5",
        borderTopColor: "var(--navy)",
        transformOrigin: "50% 50%",
      }} />
    </div>,
    document.body
  ) : null;

  const overlays = (
    <>
      {/* Screensaver overlay */}
      <Screensaver isExpanded={screensaverExpanded} onTap={handleScreensaverTap} />

      {/* Node picker */}
      {showNodePicker && <NodePickerMap onClose={() => { setShowNodePicker(false); handleClear(); }} />}

      {/* Map overlay — kept mounted once shown so it doesn't re-fetch on every open */}
      {mapMounted && <MapView destinationId={mapDestinationId} targetFloorCode={mapTargetFloorCode} sessionKioskNodeId={urlParams?.from ?? null} onClose={handleMapClose} />}

      {/* "Not provisioned" alert */}
      {notProvisionedAlert && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => setNotProvisionedAlert(false)}
        >
          <div className="bg-white rounded-2xl max-w-xs w-full mx-6 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-4 text-center">
              <p className="text-[17px] font-semibold text-black mb-2">Oops</p>
              <p className="text-[13px] text-[#3c3c43]">This Kiosk has not been provisioned. Please contact Concierge.</p>
            </div>
            <div style={{ borderTop: "0.5px solid #e5e5ea" }}>
              <button
                className="w-full py-3 text-[17px] font-medium"
                style={{ color: "#007aff" }}
                onClick={() => setNotProvisionedAlert(false)}
              >
                Ok
              </button>
            </div>
          </div>
        </div>
      )}

      {noNodeAlert && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => setNoNodeAlert(false)}
        >
          <div className="bg-white rounded-2xl max-w-xs w-full mx-6 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-4 text-center">
              <p className="text-[17px] font-semibold text-black mb-2">Oops</p>
              <p className="text-[13px] text-[#3c3c43]">Navigation is not available for this location.</p>
            </div>
            <div style={{ borderTop: "0.5px solid #e5e5ea" }}>
              <button
                className="w-full py-3 text-[17px] font-medium"
                style={{ color: "#007aff" }}
                onClick={() => setNoNodeAlert(false)}
              >
                Ok
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Off-hours black screen — sits above everything including screensaver.
          Touch wakes the kiosk (same as tapping the screensaver). After idle
          timeout fires and screensaverExpanded returns to true, it reappears. */}
      {isOffHours && screensaverExpanded && portalMounted && createPortal(
        <div
          style={{ position: "fixed", inset: 0, background: "#000", zIndex: 300 }}
          onTouchStart={e => e.stopPropagation()}
          onTouchEnd={e => {
            // preventDefault stops the browser generating a synthetic click after touchEnd,
            // preventing click-through to buttons beneath when the overlay unmounts.
            e.preventDefault();
            e.stopPropagation();
            handleScreensaverTap();
          }}
          onMouseDown={e => { e.stopPropagation(); handleScreensaverTap(); }}
          onClick={e => e.stopPropagation()}
        />,
        document.body
      )}

      {/* Floor picker */}
      {floorPicker && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => setFloorPicker(null)}
        >
          <div className="bg-white rounded-2xl max-w-xs w-full mx-6 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-3 text-center">
              <p className="text-[17px] font-semibold text-black">To which floor?</p>
            </div>
            {floorPicker.floors.map((floor) => (
              <div key={floor.levelId}>
                <div style={{ borderTop: "0.5px solid #e5e5ea" }} />
                <button
                  className="w-full py-3 text-[17px]"
                  style={{ color: "#007aff" }}
                  onClick={() => {
                    const locTitle = locations.find(l => l.id === floorPicker.locationId)?.title ?? "";
                    hdx.addAction("ui.map.navigate", { destinationId: floorPicker.locationId, locationTitle: locTitle, floorCode: floor.code });
                    setMapDestinationId(floorPicker.locationId);
                    setMapTargetFloorCode(floor.code);
                    setMapMounted(true);
                    setFloorPicker(null);
                    resetIdle();
                  }}
                >
                  {floor.title} ({floor.label})
                </button>
              </div>
            ))}
            <div style={{ borderTop: "0.5px solid #e5e5ea" }} />
            <button
              className="w-full py-3 text-[17px] font-medium"
              style={{ color: "#ff3b30" }}
              onClick={() => setFloorPicker(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );

  const compact = !!urlParams;

  const content = showResults ? (
    <SearchResults
      query={deferredSearchQuery}
      filterCategory={deferredSearchFilterCategory}
      filterDepartment={deferredSearchFilterDepartment}
      onLocationSelect={handleLocationSelect}
      onStaffSelect={handleStaffSelect}
    />
  ) : (
    <>
      {tab === 0 && <PopularTab onSelect={handlePopularSelect} compact={compact} />}
      {tab === 1 && <FacilitiesTab onSelect={handleCategorySelect} compact={compact} />}
      {tab === 2 && <DepartmentsTab onSelect={handleDepartmentSelect} compact={compact} />}
    </>
  );

  if (isV1) {
    return (
      <div className="relative h-full flex flex-col overflow-hidden" style={{ background: "var(--bg)" }} onPointerDown={resetIdle}>
        {overlays}
        {pullIndicator}
        {cacheWatermark}
        <div ref={pageRef} className="flex flex-col flex-1 overflow-hidden" style={{ willChange: "transform" }}>

        {/* V1 Header: Navy bar with branding + search */}
        <div className="v1-header">
          <div className="v1-brand">
            <span className="v1-brand-name">Sunway University</span>
            <span className="v1-brand-sub">Campus Directory</span>
          </div>
          <div className="v1-search-row">
            <input
              ref={inputRef}
              className="v1-search"
              placeholder="Search facilities, offices, staff…"
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              onFocus={resetIdle}
            />
            <button onClick={handleClear} className="v1-clear">Clear</button>
          </div>
        </div>

        {/* V1 Tab bar */}
        {!showResults && (
          <div className="v1-tabs">
            {TABS_V1.map((t, i) => (
              <button key={t} className={`v1-tab${tab === i ? " active" : ""}`} onClick={() => handleTabChange(i)}>
                {TAB_LINES_V1[i].map((line, li) => (
                  <span key={li}>{line}{li < TAB_LINES_V1[i].length - 1 ? <br /> : null}</span>
                ))}
              </button>
            ))}
          </div>
        )}

        {content}

        {!showResults && (
          <div className="text-center pb-4 flex-shrink-0" style={{ fontSize: 11, color: "#aeaeb2", lineHeight: 1.8 }}>
            <p>Version 1.0 Build #31</p>
            <p>Refreshed {formatKLTime(pageLoadTime)}</p>
            <p>-</p>
            <p>Data {formatTimestamp(lastRefreshed)}</p>
            <p>Since {formatTimestamp(lastStaffRefreshed)}</p>
          </div>
        )}
        </div>{/* end pageRef */}
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col bg-white overflow-hidden" onPointerDown={resetIdle}>
      {overlays}
      {pullIndicator}
      {cacheWatermark}
      <div ref={pageRef} className="flex flex-col flex-1 overflow-hidden" style={{ willChange: "transform" }}>

      {/* Search bar — reduced top padding in mobile QR mode */}
      <div className={`flex items-center gap-2 px-4 ${urlParams ? "pt-3" : "pt-8"} pb-2 flex-shrink-0`}>
        <input
          ref={inputRef}
          className="search-bar"
          placeholder="Tap Here To Search"
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          onFocus={resetIdle}
        />
        <button
          onClick={handleClear}
          className="flex-shrink-0 px-4 py-2 rounded-lg text-white text-[15px] font-medium"
          style={{ backgroundColor: "var(--navy)" }}
        >
          Clear
        </button>
      </div>

      {/* Segment control — hidden when showing results */}
      {!showResults && (
        <div className="px-4 pb-3 flex-shrink-0">
          <div className="segment-control">
            {TABS_DEFAULT.map((t, i) => (
              <button
                key={t}
                className={`segment-btn ${tab === i ? "active" : ""}`}
                onClick={() => handleTabChange(i)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {content}

      {/* Bottom app download banner — Pyramid style. Only on home, not in search/URL-param mode */}
      {!showResults && !urlParams && (
        <FooterBanner />
      )}

      {/* Footer version info — hidden in mobile QR mode */}
      {!showResults && tab === 0 && !urlParams && (
        <div className="text-center pb-3 text-[11px] text-[#aeaeb2] flex-shrink-0">
          <p>Version 1.0 Build #31</p>
          <p>Refreshed {formatKLTime(pageLoadTime)}</p>
        </div>
      )}
      </div>{/* end pageRef */}
    </div>
  );
}
