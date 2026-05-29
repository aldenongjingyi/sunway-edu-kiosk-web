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
      {departments.map((dept, i) => (
        <div key={dept} className="row-press" onClick={() => onSelect(dept)}>
          <div className="flex items-center px-4 py-3.5">
            <span className="flex-1 text-[17px] text-black">{dept}</span>
            <div className="chevron" />
          </div>
          {i < departments.length - 1 && <div className="divider-full" />}
        </div>
      ))}
    </div>
  );
}
