"use client";
import { useDataStore } from "@/lib/store";

export default function PopularTab({ onSelect }: { onSelect: (text: string) => void }) {
  const trendings = useDataStore(s => s.trendings);
  const loaded = useDataStore(s => s.loaded);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="v2-popular-section">
        <p className="v2-popular-heading">Popular Searches</p>
        {!loaded && (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 rounded-full animate-spin" style={{ border: "2px solid var(--navy)", borderTopColor: "transparent" }} />
          </div>
        )}
        <div className="v2-popular-chips">
          {trendings.map(t => (
            <button key={t.id} className="v2-chip" onClick={() => onSelect(t.title)}>
              {t.title}
            </button>
          ))}
        </div>
      </div>

      <div className="v2-emergency flex-shrink-0">
        <p className="v2-emergency-num">+603-7491 8777</p>
        <p className="v2-emergency-lbl">24 Hours Emergency Hotline</p>
      </div>
    </div>
  );
}
