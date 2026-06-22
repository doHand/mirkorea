import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/router'

const AUTH_ROUTES = ['/login', '/register', '/forgot-password']

// SSE 이벤트명 → 무효화할 React Query 키 prefix
const EVENT_QUERY_MAP: Record<string, string[]> = {
  inventory: ['inventory', 'transactions'],
  inbound:   ['inbound', 'inventory', 'transactions'],
  outbound:  ['outbound-orders', 'inventory', 'transactions'],
  audit:     ['audit-logs', 'alerts'],
}

export function useSSE() {
  const queryClient = useQueryClient()
  const router = useRouter()

  useEffect(() => {
    if (AUTH_ROUTES.includes(router.pathname)) return
    if (typeof window === 'undefined') return

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
    const es = new EventSource(`${apiUrl}/api/v1/sse/subscribe`)

    Object.entries(EVENT_QUERY_MAP).forEach(([eventName, queryKeys]) => {
      es.addEventListener(eventName, () => {
        queryKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: [key] })
        })
      })
    })

    es.onerror = () => {
      es.close()
    }

    return () => {
      es.close()
    }
  }, [router.pathname, queryClient])
}
