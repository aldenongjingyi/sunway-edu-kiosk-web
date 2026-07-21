"use client";
import { useDataStore } from "@/lib/store";
import StaffRow from "./StaffRow";
import type { Staff } from "@/lib/types";

interface Props {
  query: string;
  filterCategory?: number | null;
  filterDepartment?: string | null;
  onLocationSelect: (id: number) => void;
  onStaffSelect: (s: Staff) => void;
}

export default function SearchResults({ query, filterCategory, filterDepartment, onLocationSelect, onStaffSelect }: Props) {
  const { locations, staffs } = useDataStore();
  const isV1 = useDataStore(s => s.design === "v1");
  const q = query.toLowerCase().trim();

  // Filter locations
  const matchedLocations = locations.filter(loc => {
    if (filterCategory) return loc.categories.includes(filterCategory);
    if (!q) return false;
    return (
      loc.title.toLowerCase().includes(q) ||
      loc.keyword.toLowerCase().includes(q) ||
      (loc.categories_ ?? []).some(c => c.title.toLowerCase().includes(q))
    );
  });

  // Filter staff
  const matchedStaff = staffs.filter(s => {
    if (filterDepartment) return s.department === filterDepartment;
    if (!q) return false;
    return (
      s.fullName.toLowerCase().includes(q) ||
      s.department.toLowerCase().includes(q) ||
      s.designation.toLowerCase().includes(q) ||
      s.keywords.toLowerCase().includes(q)
    );
  });

  const isEmpty = matchedLocations.length === 0 && matchedStaff.length === 0;
  const hasBoth = matchedLocations.length > 0 && matchedStaff.length > 0;

  if (isV1) {
    return (
      <div className="flex-1 ios-scroll slide-up" style={{ background: "var(--bg)" }}>
        {matchedLocations.length > 0 && (
          <div>
            {hasBoth && <div className="v1-results-hdr">Facilities &amp; Offices</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {matchedLocations.map((loc) => (
                <div key={loc.id} className="v1-loc-row" onClick={() => onLocationSelect(loc.id)}>
                  <div className="v1-loc-thumb">
                    {loc.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={loc.images[0]} alt={loc.title} className="w-full h-full object-cover" />
                    ) : (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="3" width="18" height="18" rx="2" stroke="#c7c7cc" strokeWidth="1.5"/>
                        <path d="M3 9h18M9 21V9" stroke="#c7c7cc" strokeWidth="1.5"/>
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="v1-loc-title">{loc.title}</p>
                    <p className="v1-loc-sub">
                      {loc.levelTitles?.join(" / ")} &bull; {(loc.categories_ ?? []).map(c => c.title).join(" / ")}
                    </p>
                  </div>
                  <div className="chevron mt-1" />
                </div>
              ))}
            </div>
          </div>
        )}

        {matchedStaff.length > 0 && (
          <div>
            {hasBoth && <div className="v1-results-hdr">Staff</div>}
            {matchedStaff.map(s => (
              <StaffRow key={`${s.fullName}-${s.ext}`} staff={s} onSelect={onStaffSelect} />
            ))}
          </div>
        )}

        {isEmpty && q.length > 0 && (
          <div className="flex flex-col items-center justify-center py-16" style={{ color: "#8e8e93" }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" className="mb-4 opacity-30">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5"/>
              <path d="m16.5 16.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <p style={{ fontSize: 18, fontWeight: 500 }}>No results for &ldquo;{query}&rdquo;</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 ios-scroll slide-up">
      {/* Locations section */}
      {matchedLocations.length > 0 && (
        <div>
          {hasBoth && (
            <div className="px-4 pt-3 pb-1">
              <span className="text-[12px] font-semibold text-[#6b6b6b] uppercase tracking-wide">Facilities &amp; Offices</span>
            </div>
          )}
          {matchedLocations.map((loc, i) => (
            <div key={loc.id}>
              <div className="flex items-start gap-3 px-4 py-3 row-press" onClick={() => onLocationSelect(loc.id)}>
                <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-[#f2f2f7] flex items-center justify-center">
                  {loc.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={loc.images[0]} alt={loc.title} className="w-full h-full object-cover" />
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="3" width="18" height="18" rx="2" stroke="#c7c7cc" strokeWidth="1.5"/>
                      <path d="M3 9h18M9 21V9" stroke="#c7c7cc" strokeWidth="1.5"/>
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[17px] text-black leading-snug">{loc.title}</p>
                  <p className="text-[14px] text-[#3c3c43] mt-0.5">
                    {loc.levelTitles?.join(" / ")} &bull; {(loc.categories_ ?? []).map(c => c.title).join(" / ")}
                  </p>
                </div>
                <div className="chevron mt-1" />
              </div>
              {i < matchedLocations.length - 1 && <div className="divider" />}
            </div>
          ))}
        </div>
      )}

      {/* Staff section */}
      {matchedStaff.length > 0 && (
        <div>
          {hasBoth && (
            <div className="px-4 pt-4 pb-1">
              <span className="text-[12px] font-semibold text-[#6b6b6b] uppercase tracking-wide">Staff</span>
            </div>
          )}
          {matchedStaff.map(s => (
            <StaffRow key={`${s.fullName}-${s.ext}`} staff={s} onSelect={onStaffSelect} />
          ))}
        </div>
      )}

      {isEmpty && q.length > 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-[#8e8e93]">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="mb-3 opacity-40">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5"/>
            <path d="m16.5 16.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <p className="text-[17px]">No results for &ldquo;{query}&rdquo;</p>
        </div>
      )}
    </div>
  );
}
