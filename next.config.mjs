/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Strict server-only module enforcement
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Prevent server-only modules from being bundled in client code
      config.resolve.alias = {
        ...config.resolve.alias,
        // These modules should NEVER be imported in client components
        '@/lib/config': false,
        '@/lib/crypto': false,
      };
    }
    return config;
  },

  // Environment variable exposure
  // Only expose safe, non-secret flags to client
  env: {
    // No secrets exposed here - everything stays server-side
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
