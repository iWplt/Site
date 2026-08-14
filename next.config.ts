import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    reactCompiler: true
  },
  typedRoutes: true
};

export default nextConfig;
