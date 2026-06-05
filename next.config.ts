import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Type safety is enforced — the codebase type-checks cleanly (see `bun run typecheck`).
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    "preview-chat-e34d8351-20f1-4734-b1a7-5302c57da37c.space-z.ai",
  ],
  // Baseline security headers applied to every response.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
