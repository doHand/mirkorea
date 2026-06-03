'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useMenuPermissionStore } from '@/stores/menu-permission.store'
import { useOpenTabsStore } from '@/stores/open-tabs.store'
import { cn } from '@/utils/cn'

function findMenuForPath(pathname: string, menus: { href: string; label: string }[]) {
  return menus
    .filter((menu) => menu.href === pathname || (menu.href !== '/' && pathname.startsWith(menu.href)))
    .sort((a, b) => b.href.length - a.href.length)[0]
}

export function OpenTabsBar() {
  const pathname = usePathname()
  const router = useRouter()
  const menus = useMenuPermissionStore((s) => s.menus)
  const tabs = useOpenTabsStore((s) => s.tabs)
  const addTab = useOpenTabsStore((s) => s.addTab)
  const closeTab = useOpenTabsStore((s) => s.closeTab)

  useEffect(() => {
    const menu = findMenuForPath(pathname, menus)
    if (!menu) return
    addTab({ href: menu.href, label: menu.label })
  }, [addTab, menus, pathname])

  const handleClose = (href: string) => {
    const closingActive = pathname === href || (href !== '/' && pathname.startsWith(href))
    const index = tabs.findIndex((tab) => tab.href === href)
    const fallback = tabs[index - 1] ?? tabs[index + 1]

    closeTab(href)
    if (closingActive) router.push(fallback?.href ?? '/')
  }

  if (tabs.length === 0) return null

  return (
    <div className="h-10 bg-[#fefdfb]/95 dark:bg-gray-950/90 border-b border-[#ede5d8] dark:border-slate-800 shrink-0">
      <div className="h-full flex items-end gap-1 overflow-x-auto px-3 pt-1">
        {tabs.map((tab) => {
          const active = pathname === tab.href || (tab.href !== '/' && pathname.startsWith(tab.href))
          return (
            <div
              key={tab.href}
              className={cn(
                'group h-8 min-w-0 max-w-44 flex items-center rounded-t-xl border text-sm transition-colors',
                active
                  ? 'bg-indigo-600 dark:bg-indigo-500 border-indigo-600 dark:border-indigo-400 border-b-indigo-600 dark:border-b-indigo-500 text-white shadow-sm shadow-indigo-500/30'
                  : 'bg-[#f5efe6] dark:bg-slate-900 border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-800',
              )}
            >
              <Link href={tab.href} className="min-w-0 flex-1 px-3 py-1.5 truncate">
                {tab.label}
              </Link>
              <button
                onClick={() => handleClose(tab.href)}
                className={cn(
                  'mr-1 p-1 rounded-md transition-colors',
                  active
                    ? 'text-white/75 hover:text-white hover:bg-white/15'
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
    </div>
  )
}
