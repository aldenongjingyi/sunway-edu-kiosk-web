"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDataStore } from "@/lib/store";
import PopularTab from "./PopularTab";
import FacilitiesTab from "./FacilitiesTab";
import DepartmentsTab from "./DepartmentsTab";
import EventsTab from "./EventsTab";
import SearchResults from "./SearchResults";
import Screensaver from "./Screensaver";
import AdminPanel from "./AdminPanel";
import MapView from "./MapView";
import type { Category, Staff } from "@/lib/types";

const IDLE_SECONDS = 20;
const ADMIN_CODE = "my3245campusx";
const KIOSK_NODE_KEY = "admin.kiosk.nodeId";
const WORKING_START_KEY = "admin.working.start";
const WORKING_END_KEY   = "admin.working.end";
const TABS = ["Popular Searches", "Facilities / Offices", "Departments / Staffs", "Events"] as const;

// TODO: re-enable working hours enforcement before production deployment
function checkWorkingHours(): boolean {
  return true; // disabled — always treat as working hours
}

interface FloorOption {
  levelId: number;
  title: string;
  label: string;
}

export default function KioskShell() {
  const { loadData, loadStaff, locations, nodes, levels } = useDataStore();

  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<number | null>(null);
  const [filterDepartment, setFilterDepartment] = useState<string | null>(null);
  const [screensaverExpanded, setScreensaverExpanded] = useState(false);
  const [withinWorkingHours, setWithinWorkingHours] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [mapDestinationId, setMapDestinationId] = useState<number | null>(null);
  const [mapMounted, setMapMounted] = useState(false);
  const [notProvisionedAlert, setNotProvisionedAlert] = useState(false);
  const [floorPicker, setFloorPicker] = useState<{ locationId: number; floors: FloorOption[] } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load data on mount, expand screensaver once highlights are ready
  // Also reopen admin panel if we just reloaded after saving a kiosk node
  useEffect(() => {
    if (sessionStorage.getItem("admin.reopen")) {
      sessionStorage.removeItem("admin.reopen");
      setShowAdmin(true);
    }
    loadData().then(() => {
      loadStaff();
      setScreensaverExpanded(true);
    });
  }, [loadData, loadStaff]);

  // Working hours check — runs every minute
  useEffect(() => {
    const check = () => setWithinWorkingHours(checkWorkingHours());
    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Reset idle timer
  const resetIdle = useCallback(() => {
    if (idleRef.current) clearTimeout(idleRef.current);
    idleRef.current = setTimeout(() => {
      setScreensaverExpanded(true);
      setQuery("");
      setFilterCategory(null);
      setFilterDepartment(null);
      setShowResults(false);
      setTab(0);
      setMapDestinationId(null); // close map on idle
      setNotProvisionedAlert(false);
      setFloorPicker(null);
      inputRef.current?.blur();
    }, IDLE_SECONDS * 1000);
  }, []);

  // Track any user interaction
  useEffect(() => {
    const events = ["touchstart", "mousedown", "keydown", "mousemove"];
    events.forEach(e => window.addEventListener(e, resetIdle, { passive: true }));
    resetIdle();
    return () => events.forEach(e => window.removeEventListener(e, resetIdle));
  }, [resetIdle]);

  const handleScreensaverTap = () => {
    if (!withinWorkingHours) return; // outside hours: black screen can't be dismissed
    setScreensaverExpanded(prev => !prev);
    resetIdle();
  };

  const handleQueryChange = (val: string) => {
    if (val === ADMIN_CODE) {
      setShowAdmin(true);
      setQuery("");
      inputRef.current?.blur();
      return;
    }
    setQuery(val);
    setFilterCategory(null);
    setFilterDepartment(null);
    setShowResults(val.length > 0);
    resetIdle();
  };

  const handleClear = () => {
    setQuery("");
    setFilterCategory(null);
    setFilterDepartment(null);
    setShowResults(false);
    inputRef.current?.blur();
  };

  const handlePopularSelect = (text: string) => {
    setQuery(text);
    setFilterCategory(null);
    setFilterDepartment(null);
    setShowResults(true);
    resetIdle();
  };

  const handleCategorySelect = (cat: Category) => {
    setQuery(cat.title);
    setFilterCategory(cat.id);
    setFilterDepartment(null);
    setShowResults(true);
    resetIdle();
  };

  const handleDepartmentSelect = (dept: string) => {
    setQuery(dept);
    setFilterDepartment(dept);
    setFilterCategory(null);
    setShowResults(true);
    resetIdle();
  };

  const openMap = (locationId: number) => {
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
        if (level) floors.push({ levelId: node.level, title: level.title, label: level.label });
      }
    }

    if (floors.length >= 2) {
      setFloorPicker({ locationId, floors });
    } else {
      setMapDestinationId(locationId);
      setMapMounted(true);
    }
    resetIdle();
  };

  const handleLocationSelect = (id: number) => openMap(id);

  const handleStaffSelect = (s: Staff) => {
    const loc = locations.find(l => l.venue === s.lotID);
    if (loc) openMap(loc.id);
    resetIdle();
  };

  const handleMapClose = () => {
    setMapDestinationId(null);
    resetIdle();
  };

  const handleTabChange = (i: number) => {
    setTab(i);
    handleClear();
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden" onPointerDown={resetIdle}>

      {/* Screensaver overlay */}
      <Screensaver isExpanded={screensaverExpanded} onTap={handleScreensaverTap} isWorkingHours={withinWorkingHours} />

      {/* Admin panel */}
      {showAdmin && <AdminPanel
        onClose={() => { setShowAdmin(false); setQuery(""); }}
      />}

      {/* Map overlay — kept mounted once shown so it doesn't re-fetch on every open */}
      {mapMounted && <MapView destinationId={mapDestinationId} onClose={handleMapClose} />}

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
            {floorPicker.floors.map((floor, i) => (
              <div key={floor.levelId}>
                <div style={{ borderTop: "0.5px solid #e5e5ea" }} />
                <button
                  className="w-full py-3 text-[17px]"
                  style={{ color: "#007aff" }}
                  onClick={() => {
                    setMapDestinationId(floorPicker.locationId);
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

      {/* Search bar */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 flex-shrink-0">
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
            {TABS.map((t, i) => (
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

      {/* Content area */}
      {showResults ? (
        <SearchResults
          query={query}
          filterCategory={filterCategory}
          filterDepartment={filterDepartment}
          onLocationSelect={handleLocationSelect}
          onStaffSelect={handleStaffSelect}
        />
      ) : (
        <>
          {tab === 0 && <PopularTab onSelect={handlePopularSelect} />}
          {tab === 1 && <FacilitiesTab onSelect={handleCategorySelect} />}
          {tab === 2 && <DepartmentsTab onSelect={handleDepartmentSelect} />}
          {tab === 3 && <EventsTab />}
        </>
      )}

      {/* Footer version info */}
      {!showResults && tab === 0 && (
        <div className="text-center pb-3 text-[11px] text-[#aeaeb2] flex-shrink-0">
          <p>Version 1.0 Build #14</p>
        </div>
      )}
    </div>
  );
}
