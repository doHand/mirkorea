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
    <aside className="w-60 bg-slate-950 flex flex-col h-full select-none">
      {/* 로고 */}
      <div className="px-4 h-14 flex items-center justify-between border-b border-slate-800/80 shrink-0">
        <Link
          href="/"
          onClick={onClose}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Warehouse size={15} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-none tracking-tight">WMS Pro</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">창고 물류 관리</p>
          </div>
        </Link>
        <button
          onClick={onClose}
          className="lg:hidden p-1 rounded-lg hover:bg-slate-800 text-slate-500 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {sections.map(({ label, items }) => {
          const isOpen = !collapsed[label]
          return (
            <div key={label}>
              <button
                onClick={() => toggle(label)}
                className="w-full flex items-center justify-between px-2 py-1.5 mb-0.5 rounded-lg hover:bg-slate-800/60 transition-colors group"
              >
                <span className="text-[10px] font-semibold text-slate-500 group-hover:text-slate-400 uppercase tracking-widest">
                  {label}
                </span>
                <ChevronDown
                  size={12}
                  className={cn(
                    'text-slate-600 group-hover:text-slate-400 transition-transform duration-200 shrink-0',
                    isOpen ? 'rotate-0' : '-rotate-90'
                  )}
                />
              </button>
              <div
                className={cn(
                  'overflow-hidden transition-all duration-200',
                  isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
                )}
              >
                <div className="space-y-0.5 pb-2">
                  {items.map(({ href, label: itemLabel, menuId }) => {
                    const Icon = ICON_MAP[menuId] ?? LayoutDashboard
                    const active = pathname === href || (href !== '/' && pathname.startsWith(href))
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={onClose}
                        className={cn(
                          'group flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150',
                          active
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                            : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
                        )}
                      >
                        <Icon
                          size={16}
                          className={cn(
                            'shrink-0 transition-colors',
                            active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'
                          )}
                        />
                        <span className="flex-1 truncate">{itemLabel}</span>
                        {active && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />
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
      <div className="px-3 py-3 border-t border-slate-800/80 space-y-1 shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md">
            {user?.fullName?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-200 truncate leading-tight">{user?.fullName}</p>
            <span className="text-[10px] text-indigo-400 font-medium">{user?.role}</span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-800/80 hover:text-rose-400 transition-all duration-150"
        >
          <LogOut size={15} className="shrink-0" />
          로그아웃
        </button>
      </div>
    </aside>
  )
}
