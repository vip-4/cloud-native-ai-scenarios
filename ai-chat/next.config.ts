import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  serverExternalPackages: ["postgres", "bcryptjs"],
  experimental: {
    serverComponentsExternalPackages: ["postgres", "bcryptjs"],
  },
};

export default nextConfig;
