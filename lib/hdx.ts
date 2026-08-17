"use client";
// HyperDX browser instrumentation helper.
// Call initHDX() once on app mount. Use hdx.addAction() anywhere.

let _hdx: typeof import("@hyperdx/browser").default | null = null;

// Suppress img load errors from reaching window (e.g. vine.sunway.edu.my staff photos).
// Must run before HyperDX.init() so this capture listener is registered first.
function suppressImgErrors() {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (e) => {
    if (e.target instanceof HTMLImageElement) e.stopImmediatePropagation();
  }, true);
}

export async function initHDX() {
  if (typeof window === "undefined") return;
  if (_hdx) return;
  suppressImgErrors();
  const { default: HyperDX } = await import("@hyperdx/browser");
  HyperDX.init({
    apiKey: "8b23c3a0-4a71-41d8-bf96-a8fbf2490313",
    service: "sunway-edu-kiosk",
    tracePropagationTargets: [],
    consoleCapture: false,
    advancedNetworkCapture: false,
    instrumentations: { document: false, postload: false, fetch: false, xhr: false, interactions: false, longtask: false, webvitals: false },
  });
  _hdx = HyperDX;
}

export const hdx = {
  addAction(name: string, props?: Record<string, string | number | boolean>) {
    _hdx?.addAction(name, props);
  },
};
