"use client";
import { useRef, useState, useMemo } from "react";
import { useDataStore } from "@/lib/store";

interface Props {
  onClose: () => void;
}

const KIOSK_NODE_KEY = "admin.kiosk.nodeId";

export default function AdminPanel({ onClose }: Props) {
  const { loaded, locations, nodes, levels } = useDataStore();

  const [kioskNodeId, setKioskNodeId] = useState(() => localStorage?.getItem(KIOSK_NODE_KEY) ?? "");
  const [nodeSearch, setNodeSearch] = useState("");
  const [expandedLevel, setExpandedLevel] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // All nodes that have a location, enriched with level + location info
  const allNodes = useMemo(() => {
    return nodes
      .filter(n => n.location != null)
      .map(n => {
        const loc = locations.find(l => l.id === n.location);
        const level = levels[n.level];
        return {
          nodeId: n.id,
          locationTitle: loc?.title ?? "",
          venue: loc?.venue ?? "",
          levelId: n.level,
          levelLabel: level?.label ?? "?",
          levelTitle: level?.title ?? "",
          levelOrdinal: level?.ordinal ?? 999,
        };
      })
      .sort((a, b) => a.locationTitle.localeCompare(b.locationTitle));
  }, [nodes, locations, levels]);

  // Group by level, sorted by ordinal (top floor first)
  const byLevel = useMemo(() => {
    const map = new Map<number, typeof allNodes>();
    allNodes.forEach(n => {
      if (!map.has(n.levelId)) map.set(n.levelId, []);
      map.get(n.levelId)!.push(n);
    });
    return [...map.entries()].sort((a, b) => {
      const oa = allNodes.find(n => n.levelId === a[0])?.levelOrdinal ?? 999;
      const ob = allNodes.find(n => n.levelId === b[0])?.levelOrdinal ?? 999;
      return oa - ob;
    });
  }, [allNodes]);

  const searchLower = nodeSearch.toLowerCase();
  const filteredNodes = searchLower
    ? allNodes.filter(n =>
        n.locationTitle.toLowerCase().includes(searchLower) ||
        n.venue.toLowerCase().includes(searchLower) ||
        String(n.nodeId).includes(searchLower)
      )
    : null;

  const selectedNode = allNodes.find(n => String(n.nodeId) === kioskNodeId);

  const NodeRow = ({ n }: { n: typeof allNodes[0] }) => (
    <button
      className="w-full flex items-center px-4 py-3 text-left gap-3"
      onClick={() => { setKioskNodeId(String(n.nodeId)); setNodeSearch(""); }}
    >
      <span className="flex-1 text-[14px] text-black">{n.locationTitle || n.venue || `Node ${n.nodeId}`}</span>
      <span className="text-[12px] text-[#8e8e93] shrink-0">#{n.nodeId}</span>
      {String(n.nodeId) === kioskNodeId && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
          <path d="M5 12l5 5L20 7" stroke="#00226B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  );

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
          <span className="text-[17px] font-semibold text-black">Kiosk Provisioning</span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#f2f2f7] flex items-center justify-center"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="#6b6b6b" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="ios-scroll px-5 py-4 space-y-4" style={{ maxHeight: "calc(85vh - 60px)" }}>

          {/* Currently provisioned */}
          <div className="bg-[#f2f2f7] rounded-xl px-4 py-3">
            <p className="text-[12px] text-[#8e8e93] mb-0.5">Currently provisioned as</p>
            {selectedNode ? (
              <p className="text-[15px] font-semibold text-black">
                {selectedNode.locationTitle || selectedNode.venue}
                <span className="text-[#8e8e93] font-normal ml-2">
                  Node #{selectedNode.nodeId} · {selectedNode.levelTitle}
                </span>
              </p>
            ) : (
              <p className="text-[15px] font-semibold text-[#ff3b30]">Not set — select a node below</p>
            )}
          </div>

          {/* Node picker */}
          <section>
            <p className="text-[12px] font-semibold text-[#6b6b6b] uppercase tracking-wide mb-2">Select Kiosk Node</p>

            {/* Search */}
            <div className="flex items-center bg-[#f2f2f7] rounded-xl px-4 py-2.5 gap-2 mb-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 opacity-40">
                <circle cx="11" cy="11" r="7" stroke="#000" strokeWidth="2"/>
                <path d="m16.5 16.5 3 3" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                placeholder="Search location or node ID…"
                value={nodeSearch}
                onChange={e => setNodeSearch(e.target.value)}
                className="flex-1 text-[14px] bg-transparent border-none outline-none text-black placeholder:text-[#8e8e93]"
              />
              {nodeSearch && (
                <button onClick={() => setNodeSearch("")} className="text-[#8e8e93] text-[12px] shrink-0">✕</button>
              )}
            </div>

            {!loaded && <p className="text-[14px] text-[#8e8e93] px-1">Loading data…</p>}

            {loaded && (
              <div className="bg-[#f2f2f7] rounded-xl overflow-hidden">
                {/* Search results — flat list */}
                {filteredNodes && (
                  filteredNodes.length === 0
                    ? <p className="px-4 py-3 text-[14px] text-[#8e8e93]">No results</p>
                    : filteredNodes.map((n, i) => (
                        <div key={n.nodeId}>
                          {i > 0 && <div className="h-px bg-[#e5e5ea] mx-4" />}
                          <NodeRow n={n} />
                        </div>
                      ))
                )}

                {/* Grouped by level — accordion */}
                {!filteredNodes && byLevel.map(([levelId, levelNodes], li) => {
                  const first = levelNodes[0];
                  const isExpanded = expandedLevel === levelId;
                  const hasSelected = levelNodes.some(n => String(n.nodeId) === kioskNodeId);
                  return (
                    <div key={levelId}>
                      {li > 0 && <div className="h-px bg-[#e5e5ea]" />}
                      {/* Level header */}
                      <button
                        className="w-full flex items-center px-4 py-3 gap-3 text-left"
                        onClick={() => setExpandedLevel(isExpanded ? null : levelId)}
                      >
                        <span className="w-7 h-7 rounded-full bg-[#00226B] flex items-center justify-center shrink-0">
                          <span className="text-white text-[11px] font-bold">{first.levelLabel}</span>
                        </span>
                        <span className="flex-1 text-[14px] font-medium text-black">{first.levelTitle}</span>
                        <span className="text-[12px] text-[#8e8e93]">{levelNodes.length} nodes</span>
                        {hasSelected && !isExpanded && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
                            <path d="M5 12l5 5L20 7" stroke="#00226B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                        <svg
                          width="12" height="12" viewBox="0 0 12 12" fill="none"
                          style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
                          className="shrink-0 opacity-40"
                        >
                          <path d="M2 4l4 4 4-4" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      {/* Expanded node list */}
                      {isExpanded && levelNodes.map(n => (
                        <div key={n.nodeId}>
                          <div className="h-px bg-[#e5e5ea] mx-4" />
                          <NodeRow n={n} />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Save */}
          <button
            disabled={!kioskNodeId}
            onClick={() => {
              localStorage.setItem(KIOSK_NODE_KEY, kioskNodeId);
              sessionStorage.setItem("admin.reopen", "1");
              window.location.reload();
            }}
            className="w-full py-3 rounded-xl text-white text-[15px] font-medium disabled:opacity-40"
            style={{ backgroundColor: "var(--navy)" }}
          >
            {selectedNode
              ? `Save — ${selectedNode.locationTitle || `Node #${selectedNode.nodeId}`}`
              : "Save Node"}
          </button>

          <div className="pb-4" />
        </div>
      </div>
    </div>
  );
}
