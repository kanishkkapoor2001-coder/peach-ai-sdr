import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable experimental features for AI SDK streaming
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
