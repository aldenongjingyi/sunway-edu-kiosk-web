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

  const thumbnailStyle: React.CSSProperties = {
    position: "fixed",
    bottom: 20,
    right: 20,
    width: "15vw",
    height: "20vw",
    transform: "none",
    borderRadius: 10,
    overflow: "hidden",
    boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
    zIndex: 50,
    cursor: "pointer",
  };

  const expandedStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 50,
    cursor: "pointer",
  };

  return (
    <div
      style={isExpanded ? expandedStyle : thumbnailStyle}
      className="screensaver-enter"
      onClick={handleTap}
    >
      <div className="w-full h-full bg-black relative overflow-hidden">
        {highlights.map((h, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={h.id}
            src={h.image.replace("http:", "https:")}
            alt={h.title}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
            style={{ opacity: i === current % highlights.length ? 1 : 0 }}
          />
        ))}
        {highlights.length === 0 && (
          <div className="w-full h-full bg-black" />
        )}
      </div>
    </div>
  );
}
