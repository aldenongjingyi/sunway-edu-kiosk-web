"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useDataStore } from "@/lib/store";

interface Props {
  onClose: () => void;
}

const WORKING_START_KEY = "admin.working.start";
const WORKING_END_KEY   = "admin.working.end";
const KIOSK_NODE_KEY    = "admin.kiosk.nodeId";

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export default function AdminPanel({ onClose }: Props) {
  const { loaded, staffLoaded, locations, nodes, levels, staffs, highlights, trendings, lastRefreshed, lastStaffRefreshed, loadData, loadStaff, design, setDesign } = useDataStore();

  const [workingStart, setWorkingStart] = useState(() =>
    minutesToTime(parseInt(localStorage?.getItem(WORKING_START_KEY) ?? "450")) // 7:30
  );
  const [workingEnd, setWorkingEnd] = useState(() =>
    minutesToTime(parseInt(localStorage?.getItem(WORKING_END_KEY) ?? "1170")) // 19:30
  );
  const [kioskNodeId, setKioskNodeId] = useState(() => localStorage?.getItem(KIOSK_NODE_KEY) ?? "");
  const [nodeSearch, setNodeSearch] = useState("");
  const [nodePickerOpen, setNodePickerOpen] = useState(false);
  const [cacheStatus, setCacheStatus] = useState("");
  const [, setTick] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // Tick every 30s so relative timestamps stay fresh
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const relativeTime = useCallback((date: Date | null) => {
    if (!date) return "—";
    const secs = Math.floor((Date.now() - date.getTime()) / 1000);
    if (secs < 60) return "just now";
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return date.toLocaleDateString();
  }, []);

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSaveHours = () => {
    localStorage.setItem(WORKING_START_KEY, String(timeToMinutes(workingStart)));
    localStorage.setItem(WORKING_END_KEY,   String(timeToMinutes(workingEnd)));
    setCacheStatus("Working hours saved.");
    setTimeout(() => setCacheStatus(""), 2000);
  };

  const handleClearCache = async () => {
    setCacheStatus("Refreshing data...");
    // Force re-fetch by resetting loaded flags in store
    useDataStore.setState({ loaded: false, staffLoaded: false, locations: [], staffs: [], highlights: [], trendings: [] });
    try {
      await loadData();
      await loadStaff();
      setCacheStatus("Data refreshed successfully.");
    } catch {
      setCacheStatus("Refresh failed.");
    }
    setTimeout(() => setCacheStatus(""), 3000);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={handleBackdrop}
    >
      <div
        ref={panelRef}
        className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden slide-up"
        style={{ maxHeight: "85vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e5ea]">
          <span className="text-[17px] font-semibold text-black">Admin Settings</span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#f2f2f7] flex items-center justify-center"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="#6b6b6b" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="ios-scroll px-5 py-4 space-y-6" style={{ maxHeight: "calc(85vh - 60px)" }}>

          {/* Data status */}
          <section>
            <p className="text-[12px] font-semibold text-[#6b6b6b] uppercase tracking-wide mb-1">Data Status</p>
            <p className="text-[12px] text-[#8e8e93] mb-3">Records currently loaded in memory from indoorcms.com and izone.sunway.edu.my. Use Refresh API Data below to update.</p>
            <div className="bg-[#f2f2f7] rounded-xl overflow-hidden">
              <Row label="Locations" value={loaded ? String(locations.length) : "—"} />
              <div className="divider-full" />
              <Row label="Staff" value={staffLoaded ? String(staffs.length) : "—"} />
              <div className="divider-full" />
              <Row label="Highlights" value={loaded ? String(highlights.length) : "—"} />
              <div className="divider-full" />
              <Row label="Trending" value={loaded ? String(trendings.length) : "—"} />
              <div className="divider-full" />
              <Row label="Campus data fetched" value={relativeTime(lastRefreshed)} muted />
              <div className="divider-full" />
              <Row label="Staff data fetched" value={relativeTime(lastStaffRefreshed)} muted />
            </div>
          </section>

          {/* Working hours */}
          <section>
            <p className="text-[12px] font-semibold text-[#6b6b6b] uppercase tracking-wide mb-1">Working Hours</p>
            <p className="text-[12px] text-[#8e8e93] mb-3">Outside these hours the kiosk displays a black lockscreen that cannot be dismissed. Currently disabled for development.</p>
            <div className="bg-[#f2f2f7] rounded-xl overflow-hidden">
              <div className="flex items-center px-4 py-3 gap-3">
                <span className="flex-1 text-[15px] text-black">Start</span>
                <input
                  type="time"
                  value={workingStart}
                  onChange={e => setWorkingStart(e.target.value)}
                  className="text-[15px] text-[#00226B] bg-transparent border-none outline-none font-medium"
                />
              </div>
              <div className="divider-full" />
              <div className="flex items-center px-4 py-3 gap-3">
                <span className="flex-1 text-[15px] text-black">End</span>
                <input
                  type="time"
                  value={workingEnd}
                  onChange={e => setWorkingEnd(e.target.value)}
                  className="text-[15px] text-[#00226B] bg-transparent border-none outline-none font-medium"
                />
              </div>
            </div>
            <button
              onClick={handleSaveHours}
              className="mt-2 w-full py-3 rounded-xl text-white text-[15px] font-medium"
              style={{ backgroundColor: "var(--navy)" }}
            >
              Save Hours
            </button>
          </section>

          {/* Cache */}
          <section>
            <p className="text-[12px] font-semibold text-[#6b6b6b] uppercase tracking-wide mb-1">Refresh API Data</p>
            <p className="text-[12px] text-[#8e8e93] mb-3">Re-fetches from indoorcms.com (locations, nodes, highlights, trending) and izone.sunway.edu.my (staff directory). Does not affect this device or the map.</p>
            <button
              onClick={handleClearCache}
              className="w-full py-3 rounded-xl text-white text-[15px] font-medium"
              style={{ backgroundColor: "var(--navy)" }}
            >
              Refresh API Data
            </button>
            {cacheStatus && (
              <p className="text-center text-[13px] text-[#6b6b6b] mt-2 fade-in">{cacheStatus}</p>
            )}
          </section>

          {/* UI Design */}
          <section>
            <p className="text-[12px] font-semibold text-[#6b6b6b] uppercase tracking-wide mb-1">UI Design</p>
            <p className="text-[12px] text-[#8e8e93] mb-3">Switch between the default iOS-style layout and the V1 airport-kiosk style layout. Takes effect immediately.</p>
            <div className="flex gap-2">
              <button
                onClick={() => { setDesign("default"); onClose(); }}
                className="flex-1 py-3 rounded-xl text-[15px] font-medium border"
                style={{
                  backgroundColor: design === "default" ? "var(--navy)" : "transparent",
                  color: design === "default" ? "#fff" : "var(--navy)",
                  borderColor: "var(--navy)",
                }}
              >
                Default
              </button>
              <button
                onClick={() => { setDesign("v1"); onClose(); }}
                className="flex-1 py-3 rounded-xl text-[15px] font-medium border"
                style={{
                  backgroundColor: design === "v1" ? "var(--navy)" : "transparent",
                  color: design === "v1" ? "#fff" : "var(--navy)",
                  borderColor: "var(--navy)",
                }}
              >
                V1 (Airport)
              </button>
            </div>
          </section>

          {/* Map integration */}
          <section>
            <p className="text-[12px] font-semibold text-[#6b6b6b] uppercase tracking-wide mb-1">Map Integration</p>
            <p className="text-[12px] text-[#8e8e93] mb-3">
              Kiosk nodes are sourced from indoorcms.com — filtered to locations whose venue code contains &ldquo;KIOSK&rdquo;.
            </p>
            {(() => {
              const kioskNodes = nodes
                .filter(n => {
                  if (!n.location) return false;
                  const loc = locations.find(l => l.id === n.location);
                  return loc?.venue?.toUpperCase().includes("KIOSK");
                })
                .map(n => {
                  const loc = locations.find(l => l.id === n.location);
                  const level = levels[n.level];
                  return { nodeId: n.id, venue: loc?.venue ?? "", levelLabel: level?.label ?? "", levelTitle: level?.title ?? "" };
                })
                .sort((a, b) => a.venue.localeCompare(b.venue));

              const filtered = kioskNodes.filter(k =>
                nodeSearch === "" ||
                k.venue.toLowerCase().includes(nodeSearch.toLowerCase()) ||
                String(k.nodeId).includes(nodeSearch)
              );

              const selected = kioskNodes.find(k => String(k.nodeId) === kioskNodeId);

              return (
                <div className="bg-[#f2f2f7] rounded-xl overflow-hidden">
                  {/* Selected node display — tap to toggle picker */}
                  <button
                    className="w-full flex items-center px-4 py-3 gap-3 text-left"
                    onClick={() => setNodePickerOpen(o => !o)}
                  >
                    <span className="flex-1 text-[15px] text-black">Selected</span>
                    <span className="text-[14px] text-[#00226B] font-medium">
                      {selected ? `${selected.venue} (Node ${selected.nodeId})` : "None"}
                    </span>
                    <svg
                      width="12" height="12" viewBox="0 0 12 12" fill="none"
                      style={{ transform: nodePickerOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
                      className="flex-shrink-0 opacity-40 ml-1"
                    >
                      <path d="M2 4l4 4 4-4" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  {nodePickerOpen && (<>
                    {/* Search input */}
                    <div className="flex items-center px-4 py-2 gap-2 border-t border-[#e5e5ea]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 opacity-40">
                        <circle cx="11" cy="11" r="7" stroke="#000" strokeWidth="2"/>
                        <path d="m16.5 16.5 3 3" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      <input
                        type="text"
                        placeholder="Search node ID or venue…"
                        value={nodeSearch}
                        onChange={e => setNodeSearch(e.target.value)}
                        className="flex-1 text-[14px] bg-transparent border-none outline-none text-black placeholder:text-[#8e8e93]"
                      />
                      {nodeSearch && (
                        <button onClick={() => setNodeSearch("")} className="text-[#8e8e93] text-[12px]">✕</button>
                      )}
                    </div>
                    {/* Node list */}
                    <div style={{ maxHeight: 180, overflowY: "auto" }} className="border-t border-[#e5e5ea]">
                      {!loaded && <p className="px-4 py-3 text-[14px] text-[#8e8e93]">Loading…</p>}
                      {loaded && filtered.length === 0 && <p className="px-4 py-3 text-[14px] text-[#8e8e93]">No results</p>}
                      {filtered.map((k, i) => (
                        <div key={k.nodeId}>
                          {i > 0 && <div className="divider-full" />}
                          <button
                            className="w-full flex items-center justify-between px-4 py-3 text-left"
                            onClick={() => { setKioskNodeId(String(k.nodeId)); setNodeSearch(""); setNodePickerOpen(false); }}
                          >
                            <span className="text-[14px] text-black flex-1">{k.venue}</span>
                            <span className="text-[12px] text-[#8e8e93] ml-2">Node {k.nodeId}</span>
                            {String(k.nodeId) === kioskNodeId && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="ml-2 flex-shrink-0">
                                <path d="M5 12l5 5L20 7" stroke="#00226B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </>)}
                </div>
              );
            })()}
            <button
              onClick={() => {
                localStorage.setItem(KIOSK_NODE_KEY, kioskNodeId);
                sessionStorage.setItem("admin.reopen", "1");
                window.location.reload();
              }}
              className="mt-2 w-full py-3 rounded-xl text-white text-[15px] font-medium"
              style={{ backgroundColor: "var(--navy)" }}
            >
              Save Node ID
            </button>
          </section>

          <div className="pb-4" />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center px-4 py-3">
      <span className="flex-1 text-[15px] text-black">{label}</span>
      <span className={`text-[15px] ${muted ? "text-[#8e8e93]" : "text-[#3c3c43]"}`}>{value}</span>
    </div>
  );
}
