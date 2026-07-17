"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDataStore } from "@/lib/store";

interface Props {
  isExpanded: boolean;
  onTap: () => void;
  isWorkingHours: boolean;
}

// ─── SCREENSAVER VARIANT ───────────────────────────────────────────────────
// 1 = Black background, card with margin
// 2 = Black background, card flush to nearest screen edge (0 margin on narrow axis)
// 3 = Kiosk UI dimmed behind card (dark scrim)
// 4 = Average colour background — extreme blur creates a smooth colour wash from the image
const VARIANT: 1 | 2 | 3 | 4 = 3;
// ───────────────────────────────────────────────────────────────────────────

const SHADOW = "0 8px 32px rgba(0,0,0,0.35)";
const RADIUS = 16;
// Smooth spring — fluid deceleration with a very slight overshoot, no jarring size dip
const SPRING = "0.65s cubic-bezier(0.25, 1.1, 0.5, 1)";
const THUMB_PX = 120; // collapsed thumbnail width in px
const SLIDE_THRESHOLD = 50; // min drag distance (px) to commit a slide
const SLIDE_DURATION = "0.42s ease-out";

export default function Screensaver({ isExpanded, onTap, isWorkingHours }: Props) {
  const highlights = useDataStore(s => s.highlights);
  const n = highlights.length;

  // ── Slide state ───────────────────────────────────────────────────────────
  const [currentIdx, setCurrentIdx] = useState(0);
  // How far both cards are offset from their base positions (follows finger during drag)
  const [slideOffset, setSlideOffset] = useState(0);
  // Adjacent card shown during drag / auto-advance
  const [adjIdx, setAdjIdx] = useState<number | null>(null);
  // +1 = next slide is to the right, -1 = prev slide is to the left
  const [adjDir, setAdjDir] = useState<1 | -1>(1);
  // Whether CSS transition is active (off during drag so card follows finger instantly)
  const [slideAnimate, setSlideAnimate] = useState(false);

  // ── Refs for always-fresh values in async callbacks ───────────────────────
  const isAnimating = useRef(false);
  const commitRef = useRef<"next" | "prev" | "snap" | null>(null);
  const adjIdxRef = useRef<number | null>(null);
  const currentIdxRef = useRef(0);
  const nRef = useRef(n);
  const cardWidthRef = useRef(0);
  const isDragging = useRef(false);
  const dragStartX = useRef<number | null>(null);
  const dragDeltaRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ratioSetRef = useRef(false);

  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);
  useEffect(() => { nRef.current = n; }, [n]);
  useEffect(() => { adjIdxRef.current = adjIdx; }, [adjIdx]);

  const [imageRatio, setImageRatio] = useState(1.35);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [vp, setVp] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const update = () => {
      const vv = window.visualViewport;
      setVp({
        w: vv ? Math.round(vv.width) : window.innerWidth,
        h: vv ? Math.round(vv.height) : window.innerHeight,
      });
    };
    update();
    window.visualViewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  // ── Geometry ──────────────────────────────────────────────────────────────
  const expandedGeometry = (() => {
    if (!vp.w) return { top: "5vh", left: "5vw", width: "90vw", height: "90vh", borderRadius: RADIUS, wNum: 0 };
    if (VARIANT === 2) {
      const portrait = vp.h >= vp.w;
      if (portrait) {
        const w = vp.w, h = Math.round(w * imageRatio), top = Math.round((vp.h - h) / 2);
        return { top: `${top}px`, left: "0px", width: `${w}px`, height: `${h}px`, borderRadius: 0, wNum: w };
      } else {
        const h = vp.h, w = Math.round(h / imageRatio), left = Math.round((vp.w - w) / 2);
        return { top: "0px", left: `${left}px`, width: `${w}px`, height: `${h}px`, borderRadius: 0, wNum: w };
      }
    }
    // VARIANT 1 & 3 & 4: fit within 90% of both axes, maintain image aspect ratio
    const maxW = Math.round(vp.w * 0.90);
    const maxH = Math.round(vp.h * 0.90);
    const hFromW = Math.round(maxW * imageRatio);
    const h = Math.min(hFromW, maxH);
    const w = h < hFromW ? Math.round(h / imageRatio) : maxW;
    const top = Math.round((vp.h - h) / 2);
    const left = Math.round((vp.w - w) / 2);
    return { top: `${top}px`, left: `${left}px`, width: `${w}px`, height: `${h}px`, borderRadius: RADIUS, wNum: w };
  })();

  const collapsedGeometry = vp.w > 0
    ? {
        top: `${vp.h - THUMB_PX * 4 / 3 - 20}px`,
        left: `${vp.w - THUMB_PX - 20}px`,
        width: `${THUMB_PX}px`,
        height: `${Math.round(THUMB_PX * 4 / 3)}px`,
        borderRadius: RADIUS,
        wNum: THUMB_PX,
      }
    : { top: "calc(100vh - 180px)", left: "calc(100vw - 140px)", width: "120px", height: "160px", borderRadius: RADIUS, wNum: 120 };

  const geom = isExpanded ? expandedGeometry : collapsedGeometry;

  // Keep cardWidthRef current so timer callback always uses correct width
  useEffect(() => { cardWidthRef.current = geom.wNum; }, [geom.wNum]);

  // Reset slide state when expand/collapse (avoids mid-slide geometry conflicts)
  useEffect(() => {
    isAnimating.current = false;
    commitRef.current = null;
    setSlideAnimate(false);
    setSlideOffset(0);
    setAdjIdx(null);
  }, [isExpanded]);

  // ── Slide logic ───────────────────────────────────────────────────────────
  const handleSlideEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.propertyName !== "transform") return;
    if (commitRef.current === "next" || commitRef.current === "prev") {
      const target = adjIdxRef.current;
      if (target !== null) setCurrentIdx(target);
    }
    setSlideOffset(0);
    setAdjIdx(null);
    setSlideAnimate(false);
    commitRef.current = null;
    isAnimating.current = false;
  };

  // Programmatic slide (used by timer and keyboard). Two rAFs ensure adj card
  // renders at its off-screen position BEFORE the CSS transition kicks in.
  const triggerSlide = (dir: 1 | -1) => {
    const cur = currentIdxRef.current;
    const total = nRef.current;
    if (total === 0 || isAnimating.current) return;
    const next = dir === 1 ? (cur + 1) % total : (cur - 1 + total) % total;
    isAnimating.current = true;
    commitRef.current = dir === 1 ? "next" : "prev";
    adjIdxRef.current = next;
    setAdjIdx(next);
    setAdjDir(dir);
    setSlideOffset(0);
    setSlideAnimate(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSlideAnimate(true);
        setSlideOffset(-dir * cardWidthRef.current);
      });
    });
  };

  const restartTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => triggerSlide(1), 5000);
  };

  useEffect(() => {
    setCurrentIdx(0);
    setSlideOffset(0);
    setAdjIdx(null);
    setSlideAnimate(false);
    isAnimating.current = false;
    commitRef.current = null;
    restartTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isAnimating.current) return;
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

    // Show the adjacent card as soon as the drag has a clear direction
    if (nRef.current > 0 && Math.abs(delta) > 5) {
      const dir: 1 | -1 = delta < 0 ? 1 : -1;
      const cur = currentIdxRef.current;
      const total = nRef.current;
      const next = dir === 1 ? (cur + 1) % total : (cur - 1 + total) % total;
      if (adjIdxRef.current !== next) {
        adjIdxRef.current = next;
        setAdjIdx(next);
        setAdjDir(dir);
      }
    }
    setSlideOffset(delta);
  };

  const handlePointerUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const delta = dragDeltaRef.current;
    dragStartX.current = null;
    const total = nRef.current;
    const cur = currentIdxRef.current;
    const w = cardWidthRef.current;

    if (Math.abs(delta) < 8) {
      // Treat as tap — snap back and dismiss
      setSlideAnimate(true);
      setSlideOffset(0);
      setTimeout(() => setAdjIdx(null), 450);
      onTap();
      restartTimer();
      return;
    }

    setSlideAnimate(true);
    if (delta < -SLIDE_THRESHOLD && total > 0) {
      // Commit next
      const next = (cur + 1) % total;
      isAnimating.current = true;
      commitRef.current = "next";
      adjIdxRef.current = next;
      setAdjIdx(next);
      setAdjDir(1);
      setSlideOffset(-w);
      restartTimer();
    } else if (delta > SLIDE_THRESHOLD && total > 0) {
      // Commit prev
      const prev = (cur - 1 + total) % total;
      isAnimating.current = true;
      commitRef.current = "prev";
      adjIdxRef.current = prev;
      setAdjIdx(prev);
      setAdjDir(-1);
      setSlideOffset(w);
      restartTimer();
    } else {
      // Snap back
      commitRef.current = "snap";
      setSlideOffset(0);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (!mounted) return null;

  const currentSlide = n > 0 ? highlights[currentIdx] : null;
  const adjSlide = adjIdx !== null && adjIdx >= 0 && adjIdx < n ? highlights[adjIdx] : null;
  const bgImageUrl = currentSlide?.image?.replace("http:", "https:") ?? "";

  const backdropStyle: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 48,
    pointerEvents: isExpanded ? "auto" : "none",
    background: VARIANT === 4 ? "rgba(0,0,0,0)" : "rgba(0,0,0,0.6)",
    opacity: isExpanded ? 1 : 0,
    transition: "opacity 0.35s ease",
  };

  // Shared card geometry — position transitions handled here; slide handled via transform
  const baseCardStyle: React.CSSProperties = {
    position: "fixed",
    overflow: "hidden",
    borderRadius: geom.borderRadius,
    boxShadow: SHADOW,
    background: "#111",
    top: geom.top,
    left: geom.left,
    width: geom.width,
    height: geom.height,
    transition: slideAnimate
      ? `transform ${SLIDE_DURATION}, top ${SPRING}, left ${SPRING}, width ${SPRING}, height ${SPRING}`
      : `top ${SPRING}, left ${SPRING}, width ${SPRING}, height ${SPRING}`,
  };

  const imgStyle: React.CSSProperties = {
    width: "100%", height: "100%",
    objectFit: "contain", background: "#111",
    userSelect: "none", pointerEvents: "none",
    display: "block",
    draggable: false,
  } as React.CSSProperties;

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

      {/* Variant 4: average colour background wash */}
      {VARIANT === 4 && isExpanded && bgImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bgImageUrl}
          alt=""
          aria-hidden
          style={{
            position: "fixed", inset: 0, zIndex: 47,
            width: "100%", height: "100%",
            objectFit: "cover",
            filter: "blur(200px) saturate(1.6) brightness(0.6)",
            transform: "scale(2)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Adjacent card — enters from off-screen, sits behind current card */}
      {adjSlide && (
        <div style={{
          ...baseCardStyle,
          zIndex: 49,
          pointerEvents: "none",
          // Base position is same as current card; offset by ±cardWidth so it starts off-screen
          transform: `translateX(${adjDir * geom.wNum + slideOffset}px)`,
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={adjSlide.image.replace("http:", "https:")}
            alt={adjSlide.title}
            draggable={false}
            style={imgStyle}
          />
        </div>
      )}

      {/* Current card — moves with finger/animation */}
      <div
        style={{
          ...baseCardStyle,
          zIndex: 50,
          cursor: "grab",
          touchAction: "none",
          transform: `translateX(${slideOffset}px)`,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onTransitionEnd={handleSlideEnd}
      >
        {currentSlide ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentSlide.image.replace("http:", "https:")}
            alt={currentSlide.title}
            draggable={false}
            onLoad={(e) => {
              if (!ratioSetRef.current) {
                const img = e.currentTarget;
                if (img.naturalWidth > 0) {
                  ratioSetRef.current = true;
                  setImageRatio(img.naturalHeight / img.naturalWidth);
                }
              }
            }}
            style={imgStyle}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin opacity-30" />
          </div>
        )}
      </div>
    </>,
    document.body
  );
}
