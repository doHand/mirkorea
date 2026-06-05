'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import type { NextRouter } from 'next/router'
import { X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { useOpenTabsStore } from '@/stores/open-tabs.store'
import { useMenuPermissionStore } from '@/stores/menu-permission.store'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { useQuery } from '@tanstack/react-query'
import { warehouseApi } from '@/api/warehouse.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { SidebarNav } from '@/layouts/sidebar-nav'
import { HeaderBar } from '@/layouts/header-bar'
import { OpenTabsBar } from '@/layouts/open-tabs-bar'
import { cn } from '@/utils/cn'
import type { OpenTab } from '@/stores/open-tabs.store'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router        = useRouter()
  const pathname      = router.pathname
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
  const menus         = useMenuPermissionStore((s) => s.menus)
  const user          = useAuthStore((s) => s.user)
  const warehouse     = useWarehouseStore((s) => s.selectedWarehouse)
  const setWarehouse  = useWarehouseStore((s) => s.setWarehouse)

  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { data: warehouses = [] } = useQuery({
    queryKey: QUERY_KEYS.warehouses(),
    queryFn:  warehouseApi.findAll,
    enabled:  hasHydrated && isAuth,
  })

  const [isEmbed] = useState(() =>
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('embed') === '1'
      : false,
  )

  const containerRef   = useRef<HTMLDivElement>(null)
  const mainPanelRef   = useRef<HTMLDivElement>(null)
  const splitPanelRef  = useRef<HTMLDivElement>(null)
  const [isResizing, setIsResizing] = useState(false)

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

  if (!hasHydrated) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-[#142318] dark:bg-[#0a0f0b] gap-4">
      <div className="w-10 h-10 rounded-xl bg-[#D2691E] flex items-center justify-center shadow-lg shadow-[#D2691E]/30">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
        </svg>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 bg-[#D2691E] rounded-full animate-bounce [animation-delay:0ms]" />
        <div className="w-1.5 h-1.5 bg-[#D2691E]/70 rounded-full animate-bounce [animation-delay:150ms]" />
        <div className="w-1.5 h-1.5 bg-[#D2691E]/40 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  )

  if (!isAuth) return null

  if (isEmbed) {
    return (
      <EmbedLayout tabs={tabs} pathname={pathname} router={router}>
        {children}
      </EmbedLayout>
    )
  }

  const splitLabel = menus.find((m) => m.href === splitHref)?.label ?? splitHref ?? ''

  return (
    <div className="flex h-screen overflow-hidden bg-[#F9F7F2] dark:bg-[#0a0f0b]">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
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

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white dark:bg-slate-950 border-l border-[#203127] dark:border-white/5">
        <HeaderBar onMenuClick={() => setSidebarOpen(true)}>
          <OpenTabsBar />
        </HeaderBar>

        <div
          ref={containerRef}
          className="wms-workspace flex-1 flex min-w-0 overflow-hidden bg-[#F9F7F2] dark:bg-slate-950"
          style={{ cursor: isResizing ? 'col-resize' : undefined }}
        >
          <div
            ref={mainPanelRef}
            className="overflow-auto p-3 lg:p-5"
            style={{ width: splitHref ? `${splitRatio}%` : '100%' }}
          >
            {children}
          </div>

          {splitHref && (
            <>
              <div
                onMouseDown={startResize}
                className="w-1 shrink-0 cursor-col-resize bg-gray-200 dark:bg-slate-700 hover:bg-[#D2691E] dark:hover:bg-[#c05c18] transition-colors active:bg-[#D2691E]"
              />

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

function EmbedLayout({
  tabs, pathname, router, children,
}: {
  tabs: OpenTab[]
  pathname: string
  router: NextRouter
  children: React.ReactNode
}) {
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
                  ? 'bg-[#D2691E] text-white'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800',
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        {children}
      </div>
    </div>
  )
}
