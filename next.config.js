/** @type {import('next').NextConfig} */
const baseSecurityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Content-Security-Policy', value: "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com https://www.google-analytics.com https://region1.google-analytics.com; frame-src 'self' https://challenges.cloudflare.com; upgrade-insecure-requests" }
];

const nextConfig = {
  images: {
    formats: ['image/avif','image/webp'],
    remotePatterns: process.env.NEXT_PUBLIC_SUPABASE_URL ? [{ protocol:'https', hostname:new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, pathname:'/storage/v1/object/public/**' }] : [],
    maximumRedirects: 0,
    dangerouslyAllowLocalIP: false
  },
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/(.*)', headers: baseSecurityHeaders },
      { source: '/admin/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store, max-age=0' }, { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }] },
      { source: '/api/admin/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store, max-age=0' }] }
    ];
  }
};
module.exports = nextConfig;
