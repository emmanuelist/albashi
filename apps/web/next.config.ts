import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // REVIEW_EXPORT=1 writes a static snapshot to out/ for the design review capture; deploys never set it.
  ...(process.env.REVIEW_EXPORT ? { output: 'export' as const, distDir: '.next-review' } : {}),
};

export default config;
