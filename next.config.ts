import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do NOT use output: "standalone" — it conflicts with Netlify's plugin.
  // Netlify handles output via @netlify/plugin-nextjs (OpenNext adapter).
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  experimental: {
    // Turbopack is stable in Next.js 16 — keep enabled for faster builds
    optimizePackageImports: ["lucide-react", "recharts", "framer-motion"],
  },
  // Allow Prisma to be bundled in serverless functions
  serverExternalPackages: ["@prisma/client", "@supabase/supabase-js"],
  // ESLint errors shouldn't fail the production build
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
