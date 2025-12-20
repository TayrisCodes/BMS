/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  // Exclude MongoDB from Edge runtime bundle (middleware)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude MongoDB from client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        mongodb: false,
        'mongodb-client-encryption': false,
      };
    }
    return config;
  },
  // Experimental features to handle server-only packages
  experimental: {
    serverComponentsExternalPackages: ['mongodb'],
  },
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};

export default nextConfig;
