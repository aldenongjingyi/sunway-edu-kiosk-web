"use client";
import { useEffect, useRef, useState } from "react";
import { useDataStore } from "@/lib/store";

interface Props {
  isExpanded: boolean;
  onTap: () => void;
}

export default function Screensaver({ isExpanded, onTap }: Props) {
  const highlights = useDataStore(s => s.highlights);
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const restartTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % Math.max(highlights.length, 1));
    }, 5000);
  };

  useEffect(() => {
    restartTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlights.length]);

  const handleTap = () => {
    restartTimer();
    onTap();
  };

  const style: React.CSSProperties = isExpanded
    ? {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 0,
        boxShadow: "none",
        zIndex: 50,
        overflow: "hidden",
        cursor: "pointer",
      }
    : {
        position: "fixed",
        bottom: 20,
        right: 20,
        width: "min(15vw, 160px)",
        height: "min(20vw, 213px)",
        aspectRatio: "3 / 4",
        borderRadius: 10,
        boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
        zIndex: 50,
        overflow: "hidden",
        cursor: "pointer",
      };

  return (
    <div style={style} onClick={handleTap}>
      <div className={`w-full h-full relative ${isExpanded ? "bg-transparent" : "bg-black"}`}>
        {highlights.map((h, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={h.id}
            src={h.image.replace("http:", "https:")}
            alt={h.title}
            className={`absolute inset-0 w-full h-full ${isExpanded ? "object-contain" : "object-cover"}`}
            style={{
              opacity: i === current % highlights.length ? 1 : 0,
              transition: "opacity 0.7s ease",
              filter: isExpanded ? "drop-shadow(0 8px 32px rgba(0,0,0,0.35))" : "none",
            }}
          />
        ))}
        {highlights.length === 0 && (
          <div className="w-full h-full bg-[#111] flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin opacity-30" />
          </div>
        )}
      </div>
    </div>
  );
}
