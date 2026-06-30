import { GetServerSideProps } from 'next'

// 사이트맵은 공개 접근 가능한 페이지만 포함 (인증 필요 페이지 제외)
const PUBLIC_PAGES = [
  { path: '/login',           priority: '1.0', changefreq: 'monthly' },
  { path: '/register',        priority: '0.5', changefreq: 'monthly' },
  { path: '/forgot-password', priority: '0.3', changefreq: 'yearly'  },
]

function Sitemap() {
  return null
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com'
  const now = new Date().toISOString().split('T')[0]

  const urls = PUBLIC_PAGES.map(
    ({ path, priority, changefreq }) => `
  <url>
    <loc>${siteUrl}${path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
  ).join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>`

  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, must-revalidate')
  res.write(xml)
  res.end()

  return { props: {} }
}

export default Sitemap
