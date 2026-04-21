import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  async headers() {
    const isProd = process.env.NODE_ENV === 'production';

    const securityHeaders = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      // CSP hanya di production — di development terlalu restrictive dan blokir HMR/DevTools
      ...(isProd ? [{
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: https:",
          "font-src 'self' data:",
          "connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com https://api.sms-man.com https://api.grizzlysms.com https://5sim.net wss://*.supabase.co",
          "frame-src https://challenges.cloudflare.com",
          "form-action 'self'",
          "base-uri 'self'",
        ].join('; '),
      }] : []),
    ];

    return [
      { source: '/(.*)', headers: securityHeaders },
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};

export default nextConfig;