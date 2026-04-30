import path from "node:path";
import type { NextConfig } from "next";

const monoRoot = path.resolve(process.cwd(), "../..");

const nextConfig: NextConfig = {
  transpilePackages: ["@noderails-card/ui"],
  outputFileTracingRoot: monoRoot
};

export default nextConfig;
