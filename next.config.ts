import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` otherwise appends a managed block to the project's
  // git-ignored claude.md working agreement.
  agentRules: false,
};

export default nextConfig;
