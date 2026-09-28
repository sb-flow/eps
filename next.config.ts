import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["xlsx", "mammoth"],
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
};
export default config;
