'use client'
import { Menu, Sun, Moon, ChevronDown } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { useQuery } from '@tanstack/react-query'
import { warehouseApi } from '@/api/warehouse.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useTheme } from 'next-themes'

interface Props {
  onMenuClick?: () => void
}

export function HeaderBar({ onMenuClick }: Props) {
  const { user }                        = useAuthStore()
  const { selectedWarehouse, setWarehouse } = useWarehouseStore()
  const { resolvedTheme, setTheme }     = useTheme()

  const { data: warehouses = [] } = useQuery({
    queryKey: QUERY_KEYS.warehouses(),
    queryFn:  warehouseApi.findAll,
  })

  const today = format(new Date(), 'M월 d일 EEEE', { locale: ko })

  return (
    <header className="h-14 bg-[#fefdfb]/95 dark:bg-gray-950/90 backdrop-blur-md border-b border-[#ede5d8] dark:border-slate-800 flex items-center px-4 gap-3 shrink-0 sticky top-0 z-30">
      {/* 모바일 햄버거 */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 transition-colors"
        aria-label="메뉴 열기"
      >
        <Menu size={20} />
      </button>

      {/* 창고 선택 */}
      <div className="relative flex items-center">
        <select
          value={selectedWarehouse?.id ?? ''}
          onChange={(e) => {
            const wh = warehouses.find((w) => w.id === e.target.value)
            if (wh) setWarehouse(wh)
          }}
          className="appearance-none pl-3 pr-8 py-1.5 text-sm bg-[#f5efe6] dark:bg-slate-800 border border-[#ede5d8] dark:border-slate-700 rounded-xl text-gray-800 dark:text-gray-200 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors hover:border-[#c9b99e] dark:hover:border-slate-600"
        >
          <option value="">창고 선택</option>
          {warehouses.map((wh) => (
            <option key={wh.id} value={wh.id}>{wh.name}</option>
          ))}
        </select>
        <ChevronDown size={13} className="absolute right-2.5 text-gray-400 pointer-events-none" />
      </div>

      <div className="flex-1" />

      {/* 날짜 */}
      <span className="hidden md:block text-xs text-gray-400 dark:text-slate-500 font-medium tabular-nums">
        {today}
      </span>

      {/* 다크 모드 토글 */}
      <button
        onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 transition-colors"
        aria-label="테마 전환"
      >
        {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* 사용자 */}
      <div className="flex items-center gap-2 pl-1">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-md shadow-indigo-500/20">
          {user?.fullName?.charAt(0)?.toUpperCase() ?? 'U'}
        </div>
        <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-slate-300 max-w-[120px] truncate">
          {user?.fullName}
        </span>
      </div>
    </header>
  )
}
