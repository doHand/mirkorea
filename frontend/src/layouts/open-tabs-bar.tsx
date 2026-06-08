'use client'

import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { X, PanelRight } from 'lucide-react'
import { useMenuPermissionStore } from '@/stores/menu-permission.store'
import { useOpenTabsStore } from '@/stores/open-tabs.store'
import { cn } from '@/utils/cn'

function findMenuForPath(pathname: string, menus: { href: string; label: string }[]) {
  return menus
    .filter((menu) => menu.href === pathname || (menu.href !== '/' && pathname.startsWith(menu.href)))
    .sort((a, b) => b.href.length - a.href.length)[0]
}

export function OpenTabsBar() {
  const router    = useRouter()
  const pathname  = router.pathname
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

  const currentMenu = findMenuForPath(pathname, menus)
  if (!currentMenu) return null

  const isSplitTarget = draggingHref === splitHref

  const handleClose = (href: string) => {
    closeTab(href)
    const isActive = href === currentMenu.href
    if (isActive) {
      const idx = tabs.findIndex((t) => t.href === href)
      const remaining = tabs.filter((t) => t.href !== href)
      const next = remaining[idx] ?? remaining[idx - 1] ?? null
      router.push(next ? next.href : '/')
    }
  }

  return (
    <>
      <div className="min-w-0 flex-1 flex items-end gap-0.5 overflow-x-auto pt-1.5">

        {tabs.map((tab) => {
          const active = tab.href === currentMenu.href
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
                'group relative h-[34px] -mb-px min-w-0 max-w-56 flex items-center rounded-t-lg text-[12px] font-medium transition-all shrink-0 cursor-grab active:cursor-grabbing select-none',
                active
                  ? 'bg-[#F8F6F1] dark:bg-slate-950 text-gray-900 dark:text-white border-t border-l border-r border-gray-200 dark:border-slate-700 z-10'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100/80 dark:hover:bg-slate-800/50',
                splitHref === tab.href ? 'ring-1 ring-[#D2691E]/50 ring-inset' : '',
              )}
            >
              <Link
                href={tab.href}
                draggable={false}
                className="min-w-0 flex-1 truncate py-1 pl-3.5 pr-1"
              >
                {tab.label}
              </Link>
              <button
                onClick={(e) => { e.preventDefault(); handleClose(tab.href) }}
                className="mr-1.5 w-[16px] h-[16px] flex items-center justify-center rounded transition-colors shrink-0 text-gray-400 hover:text-gray-700 hover:bg-gray-200 dark:hover:bg-slate-600"
                aria-label={`${tab.label} 탭 닫기`}
              >
                <X size={10} />
              </button>
            </div>
          )
        })}

        {/* 분리 드롭존 */}
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
            'flex items-center gap-1 px-2 h-7 mb-1 self-center rounded-lg border text-[10px] transition-all duration-150 shrink-0',
            draggingHref
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none w-0 overflow-hidden px-0',
            dropActive
              ? isSplitTarget
                ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-400 text-rose-500'
                : 'bg-amber-50 dark:bg-amber-900/20 border-[#D2691E] text-[#D2691E]'
              : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-400',
          )}
        >
          <PanelRight size={11} />
          <span className="whitespace-nowrap">{isSplitTarget ? '분리 닫기' : '분리 보기'}</span>
        </div>

        {splitHref && !draggingHref && (
          <button
            onClick={() => setSplit(null)}
            title="분리 닫기"
            className="shrink-0 p-1.5 mb-1 self-center rounded-lg text-[#D2691E]/60 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
          >
            <PanelRight size={13} />
          </button>
        )}

      </div>
    </>
  )
}
