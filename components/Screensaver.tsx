"use client";
import { useEffect, useRef, useState } from "react";
import { useDataStore } from "@/lib/store";

interface Props {
  isExpanded: boolean;
  onTap: () => void;
}

const SHADOW = "0 8px 32px rgba(0,0,0,0.35)";
const RADIUS = 16;
// Smooth spring — fluid deceleration with a very slight overshoot, no jarring size dip
const SPRING = "0.65s cubic-bezier(0.25, 1.1, 0.5, 1)";

// Thumbnail dimensions (must match between collapsed card and CSS calc below)
const THUMB = "min(15vw, 160px)";

export default function Screensaver({ isExpanded, onTap }: Props) {
  const highlights = useDataStore(s => s.highlights);

  // Carousel: append a clone of the first slide for seamless looping
  const slides = highlights.length > 0 ? [...highlights, highlights[0]] : highlights;

  const [displayIndex, setDisplayIndex] = useState(0);
  const [slideAnimate, setSlideAnimate] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const advance = () => {
    setSlideAnimate(true);
    setDisplayIndex(i => i + 1);
  };

  const restartTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(advance, 5000);
  };

  useEffect(() => {
    // Reset carousel when highlights change
    setDisplayIndex(0);
    setSlideAnimate(false);
    restartTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlights.length]);

  // When we land on the clone (last slide), snap silently back to index 0
  const handleTransitionEnd = () => {
    if (displayIndex >= highlights.length) {
      setSlideAnimate(false);
      setDisplayIndex(0);
    }
  };

  const handleTap = () => {
    restartTimer();
    onTap();
  };

  // Card always uses top/left anchoring so transitions are smooth between states.
  const cardStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 50,
    overflow: "hidden",
    borderRadius: RADIUS,
    boxShadow: SHADOW,
    cursor: "pointer",
    transition: `top ${SPRING}, left ${SPRING}, width ${SPRING}, height ${SPRING}`,
    ...(isExpanded
      ? {
          // Center: top = (100vh - 85vh) / 2 = 7.5vh
          top: "7.5vh",
          left: "calc(50vw - 85vh * 3 / 8)",
          width: "calc(85vh * 3 / 4)",
          height: "85vh",
        }
      : {
          // Bottom-right thumbnail
          top: `calc(100vh - ${THUMB} * 4 / 3 - 20px)`,
          left: `calc(100vw - ${THUMB} - 20px)`,
          width: THUMB,
          height: `calc(${THUMB} * 4 / 3)`,
        }),
  };

  // Separate backdrop that fades in/out independently (faster than card spring)
  const backdropStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 49,
    pointerEvents: isExpanded ? "auto" : "none",
    background: "rgba(0,0,0,0.04)",
    backdropFilter: isExpanded ? "blur(3px)" : "blur(0px)",
    WebkitBackdropFilter: isExpanded ? "blur(3px)" : "blur(0px)",
    opacity: isExpanded ? 1 : 0,
    transition: "opacity 0.35s ease, backdrop-filter 0.35s ease, -webkit-backdrop-filter 0.35s ease",
  };

  return (
    <>
      <div style={backdropStyle} onClick={handleTap} />
      <div style={cardStyle} onClick={handleTap}>
        {/* Horizontal strip of slides */}
        <div
          style={{
            display: "flex",
            height: "100%",
            transform: `translateX(-${displayIndex * 100}%)`,
            transition: slideAnimate ? "transform 1s ease-in-out" : "none",
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {slides.length > 0 ? slides.map((h, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={h.image.replace("http:", "https:")}
              alt={h.title}
              style={{ flex: "0 0 100%", width: "100%", height: "100%", objectFit: "cover" }}
            />
          )) : (
            <div className="flex-none w-full h-full bg-[#111] flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin opacity-30" />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
