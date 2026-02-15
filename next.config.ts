import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Include prompt files in serverless function bundles.
  // These are loaded via readFileSync at runtime and can't be auto-traced.
  outputFileTracingIncludes: {
    "/api/**": ["./prompts/**", "./src/prompts/**"],
  },
  // Exclude pdf-parse from bundling — it loads test fixtures at require-time
  // which breaks in serverless environments.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
