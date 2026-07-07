import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data: *.supabase.co",
      "font-src 'self'",
      "connect-src 'self' *.supabase.co wss://*.supabase.co *.sentry.io *.ingest.sentry.io",
      "frame-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; '),
  },
]

const isDev = process.env.NODE_ENV === 'development'

const nextConfig: NextConfig = {
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS?.split(',').filter(Boolean) ?? [],
  async headers() {
    // Skip CSP in dev to avoid blocking local network access
    if (isDev) return []
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/**' }],
  },
}

export default nextConfig
