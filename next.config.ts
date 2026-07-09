import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  devIndicators: false,
  reactStrictMode: false,
  images: { unoptimized: true },
  allowedDevOrigins: ["192.168.100.27"],
  // Cache-Control headers are set per-file in scripts/deploy.mjs
};

export default nextConfig;
