import type { Metadata, Viewport } from 'next'
import './globals.css'
import { QueryProvider } from '@/providers/query-provider'
import { ToastProvider } from '@/providers/toast-provider'

export const metadata: Metadata = {
  title: 'WMS Pro — 창고 물류 관리 시스템',
  description: '실시간 재고 기반 창고 물류 관리 시스템',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css" />
      </head>
      <body>
        <QueryProvider>
          <ToastProvider />
          {children}
        </QueryProvider>
      </body>
    </html>
  )
}
