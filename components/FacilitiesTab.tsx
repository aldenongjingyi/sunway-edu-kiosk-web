"use client";
import { useDataStore } from "@/lib/store";
import type { Category } from "@/lib/types";

export default function FacilitiesTab({ onSelect }: { onSelect: (c: Category) => void }) {
  const categories = useDataStore(s => s.categories);
  const loaded = useDataStore(s => s.loaded);

  const visible = Object.values(categories)
    .filter(c => !c.hidden && c.parent === null)
    .sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));

  return (
    <div className="flex-1 ios-scroll">
      {!loaded && (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-2 border-[#00226B] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <div className="grid grid-cols-5 gap-3 p-4">
        {visible.map(cat => (
          <button
            key={cat.id}
            className="card-press flex flex-col items-center gap-2"
            onClick={() => onSelect(cat)}
          >
            <div
              className="w-full aspect-square rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "#f2f2f7" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cat.image}
                alt={cat.title}
                className="w-12 h-12 object-contain"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.style.display = "none";
                  const parent = img.parentElement;
                  if (parent) {
                    parent.style.backgroundColor = "var(--navy)";
                    parent.innerHTML = `<span style="color:white;font-size:11px;text-align:center;padding:4px">${cat.code}</span>`;
                  }
                }}
              />
            </div>
            <span className="text-[13px] text-black text-center leading-tight">{cat.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
