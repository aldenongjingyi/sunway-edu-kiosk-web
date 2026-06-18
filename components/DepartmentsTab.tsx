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
    <div className="v2-dept-section">
      {!staffLoaded && (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 rounded-full animate-spin" style={{ border: "2px solid var(--navy)", borderTopColor: "transparent" }} />
        </div>
      )}
      {departments.map((dept, i) => (
        <div key={dept}>
          <div className="v2-dept-row" onClick={() => onSelect(dept)}>
            <span className="v2-dept-name">{dept}</span>
            <div className="chevron" />
          </div>
          {i < departments.length - 1 && <div className="v2-dept-divider" />}
        </div>
      ))}
    </div>
  );
}
