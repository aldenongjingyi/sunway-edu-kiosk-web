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

  useEffect(() => {
    loadData().then(() => {
      loadStaff();
      setScreensaverExpanded(true);
    });
  }, [loadData, loadStaff]);

  useEffect(() => {
    const check = () => setWithinWorkingHours(checkWorkingHours());
    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, []);

  const resetIdle = useCallback(() => {
    if (idleRef.current) clearTimeout(idleRef.current);
    idleRef.current = setTimeout(() => {
      setScreensaverExpanded(true);
      setQuery("");
      setFilterCategory(null);
      setFilterDepartment(null);
      setShowResults(false);
      setTab(0);
      setMapDestinationId(null);
      setNotProvisionedAlert(false);
      setFloorPicker(null);
      inputRef.current?.blur();
    }, IDLE_SECONDS * 1000);
  }, []);

  useEffect(() => {
    const events = ["touchstart", "mousedown", "keydown", "mousemove"];
    events.forEach(e => window.addEventListener(e, resetIdle, { passive: true }));
    resetIdle();
    return () => events.forEach(e => window.removeEventListener(e, resetIdle));
  }, [resetIdle]);

  const handleScreensaverTap = () => {
    if (!withinWorkingHours) return;
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
    const rawNodeId = typeof window !== "undefined" ? localStorage.getItem(KIOSK_NODE_KEY) : null;
    if (!rawNodeId) {
      setNotProvisionedAlert(true);
      return;
    }
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

  const TAB_LABELS = ["Popular", "Facilities", "Departments", "Events"];

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden" onPointerDown={resetIdle}>

      {/* Screensaver overlay */}
      <Screensaver isExpanded={screensaverExpanded} onTap={handleScreensaverTap} isWorkingHours={withinWorkingHours} />

      {/* Admin panel */}
      {showAdmin && <AdminPanel onClose={() => { setShowAdmin(false); setQuery(""); }} />}

      {/* Map overlay */}
      {mapMounted && <MapView destinationId={mapDestinationId} onClose={handleMapClose} />}

      {/* Not provisioned alert */}
      {notProvisionedAlert && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={() => setNotProvisionedAlert(false)}>
          <div className="bg-white rounded-2xl max-w-xs w-full mx-6 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-4 text-center">
              <p className="text-[17px] font-semibold text-black mb-2">Oops</p>
              <p className="text-[13px] text-[#3c3c43]">This Kiosk has not been provisioned. Please contact Concierge.</p>
            </div>
            <div style={{ borderTop: "0.5px solid #e5e5ea" }}>
              <button className="w-full py-3 text-[17px] font-medium" style={{ color: "#007aff" }} onClick={() => setNotProvisionedAlert(false)}>Ok</button>
            </div>
          </div>
        </div>
      )}

      {/* Floor picker */}
      {floorPicker && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={() => setFloorPicker(null)}>
          <div className="bg-white rounded-2xl max-w-xs w-full mx-6 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-3 text-center">
              <p className="text-[17px] font-semibold text-black">To which floor?</p>
            </div>
            {floorPicker.floors.map((floor) => (
              <div key={floor.levelId}>
                <div style={{ borderTop: "0.5px solid #e5e5ea" }} />
                <button className="w-full py-3 text-[17px]" style={{ color: "#007aff" }}
                  onClick={() => { setMapDestinationId(floorPicker.locationId); setMapMounted(true); setFloorPicker(null); resetIdle(); }}>
                  {floor.title} ({floor.label})
                </button>
              </div>
            ))}
            <div style={{ borderTop: "0.5px solid #e5e5ea" }} />
            <button className="w-full py-3 text-[17px] font-medium" style={{ color: "#ff3b30" }} onClick={() => setFloorPicker(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── V2 Slim header ── */}
      <div className="v2-header">
        <div>
          <p className="v2-wordmark">Sunway University</p>
          <p className="v2-wordmark-sub">Campus Directory</p>
        </div>
        {!showResults && tab === 0 && (
          <p style={{ fontSize: 11, color: "#aeaeb2" }}>v1.0 #14</p>
        )}
      </div>

      {/* ── V2 Hero search bar ── */}
      <div className="v2-search-zone">
        <div className="v2-search-wrap">
          <svg className="v2-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/>
            <path d="m16.5 16.5 3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            className="v2-search"
            placeholder="Search facilities, staff, departments…"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            onFocus={resetIdle}
          />
          {query.length > 0 && (
            <button onClick={handleClear} className="v2-clear">Clear</button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden flex flex-col">
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
      </div>

      {/* ── V2 Bottom tab bar ── */}
      {!showResults && (
        <div className="v2-tabbar">
          {TAB_LABELS.map((label, i) => (
            <button key={label} className={`v2-tab-btn${tab === i ? " active" : ""}`} onClick={() => handleTabChange(i)}>
              <div className="v2-tab-dot" />
              <span className="v2-tab-label">{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
