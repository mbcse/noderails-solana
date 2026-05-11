import path from "node:path";
import type { NextConfig } from "next";

const monoRoot = path.resolve(process.cwd(), "../..");

const nextConfig: NextConfig = {
  transpilePackages: ["@noderails-card/ui"],
  /** Monorepo: single trace root avoids shipping two copies of react from mixed resolution paths in prod. */
  outputFileTracingRoot: monoRoot
};

export default nextConfig;
