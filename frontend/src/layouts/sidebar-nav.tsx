'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Package, BarChart3, Warehouse, ScanLine, ClipboardList,
  LayoutDashboard, LogOut, X, ChevronRight, ShieldCheck,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAuthStore } from '@/stores/auth.store'

const NAV_SECTIONS = [
  {
    label: '운영',
    items: [
      { href: '/',             label: '대시보드',    icon: LayoutDashboard, adminOnly: false },
      { href: '/products',     label: '상품 관리',   icon: Package,         adminOnly: false },
      { href: '/inventory',    label: '재고 조회',   icon: BarChart3,       adminOnly: false },
      { href: '/scan',         label: '바코드 스캔', icon: ScanLine,        adminOnly: false },
    ],
  },
  {
    label: '설정',
    items: [
      { href: '/warehouse',    label: '창고/위치',   icon: Warehouse,       adminOnly: false },
      { href: '/transactions', label: '이력 조회',   icon: ClipboardList,   adminOnly: false },
      { href: '/users',        label: '권한 관리',   icon: ShieldCheck,     adminOnly: true  },
    ],
  },
]

interface Props {
  onClose?: () => void
}

export function SidebarNav({ onClose }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, clearAuth } = useAuthStore()

  const handleLogout = () => {
    clearAuth()
    router.push('/login')
  }

  return (
    <aside className="w-60 bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 flex flex-col h-full shadow-sm">
      {/* 로고 */}
      <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
        <Link href="/" onClick={onClose} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-brand-500 rounded-xl flex items-center justify-center shadow-sm">
            <Warehouse size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 dark:text-white leading-none">WMS Pro</h1>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">창고 물류 관리</p>
          </div>
        </Link>
        <button
          onClick={onClose}
          className="lg:hidden p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* 사용자 정보 */}
      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-sm shrink-0">
            {user?.fullName?.charAt(0) ?? 'U'}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">{user?.fullName}</p>
            <span className="text-[10px] text-brand-500 font-medium">{user?.role}</span>
          </div>
        </div>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_SECTIONS.map(({ label, items }) => (
          <div key={label}>
            <p className="px-2 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5">
              {label}
            </p>
            <div className="space-y-0.5">
              {items.filter(({ adminOnly }) => !adminOnly || user?.role === 'ADMIN').map(({ href, label: itemLabel, icon: Icon }) => {
                const active = pathname === href || (href !== '/' && pathname.startsWith(href))
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all',
                      active
                        ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                    )}
                  >
                    <Icon size={16} className={active ? 'text-brand-500 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500'} />
                    <span className="flex-1">{itemLabel}</span>
                    {active && <ChevronRight size={12} className="text-brand-300 dark:text-brand-500" />}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* 로그아웃 */}
      <div className="px-3 py-3 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors"
        >
          <LogOut size={16} />
          로그아웃
        </button>
      </div>
    </aside>
  )
}
