import { Html, Head, Main, NextScript } from 'next/document'

const SITE_URL  = process.env.NEXT_PUBLIC_SITE_URL  || ''
const SITE_NAME = 'WMS Pro'
const DESCRIPTION =
  '효율적인 창고 물류 관리 시스템 — 입출고, 재고, 주문, 피킹을 한 곳에서 관리하세요.'
const OG_IMAGE  = SITE_URL ? `${SITE_URL}/og-image.png` : '/og-image.png'

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  description: DESCRIPTION,
  ...(SITE_URL && { url: SITE_URL }),
}

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  ...(SITE_URL && { url: SITE_URL }),
}

export default function Document() {
  return (
    <Html lang="ko" suppressHydrationWarning>
      <Head>
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* PWA */}
        <meta name="theme-color" content="#2f6f58" />
        <link rel="manifest" href="/manifest.json" />

        {/* Global Meta */}
        <meta name="application-name" content={SITE_NAME} />
        <meta name="description" content={DESCRIPTION} />
        <meta name="robots" content="noindex, nofollow" />
        {SITE_URL && <link rel="canonical" href={SITE_URL} />}

        {/* Open Graph */}
        <meta property="og:type"        content="website" />
        <meta property="og:site_name"   content={SITE_NAME} />
        <meta property="og:title"       content={SITE_NAME} />
        <meta property="og:description" content={DESCRIPTION} />
        {SITE_URL && <meta property="og:url" content={SITE_URL} />}
        <meta property="og:image"       content={OG_IMAGE} />
        <meta property="og:image:width"  content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:locale"      content="ko_KR" />

        {/* Twitter Card */}
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content={SITE_NAME} />
        <meta name="twitter:description" content={DESCRIPTION} />
        <meta name="twitter:image"       content={OG_IMAGE} />

        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
