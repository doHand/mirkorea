import type { AppProps } from 'next/app'
import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import Script from 'next/script'
import { QueryProvider } from '@/providers/query-provider'
import { ToastProvider } from '@/providers/toast-provider'
import { ThemeProvider } from '@/providers/theme-provider'
import { ResizableTables } from '@/components/ResizableTables'
import DashboardLayout from '@/layouts/dashboard-layout'
import { useSSE } from '@/hooks/useSSE'
import '../styles/globals.css'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'

const NO_LAYOUT_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password', '/404', '/500', '/privacy']
const GA_ID = process.env.NEXT_PUBLIC_GA_ID

function SSEInitializer() {
  useSSE()
  return null
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const isPublic =
    NO_LAYOUT_ROUTES.includes(router.pathname) || router.pathname === '/_error'

  // GA4 페이지 전환 추적
  const handleRouteChange = useCallback((url: string) => {
    if (GA_ID && typeof window !== 'undefined' && typeof (window as unknown as Record<string, unknown>).gtag === 'function') {
      ;(window as unknown as { gtag: (...args: unknown[]) => void }).gtag('config', GA_ID, { page_path: url })
    }
  }, [])

  useEffect(() => {
    router.events.on('routeChangeComplete', handleRouteChange)
    return () => router.events.off('routeChangeComplete', handleRouteChange)
  }, [router.events, handleRouteChange])

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <QueryProvider>
        {/* GA4 */}
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
            </Script>
          </>
        )}

        <SSEInitializer />
        <ToastProvider />
        <ResizableTables />
        {isPublic ? (
          <Component {...pageProps} />
        ) : (
          <DashboardLayout>
            <Component {...pageProps} />
          </DashboardLayout>
        )}
      </QueryProvider>
    </ThemeProvider>
  )
}
