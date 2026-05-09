import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Only set tracing root during `next build` — setting it in dev breaks Turbopack
  // module resolution for workspace-local devDependencies (e.g. tailwindcss).
  ...(process.env.NODE_ENV === "production" && {
    outputFileTracingRoot: path.join(__dirname, "../../"),
  }),
};

export default nextConfig;
