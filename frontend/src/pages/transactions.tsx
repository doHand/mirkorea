'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ColDef } from 'ag-grid-community'
import { FileDown, Menu, RefreshCw, RotateCcw, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { stockApi } from '@/api/stock.api'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { QUERY_KEYS } from '@/constants/query-keys'
import { TX_TYPE_COLOR, TX_TYPE_LABEL } from '@/constants/stock.constants'
import { formatDateTime, formatNumber, formatQtyDelta } from '@/utils/format'
import { datedExcelFilename, writeRowsToExcel } from '@/utils/excel'
import { AppAgGrid } from '@/components/AppAgGrid'
import { GridPageLayout } from '@/components/grid/GridPageLayout'
import { cn } from '@/utils/cn'
import type { StockTransaction, TxType } from '@/types/api.types'

export default function TransactionsPage() {
  const warehouse = useWarehouseStore((state) => state.selectedWarehouse)
  const menuRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(1)
  const [txType, setTxType] = useState<TxType | ''>('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const { data, isFetching, isLoading, refetch } = useQuery({
    queryKey: QUERY_KEYS.transactions({ warehouseId: warehouse?.id, txType: txType || undefined, search: search || undefined, from, to, page }),
    queryFn: () => stockApi.getTransactions({ warehouseId: warehouse!.id, txType: txType || undefined, search: search || undefined, from: from || undefined, to: to || undefined, page, limit: 100 }),
    enabled: Boolean(warehouse?.id),
  })

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const resetFilters = () => {
    setTxType('')
    setSearchInput('')
    setSearch('')
    setFrom('')
    setTo('')
    setPage(1)
  }

  const handleExcelDownload = useCallback(async () => {
    if (!warehouse?.id) return
    setExporting(true)
    try {
      const all = await stockApi.getTransactions({
        warehouseId: warehouse.id,
        txType: txType || undefined,
        search: search || undefined,
        from: from || undefined,
        to: to || undefined,
        limit: 9999,
      })
      if (!all.items.length) {
        toast.error('내보낼 데이터가 없습니다')
        return
      }
      const rows = all.items.map((txn) => ({
        '거래번호': txn.txnNo,
        '유형': TX_TYPE_LABEL[txn.txType],
        '상품명': txn.product?.name ?? '',
        '상품코드': txn.product?.code ?? '',
        '위치': txn.location?.code ?? '',
        'LOT': txn.lotNumber ?? '',
        '변동수량': txn.qty,
        '이전재고': txn.qtyBefore,
        '이후재고': txn.qtyAfter,
        '사유': txn.reason ?? '',
        '메모': txn.memo ?? '',
        '취소여부': txn.isCancelled ? 'Y' : 'N',
        '작업자': txn.createdByName ?? txn.createdByUser?.fullName ?? txn.createdByUser?.username ?? '',
        '일시': formatDateTime(txn.createdAt),
      }))
      await writeRowsToExcel(rows, datedExcelFilename('재고_변경_이력'))
    } catch {
      toast.error('엑셀 다운로드에 실패했습니다')
    } finally {
      setExporting(false)
    }
  }, [from, search, to, txType, warehouse?.id])

  // Display-only transaction columns stay local; the shared grid owns generic behavior.
  const columns = useMemo<ColDef<StockTransaction>[]>(() => [
    { headerName: '일시', width: 165, valueGetter: (p) => p.data?.createdAt ? formatDateTime(p.data.createdAt) : '-' },
    { headerName: '거래번호', width: 150, valueGetter: (p) => p.data?.txnNo ?? '-', cellClass: 'font-mono text-xs font-semibold text-[var(--color-primary)]' },
    { headerName: '유형', width: 132, valueGetter: (p) => p.data ? TX_TYPE_LABEL[p.data.txType] : '-', cellRenderer: (p: { data?: StockTransaction }) => {
      if (!p.data) return '-'
      return <span className={cn('inline-flex rounded px-2 py-0.5 text-xs font-semibold', TX_TYPE_COLOR[p.data.txType])}>{TX_TYPE_LABEL[p.data.txType]}</span>
    } },
    { headerName: '상품명', minWidth: 190, flex: 1.2, valueGetter: (p) => p.data?.product?.name ?? '-' },
    { headerName: '상품코드', width: 120, valueGetter: (p) => p.data?.product?.code ?? '-' },
    { headerName: '위치', width: 115, valueGetter: (p) => p.data?.location?.code ?? '-' },
    { headerName: 'LOT', width: 120, valueGetter: (p) => p.data?.lotNumber ?? '-' },
    { headerName: '변동', width: 100, type: 'numericColumn', valueGetter: (p) => p.data?.qty ?? 0, valueFormatter: (p) => formatQtyDelta(Number(p.value ?? 0)), cellClass: (p) => Number(p.value) > 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold' },
    { headerName: '이전', width: 100, type: 'numericColumn', valueGetter: (p) => p.data?.qtyBefore ?? 0, valueFormatter: (p) => formatNumber(Number(p.value ?? 0)) },
    { headerName: '이후', width: 100, type: 'numericColumn', valueGetter: (p) => p.data?.qtyAfter ?? 0, valueFormatter: (p) => formatNumber(Number(p.value ?? 0)) },
    { headerName: '바코드', width: 135, valueGetter: (p) => p.data?.barcodeScanned ?? '-', cellClass: 'font-mono text-xs' },
    { headerName: '참조', width: 145, valueGetter: (p) => [p.data?.referenceType, p.data?.referenceId].filter(Boolean).join(' · ') || '-' },
    { headerName: '사유/메모', minWidth: 180, flex: 1, valueGetter: (p) => [p.data?.reason, p.data?.memo].filter(Boolean).join(' · ') || '-' },
    { headerName: '상태', width: 90, valueGetter: (p) => p.data?.isCancelled ? '취소' : '정상', cellRenderer: (p: { data?: StockTransaction }) => (
      <span className={cn('inline-flex rounded px-2 py-0.5 text-xs font-semibold', p.data?.isCancelled ? 'bg-gray-100 text-gray-500' : 'bg-emerald-100 text-emerald-700')}>
        {p.data?.isCancelled ? '취소' : '정상'}
      </span>
    ) },
    { headerName: '작업자', width: 140, valueGetter: (p) => p.data?.createdByName ?? p.data?.createdByUser?.fullName ?? p.data?.createdByUser?.username ?? '-' },
  ], [])

  if (!warehouse) return <div className="grid h-64 place-items-center text-gray-400">창고를 먼저 선택해주세요.</div>

  return <GridPageLayout
    title="재고 변경 이력"
    description="입고, 출고, 조정, 위치 이동에 따른 재고 수량 변화를 조회합니다."
    toolbar={
      <div className="flex items-center gap-2">
        <button
          type="button"
          title="새로고침"
          onClick={() => void refetch()}
          className="wms-toolbar-action inline-flex h-8 w-8 items-center justify-center rounded transition-colors"
        >
          <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
        </button>
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            title="추가 작업"
            aria-label="추가 작업"
            aria-expanded={menuOpen}
            className="wms-toolbar-action inline-flex h-8 w-8 items-center justify-center rounded transition-colors"
          >
            <Menu size={17} strokeWidth={2.2} />
          </button>
          {menuOpen && (
            <div className="product-grid-overflow absolute right-0 top-9 z-50 flex min-w-[156px] flex-col gap-1 rounded border border-gray-200 bg-white p-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
              <button
                type="button"
                onClick={() => { setMenuOpen(false); void handleExcelDownload() }}
                disabled={exporting}
                className="wms-toolbar-action inline-flex h-8 items-center gap-2 rounded px-2 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <FileDown size={13} />
                {exporting ? '준비 중...' : '엑셀 내보내기'}
              </button>
            </div>
          )}
        </div>
      </div>
    }
  >
    <div className="rounded border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-40 text-xs font-medium text-gray-500 dark:text-gray-400">
          유형
          <select value={txType} onChange={(event) => { setTxType(event.target.value as TxType | ''); setPage(1) }} className="mt-1 w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
            <option value="">전체 유형</option>{Object.entries(TX_TYPE_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
          기간
          <div className="mt-1 flex items-center overflow-hidden rounded border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <input
              type="date"
              value={from}
              onChange={(event) => { setFrom(event.target.value); setPage(1) }}
              className="h-9 border-0 bg-transparent px-3 text-sm text-gray-900 outline-none dark:text-white"
              aria-label="시작일"
            />
            <span className="border-x border-gray-200 px-2 text-xs text-gray-400 dark:border-gray-700">~</span>
            <input
              type="date"
              value={to}
              onChange={(event) => { setTo(event.target.value); setPage(1) }}
              className="h-9 border-0 bg-transparent px-3 text-sm text-gray-900 outline-none dark:text-white"
              aria-label="종료일"
            />
          </div>
        </div>
        <label className="min-w-72 flex-1 text-xs font-medium text-gray-500 dark:text-gray-400">
          검색
          <div className="mt-1 flex overflow-hidden rounded border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setSearch(searchInput)
                  setPage(1)
                }
              }}
              placeholder="상품코드, 상품명, 거래번호, 사유, 바코드"
              className="h-9 min-w-0 flex-1 border-0 bg-transparent px-3 text-sm text-gray-900 outline-none dark:text-white"
            />
            <button
              type="button"
              onClick={() => {
                setSearch(searchInput)
                setPage(1)
              }}
              className="inline-flex h-9 items-center gap-1 border-l border-gray-200 px-3 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <Search size={13} />
              검색
            </button>
          </div>
        </label>
        <button
          type="button"
          onClick={resetFilters}
          className="wms-toolbar-action inline-flex h-9 items-center gap-1.5 rounded px-3 text-xs font-semibold transition-colors"
        >
          <RotateCcw size={13} />
          초기화
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded bg-gray-100 px-2 py-1 font-semibold text-gray-600 dark:bg-slate-800 dark:text-slate-300">최신 {formatNumber(data?.total ?? 0)}건</span>
          <span className="rounded bg-gray-100 px-2 py-1 text-gray-500 dark:bg-slate-800 dark:text-slate-400">페이지 {formatNumber(data?.items.length ?? 0)}건</span>
        </div>
      </div>
    </div>
    <div className="min-h-0 flex-1 overflow-hidden rounded border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"><AppAgGrid rows={data?.items ?? []} columns={columns} loading={isLoading} /></div>
    {data && data.totalPages > 1 && (
      <div className="flex items-center justify-center gap-2">
        <button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="rounded border border-gray-200 bg-white px-3 py-1.5 text-sm disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900">이전</button>
        <span className="min-w-20 text-center text-sm text-gray-500">{page} / {data.totalPages}</span>
        <button onClick={() => setPage((current) => Math.min(data.totalPages, current + 1))} disabled={page === data.totalPages} className="rounded border border-gray-200 bg-white px-3 py-1.5 text-sm disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900">다음</button>
      </div>
    )}
  </GridPageLayout>
}
