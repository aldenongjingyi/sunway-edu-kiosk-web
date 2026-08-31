import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  assetPrefix: (process.env.LOCAL_BUILD || process.env.VERCEL || process.env.NODE_ENV !== "production") ? "" : "https://sgp1.digitaloceanspaces.com/kiosk-sunwayedu.getmallapp.com",
  devIndicators: false,
  reactStrictMode: false,
  images: { unoptimized: true },
  allowedDevOrigins: ["192.168.100.27", "192.168.100.237", "192.168.100.239"],
  env: {
    ...(!process.env.LOCAL_BUILD && !process.env.VERCEL && process.env.NODE_ENV === "production" ? {
      NEXT_PUBLIC_WAYFINDER_URL: "https://maps-sunwayedu.getmallapp.com/wayfinder-map.min.js",
    } : {}),
  },
  // Cache-Control headers are set per-file in scripts/deploy.mjs
};

export default nextConfig;
