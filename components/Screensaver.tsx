"use client";
import { useEffect, useRef, useState } from "react";
import { useDataStore } from "@/lib/store";

interface Props {
  isExpanded: boolean;
  onTap: () => void;
}

const SHADOW = "0 8px 32px rgba(0,0,0,0.35)";
const RADIUS = 16;

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

  // Outer wrapper: fullscreen transparent backdrop when expanded, small box when thumbnail
  const outerStyle: React.CSSProperties = isExpanded
    ? {
        position: "fixed",
        inset: 0,
        zIndex: 50,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
      }
    : {
        position: "fixed",
        bottom: 20,
        right: 20,
        width: "min(15vw, 160px)",
        aspectRatio: "3 / 4",
        zIndex: 50,
        cursor: "pointer",
        borderRadius: RADIUS,
        overflow: "hidden",
        boxShadow: SHADOW,
      };

  // Inner poster: sized portrait container, centered in backdrop when expanded
  const innerStyle: React.CSSProperties = isExpanded
    ? {
        height: "85vh",
        aspectRatio: "3 / 4",
        borderRadius: RADIUS,
        overflow: "hidden",
        boxShadow: SHADOW,
        position: "relative",
        flexShrink: 0,
      }
    : {
        width: "100%",
        height: "100%",
        position: "relative",
      };

  return (
    <div style={outerStyle} onClick={handleTap}>
      <div style={innerStyle}>
        {highlights.map((h, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={h.id}
            src={h.image.replace("http:", "https:")}
            alt={h.title}
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              opacity: i === current % highlights.length ? 1 : 0,
              transition: "opacity 0.7s ease",
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
