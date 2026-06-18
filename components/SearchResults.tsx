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
  const q = query.toLowerCase().trim();

  const matchedLocations = locations.filter(loc => {
    if (filterCategory) return loc.categories.includes(filterCategory);
    if (!q) return false;
    return (
      loc.title.toLowerCase().includes(q) ||
      loc.keyword.toLowerCase().includes(q) ||
      (loc.categories_ ?? []).some(c => c.title.toLowerCase().includes(q))
    );
  });

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

  return (
    <div className="flex-1 ios-scroll slide-up">

      {matchedLocations.length > 0 && (
        <div>
          {hasBoth && <div className="v2-results-hdr">Facilities &amp; Offices</div>}
          {matchedLocations.map((loc, i) => (
            <div key={loc.id}>
              <div className="v2-loc-row" onClick={() => onLocationSelect(loc.id)}>
                <div className="v2-loc-thumb">
                  {loc.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={loc.images[0]} alt={loc.title} className="w-full h-full object-cover" />
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="3" width="18" height="18" rx="2" stroke="#c7c7cc" strokeWidth="1.5"/>
                      <path d="M3 9h18M9 21V9" stroke="#c7c7cc" strokeWidth="1.5"/>
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="v2-loc-title">{loc.title}</p>
                  <p className="v2-loc-sub">
                    {loc.levelTitles?.join(" / ")} &bull; {(loc.categories_ ?? []).map(c => c.title).join(" / ")}
                  </p>
                </div>
                <div className="chevron" />
              </div>
              {i < matchedLocations.length - 1 && <div className="divider" />}
            </div>
          ))}
        </div>
      )}

      {matchedStaff.length > 0 && (
        <div>
          {hasBoth && <div className="v2-results-hdr">Staff</div>}
          {matchedStaff.map(s => (
            <StaffRow key={`${s.fullName}-${s.ext}`} staff={s} onSelect={onStaffSelect} />
          ))}
        </div>
      )}

      {isEmpty && q.length > 0 && (
        <div className="flex flex-col items-center justify-center py-16" style={{ color: "#aaaaaa" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="mb-3 opacity-30">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5"/>
            <path d="m16.5 16.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <p style={{ fontSize: 17, color: "#aaaaaa" }}>No results for &ldquo;{query}&rdquo;</p>
        </div>
      )}
    </div>
  );
}
