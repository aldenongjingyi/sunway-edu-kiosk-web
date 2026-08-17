"use client";
import { useRef, useState } from "react";
import { useDataStore } from "@/lib/store";

interface Props {
  onClose: () => void;
}

const KIOSK_NODE_KEY = "admin.kiosk.nodeId";

export default function AdminPanel({ onClose }: Props) {
  const { loaded, locations, nodes, levels } = useDataStore();

  const [kioskNodeId, setKioskNodeId] = useState(() => localStorage?.getItem(KIOSK_NODE_KEY) ?? "");
  const [nodeSearch, setNodeSearch] = useState("");
  const [nodePickerOpen, setNodePickerOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
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

