'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { useOpenTabsStore } from '@/stores/open-tabs.store'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { useQuery } from '@tanstack/react-query'
import { warehouseApi } from '@/api/warehouse.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { SidebarNav } from '@/layouts/sidebar-nav'
import { HeaderBar } from '@/layouts/header-bar'
import { OpenTabsBar } from '@/layouts/open-tabs-bar'
import { cn } from '@/utils/cn'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router        = useRouter()
  const pathname      = usePathname()
  const isAuth        = useAuthStore((s) => s.isAuth)
  const hasHydrated   = useAuthStore((s) => s._hasHydrated)
  const sessionExpiry = useAuthStore((s) => s.sessionExpiresAt)
  const extendSession = useAuthStore((s) => s.extendSession)
  const clearAuth     = useAuthStore((s) => s.clearAuth)
  const splitHref     = useOpenTabsStore((s) => s.splitHref)
  const setSplit      = useOpenTabsStore((s) => s.setSplit)
  const splitRatio    = useOpenTabsStore((s) => s.splitRatio)
  const setSplitRatio = useOpenTabsStore((s) => s.setSplitRatio)
  const tabs          = useOpenTabsStore((s) => s.tabs)
  const user          = useAuthStore((s) => s.user)
  const warehouse     = useWarehouseStore((s) => s.selectedWarehouse)
  const setWarehouse  = useWarehouseStore((s) => s.setWarehouse)

  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { data: warehouses = [] } = useQuery({
    queryKey: QUERY_KEYS.warehouses(),
    queryFn:  warehouseApi.findAll,
    enabled:  hasHydrated && isAuth,
  })

  // 임베드 감지: lazy init으로 플래시 없이 즉시 결정
  const [isEmbed] = useState(() =>
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('embed') === '1'
      : false,
  )

  const containerRef   = useRef<HTMLDivElement>(null)
  const mainPanelRef   = useRef<HTMLDivElement>(null)
  const splitPanelRef  = useRef<HTMLDivElement>(null)
  const [isResizing, setIsResizing] = useState(false)

  // 분리 패널 경계 드래그로 크기 조절
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    const container = containerRef.current
    if (!container) return

    const onMove = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const ratio = ((ev.clientX - rect.left) / rect.width) * 100
      const clamped = Math.min(80, Math.max(20, ratio))
      if (mainPanelRef.current)  mainPanelRef.current.style.width  = `${clamped}%`
      if (splitPanelRef.current) splitPanelRef.current.style.width = `${100 - clamped}%`
    }

    const onUp = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const ratio = ((ev.clientX - rect.left) / rect.width) * 100
      setSplitRatio(ratio)
      setIsResizing(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [setSplitRatio])

  useEffect(() => {
    if (!hasHydrated) return
    if (!isAuth) {
      router.push('/login')
      return
    }

    if (sessionExpiry && Date.now() > sessionExpiry) {
      const refreshToken = localStorage.getItem('refresh_token')
      if (!refreshToken) {
        clearAuth()
        router.push('/login')
        return
      }
      fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
        .then((r) => r.json())
        .then((json) => {
          if (json?.data?.accessToken) {
            localStorage.setItem('access_token', json.data.accessToken)
            localStorage.setItem('refresh_token', json.data.refreshToken)
            extendSession()
          } else {
            clearAuth()
            router.push('/login')
          }
        })
        .catch(() => {
          clearAuth()
          router.push('/login')
        })
    } else {
      extendSession()
    }
  }, [hasHydrated, isAuth]) // eslint-disable-line react-hooks/exhaustive-deps

  // iframe 내부에서 보낸 navigate 메시지 수신 → splitHref 동기화 (embed 모드에서는 no-op)
  useEffect(() => {
    if (isEmbed) return
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'split-navigate') setSplit(e.data.href)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [isEmbed, setSplit])

  useEffect(() => {
    if (!warehouses.length) return

    const activeWarehouses = warehouses.filter((w) => w.isActive)
    const candidates = activeWarehouses.length ? activeWarehouses : warehouses
    const userWarehouse = user?.warehouseId
      ? candidates.find((w) => w.id === user.warehouseId)
      : null
    const current = warehouse
      ? candidates.find((w) => w.id === warehouse.id)
      : null

    if (!current) setWarehouse(userWarehouse ?? candidates[0])
  }, [setWarehouse, user?.warehouseId, warehouse, warehouses])

  if (!hasHydrated || !isAuth) return null

  // 임베드 모드: 미니 탭바 + 콘텐츠
  if (isEmbed) {
    return (
      <EmbedLayout tabs={tabs} pathname={pathname} router={router}>
        {children}
      </EmbedLayout>
    )
  }

  const splitLabel = tabs.find((t) => t.href === splitHref)?.label

  return (
    <div className="flex h-screen overflow-hidden bg-[#c8d1e7] p-0 lg:gap-1 lg:p-6 dark:bg-slate-950">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div
        className={[
          'fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out lg:inset-y-auto',
          'lg:relative lg:z-auto lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        <SidebarNav onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white shadow-2xl shadow-slate-900/10 backdrop-blur lg:rounded-[22px] dark:bg-slate-950">
        <HeaderBar onMenuClick={() => setSidebarOpen(true)}>
          <OpenTabsBar />
        </HeaderBar>

        {/* 메인 + 분리 패널 */}
        <div
          ref={containerRef}
          className="flex-1 flex min-w-0 overflow-hidden bg-[#f6f8fc] dark:bg-slate-950"
          style={{ cursor: isResizing ? 'col-resize' : undefined }}
        >
          {/* 메인 패널 */}
          <div
            ref={mainPanelRef}
            className="overflow-auto p-4 lg:p-6"
            style={{ width: splitHref ? `${splitRatio}%` : '100%' }}
          >
            {children}
          </div>

          {splitHref && (
            <>
              {/* 크기 조절 핸들 */}
              <div
                onMouseDown={startResize}
                className="w-1 shrink-0 cursor-col-resize bg-gray-200 dark:bg-slate-700 hover:bg-indigo-400 dark:hover:bg-indigo-500 transition-colors active:bg-indigo-500"
              />

              {/* 분리 패널 */}
              <div
                ref={splitPanelRef}
                className="flex flex-col bg-white dark:bg-slate-900 overflow-hidden"
                style={{ width: `${100 - splitRatio}%` }}
              >
                <div className="h-8 shrink-0 flex items-center justify-between px-3 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    {splitLabel}
                  </span>
                  <button
                    onClick={() => setSplit(null)}
                    title="분리 닫기"
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
                <iframe
                  key={splitHref}
                  src={`${splitHref}?embed=1`}
                  className="flex-1 border-0 w-full"
                  title={splitLabel}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 분리 패널 embed 전용 레이아웃 ─────────────────────────────────────────────
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import type { OpenTab } from '@/stores/open-tabs.store'

function EmbedLayout({
  tabs, pathname, router, children,
}: {
  tabs: OpenTab[]
  pathname: string
  router: AppRouterInstance
  children: React.ReactNode
}) {
  // 페이지 이동 시 부모 프레임에 알림 → splitHref 동기화
  useEffect(() => {
    if (typeof window !== 'undefined' && window.parent !== window) {
      window.parent.postMessage(
        { type: 'split-navigate', href: pathname },
        window.location.origin,
      )
    }
  }, [pathname])

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-100 dark:bg-slate-950">
      {/* 미니 탭바 */}
      <div className="h-8 shrink-0 flex items-end gap-0.5 px-2 pt-1 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 overflow-x-auto">
        {tabs.map((tab) => {
          const active = pathname === tab.href || (tab.href !== '/' && pathname.startsWith(tab.href))
          return (
            <button
              key={tab.href}
              onClick={() => router.push(`${tab.href}?embed=1`)}
              className={cn(
                'h-7 px-2.5 text-[11px] font-medium rounded-t-lg shrink-0 whitespace-nowrap transition-colors',
                active
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800',
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      {/* 콘텐츠 */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        {children}
      </div>
    </div>
  )
}
