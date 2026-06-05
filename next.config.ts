import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    "preview-chat-e34d8351-20f1-4734-b1a7-5302c57da37c.space-z.ai",
  ],
};

export default nextConfig;
