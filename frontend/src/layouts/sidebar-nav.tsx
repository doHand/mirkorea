'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Package, BarChart3, ArrowDownToLine, ArrowUpFromLine,
  Warehouse, ScanLine, ClipboardList, Settings, LayoutDashboard,
} from 'lucide-react'
import { cn } from '@/utils/cn'

const NAV_ITEMS = [
  { href: '/',            label: '대시보드',   icon: LayoutDashboard },
  { href: '/products',    label: '상품관리',   icon: Package },
  { href: '/inventory',   label: '재고조회',   icon: BarChart3 },
  { href: '/inbound',     label: '입고관리',   icon: ArrowDownToLine },
  { href: '/outbound',    label: '출고관리',   icon: ArrowUpFromLine },
  { href: '/scan',        label: '바코드 스캔', icon: ScanLine },
  { href: '/warehouse',   label: '창고/위치',  icon: Warehouse },
  { href: '/transactions',label: '로그 조회',  icon: ClipboardList },
  { href: '/settings',    label: '설정',       icon: Settings },
]

export function SidebarNav() {
  const pathname = usePathname()

  return (
    <aside className="w-56 bg-brand-900 text-white flex flex-col shrink-0">
      <div className="p-4 border-b border-brand-700">
        <h1 className="font-bold text-lg tracking-tight">WMS Pro</h1>
        <p className="text-xs text-brand-100 opacity-70 mt-0.5">창고 물류 관리</p>
      </div>

      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-brand-600 text-white font-medium'
                  : 'text-brand-100 opacity-80 hover:bg-brand-800 hover:opacity-100'
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
