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
};

export default nextConfig;
