'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ColDef } from 'ag-grid-community'
import { stockApi } from '@/api/stock.api'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { QUERY_KEYS } from '@/constants/query-keys'
import { TX_TYPE_LABEL } from '@/constants/stock.constants'
import { formatDateTime, formatNumber, formatQtyDelta } from '@/utils/format'
import { ExportButton } from '@/components/ExportButton'
import { AppAgGrid } from '@/components/AppAgGrid'
import { GridPageLayout } from '@/components/grid/GridPageLayout'
import type { StockTransaction, TxType } from '@/types/api.types'

export default function TransactionsPage() {
  const warehouse = useWarehouseStore((state) => state.selectedWarehouse)
  const [page, setPage] = useState(1)
  const [txType, setTxType] = useState<TxType | ''>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.transactions({ warehouseId: warehouse?.id, txType: txType || undefined, from, to, page }),
    queryFn: () => stockApi.getTransactions({ warehouseId: warehouse!.id, txType: txType || undefined, from: from || undefined, to: to || undefined, page, limit: 100 }),
    enabled: Boolean(warehouse?.id),
  })

  // Display-only transaction columns stay local; the shared grid owns generic behavior.
  const columns = useMemo<ColDef<StockTransaction>[]>(() => [
    { headerName: '거래번호', field: 'txnNo', width: 150 },
    { headerName: '유형', width: 120, valueGetter: (p) => p.data ? TX_TYPE_LABEL[p.data.txType] : '-' },
    { headerName: '상품명', minWidth: 180, flex: 1, valueGetter: (p) => p.data?.product?.name ?? '-' },
    { headerName: '상품코드', width: 120, valueGetter: (p) => p.data?.product?.code ?? '-' },
    { headerName: '위치', width: 110, valueGetter: (p) => p.data?.location?.code ?? '-' },
    { headerName: '변동', width: 100, type: 'numericColumn', valueGetter: (p) => p.data?.qty ?? 0, valueFormatter: (p) => formatQtyDelta(Number(p.value ?? 0)), cellClass: (p) => Number(p.value) > 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold' },
    { headerName: '이전', width: 100, type: 'numericColumn', valueGetter: (p) => p.data?.qtyBefore ?? 0, valueFormatter: (p) => formatNumber(Number(p.value ?? 0)) },
    { headerName: '이후', width: 100, type: 'numericColumn', valueGetter: (p) => p.data?.qtyAfter ?? 0, valueFormatter: (p) => formatNumber(Number(p.value ?? 0)) },
    { headerName: '작업자', width: 120, valueGetter: (p) => p.data?.createdByUser?.fullName ?? p.data?.createdByUser?.username ?? '-' },
    { headerName: '일시', width: 165, valueGetter: (p) => p.data?.createdAt ? formatDateTime(p.data.createdAt) : '-' },
  ], [])

  if (!warehouse) return <div className="grid h-64 place-items-center text-gray-400">창고를 먼저 선택해주세요.</div>

  return <GridPageLayout title="재고 변경 이력" toolbar={<ExportButton filename="재고 변경 이력" getData={async () => {
        const all = await stockApi.getTransactions({ warehouseId: warehouse.id, txType: txType || undefined, from: from || undefined, to: to || undefined, limit: 9999 })
        return all.items.map((txn) => ({
          '거래번호': txn.txnNo, '유형': TX_TYPE_LABEL[txn.txType], '상품명': txn.product?.name ?? '', '상품코드': txn.product?.code ?? '',
          '위치': txn.location?.code ?? '', '변동수량': txn.qty, '이전재고': txn.qtyBefore, '이후재고': txn.qtyAfter,
          '취소여부': txn.isCancelled ? 'Y' : 'N', '작업자': txn.createdByUser?.fullName ?? txn.createdByUser?.username ?? '', '일시': formatDateTime(txn.createdAt),
        }))
      }} />}>
    <div className="flex flex-wrap gap-3 rounded border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <select value={txType} onChange={(event) => { setTxType(event.target.value as TxType | ''); setPage(1) }} className="rounded border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
        <option value="">전체 유형</option>{Object.entries(TX_TYPE_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
      <input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1) }} className="rounded border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
      <span className="self-center text-gray-400">~</span>
      <input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1) }} className="rounded border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
      <span className="self-center text-xs text-gray-400">총 {formatNumber(data?.total)}건</span>
    </div>
    <div className="min-h-0 flex-1 overflow-hidden rounded border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"><AppAgGrid rows={data?.items ?? []} columns={columns} loading={isLoading} /></div>
    {data && data.totalPages > 1 && <div className="flex items-center justify-center gap-2"><button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="rounded border px-3 py-1 text-sm disabled:opacity-40">이전</button><span className="text-sm text-gray-500">{page} / {data.totalPages}</span><button onClick={() => setPage((current) => Math.min(data.totalPages, current + 1))} disabled={page === data.totalPages} className="rounded border px-3 py-1 text-sm disabled:opacity-40">다음</button></div>}
  </GridPageLayout>
}
