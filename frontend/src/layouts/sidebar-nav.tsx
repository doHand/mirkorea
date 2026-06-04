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
    bar: 'bg-blue-400',
    text: 'text-blue-100',
    bg: 'bg-white/[0.04]',
    border: 'border-white/10',
  },
  {
    bar: 'bg-emerald-400',
    text: 'text-emerald-100',
    bg: 'bg-white/[0.04]',
    border: 'border-white/10',
  },
  {
    bar: 'bg-amber-300',
    text: 'text-amber-100',
    bg: 'bg-white/[0.04]',
    border: 'border-white/10',
  },
  {
    bar: 'bg-cyan-300',
    text: 'text-cyan-100',
    bg: 'bg-white/[0.04]',
    border: 'border-white/10',
  },
  {
    bar: 'bg-rose-300',
    text: 'text-rose-100',
    bg: 'bg-white/[0.04]',
    border: 'border-white/10',
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
    <aside className="w-64 bg-[#1d2a3d] text-slate-200 flex flex-col h-full select-none shadow-2xl shadow-slate-950/25 lg:rounded-[20px] lg:overflow-hidden">
      {/* 로고 */}
      <div className="px-4 h-16 flex items-center justify-between border-b border-white/10 shrink-0 bg-[#1d2a3d]">
        <Link
          href="/"
          onClick={onClose}
          className="flex items-center gap-3 hover:opacity-85 transition-opacity"
        >
          <div className="w-9 h-9 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Warehouse size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-none">WMS Pro</h1>
            <p className="text-[11px] text-slate-400 mt-1">창고 물류 관리</p>
          </div>
        </Link>
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 text-slate-300 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-2.5 bg-[#1d2a3d]">
        {sections.map(({ label, items }, sectionIndex) => {
          const isOpen = !collapsed[label]
          const style = SECTION_STYLES[sectionIndex % SECTION_STYLES.length]
          return (
            <div key={label} className={cn('rounded-2xl border p-1.5 transition-colors', style.bg, style.border)}>
              <button
                onClick={() => toggle(label)}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-white/[0.08] transition-colors group"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className={cn('w-1.5 h-5 rounded-full shrink-0', style.bar)} />
                  <span className={cn('text-xs font-bold truncate', style.text)}>
                    {label}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-[10px] tabular-nums text-slate-200 border border-white/10">
                    {items.length}
                  </span>
                </span>
                <ChevronDown size={13} className={cn('text-slate-400 transition-transform duration-200 shrink-0', isOpen ? 'rotate-0' : '-rotate-90')} />
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
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-500 border-blue-400/60 text-white shadow-lg shadow-blue-950/30'
                            : 'border-transparent text-slate-300 hover:bg-white/10 hover:text-white hover:border-white/10'
                        )}
                      >
                        <Icon
                          size={16}
                          className={cn(
                            'shrink-0 transition-colors',
                            active ? 'text-white' : 'text-slate-500 group-hover:text-white'
                          )}
                        />
                        <span className="flex-1 truncate">{itemLabel}</span>
                        {active && (
                          <span className="w-1.5 h-6 rounded-full bg-white/80 shrink-0" />
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
      <div className="px-3 py-3 border-t border-white/10 space-y-1 shrink-0 bg-[#1d2a3d]">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl bg-white/[0.06] border border-white/10">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">
            {user?.fullName?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate leading-tight">{user?.fullName}</p>
            <span className="text-[10px] text-blue-200 font-medium">{user?.role}</span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-400 hover:bg-rose-500/10 hover:text-rose-200 transition-all duration-150"
        >
          <LogOut size={15} className="shrink-0" />
          로그아웃
        </button>
      </div>
    </aside>
  )
}
