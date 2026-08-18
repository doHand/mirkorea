'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { useMenuPermissionStore } from '@/stores/menu-permission.store'
import { useOpenTabsStore } from '@/stores/open-tabs.store'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { useQuery } from '@tanstack/react-query'
import { warehouseApi } from '@/api/warehouse.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { SidebarNav } from '@/layouts/sidebar-nav'
import { HeaderBar } from '@/layouts/header-bar'
import { OpenTabsBar, SplitTabsBar } from '@/layouts/open-tabs-bar'
import type { UserRole } from '@/types/api.types'

function findMenuForPath<T extends { href: string }>(pathname: string, menus: T[]) {
  return menus
    .filter((menu) =>
      menu.href === pathname
      || (menu.href !== '/' && pathname.startsWith(`${menu.href}/`)),
    )
    .sort((a, b) => b.href.length - a.href.length)[0]
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router        = useRouter()
  const isAuth        = useAuthStore((s) => s.isAuth)
  const hasHydrated   = useAuthStore((s) => s._hasHydrated)
  const setHasHydrated = useAuthStore((s) => s.setHasHydrated)
  const splitHref     = useOpenTabsStore((s) => s.splitHref)
  const setSplit      = useOpenTabsStore((s) => s.setSplit)
  const splitTabs     = useOpenTabsStore((s) => s.splitTabs)
  const closeSplitTab = useOpenTabsStore((s) => s.closeSplitTab)
  const clearSplitTabs = useOpenTabsStore((s) => s.clearSplitTabs)
  const splitRatio    = useOpenTabsStore((s) => s.splitRatio)
  const setSplitRatio = useOpenTabsStore((s) => s.setSplitRatio)
  const user          = useAuthStore((s) => s.user)
  const warehouse     = useWarehouseStore((s) => s.selectedWarehouse)
  const setWarehouse  = useWarehouseStore((s) => s.setWarehouse)
  const menus         = useMenuPermissionStore((s) => s.menus)

  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (hasHydrated) return
    const fallback = window.setTimeout(() => setHasHydrated(true), 1000)
    return () => window.clearTimeout(fallback)
  }, [hasHydrated, setHasHydrated])

  const { data: warehouses = [] } = useQuery({
    queryKey: QUERY_KEYS.warehouses(),
    queryFn:  warehouseApi.findAll,
    enabled:  hasHydrated && isAuth,
  })

  const [isEmbed, setIsEmbed] = useState(false)

  useEffect(() => {
    setIsEmbed(
      window.parent !== window
      || new URLSearchParams(window.location.search).get('embed') === '1',
    )
  }, [router.asPath])

  const containerRef   = useRef<HTMLDivElement>(null)
  const mainPanelRef   = useRef<HTMLDivElement>(null)
  const splitPanelRef  = useRef<HTMLDivElement>(null)
  const [isResizing, setIsResizing] = useState(false)
  const draggingTabHref = useOpenTabsStore((s) => s.draggingHref)
  const setDraggingTabHref = useOpenTabsStore((s) => s.setDraggingHref)
  const tabs           = useOpenTabsStore((s) => s.tabs)
  const addSplitTab    = useOpenTabsStore((s) => s.addSplitTab)
  const [workspaceDropActive, setWorkspaceDropActive] = useState(false)

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    const container = containerRef.current
    if (!container) return

    const onMove = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const ratio = ((ev.clientY - rect.top) / rect.height) * 100
      const clamped = Math.min(80, Math.max(20, ratio))
      if (mainPanelRef.current)  mainPanelRef.current.style.height  = `${clamped}%`
      if (splitPanelRef.current) splitPanelRef.current.style.height = `${100 - clamped}%`
    }

    const onUp = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const ratio = ((ev.clientY - rect.top) / rect.height) * 100
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

    const { sessionExpiresAt, clearAuth, extendSession } = useAuthStore.getState()

    if (sessionExpiresAt && Date.now() > sessionExpiresAt) {
      fetch('/api/auth/refresh', { method: 'POST' })
        .then((r) => {
          if (r.ok) {
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
  }, [hasHydrated, isAuth, router])

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

  const currentMenu = useMemo(
    () => findMenuForPath(router.pathname, menus),
    [menus, router.pathname],
  )
  const role = user?.role as UserRole | undefined
  const isRouteAllowed = !currentMenu || (!!role && currentMenu.roles.includes(role))

  if (!hasHydrated) return (
    <div className="app-shell app-loader h-screen w-full flex flex-col items-center justify-center gap-4">
      <div className="app-loader-mark w-8 h-8 rounded flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
        </svg>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="app-loader-dot w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:0ms]" />
        <div className="app-loader-dot w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:150ms]" />
        <div className="app-loader-dot-muted w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  )

  if (!isAuth) return null

  if (!isRouteAllowed) {
    return (
      <div className="app-shell flex h-screen overflow-hidden">
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
        <main className="min-w-0 flex-1 overflow-y-auto">
          <HeaderBar onMenuClick={() => setSidebarOpen(true)} />
          <div className="flex min-h-[calc(100vh-56px)] items-center justify-center px-4">
            <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h1 className="text-base font-bold text-gray-900 dark:text-white">접근 권한이 없습니다</h1>
              <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
                현재 계정으로는 이 메뉴를 열 수 없습니다.
              </p>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="mt-5 rounded bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
              >
                대시보드로 이동
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (isEmbed) {
    return (
      <EmbedLayout>
        {children}
      </EmbedLayout>
    )
  }

  return (
    <div className="app-shell flex h-screen overflow-hidden">
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

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden app-surface border-0 rounded-none dark:bg-slate-950">
        <HeaderBar onMenuClick={() => setSidebarOpen(true)}>
          <div className="wms-tabs-layout flex w-full min-w-0 flex-col items-stretch">
            <div className="wms-main-tabs flex min-w-0 w-full">
              <OpenTabsBar />
            </div>
            {splitHref && (
              <div className="wms-split-tabs flex min-w-0 w-full border-t border-gray-200 pt-1 dark:border-slate-700">
                <SplitTabsBar />
              </div>
            )}
          </div>
        </HeaderBar>

        <div
          ref={containerRef}
          className="app-workspace wms-workspace relative flex-1 flex flex-col min-w-0 overflow-hidden dark:bg-slate-950"
          style={{ cursor: isResizing ? 'row-resize' : undefined }}
          onDragOver={(e) => {
            if (!draggingTabHref && !e.dataTransfer.types.includes('tab-href')) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            setWorkspaceDropActive(true)
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return
            setWorkspaceDropActive(false)
          }}
          onDrop={(e) => {
            e.preventDefault()
            const href = e.dataTransfer.getData('tab-href')
            const tab = tabs.find((t) => t.href === href)
            if (tab) addSplitTab(tab)
            setWorkspaceDropActive(false)
            setDraggingTabHref(null)
          }}
        >
          {draggingTabHref && (
            <div
              className={[
                'pointer-events-none absolute inset-x-4 bottom-4 z-20 flex h-1/3 items-center justify-center rounded-lg border-2 border-dashed text-xs font-medium transition-colors',
                workspaceDropActive
                  ? 'app-tab-drop-active dark:bg-amber-900/20'
                  : 'border-gray-300 text-gray-400 dark:border-slate-600 dark:text-slate-500',
              ].join(' ')}
            >
              여기에 놓으면 화면 아래로 분할됩니다
            </div>
          )}

          <div
            ref={mainPanelRef}
            className="wms-main-panel overflow-auto p-4 lg:p-5"
            style={{ height: splitHref ? `${splitRatio}%` : '100%' }}
          >
            {children}
          </div>

          {splitHref && (
            <>
              <div
                onMouseDown={startResize}
                className="wms-split-divider h-1 w-full shrink-0 cursor-row-resize wms-splitter transition-colors"
              />

              <div
                ref={splitPanelRef}
                className="wms-split-panel flex flex-col bg-white dark:bg-slate-900 overflow-hidden"
                style={{ height: `${100 - splitRatio}%` }}
              >
                <div className="hidden">
                  {splitTabs.map((tab) => (
                    <div
                      key={tab.href}
                      className={[
                        'flex h-8 min-w-0 max-w-48 shrink-0 items-center rounded-t-lg text-xs',
                        splitHref === tab.href
                          ? 'bg-white text-gray-900 border border-b-white border-gray-200 dark:bg-slate-900 dark:text-white dark:border-slate-700 dark:border-b-slate-900'
                          : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-700',
                      ].join(' ')}
                    >
                      <button
                        type="button"
                        onClick={() => setSplit(tab.href)}
                        className="min-w-0 flex-1 truncate py-1 pl-2.5 pr-1 text-left"
                      >
                        {tab.label}
                      </button>
                      <button
                        type="button"
                        onClick={() => closeSplitTab(tab.href)}
                        title={`${tab.label} 닫기`}
                        className="mr-1 flex h-4 w-4 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-slate-600 dark:hover:text-white"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={clearSplitTabs}
                    title="분리 닫기"
                    className="ml-auto mb-1.5 shrink-0 p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
                <div className="relative flex-1">
                  {splitTabs.map((tab) => (
                    <iframe
                      key={tab.href}
                      src={`${tab.href}?embed=1`}
                      className={[
                        'absolute inset-0 h-full w-full border-0',
                        splitHref === tab.href ? 'block' : 'hidden',
                      ].join(' ')}
                      title={tab.label}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function EmbedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="app-embed h-screen overflow-auto p-4 dark:bg-slate-950 lg:p-5">
      <div className="min-h-full">
        {children}
      </div>
    </div>
  )
}
