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
  const { locations, staffs, categories } = useDataStore();
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

  return (
    <div className="flex-1 ios-scroll slide-up">
      {/* Locations section */}
      {matchedLocations.length > 0 && (
        <div>
          {matchedLocations.length > 0 && matchedStaff.length > 0 && (
            <div className="px-4 pt-3 pb-1">
              <span className="text-[12px] font-semibold text-[#6b6b6b] uppercase tracking-wide">Facilities &amp; Offices</span>
            </div>
          )}
          {matchedLocations.map((loc, i) => (
            <div key={loc.id}>
              <div className="flex flex-col items-center px-4 py-3 row-press text-center" onClick={() => onLocationSelect(loc.id)}>
                <p className="font-semibold text-[17px] text-black leading-snug">{loc.title}</p>
                <p className="text-[14px] text-[#3c3c43] mt-0.5">
                  {loc.levelTitles?.join(" / ")} &bull; {(loc.categories_ ?? []).map(c => c.title).join(" / ")}
                </p>
              </div>
              {i < matchedLocations.length - 1 && <div className="divider-full" />}
            </div>
          ))}
        </div>
      )}

      {/* Staff section */}
      {matchedStaff.length > 0 && (
        <div>
          {matchedLocations.length > 0 && matchedStaff.length > 0 && (
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
