"use client";
import { useDataStore } from "@/lib/store";
import { useEffect } from "react";

export default function DepartmentsTab({ onSelect }: { onSelect: (dept: string) => void }) {
  const { staffs, loadStaff, staffLoaded } = useDataStore();

  useEffect(() => { loadStaff(); }, [loadStaff]);

  const departments = staffLoaded
    ? Array.from(new Set(staffs.map(s => s.department))).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    : [];

  return (
    <div className="flex-1 ios-scroll">
      {!staffLoaded && (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-2 border-[#00226B] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <div className="flex flex-col items-center pt-2">
        {departments.map(dept => (
          <button
            key={dept}
            className="w-full text-center py-3 text-[20px] text-black font-light row-press"
            onClick={() => onSelect(dept)}
          >
            {dept}
          </button>
        ))}
      </div>
    </div>
  );
}
