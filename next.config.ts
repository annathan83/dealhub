import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist/legacy is a large ESM package — keep it in Node.js runtime,
  // not bundled by webpack, to avoid DOMMatrix / canvas issues.
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
