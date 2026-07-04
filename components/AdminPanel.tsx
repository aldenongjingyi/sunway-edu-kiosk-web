"use client";
import { useEffect, useRef, useState } from "react";
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
  const { loaded, staffLoaded, locations, nodes, levels, staffs, highlights, trendings, loadData, loadStaff } = useDataStore();

  const [workingStart, setWorkingStart] = useState(() =>
    minutesToTime(parseInt(localStorage?.getItem(WORKING_START_KEY) ?? "450")) // 7:30
  );
  const [workingEnd, setWorkingEnd] = useState(() =>
    minutesToTime(parseInt(localStorage?.getItem(WORKING_END_KEY) ?? "1170")) // 19:30
  );
  const [kioskNodeId, setKioskNodeId] = useState(() => localStorage?.getItem(KIOSK_NODE_KEY) ?? "");
  const [cacheStatus, setCacheStatus] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

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
            <p className="text-[12px] font-semibold text-[#6b6b6b] uppercase tracking-wide mb-3">Data Status</p>
            <div className="bg-[#f2f2f7] rounded-xl overflow-hidden">
              <Row label="Locations" value={loaded ? String(locations.length) : "—"} />
              <div className="divider-full" />
              <Row label="Staff" value={staffLoaded ? String(staffs.length) : "—"} />
              <div className="divider-full" />
              <Row label="Highlights" value={loaded ? String(highlights.length) : "—"} />
              <div className="divider-full" />
              <Row label="Trending" value={loaded ? String(trendings.length) : "—"} />
            </div>
          </section>

          {/* Working hours */}
          <section>
            <p className="text-[12px] font-semibold text-[#6b6b6b] uppercase tracking-wide mb-3">Working Hours</p>
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

          {/* Map integration */}
          <section>
            <p className="text-[12px] font-semibold text-[#6b6b6b] uppercase tracking-wide mb-1">Map Integration</p>
            <p className="text-[12px] text-[#8e8e93] mb-3">
              Kiosk nodes are sourced from indoorcms.com — filtered to locations whose venue code contains &ldquo;KIOSK&rdquo;.
            </p>
            <div className="bg-[#f2f2f7] rounded-xl overflow-hidden">
              <div className="flex items-center px-4 py-3 gap-3">
                <span className="flex-1 text-[15px] text-black">This Kiosk</span>
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

                  if (!loaded) return <span className="text-[14px] text-[#8e8e93]">Loading…</span>;
                  if (kioskNodes.length === 0) return <span className="text-[14px] text-[#8e8e93]">No kiosk nodes found</span>;

                  return (
                    <select
                      value={kioskNodeId}
                      onChange={e => setKioskNodeId(e.target.value)}
                      className="text-[14px] text-[#00226B] bg-transparent border-none outline-none font-medium max-w-[60%] text-right"
                    >
                      <option value="">Select…</option>
                      {kioskNodes.map(k => (
                        <option key={k.nodeId} value={String(k.nodeId)}>
                          {k.venue} (Node {k.nodeId})
                        </option>
                      ))}
                    </select>
                  );
                })()}
              </div>
            </div>
            <button
              onClick={() => {
                localStorage.setItem(KIOSK_NODE_KEY, kioskNodeId);
                setCacheStatus("Kiosk node saved.");
                setTimeout(() => setCacheStatus(""), 2000);
              }}
              className="mt-2 w-full py-3 rounded-xl text-white text-[15px] font-medium"
              style={{ backgroundColor: "var(--navy)" }}
            >
              Save Node ID
            </button>
            <p className="text-[12px] text-[#8e8e93] mt-2 text-center">
              Sets the &ldquo;You Are Here&rdquo; start point for directions
            </p>
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
