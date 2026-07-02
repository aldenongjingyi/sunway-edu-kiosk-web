"use client";
import { useDataStore } from "@/lib/store";

export default function EventsTab() {
  const highlights = useDataStore(s => s.highlights);
  const loaded = useDataStore(s => s.loaded);

  if (!loaded) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#00226B] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (highlights.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[17px] text-[#8e8e93]">No upcoming events</p>
      </div>
    );
  }

  return (
    <div className="flex-1 ios-scroll px-4 pt-4 pb-6 flex flex-col gap-4">
      {highlights.map((h, i) => (
        <div key={i} className="rounded-2xl overflow-hidden bg-[#f2f2f7]" style={{ flexShrink: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={h.image.replace("http:", "https:")}
            alt={h.title}
            style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }}
          />
          <div className="px-4 py-3">
            <p className="text-[17px] font-semibold text-black leading-snug">{h.title}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
