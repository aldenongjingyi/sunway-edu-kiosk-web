"use client";
import { useDataStore } from "@/lib/store";

export default function PopularTab({ onSelect }: { onSelect: (text: string) => void }) {
  const trendings = useDataStore(s => s.trendings);
  const loaded = useDataStore(s => s.loaded);

  return (
    <div className="v3-popular-scroll" style={{ background: "var(--panel-bg)" }}>
      {!loaded && (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 rounded-full animate-spin" style={{ border: "2px solid var(--sidebar)", borderTopColor: "transparent" }} />
        </div>
      )}
      {trendings.map((t, i) => (
        <div key={t.id}>
          <button className="v3-popular-row" onClick={() => onSelect(t.title)}>
            {t.title}
          </button>
          {i < trendings.length - 1 && <div className="divider-full" />}
        </div>
      ))}
    </div>
  );
}
