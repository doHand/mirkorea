'use client'
import { useRouter } from 'next/navigation'
import { LogOut, User, ChevronDown } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { useQuery } from '@tanstack/react-query'
import { warehouseApi } from '@/api/warehouse.api'
import { QUERY_KEYS } from '@/constants/query-keys'

export function HeaderBar() {
  const router = useRouter()
  const { user, clearAuth } = useAuthStore()
  const { selectedWarehouse, setWarehouse } = useWarehouseStore()

  const { data: warehouses = [] } = useQuery({
    queryKey: QUERY_KEYS.warehouses(),
    queryFn:  warehouseApi.findAll,
  })

  const handleLogout = () => {
    clearAuth()
    router.push('/login')
  }

  return (
    <header className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-4 shrink-0">
      {/* 창고 선택 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">창고:</span>
        <select
          value={selectedWarehouse?.id ?? ''}
          onChange={(e) => {
            const w = warehouses.find((wh) => wh.id === e.target.value)
            if (w) setWarehouse(w)
          }}
          className="text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">창고 선택</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>

      <div className="flex-1" />

      {/* 사용자 정보 */}
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <User size={14} className="text-gray-400" />
        <span>{user?.fullName}</span>
        <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{user?.role}</span>
      </div>

      <button
        onClick={handleLogout}
        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
        title="로그아웃"
      >
        <LogOut size={15} />
      </button>
    </header>
  )
}
