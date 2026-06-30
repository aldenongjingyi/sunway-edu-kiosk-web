import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  reactStrictMode: false,
  allowedDevOrigins: ["192.168.100.16"],
  async headers() {
    return [{
      // Only apply no-store to page routes, NOT to /_next/static/ assets (CSS/JS)
      source: "/((?!_next/static).*)",
      headers: [{ key: "Cache-Control", value: "no-store" }],
    }];
  },
};

export default nextConfig;
