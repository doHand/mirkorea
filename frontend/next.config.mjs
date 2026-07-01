/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== 'production'

const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  ...(isDev ? ["'unsafe-eval'"] : []),
  'https://t1.daumcdn.net',
  'https://www.googletagmanager.com',
].join(' ')

const connectSrc = [
  "'self'",
  ...(isDev ? ['http://localhost:*', 'ws://localhost:*'] : []),
  'https://www.google-analytics.com',
  'https://analytics.google.com',
  'https://t1.daumcdn.net',
].join(' ')

const ContentSecurityPolicy = [
  "default-src 'self'",
  // Next.js Pages Router는 인라인 스크립트(__NEXT_DATA__ 등)를 사용하므로 unsafe-inline 필요
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  // 바코드 카메라 스캔(@zxing)이 blob: 을 사용
  "img-src 'self' data: blob: https://www.google-analytics.com https://www.googletagmanager.com",
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options',           value: 'DENY' },
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  // camera는 @zxing 바코드 스캔 기능에 필요하므로 허용 유지
  { key: 'Permissions-Policy',        value: 'microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy',   value: ContentSecurityPolicy },
]

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },

  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/:path*`,
      },
    ]
  },
}

export default nextConfig
