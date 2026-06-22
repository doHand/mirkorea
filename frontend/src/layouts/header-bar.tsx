'use client'
import type { ReactNode } from 'react'
import { Menu, Sun, Moon, Warehouse } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useTheme } from 'next-themes'

interface Props {
  onMenuClick?: () => void
  children?: ReactNode
}

export function HeaderBar({ onMenuClick, children }: Props) {
  const { user }                    = useAuthStore()
  const { resolvedTheme, setTheme } = useTheme()
  const warehouse                   = useWarehouseStore((s) => s.selectedWarehouse)

  const today = format(new Date(), 'M/d (EEE)', { locale: ko })

  return (
    <header className="bg-white dark:bg-slate-900 shrink-0 sticky top-0 z-30 border-b border-[#E5D3B3]/70 dark:border-slate-700">
      {/* 상단 컨트롤 행 */}
      <div className="h-[38px] flex items-center px-3 lg:px-4 gap-2">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 transition-colors"
          aria-label="메뉴 열기"
        >
          <Menu size={17} />
        </button>

        <div className="hidden lg:flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#D2691E]" />
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#2D4033] dark:text-[#E5D3B3]">Operations console</span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5">
          {warehouse && (
            <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded bg-[#F9F7F2] dark:bg-slate-800 border border-[#E5D3B3] dark:border-slate-700">
              <Warehouse size={11} className="text-[#D2691E] shrink-0" />
              <span className="text-[11px] font-medium text-gray-600 dark:text-slate-300 max-w-[80px] truncate">
                {warehouse.name}
              </span>
            </div>
          )}

          <span className="hidden md:block text-[11px] text-gray-400 dark:text-slate-500 font-medium tabular-nums px-1">
            {today}
          </span>

          <div className="h-4 w-px bg-gray-200 dark:bg-slate-700" />

          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
            aria-label="테마 전환"
          >
            {resolvedTheme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>

          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded bg-[#D2691E] flex items-center justify-center text-white font-bold text-xs shrink-0">
              {user?.fullName?.charAt(0)?.toUpperCase() ?? 'U'}
            </div>
            <span className="hidden sm:block text-[12px] font-medium text-gray-700 dark:text-slate-300 max-w-[100px] truncate">
              {user?.fullName}
            </span>
          </div>
        </div>
      </div>

      {/* 탭 행 — border-b가 있고 활성 탭이 이를 끊어냄 */}
      <div className="flex items-end px-2 lg:px-3 bg-[#F9F7F2]/70 dark:bg-slate-900 border-t border-[#E5D3B3]/45 dark:border-slate-800">
        {children}
      </div>
    </header>
  )
}
