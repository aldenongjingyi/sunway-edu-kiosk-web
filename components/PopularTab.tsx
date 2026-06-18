"use client";
import { useDataStore } from "@/lib/store";

export default function PopularTab({ onSelect }: { onSelect: (text: string) => void }) {
  const trendings = useDataStore(s => s.trendings);
  const loaded = useDataStore(s => s.loaded);

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "var(--bg)" }}>
      <div className="v1-pills-wrap">
        {!loaded && (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--navy)", borderTopColor: "transparent" }} />
          </div>
        )}
        {trendings.map(t => (
          <button key={t.id} className="v1-pill-btn" onClick={() => onSelect(t.title)}>
            {t.title}
          </button>
        ))}
      </div>

      <div className="v1-emergency flex-shrink-0">
        <p className="v1-emergency-num">+603-7491 8777</p>
        <p className="v1-emergency-lbl">24 Hours Emergency Hotline</p>
      </div>
    </div>
  );
}
