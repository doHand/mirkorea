'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight, PanelRight } from 'lucide-react'
import { useMenuPermissionStore } from '@/stores/menu-permission.store'
import { useOpenTabsStore } from '@/stores/open-tabs.store'
import { cn } from '@/utils/cn'

function findMenuForPath(pathname: string, menus: { href: string; label: string }[]) {
  return menus
    .filter((menu) => menu.href === pathname || (menu.href !== '/' && pathname.startsWith(menu.href)))
    .sort((a, b) => b.href.length - a.href.length)[0]
}

export function OpenTabsBar() {
  const pathname  = usePathname()
  const router    = useRouter()
  const menus     = useMenuPermissionStore((s) => s.menus)
  const tabs      = useOpenTabsStore((s) => s.tabs)
  const addTab    = useOpenTabsStore((s) => s.addTab)
  const closeTab  = useOpenTabsStore((s) => s.closeTab)
  const splitHref = useOpenTabsStore((s) => s.splitHref)
  const setSplit  = useOpenTabsStore((s) => s.setSplit)

  const [draggingHref, setDraggingHref] = useState<string | null>(null)
  const [dropActive,   setDropActive]   = useState(false)

  useEffect(() => {
    const menu = findMenuForPath(pathname, menus)
    if (!menu) return
    addTab({ href: menu.href, label: menu.label })
  }, [addTab, menus, pathname])

  // Alt+← / Alt+→ 탭 이동
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
      if (tabs.length < 2) return
      e.preventDefault()
      const idx = tabs.findIndex(
        (t) => t.href === pathname || (t.href !== '/' && pathname.startsWith(t.href)),
      )
      if (idx < 0) return
      const next =
        e.key === 'ArrowRight'
          ? tabs[(idx + 1) % tabs.length]
          : tabs[(idx - 1 + tabs.length) % tabs.length]
      router.push(next.href)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [tabs, pathname, router])

  const handleClose = (href: string) => {
    const closingActive = pathname === href || (href !== '/' && pathname.startsWith(href))
    const index = tabs.findIndex((tab) => tab.href === href)
    const fallback = tabs[index - 1] ?? tabs[index + 1]
    closeTab(href)
    if (closingActive) router.push(fallback?.href ?? '/')
  }

  const activeIdx = tabs.findIndex(
    (t) => t.href === pathname || (t.href !== '/' && pathname.startsWith(t.href)),
  )
  const prevTab = activeIdx > 0 ? tabs[activeIdx - 1] : null
  const nextTab = activeIdx < tabs.length - 1 ? tabs[activeIdx + 1] : null

  if (tabs.length === 0) return null

  const isSplitTarget = draggingHref === splitHref

  return (
    <div className="h-10 min-w-0 bg-transparent shrink">
      <div className="h-full flex items-center gap-2">
        {/* 이전 / 다음 탭 이동 버튼 */}
        <div className="hidden sm:flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => prevTab && router.push(prevTab.href)}
            disabled={!prevTab}
            title="이전 탭 (Alt+←)"
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 disabled:opacity-25 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => nextTab && router.push(nextTab.href)}
            disabled={!nextTab}
            title="다음 탭 (Alt+→)"
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 disabled:opacity-25 transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* 탭 목록 */}
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-2xl border border-gray-200 bg-gray-100/80 p-1 shadow-inner dark:border-slate-700 dark:bg-slate-800/80">
          {tabs.map((tab) => {
            const active  = pathname === tab.href || (tab.href !== '/' && pathname.startsWith(tab.href))
            const isSplit = splitHref === tab.href
            return (
              <div
                key={tab.href}
                draggable
                onDragStart={(e) => {
                  setDraggingHref(tab.href)
                  e.dataTransfer.setData('tab-href', tab.href)
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                onDragEnd={() => { setDraggingHref(null); setDropActive(false) }}
                className={cn(
                  'group relative h-8 min-w-0 max-w-44 flex items-center rounded-xl border text-sm transition-all shrink-0 cursor-grab active:cursor-grabbing select-none',
                  active
                    ? 'bg-white border-blue-200 text-blue-700 shadow-md shadow-blue-950/10 dark:bg-slate-950 dark:border-indigo-500 dark:text-indigo-100'
                    : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-white/70 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700/80',
                  isSplit ? 'ring-1 ring-violet-400 dark:ring-violet-500' : '',
                )}
              >
                {active && (
                  <span className="absolute inset-x-3 -bottom-1 h-0.5 rounded-full bg-blue-500 dark:bg-indigo-400" />
                )}
                <Link
                  href={tab.href}
                  draggable={false}
                  className="min-w-0 flex-1 px-3 py-1.5 truncate"
                >
                  {tab.label}
                </Link>
                <button
                  onClick={() => handleClose(tab.href)}
                  className={cn(
                    'mr-1 p-1 rounded-md transition-colors',
                    active
                      ? 'text-blue-400 hover:text-rose-500 hover:bg-rose-50 dark:text-indigo-200 dark:hover:text-rose-300 dark:hover:bg-rose-900/20'
                      : 'text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20',
                  )}
                  aria-label={`${tab.label} 탭 닫기`}
                >
                  <X size={12} />
                </button>
              </div>
            )
          })}
        </div>

        {/* 분리 드롭존: 탭 드래그 중에만 나타남 */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDropActive(true) }}
          onDragLeave={() => setDropActive(false)}
          onDrop={(e) => {
            e.preventDefault()
            const href = e.dataTransfer.getData('tab-href')
            setSplit(href === splitHref ? null : href)
            setDraggingHref(null)
            setDropActive(false)
          }}
          className={cn(
            'flex items-center gap-1.5 px-2.5 rounded-lg border-2 border-dashed text-xs transition-all duration-150 shrink-0 self-center',
            draggingHref
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none w-0 overflow-hidden px-0',
            dropActive
              ? isSplitTarget
                ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-400 text-rose-500'
                : 'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : isSplitTarget
                ? 'bg-gray-50 dark:bg-slate-800 border-rose-300 text-rose-400'
                : 'bg-gray-50 dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-500',
          )}
        >
          <PanelRight size={12} />
          {isSplitTarget ? '분리 닫기' : '여기에 놓아 분리'}
        </div>

        {/* 분리 중인 경우 닫기 버튼 (항상 표시) */}
        {splitHref && !draggingHref && (
          <button
            onClick={() => setSplit(null)}
            title="분리 닫기"
            className="shrink-0 self-center p-1 rounded text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
          >
            <PanelRight size={14} className="text-violet-500" />
          </button>
        )}
      </div>
    </div>
  )
}
