import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    "preview-chat-cc510338-8c17-429c-9def-4356a06536ed.space.chatglm.site",
  ],
};

export default nextConfig;
