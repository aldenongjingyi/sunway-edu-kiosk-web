import type { NextConfig } from "next";

const isQrcode = process.env.DEPLOY_TARGET === "qrcode";
const isProd = !process.env.LOCAL_BUILD && !process.env.VERCEL && process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  assetPrefix: isQrcode
    ? "https://maps-sunwayedu.getmallapp.com/qrcode"
    : isProd
      ? "https://sgp1.digitaloceanspaces.com/kiosk-sunwayedu.getmallapp.com"
      : "",
  devIndicators: false,
  reactStrictMode: false,
  images: { unoptimized: true },
  allowedDevOrigins: ["192.168.100.27", "192.168.100.237", "192.168.100.239"],
  env: {
    ...(isQrcode ? {
      NEXT_PUBLIC_WAYFINDER_URL: "https://maps-sunwayedu.getmallapp.com/qrcode/wayfinder-map.min.js",
      NEXT_PUBLIC_ASSET_PREFIX: "https://maps-sunwayedu.getmallapp.com/qrcode",
    } : isProd ? {
      NEXT_PUBLIC_WAYFINDER_URL: "https://sgp1.digitaloceanspaces.com/kiosk-sunwayedu.getmallapp.com/wayfinder-map.min.js",
      NEXT_PUBLIC_ASSET_PREFIX: "https://sgp1.digitaloceanspaces.com/kiosk-sunwayedu.getmallapp.com",
    } : {}),
  },
  // Cache-Control headers are set per-file in scripts/deploy.mjs
};

export default nextConfig;
