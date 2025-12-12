/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
};

export default nextConfig;
