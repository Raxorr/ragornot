import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  // Served from the domain root (https://ragornot.com) — no base path.
  images: {
    // Static export doesn't support Next.js image optimization.
    unoptimized: true,
  },
};

export default nextConfig;
