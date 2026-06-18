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
    <div className="v1-dept-list">
      {!staffLoaded && (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--navy)", borderTopColor: "transparent" }} />
        </div>
      )}
      {departments.map(dept => (
        <button key={dept} className="v1-dept-card" onClick={() => onSelect(dept)}>
          <span className="v1-dept-name">{dept}</span>
          <div className="chevron" />
        </button>
      ))}
    </div>
  );
}
