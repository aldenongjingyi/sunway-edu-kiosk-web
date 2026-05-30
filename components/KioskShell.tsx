"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDataStore } from "@/lib/store";
import PopularTab from "./PopularTab";
import FacilitiesTab from "./FacilitiesTab";
import DepartmentsTab from "./DepartmentsTab";
import SearchResults from "./SearchResults";
import Screensaver from "./Screensaver";
import AdminPanel from "./AdminPanel";
import type { Category, Staff } from "@/lib/types";

const IDLE_SECONDS = 20;
const ADMIN_CODE = "my3245campusx";
const TABS = ["Popular Searches", "Facilities / Offices", "Departments / Staffs"] as const;

export default function KioskShell() {
  const { loadData, loadStaff } = useDataStore();

  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<number | null>(null);
  const [filterDepartment, setFilterDepartment] = useState<string | null>(null);
  const [screensaverExpanded, setScreensaverExpanded] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load data on mount, expand screensaver once highlights are ready
  useEffect(() => {
    loadData().then(() => {
      loadStaff();
      setScreensaverExpanded(true);
    });
  }, [loadData, loadStaff]);

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
    setScreensaverExpanded(prev => !prev);
    resetIdle();
  };

  const handleQueryChange = (val: string) => {
    // Check for admin code
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

  const handleStaffSelect = (_s: Staff) => {
    // TODO: hand off to web map with _s.lotID as destination
    resetIdle();
  };

  const handleTabChange = (i: number) => {
    setTab(i);
    handleClear();
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden" onPointerDown={resetIdle}>

      {/* Screensaver overlay */}
      <Screensaver isExpanded={screensaverExpanded} onTap={handleScreensaverTap} />

      {/* Admin panel */}
      {showAdmin && <AdminPanel onClose={() => { setShowAdmin(false); setQuery(""); }} />}

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
          onStaffSelect={handleStaffSelect}
        />
      ) : (
        <>
          {tab === 0 && <PopularTab onSelect={handlePopularSelect} />}
          {tab === 1 && <FacilitiesTab onSelect={handleCategorySelect} />}
          {tab === 2 && <DepartmentsTab onSelect={handleDepartmentSelect} />}
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
