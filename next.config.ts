import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Include prompt files in serverless function bundles.
  // These are loaded via readFileSync at runtime and can't be auto-traced.
  outputFileTracingIncludes: {
    "/api/**": ["./prompts/**", "./src/prompts/**"],
  },
};

export default nextConfig;
