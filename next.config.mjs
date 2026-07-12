/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Frontend-only deployment: no server runtime work, all API calls go to
  // the external NEXT_PUBLIC_API_URL. Images are optimized by Next/Vercel.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  // These packages do Node-specific things (native requires, internal
  // circular imports) that break when webpack tries to bundle them for
  // the Route Handler. Marking them external makes Next.js load them via
  // plain Node `require` at runtime instead, which avoids the
  // "Cannot access 'os' before initialization" TDZ error during build.
  serverExternalPackages: ['exceljs', 'pptxgenjs', 'docx', 'pdf-lib', 'jszip'],
};

export default nextConfig;
