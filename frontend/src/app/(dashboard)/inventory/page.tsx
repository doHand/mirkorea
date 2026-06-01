'use client'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Search } from 'lucide-react'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { stockApi } from '@/api/stock.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { formatNumber } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { Inventory } from '@/types/api.types'

export default function InventoryPage() {
  const warehouse  = useWarehouseStore((s) => s.selectedWarehouse)
  const [search,   setSearch]   = useState('')
  const [belowOnly, setBelowOnly] = useState(false)

  const { data: lowStock = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.lowStock(warehouse?.id ?? ''),
    queryFn:  () => stockApi.getLowStock(warehouse!.id),
    enabled:  !!warehouse?.id,
    refetchInterval: 30_000,
  })

  const { data: summary } = useQuery({
    queryKey: QUERY_KEYS.invSummary(warehouse?.id ?? ''),
    queryFn:  () => stockApi.getSummary(warehouse!.id),
    enabled:  !!warehouse?.id,
  })

  const filtered = useMemo(() => {
    let list: Inventory[] = lowStock
    if (belowOnly) list = list.filter((i) => i.quantity <= (i.product?.safetyStock ?? 0))
    if (search) {
      const s = search.toLowerCase()
      list = list.filter(
        (i) => i.product?.name.toLowerCase().includes(s) || i.product?.code.toLowerCase().includes(s)
      )
    }
    return list
  }, [lowStock, belowOnly, search])

  if (!warehouse) {
    return <div className="flex items-center justify-center h-64 text-gray-400">창고를 먼저 선택하세요</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">재고 현황</h2>
          <p className="text-sm text-gray-500">전체 SKU: {formatNumber(summary?.totalSkus)} / 총 수량: {formatNumber(summary?.totalQty)}</p>
        </div>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="상품명 또는 코드 검색"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={belowOnly} onChange={(e) => setBelowOnly(e.target.checked)} />
          안전재고 미달만
        </label>
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">상품</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">위치</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">현재고</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">예약</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">가용</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">안전재고</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">로딩 중...</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">데이터가 없습니다</td></tr>
            )}
            {filtered.map((inv) => {
              const isBelowSafety = inv.quantity <= (inv.product?.safetyStock ?? 0)
              const available     = inv.quantity - inv.reservedQty
              return (
                <tr key={inv.id} className={cn(isBelowSafety && 'bg-red-50')}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{inv.product?.name}</p>
                    <p className="text-xs text-gray-400">{inv.product?.code}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{inv.location?.code}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">
                    {formatNumber(inv.quantity)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 tabular-nums">
                    {formatNumber(inv.reservedQty)}
                  </td>
                  <td className={cn('px-4 py-3 text-right tabular-nums font-medium', available <= 0 && 'text-red-600')}>
                    {formatNumber(available)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 tabular-nums">
                    {formatNumber(inv.product?.safetyStock)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isBelowSafety ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        <AlertTriangle size={11} /> 미달
                      </span>
                    ) : (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">정상</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
