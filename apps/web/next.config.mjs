const isProd = process.env.NODE_ENV === 'production';

const origin = (url, fallback) => {
  try {
    return new URL(url || fallback).origin;
  } catch {
    return new URL(fallback).origin;
  }
};

// Origins the browser may talk to. Derived from the same env vars the app uses
// at runtime, so the CSP always matches the deployed API (Render) and never
// hardcodes localhost in production.
const apiOrigin = origin(process.env.NEXT_PUBLIC_API_URL, 'http://localhost:3001');
const wsOrigin = origin(process.env.NEXT_PUBLIC_WS_URL, apiOrigin);
const wsSocketOrigin = wsOrigin.replace(/^http/, 'ws');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel builds its own output; standalone is only for the Docker image.
  output: process.env.VERCEL ? undefined : 'standalone',
  poweredByHeader: false,

  images: {
    // Restrict remote image sources to prevent SSRF via Next.js image optimizer
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // 'unsafe-eval' is only needed by Next's dev/HMR runtime.
              `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://res.cloudinary.com https://storage.googleapis.com",
              "font-src 'self' data:",
              `connect-src 'self' ${[...new Set([apiOrigin, wsOrigin, wsSocketOrigin])].join(' ')}`,
              "frame-ancestors 'none'",
            ].join('; '),
          },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
      {
        // Allow the file proxy to be embedded in iframes from the same origin
        source: '/api/file-proxy',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
