import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  reactStrictMode: false,
  async headers() {
    return [{
      source: "/(.*)",
      headers: [{ key: "Cache-Control", value: "no-store" }],
    }];
  },
};

export default nextConfig;
