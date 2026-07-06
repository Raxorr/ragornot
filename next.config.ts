import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  // Set NEXT_BASE_PATH=/ragornot in GitHub Actions for the project-page URL.
  // Leave empty (or unset) for a custom domain where the site is at the root.
  basePath: process.env.NEXT_BASE_PATH ?? "",
  images: {
    // Static export doesn't support Next.js image optimization.
    unoptimized: true,
  },
};

export default nextConfig;
