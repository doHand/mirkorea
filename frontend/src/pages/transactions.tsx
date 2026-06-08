'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { stockApi } from '@/api/stock.api'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { QUERY_KEYS } from '@/constants/query-keys'
import { TX_TYPE_LABEL, TX_TYPE_COLOR } from '@/constants/stock.constants'
import { formatDateTime, formatQtyDelta, formatNumber } from '@/utils/format'
import { cn } from '@/utils/cn'
import { ExportButton } from '@/components/ExportButton'
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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">재고 변경 이력</h2>
        <ExportButton
          filename="재고 변경 이력"
          getData={async () => {
            const all = await stockApi.getTransactions({
              warehouseId: warehouse?.id,
              txType: txType as TxType || undefined,
              from: from || undefined,
              to:   to   || undefined,
              limit: 9999,
            })
            return all.items.map((t) => ({
              '거래번호': t.txnNo,
              '유형':     TX_TYPE_LABEL[t.txType],
              '상품명':   t.product?.name ?? '',
              '상품코드': t.product?.code ?? '',
              '위치':     t.location?.code ?? '',
              '변동수량': t.qty,
              '이전재고': t.qtyBefore,
              '이후재고': t.qtyAfter,
              '취소여부': t.isCancelled ? 'Y' : 'N',
              '작업자':   t.createdByUser?.fullName ?? t.createdByUser?.username ?? '',
              '일시':     formatDateTime(t.createdAt),
            }))
          }}
        />
      </div>

      {/* 필터 */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-3 flex flex-wrap gap-3 shadow-sm">
        <select
          value={txType}
          onChange={(e) => { setTxType(e.target.value as TxType | ''); setPage(1) }}
          className="text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="">전체 유형</option>
          {Object.entries(TX_TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }}
          className="text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
        <span className="text-gray-400 dark:text-gray-500 self-center">~</span>
        <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }}
          className="text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
        <span className="text-xs text-gray-400 dark:text-gray-500 self-center">총 {formatNumber(data?.total)}건</span>
      </div>

      {/* 테이블 */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="bg-[#2D4033] text-white">
              <th className="text-center px-4 py-3 font-semibold w-36">거래번호</th>
              <th className="text-center px-4 py-3 font-semibold w-28">유형</th>
              <th className="text-center px-4 py-3 font-semibold">상품</th>
              <th className="text-center px-4 py-3 font-semibold w-28">위치</th>
              <th className="text-center px-4 py-3 font-semibold w-20">변동</th>
              <th className="text-center px-4 py-3 font-semibold w-20">이전</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-20">이후</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-28">작업자</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-36">일시</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading && (
              <tr><td colSpan={9} className="text-center py-10 text-gray-400 dark:text-gray-500">로딩 중...</td></tr>
            )}
            {data?.items.map((txn) => (
              <tr key={txn.id} className={cn('hover:bg-gray-50 dark:hover:bg-gray-700/50', txn.isCancelled && 'opacity-50 line-through')}>
                <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{txn.txnNo}</td>
                <td className="px-4 py-3">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', TX_TYPE_COLOR[txn.txType])}>
                    {TX_TYPE_LABEL[txn.txType]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium truncate max-w-40 text-gray-900 dark:text-gray-100">{txn.product?.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{txn.product?.code}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{txn.location?.code}</td>
                <td className={cn('px-4 py-3 text-right font-bold tabular-nums',
                  txn.qty > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                  {formatQtyDelta(txn.qty)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-500 dark:text-gray-400">{formatNumber(txn.qtyBefore)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900 dark:text-gray-100">{formatNumber(txn.qtyAfter)}</td>
                <td className="px-4 py-3 text-center text-sm text-gray-700 dark:text-gray-300">
                  {txn.createdByUser?.fullName ?? txn.createdByUser?.username ?? '—'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{formatDateTime(txn.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* 페이지네이션 */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">이전</button>
          <span className="text-sm text-gray-600 dark:text-gray-400">{formatNumber(page)} / {formatNumber(data.totalPages)}</span>
          <button onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}
            className="px-3 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">다음</button>
        </div>
      )}
    </div>
  )
}
