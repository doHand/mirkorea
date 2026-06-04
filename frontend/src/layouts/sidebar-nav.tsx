'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  Package, BarChart3, Warehouse, ScanLine, ClipboardList,
  LayoutDashboard, LogOut, X, ShieldCheck, UserCog, Tags, LayoutGrid,
  Hash, Barcode, FileText, BoxSelect, FlaskConical, Ruler, ChevronDown,
  PackageCheck, Building2, Receipt, FileCog, Users, Shield,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAuthStore } from '@/stores/auth.store'
import { useMenuPermissionStore } from '@/stores/menu-permission.store'
import type { UserRole } from '@/types/api.types'

const SECTION_STYLES = [
  {
    bar: 'bg-indigo-500',
    text: 'text-indigo-700 dark:text-indigo-100',
    bg: 'bg-indigo-50/80 dark:bg-indigo-950/50',
    border: 'border-indigo-100 dark:border-indigo-700/60',
  },
  {
    bar: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-100',
    bg: 'bg-emerald-50/80 dark:bg-emerald-950/50',
    border: 'border-emerald-100 dark:border-emerald-700/60',
  },
  {
    bar: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-100',
    bg: 'bg-amber-50/80 dark:bg-amber-950/50',
    border: 'border-amber-100 dark:border-amber-700/60',
  },
  {
    bar: 'bg-sky-500',
    text: 'text-sky-700 dark:text-sky-100',
    bg: 'bg-sky-50/80 dark:bg-sky-950/50',
    border: 'border-sky-100 dark:border-sky-700/60',
  },
  {
    bar: 'bg-rose-500',
    text: 'text-rose-700 dark:text-rose-100',
    bg: 'bg-rose-50/80 dark:bg-rose-950/50',
    border: 'border-rose-100 dark:border-rose-700/60',
  },
]

const ICON_MAP: Record<string, React.ElementType> = {
  dashboard:          LayoutDashboard,
  products:           Package,
  inventory:          BarChart3,
  scan:               ScanLine,
  'product-codes':    Hash,
  barcodes:           Barcode,
  'product-attrs':    FileText,
  'box-qty':          BoxSelect,
  lot:                FlaskConical,
  units:              Ruler,
  inbound:            PackageCheck,
  pricing:            Tags,
  warehouse:          Warehouse,
  transactions:       ClipboardList,
  users:              ShieldCheck,
  'menu-permissions': LayoutGrid,
  profile:            UserCog,
  clients:            Building2,
  quotes:             Receipt,
  'supplier-settings': FileCog,
  'role-management':   Shield,
  'permissions':       Users,
}

interface Props {
  onClose?: () => void
}

export function SidebarNav({ onClose }: Props) {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, clearAuth } = useAuthStore()
  const menus        = useMenuPermissionStore((s) => s.menus)
  const sectionOrder = useMenuPermissionStore((s) => s.sectionOrder)

  const handleLogout = () => {
    clearAuth()
    router.push('/login')
  }

  const role = user?.role as UserRole | undefined
  const visibleMenus = menus.filter((m) => role && m.roles.includes(role))

  const sections = sectionOrder
    .map((section) => ({ label: section, items: visibleMenus.filter((m) => m.section === section) }))
    .filter((s) => s.items.length > 0)

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const toggle = (label: string) =>
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }))

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-gray-200/80 dark:border-slate-700 flex flex-col h-full select-none shadow-xl shadow-gray-200/50 dark:shadow-black/20">
      {/* 로고 */}
      <div className="px-4 h-16 flex items-center justify-between border-b border-gray-200/80 dark:border-slate-700 shrink-0 bg-white dark:bg-slate-900">
        <Link
          href="/"
          onClick={onClose}
          className="flex items-center gap-3 hover:opacity-85 transition-opacity"
        >
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm shadow-indigo-500/25">
            <Warehouse size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-950 dark:text-white leading-none">WMS Pro</h1>
            <p className="text-[11px] text-gray-500 dark:text-slate-300 mt-1">창고 물류 관리</p>
          </div>
        </Link>
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-300 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-2.5 bg-gray-50/70 dark:bg-slate-900">
        {sections.map(({ label, items }, sectionIndex) => {
          const isOpen = !collapsed[label]
          const style = SECTION_STYLES[sectionIndex % SECTION_STYLES.length]
          return (
            <div key={label} className={cn('rounded-2xl border p-1.5 transition-colors', style.bg, style.border)}>
              <button
                onClick={() => toggle(label)}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-white/70 dark:hover:bg-slate-800/80 transition-colors group"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className={cn('w-1.5 h-5 rounded-full shrink-0', style.bar)} />
                  <span className={cn('text-xs font-bold truncate', style.text)}>
                    {label}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md bg-white/80 dark:bg-slate-800/90 text-[10px] tabular-nums text-gray-500 dark:text-slate-100 border border-white/70 dark:border-slate-700">
                    {items.length}
                  </span>
                </span>
                <ChevronDown size={13} className={cn('text-gray-400 dark:text-slate-300 transition-transform duration-200 shrink-0', isOpen ? 'rotate-0' : '-rotate-90')} />
              </button>
              <div
                className={cn(
                  'overflow-hidden transition-all duration-200',
                  isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
                )}
              >
                <div className="space-y-1 pt-1">
                  {items.map(({ href, label: itemLabel, menuId }) => {
                    const Icon = ICON_MAP[menuId] ?? LayoutDashboard
                    const active = pathname === href || (href !== '/' && pathname.startsWith(href))
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={onClose}
                        className={cn(
                          'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 border',
                          active
                            ? 'bg-white dark:bg-indigo-950/80 border-indigo-200 dark:border-indigo-500 text-indigo-700 dark:text-indigo-100 shadow-sm'
                            : 'border-transparent text-gray-600 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800/90 hover:text-gray-950 dark:hover:text-white hover:border-white/80 dark:hover:border-slate-700'
                        )}
                      >
                        <Icon
                          size={16}
                          className={cn(
                            'shrink-0 transition-colors',
                            active ? 'text-indigo-600 dark:text-indigo-100' : 'text-gray-400 dark:text-slate-400 group-hover:text-gray-700 dark:group-hover:text-white'
                          )}
                        />
                        <span className="flex-1 truncate">{itemLabel}</span>
                        {active && (
                          <span className="w-1.5 h-6 rounded-full bg-indigo-500 shrink-0" />
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </nav>

      {/* 사용자 + 로그아웃 */}
      <div className="px-3 py-3 border-t border-gray-200/80 dark:border-slate-700 space-y-1 shrink-0 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl bg-gray-50 dark:bg-slate-800/90 border border-gray-100 dark:border-slate-700">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">
            {user?.fullName?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-800 dark:text-slate-200 truncate leading-tight">{user?.fullName}</p>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">{user?.role}</span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-500 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 dark:hover:text-rose-200 transition-all duration-150"
        >
          <LogOut size={15} className="shrink-0" />
          로그아웃
        </button>
      </div>
    </aside>
  )
}
