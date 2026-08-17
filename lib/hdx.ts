// HyperDX browser instrumentation helper.
// Call initHDX() once on app mount. Use hdx.addAction() anywhere.

let _hdx: typeof import("@hyperdx/browser").default | null = null;

export async function initHDX() {
  const apiKey = process.env.NEXT_PUBLIC_HYPERDX_API_KEY;
  if (!apiKey || typeof window === "undefined") return;
  if (_hdx) return;
  const { default: HyperDX } = await import("@hyperdx/browser");
  HyperDX.init({
    apiKey,
    service: "sunway-edu-kiosk",
    tracePropagationTargets: [/sunway-kiosk-proxy\.sunway-kiosk\.workers\.dev/],
    consoleCapture: true,
    advancedNetworkCapture: true,
    instrumentations: { interactions: false },
  });
  _hdx = HyperDX;
}

export const hdx = {
  addAction(name: string, props?: Record<string, string | number | boolean>) {
    _hdx?.addAction(name, props);
  },
};
