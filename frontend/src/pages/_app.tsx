import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import { QueryProvider } from '@/providers/query-provider'
import { ToastProvider } from '@/providers/toast-provider'
import { ThemeProvider } from '@/providers/theme-provider'
import { ResizableTables } from '@/components/ResizableTables'
import DashboardLayout from '@/layouts/dashboard-layout'
import { useSSE } from '@/hooks/useSSE'
import '../styles/globals.css'

const AUTH_ROUTES = ['/login', '/register', '/forgot-password']

function SSEInitializer() {
  useSSE()
  return null
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const isAuth = AUTH_ROUTES.includes(router.pathname)

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <QueryProvider>
        <SSEInitializer />
        <ToastProvider />
        <ResizableTables />
        {isAuth ? (
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