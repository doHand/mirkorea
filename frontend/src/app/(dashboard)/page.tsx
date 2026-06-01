'use client'
import { useQuery } from '@tanstack/react-query'
import { Package, TrendingDown, Warehouse, AlertTriangle } from 'lucide-react'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { stockApi } from '@/api/stock.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { formatNumber } from '@/utils/format'

export default function DashboardPage() {
  const warehouse = useWarehouseStore((s) => s.selectedWarehouse)

  const { data: summary } = useQuery({
    queryKey: QUERY_KEYS.invSummary(warehouse?.id ?? ''),
    queryFn:  () => stockApi.getSummary(warehouse!.id),
    enabled:  !!warehouse?.id,
  })

  const { data: lowStock = [] } = useQuery({
    queryKey: QUERY_KEYS.lowStock(warehouse?.id ?? ''),
    queryFn:  () => stockApi.getLowStock(warehouse!.id),
    enabled:  !!warehouse?.id,
  })

  if (!warehouse) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <Warehouse size={40} className="mx-auto mb-2 opacity-40" />
          <p>상단에서 창고를 선택해주세요</p>
        </div>
      </div>
    )
  }

  const cards = [
    { label: '전체 SKU',    value: summary?.totalSkus,      icon: Package,      color: 'bg-blue-50  text-blue-600' },
    { label: '총 재고 수량', value: summary?.totalQty,       icon: Warehouse,    color: 'bg-green-50 text-green-600' },
    { label: '안전재고 미달', value: summary?.lowStockCount,  icon: TrendingDown, color: 'bg-red-50   text-red-600' },
    { label: '경고 품목',    value: lowStock.length,         icon: AlertTriangle,color: 'bg-yellow-50 text-yellow-600' },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{warehouse.name} 현황</h2>
        <p className="text-sm text-gray-500">실시간 재고 모니터링</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">{label}</span>
              <span className={`p-2 rounded-lg ${color}`}><Icon size={16} /></span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatNumber(value ?? 0)}</p>
          </div>
        ))}
      </div>

      {/* 안전재고 미달 목록 */}
      {lowStock.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            안전재고 미달 상품
          </h3>
          <div className="space-y-2">
            {lowStock.slice(0, 10).map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <span className="text-sm font-medium">{inv.product?.name}</span>
                  <span className="text-xs text-gray-400 ml-2">{inv.location?.code}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-red-600">{formatNumber(inv.quantity)}</span>
                  <span className="text-xs text-gray-400 ml-1">/ 안전:{formatNumber(inv.product?.safetyStock)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
