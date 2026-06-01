'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { stockApi } from '@/api/stock.api'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { QUERY_KEYS } from '@/constants/query-keys'
import { TX_TYPE_LABEL, TX_TYPE_COLOR } from '@/constants/stock.constants'
import { formatDateTime, formatQtyDelta, formatNumber } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { TxType } from '@/types/api.types'

export default function TransactionsPage() {
  const warehouse = useWarehouseStore((s) => s.selectedWarehouse)
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [txType, setTxType] = useState<TxType | ''>('')
  const [from,   setFrom]   = useState('')
  const [to,     setTo]     = useState('')

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.transactions({ warehouseId: warehouse?.id, txType: txType || undefined, from, to, page }),
    queryFn:  () => stockApi.getTransactions({
      warehouseId: warehouse?.id,
      txType: txType as TxType || undefined,
      from: from || undefined,
      to:   to   || undefined,
      page,
      limit: 100,
    }),
    enabled: !!warehouse?.id,
  })

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">거래 로그</h2>

      {/* 필터 */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-wrap gap-3">
        <select
          value={txType}
          onChange={(e) => { setTxType(e.target.value as TxType | ''); setPage(1) }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">전체 유형</option>
          {Object.entries(TX_TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none" />
        <span className="text-gray-400 self-center">~</span>
        <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none" />
        <span className="text-xs text-gray-400 self-center">총 {formatNumber(data?.total)}건</span>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600 w-36">거래번호</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 w-28">유형</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">상품</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 w-28">위치</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 w-20">변동</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 w-20">이전</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 w-20">이후</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 w-36">일시</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400">로딩 중...</td></tr>
            )}
            {data?.items.map((txn) => (
              <tr key={txn.id} className={cn(txn.isCancelled && 'opacity-50 line-through')}>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{txn.txnNo}</td>
                <td className="px-4 py-3">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', TX_TYPE_COLOR[txn.txType])}>
                    {TX_TYPE_LABEL[txn.txType]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium truncate max-w-40">{txn.product?.name}</p>
                  <p className="text-xs text-gray-400">{txn.product?.code}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{txn.location?.code}</td>
                <td className={cn('px-4 py-3 text-right font-bold tabular-nums',
                  txn.qty > 0 ? 'text-green-600' : 'text-red-600')}>
                  {formatQtyDelta(txn.qty)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-500">{formatNumber(txn.qtyBefore)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">{formatNumber(txn.qtyAfter)}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{formatDateTime(txn.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50">이전</button>
          <span className="text-sm text-gray-600">{page} / {data.totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}
            className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50">다음</button>
        </div>
      )}
    </div>
  )
}
