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
    <div className="flex-1 ios-scroll" style={{ background: "var(--bg)" }}>
      {!loaded && (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--navy)", borderTopColor: "transparent" }} />
        </div>
      )}
      <div className="v1-cat-grid">
        {visible.map(cat => (
          <button
            key={cat.id}
            className="v1-cat-tile"
            onClick={() => onSelect(cat)}
          >
            <div className="v1-cat-icon">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cat.image}
                alt={cat.title}
                className="w-14 h-14 object-contain"
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
            <span className="v1-cat-label">{cat.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
