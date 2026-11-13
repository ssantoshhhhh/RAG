import { existsSync } from "node:fs";
import path from "node:path";

import type { NextConfig } from "next";

const rootEnvFile = path.resolve(__dirname, "..", ".env");
if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile);
}

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
};

export default nextConfig;