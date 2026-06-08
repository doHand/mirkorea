'use client'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import {
  Package, BarChart3, Warehouse, ScanLine, ClipboardList,
  LayoutDashboard, LogOut, X, ShieldCheck, UserCog, Tags, LayoutGrid,
  Hash, Barcode, FileText, BoxSelect, FlaskConical, Ruler, ChevronDown,
  PackageCheck, Building2, Receipt, FileCog, Users, Shield, Tag,
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
  categories:         Tag,
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
  const router   = useRouter()
  const pathname = router.pathname
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
    <aside className="w-[248px] bg-[#2D4033] text-[#F9F7F2] flex flex-col h-full select-none shadow-xl shadow-black/15">

      {/* 로고 영역 */}
      <div className="px-4 h-[68px] flex items-center justify-between shrink-0 border-b border-[#E5D3B3]/20">
        <Link
          href="/"
          onClick={onClose}
          className="flex items-center gap-3 hover:opacity-90 transition-opacity"
        >
          <div className="w-9 h-9 bg-[#F9F7F2] border border-[#E5D3B3]/70 rounded-md flex items-center justify-center shrink-0">
            <Warehouse size={18} className="text-[#2D4033]" />
          </div>
          <div>
            <h1 className="text-[14px] font-bold text-white leading-none">MK WMS</h1>
            <p className="text-[10px] text-slate-500 mt-0.5 tracking-wide">창고 물류 관리 시스템</p>
          </div>
        </Link>
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 text-slate-400 transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5">
        {sections.map(({ label, items }, sectionIndex) => {
          const isOpen = !collapsed[label]
          return (
            <div key={label} className={cn(sectionIndex > 0 ? 'mt-1' : '')}>
              {/* 섹션 헤더 */}
              <button
                onClick={() => toggle(label)}
                className="w-full flex items-center gap-2 px-4 py-1.5 hover:bg-black/10 transition-colors group"
              >
                <span className="text-[10px] font-bold tracking-[0.08em] text-[#E5D3B3]/55 group-hover:text-[#E5D3B3]/85 transition-colors flex-1 text-left truncate">
                  {label}
                </span>
                <ChevronDown
                  size={11}
                  className={cn(
                    'text-[#E5D3B3]/40 group-hover:text-[#E5D3B3]/75 transition-transform duration-200 shrink-0',
                    isOpen ? 'rotate-0' : '-rotate-90',
                  )}
                />
              </button>

              {/* 섹션 아이템 */}
              <div
                className={cn(
                  'overflow-hidden transition-all duration-200',
                  isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0',
                )}
              >
                <div className="px-2 pb-1 space-y-0.5">
                  {items.map(({ href, label: itemLabel, menuId }) => {
                    const Icon   = ICON_MAP[menuId] ?? LayoutDashboard
                    const active = pathname === href || (href !== '/' && pathname.startsWith(href))
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={onClose}
                        className={cn(
                          'group relative flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-all duration-150',
                          active
                            ? 'bg-[#F9F7F2] text-[#2D4033] font-semibold shadow-sm'
                            : 'text-[#F9F7F2]/65 font-medium hover:bg-black/10 hover:text-white',
                        )}
                      >
                        {active && (
                          <span className="absolute left-0 inset-y-[6px] w-[3px] bg-[#D2691E] rounded-r-full" />
                        )}
                        <Icon
                          size={15}
                          className={cn(
                            'shrink-0 transition-colors',
                            active
                              ? 'text-[#D2691E]'
                              : 'text-[#E5D3B3]/45 group-hover:text-[#E5D3B3]',
                          )}
                        />
                        <span className="flex-1 truncate">{itemLabel}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>

              {/* 섹션 구분선 (마지막 제외) */}
              {sectionIndex < sections.length - 1 && (
                <div className="mx-4 mt-1 border-b border-[#E5D3B3]/10" />
              )}
            </div>
          )
        })}
      </nav>

      {/* 사용자 + 로그아웃 */}
      <div className="px-3 py-3 border-t border-[#E5D3B3]/20 space-y-1 shrink-0">
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-md bg-black/10 border border-[#E5D3B3]/10">
          <div className="w-7 h-7 rounded-md bg-[#D2691E] flex items-center justify-center text-white font-bold text-xs shrink-0">
            {user?.fullName?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-white truncate leading-tight">{user?.fullName}</p>
            <span className="text-[10px] text-[#E5D3B3]/60 font-medium">{user?.role}</span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] text-[#E5D3B3]/55 hover:bg-black/10 hover:text-white transition-all duration-150"
        >
          <LogOut size={14} className="shrink-0" />
          로그아웃
        </button>
      </div>
    </aside>
  )
}
