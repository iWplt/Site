import type { NextConfig } from "next";
import { UPLOAD_REQUEST_BODY_LIMIT } from "./src/lib/upload-limits";

const supabaseHost = (() => {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return url ? new URL(url).hostname : undefined;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.68.102"],
  experimental: {
    serverActions: {
      bodySizeLimit: UPLOAD_REQUEST_BODY_LIMIT
    },
    proxyClientMaxBodySize: UPLOAD_REQUEST_BODY_LIMIT
  },
  images: {
    formats: ["image/webp"],
    qualities: [75, 82, 86, 88, 90, 92, 95],
    deviceSizes: [430, 828, 1200],
    imageSizes: [48, 96, 256, 384],
    localPatterns: [{ pathname: "/warka-brand/**" }, { pathname: "/warka/**" }, { pathname: "/brand/**" }],
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/**"
          }
        ]
      : []
  }
};

export default nextConfig;

// Enables Cloudflare bindings during `next dev` (OpenNext local integration).
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
