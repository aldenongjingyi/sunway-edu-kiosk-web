"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDataStore } from "@/lib/store";

interface Props {
  isExpanded: boolean;
  onTap: () => void;
  isWorkingHours: boolean;
}

const SHADOW = "0 8px 32px rgba(0,0,0,0.35)";
const RADIUS = 16;
// Smooth spring — fluid deceleration with a very slight overshoot, no jarring size dip
const SPRING = "0.65s cubic-bezier(0.25, 1.1, 0.5, 1)";
const THUMB_PX = 120; // collapsed thumbnail width in px
// Min drag distance to trigger a slide change
const SLIDE_THRESHOLD = 50;

export default function Screensaver({ isExpanded, onTap, isWorkingHours }: Props) {
  const highlights = useDataStore(s => s.highlights);
  const n = highlights.length;

  // Bi-directional seamless loop:
  // slides = [clone_of_last, real_0, real_1, ..., real_n-1, clone_of_first]
  // Real slides sit at indices 1..n; we start at index 1.
  const slides = n > 0 ? [highlights[n - 1], ...highlights, highlights[0]] : [];
  const pct = slides.length > 0 ? 100 / slides.length : 100; // % of strip per slide

  const [displayIndex, setDisplayIndex] = useState(1);
  const [slideAnimate, setSlideAnimate] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Use visualViewport (actual visible area) to avoid layout-viewport quirks in Android WebView
  const [vp, setVp] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const update = () => {
      const vv = window.visualViewport;
      const w = vv ? Math.round(vv.width) : window.innerWidth;
      const h = vv ? Math.round(vv.height) : window.innerHeight;
      setVp({ w, h });
    };
    update();
    window.visualViewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dragStartX = useRef<number | null>(null);
  const dragDeltaRef = useRef(0);
  const isDragging = useRef(false);

  const restartTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSlideAnimate(true);
      setDisplayIndex(i => i + 1);
    }, 5000);
  };

  useEffect(() => {
    setDisplayIndex(1);
    setSlideAnimate(false);
    restartTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  // Seamless loop: after landing on a clone, snap silently to the real counterpart
  const handleTransitionEnd = () => {
    if (n === 0) return;
    if (displayIndex >= n + 1) {
      setSlideAnimate(false);
      setDisplayIndex(1);
    } else if (displayIndex <= 0) {
      setSlideAnimate(false);
      setDisplayIndex(n);
    }
  };

  // --- Drag / swipe handlers ---
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartX.current = e.clientX;
    dragDeltaRef.current = 0;
    isDragging.current = true;
    setSlideAnimate(false);
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || dragStartX.current === null) return;
    const delta = e.clientX - dragStartX.current;
    dragDeltaRef.current = delta;
    setDragOffset(delta);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const delta = dragDeltaRef.current;
    dragStartX.current = null;

    // Re-enable transition in this render, then commit position change in the next
    // frame so the browser sees a before/after pair and animates correctly.
    setSlideAnimate(true);
    requestAnimationFrame(() => {
      setDragOffset(0);
      if (Math.abs(delta) < 8) {
        // Tiny movement — treat as tap
        restartTimer();
        onTap();
      } else if (delta < -SLIDE_THRESHOLD) {
        setDisplayIndex(i => i + 1);
        restartTimer();
      } else if (delta > SLIDE_THRESHOLD) {
        setDisplayIndex(i => i - 1);
        restartTimer();
      }
      // Otherwise snap back: dragOffset→0 with transition active
    });
  };

  // --- Styles ---
  const cardStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 50,
    overflow: "hidden",
    borderRadius: RADIUS,
    boxShadow: SHADOW,
    cursor: "grab",
    touchAction: "none",
    background: "#111",
    transition: `top ${SPRING}, left ${SPRING}, width ${SPRING}, height ${SPRING}`,
    ...(vp.w > 0
      ? (isExpanded
        ? {
            top:    `${Math.round(vp.h * 0.05)}px`,
            left:   `${Math.round(vp.w * 0.05)}px`,
            width:  `${Math.round(vp.w * 0.90)}px`,
            height: `${Math.round(vp.h * 0.90)}px`,
          }
        : {
            top:    `${vp.h - THUMB_PX * 4 / 3 - 20}px`,
            left:   `${vp.w - THUMB_PX - 20}px`,
            width:  `${THUMB_PX}px`,
            height: `${Math.round(THUMB_PX * 4 / 3)}px`,
          })
      : (isExpanded
        ? { top: "5vh", left: "5vw", width: "90vw", height: "90vh" }
        : { top: "calc(100vh - 180px)", left: "calc(100vw - 140px)", width: "120px", height: "160px" }
      )),
  };

  const backdropStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 49,
    pointerEvents: isExpanded ? "auto" : "none",
    background: "rgba(0,0,0,0.55)",
    backdropFilter: isExpanded ? "blur(3px)" : "blur(0px)",
    WebkitBackdropFilter: isExpanded ? "blur(3px)" : "blur(0px)",
    opacity: isExpanded ? 1 : 0,
    transition: "opacity 0.35s ease, backdrop-filter 0.35s ease, -webkit-backdrop-filter 0.35s ease",
  };

  // Strip translateX: percentage is relative to strip's own width (slides.length * cardWidth),
  // so -displayIndex * pct% == -displayIndex * cardWidth. Drag offset added in pixels.
  const stripTranslate = slides.length > 0
    ? `calc(-${displayIndex * pct}% + ${dragOffset}px)`
    : "0px";

  if (!mounted) return null;

  // Outside working hours: black fullscreen overlay, cannot be dismissed
  if (!isWorkingHours) {
    return createPortal(
      <div
        style={{ position: "fixed", inset: 0, zIndex: 50, background: "#000", touchAction: "none" }}
        onPointerDown={e => e.stopPropagation()}
      />,
      document.body
    );
  }

  return createPortal(
    <>
      <div style={backdropStyle} onClick={() => { restartTimer(); onTap(); }} />
      <div
        style={cardStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Horizontal strip — width = slides.length × card width */}
        <div
          style={{
            display: "flex",
            width: `${slides.length > 0 ? slides.length * 100 : 100}%`,
            height: "100%",
            transform: `translateX(${stripTranslate})`,
            transition: slideAnimate ? "transform 0.5s ease-in-out" : "none",
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {slides.length > 0 ? slides.map((h, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={h.image.replace("http:", "https:")}
              alt={h.title}
              draggable={false}
              style={{
                width: `${pct}%`,
                height: "100%",
                objectFit: "contain",
                background: "#111",
                flexShrink: 0,
                userSelect: "none",
                pointerEvents: "none",
              }}
            />
          )) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#111" }}>
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin opacity-30" />
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
