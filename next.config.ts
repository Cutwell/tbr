import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile in a parent directory otherwise makes Turbopack infer the
  // wrong workspace root.
  output: "export",
  turbopack: { root: __dirname },
};

export default nextConfig;
