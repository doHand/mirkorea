'use client'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Search } from 'lucide-react'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { stockApi } from '@/api/stock.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { formatNumber } from '@/utils/format'
import { cn } from '@/utils/cn'
import { ExportButton } from '@/components/ExportButton'
import type { Inventory } from '@/types/api.types'

export default function InventoryPage() {
  const warehouse  = useWarehouseStore((s) => s.selectedWarehouse)
  const [search,   setSearch]   = useState('')
  const [belowOnly, setBelowOnly] = useState(false)

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.inventory({ warehouseId: warehouse?.id ?? '' }),
    queryFn:  () => stockApi.getInventory(warehouse!.id),
    enabled:  !!warehouse?.id,
    refetchInterval: 30_000,
  })

  const { data: summary } = useQuery({
    queryKey: QUERY_KEYS.invSummary(warehouse?.id ?? ''),
    queryFn:  () => stockApi.getSummary(warehouse!.id),
    enabled:  !!warehouse?.id,
  })

  const filtered = useMemo(() => {
    let list: Inventory[] = inventory
    if (belowOnly) list = list.filter((i) => i.quantity <= (i.product?.safetyStock ?? 0))
    if (search) {
      const s = search.toLowerCase()
      list = list.filter(
        (i) => i.product?.name.toLowerCase().includes(s) || i.product?.code.toLowerCase().includes(s)
      )
    }
    return list
  }, [inventory, belowOnly, search])

  if (!warehouse) {
    return <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">창고를 먼저 선택하세요</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">재고 현황</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">전체 SKU: {formatNumber(summary?.totalSkus)} / 총 수량: {formatNumber(summary?.totalQty)}</p>
        </div>
        <ExportButton
          filename="재고현황"
          getData={() => filtered.map((inv) => ({
            '상품코드':    inv.product?.code ?? '',
            '상품명':      inv.product?.name ?? '',
            '위치코드':    inv.location?.code ?? '',
            '원가':        inv.product?.costPrice ?? 0,
            '판매가':      inv.product?.sellPrice ?? 0,
            '현재고':      inv.quantity,
            '예약수량':    inv.reservedQty,
            '가용수량':    inv.quantity - inv.reservedQty,
            '안전재고':    inv.product?.safetyStock ?? 0,
          }))}
        />
      </div>

      {/* 필터 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="상품명 또는 코드 검색"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
          <input type="checkbox" checked={belowOnly} onChange={(e) => setBelowOnly(e.target.checked)} />
          안전재고 미달만
        </label>
      </div>

      {/* 목록 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">상품</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">위치</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">원가</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">판매가</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">현재고</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">예약</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">가용</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">안전재고</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading && (
              <tr><td colSpan={9} className="text-center py-10 text-gray-400 dark:text-gray-500">로딩 중...</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center py-10 text-gray-400 dark:text-gray-500">데이터가 없습니다</td></tr>
            )}
            {filtered.map((inv) => {
              const isBelowSafety = inv.quantity <= (inv.product?.safetyStock ?? 0)
              const available     = inv.quantity - inv.reservedQty
              return (
                <tr key={inv.id} className={cn(isBelowSafety ? 'bg-red-50 dark:bg-red-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50')}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{inv.product?.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{inv.product?.code}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{inv.location?.code}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-400">
                    {formatNumber(inv.product?.costPrice)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-400">
                    {formatNumber(inv.product?.sellPrice)}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-gray-900 dark:text-gray-100">
                    {formatNumber(inv.quantity)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 tabular-nums">
                    {formatNumber(inv.reservedQty)}
                  </td>
                  <td className={cn('px-4 py-3 text-right tabular-nums font-medium', available <= 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100')}>
                    {formatNumber(available)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 dark:text-gray-500 tabular-nums">
                    {formatNumber(inv.product?.safetyStock)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isBelowSafety ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full">
                        <AlertTriangle size={11} /> 미달
                      </span>
                    ) : (
                      <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">정상</span>
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
