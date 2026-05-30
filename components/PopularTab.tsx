"use client";
import { useDataStore } from "@/lib/store";

export default function PopularTab({ onSelect }: { onSelect: (text: string) => void }) {
  const trendings = useDataStore(s => s.trendings);
  const loaded = useDataStore(s => s.loaded);

  return (
    <div className="flex-1 ios-scroll flex flex-col">
      {/* Trending list */}
      <div className="flex-1 flex flex-col items-center justify-start pt-6">
        {!loaded && (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-2 border-[#00226B] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {trendings.map(t => (
          <button
            key={t.id}
            className="w-full text-center py-3 text-[22px] text-black font-light row-press"
            onClick={() => onSelect(t.title)}
          >
            {t.title}
          </button>
        ))}
      </div>

      {/* Emergency hotline */}
      <div className="text-center pb-8 pt-6">
        <p className="text-[28px] font-semibold" style={{ color: "var(--red)" }}>+603-7491 8777</p>
        <p className="text-[14px] text-[#6b6b6b] mt-1">24 Hours Emergency Hotline</p>
      </div>
    </div>
  );
}
