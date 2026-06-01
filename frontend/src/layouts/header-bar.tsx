'use client'
import { Menu, Warehouse, Sun, Moon } from 'lucide-react'
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
  const { user } = useAuthStore()
  const { selectedWarehouse, setWarehouse } = useWarehouseStore()
  const { resolvedTheme, setTheme } = useTheme()

  const { data: warehouses = [] } = useQuery({
    queryKey: QUERY_KEYS.warehouses(),
    queryFn: warehouseApi.findAll,
  })

  const today = format(new Date(), 'yyyy년 M월 d일 EEEE', { locale: ko })

  return (
    <header className="h-14 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex items-center px-4 gap-3 shrink-0">
      {/* 모바일 햄버거 */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
        aria-label="메뉴 열기"
      >
        <Menu size={20} />
      </button>

      {/* 창고 선택 */}
      <div className="flex items-center gap-2">
        <Warehouse size={14} className="text-gray-400 shrink-0" />
        <select
          value={selectedWarehouse?.id ?? ''}
          onChange={(e) => {
            const wh = warehouses.find((w) => w.id === e.target.value)
            if (wh) setWarehouse(wh)
          }}
          className="text-sm bg-gray-50 dark:bg-gray-700 dark:text-gray-200 border-0 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-200 text-gray-700 font-medium cursor-pointer"
        >
          <option value="">창고 선택</option>
          {warehouses.map((wh) => (
            <option key={wh.id} value={wh.id}>{wh.name}</option>
          ))}
        </select>
      </div>

      <div className="flex-1" />

      {/* 날짜 */}
      <span className="hidden md:block text-xs text-gray-400 dark:text-gray-500">{today}</span>

      {/* 테마 토글 */}
      <button
        onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
        aria-label="테마 전환"
      >
        {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* 사용자 */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-xs shrink-0">
          {user?.fullName?.charAt(0) ?? 'U'}
        </div>
        <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
          {user?.fullName}
        </span>
      </div>
    </header>
  )
}
