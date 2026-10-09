import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      {
        source: "/bookings",
        destination: "/api/bookings",
      },
      {
        source: "/public/:path*",
        destination: "/api/public/:path*",
      },
    ];
  },
};

export default nextConfig;
