'use client'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import {
  LogOut, ChevronDown, Warehouse, LayoutDashboard, Package, Barcode, Ruler, Tags,
  ArrowDownToLine, ArrowUpFromLine, ScanLine, History, ClipboardCheck, Building2,
  FileText, Users, Settings, Bell, UserCircle, BookOpen, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAuthStore } from '@/stores/auth.store'
import { useMenuPermissionStore } from '@/stores/menu-permission.store'
import type { UserRole } from '@/types/api.types'

// Menu IDs are stable even when administrators rename menu labels, so icons remain consistent.
const MENU_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard, help: BookOpen, products: Package, inventory: ClipboardCheck, scan: ScanLine,
  barcodes: Barcode, 'product-attrs': Package, units: Ruler, categories: Tags, inbound: ArrowDownToLine,
  outbound: ArrowUpFromLine, warehouse: Warehouse, transactions: History,
  'inventory-audit': ClipboardCheck, clients: Building2, quotes: FileText, users: Users,
  'menu-permissions': Settings, 'supplier-settings': Settings,
  'audit-logs': History, alerts: Bell, profile: UserCircle,
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
    <aside className="app-sidebar">

      {/* 로고 영역 */}
      <div className="app-sidebar-brand flex items-center justify-between shrink-0">
        <Link
          href="/"
          onClick={onClose}
          className="flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          <div className="app-sidebar-logo shrink-0">
            <Warehouse size={15} className="text-white" />
          </div>
          <div>
            <h1 className="app-sidebar-title text-[13px] font-bold leading-none">MK WMS</h1>
            <p className="app-sidebar-caption text-[9px] mt-1 font-medium">창고 물류 관리 시스템</p>
          </div>
        </Link>
        <button
          onClick={onClose}
          className="app-sidebar-close lg:hidden px-1.5 py-0.5 text-[11px] rounded-lg transition-colors"
        >
          닫기
        </button>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {sections.map(({ label, items }, sectionIndex) => {
          const isOpen = !collapsed[label]
          return (
            <div key={label} className={cn(sectionIndex > 0 ? 'mt-0.5' : '')}>
              {/* 섹션 헤더 */}
              <button
                onClick={() => toggle(label)}
                className="app-sidebar-section w-full flex items-center gap-2 px-2.5 py-2 transition-colors group"
              >
                <span className="app-sidebar-section-label text-[10px] font-bold tracking-[0.08em] transition-colors flex-1 text-left truncate">
                  {label}
                </span>
                <ChevronDown
                  size={11}
                  className={cn(
                    'app-sidebar-section-icon transition-transform duration-200 shrink-0',
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
                <div className="px-0.5 pb-1 space-y-0.5">
                  {items.map(({ href, label: itemLabel, menuId }) => {
                    const Icon = MENU_ICONS[menuId] ?? Settings
                    const active = pathname === href || (href !== '/' && pathname.startsWith(href))
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={onClose}
                        className={cn(
                          'app-sidebar-link group relative flex items-center gap-2 px-2.5 py-2 text-[12px] transition-all duration-150',
                          active
                            ? 'app-sidebar-link-active font-semibold'
                            : 'font-medium',
                        )}
                      >
                        {active && (
                          <span className="app-sidebar-active-marker absolute left-0 inset-y-[8px] w-[3px]" />
                        )}
                        <Icon
                          size={15}
                          aria-hidden="true"
                          className="app-sidebar-link-icon shrink-0"
                        />
                        <span className="flex-1 truncate">{itemLabel}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>

              {/* 섹션 구분선 (마지막 제외) */}
              {sectionIndex < sections.length - 1 && (
                <div className="app-sidebar-divider mx-3 mt-2 border-b" />
              )}
            </div>
          )
        })}
      </nav>

      {/* 사용자 + 로그아웃 */}
      <div className="app-sidebar-footer px-3 py-3 border-t space-y-1 shrink-0">
        <div className="app-sidebar-user flex items-center gap-2 px-2.5 py-2">
          <div className="app-sidebar-avatar font-bold text-xs shrink-0">
            {user?.fullName?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="app-sidebar-user-name text-[11px] font-semibold truncate leading-tight">{user?.fullName}</p>
            <span className="app-sidebar-role text-[10px] font-medium">{user?.role}</span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="app-sidebar-logout w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12px] transition-all duration-150"
        >
          <LogOut size={13} className="shrink-0" />
          로그아웃
        </button>
      </div>
    </aside>
  )
}
