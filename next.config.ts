import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep heavy Node.js-only packages out of the webpack bundle.
  // pdf-parse uses the file system at import time (test fixtures), so it must
  // run in the Node.js runtime, not be bundled by webpack.
  serverExternalPackages: ["pdf-parse", "mammoth", "xlsx"],
};

export default nextConfig;
