'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Minus, Plus, RefreshCw, RotateCcw, Save, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { returnCollectionApi } from '@/api/return-collection.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { RETURN_COLLECTION_TYPE_LABEL } from '@/constants/stock.constants'
import { formatNumber } from '@/utils/format'
import { cn } from '@/utils/cn'
import * as ui from '@/styles/ui'
import { StatusBadge } from '@/components/StatusBadge'
import { ReturnCollectionScanModal } from '@/components/ReturnCollectionScanModal'
import type { ReturnCollection, ReturnCollectionType } from '@/types/api.types'

const TYPE_BADGE_VARIANT: Record<ReturnCollectionType, 'orange' | 'purple'> = {
  RETURN: 'orange',
  RECALL: 'purple',
}

const TYPE_SUMMARY_STYLE: Record<ReturnCollectionType | 'ALL', string> = {
  ALL:    'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-gray-900 dark:text-slate-300',
  RETURN: 'border-orange-100 bg-orange-50/70 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/20 dark:text-orange-300',
  RECALL: 'border-purple-100 bg-purple-50/70 text-purple-700 dark:border-purple-900/50 dark:bg-purple-950/20 dark:text-purple-300',
}

const TYPE_DOT_STYLE: Record<ReturnCollectionType | 'ALL', string> = {
  ALL:    'bg-slate-400',
  RETURN: 'bg-orange-500',
  RECALL: 'bg-purple-500',
}

export function ReturnCollectionPanel({ warehouseId }: { warehouseId: string }) {
  const qc = useQueryClient()
  const gridRef = useRef<AgGridReact<ReturnCollection>>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search,      setSearch]      = useState('')
  const [typeFilter,  setTypeFilter]  = useState<ReturnCollectionType | ''>('')
  const [dateFrom,    setDateFrom]    = useState('')
  const [dateTo,      setDateTo]      = useState('')
  const [scanOpen,    setScanOpen]    = useState(false)
  const [selectedRowCount, setSelectedRowCount] = useState(0)
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    gridRef.current?.api?.redrawRows()
  }, [pendingDeleteIds])

  const { data: page, isLoading, isFetching } = useQuery({
    queryKey: QUERY_KEYS.returnCollections({ warehouseId, type: typeFilter || undefined, search: search || undefined, from: dateFrom || undefined, to: dateTo || undefined }),
    queryFn:  () => returnCollectionApi.findAll({ warehouseId, type: typeFilter || undefined, search: search || undefined, from: dateFrom || undefined, to: dateTo || undefined, limit: 200 }),
    enabled:  !!warehouseId,
  })

  const { data: countSummary } = useQuery({
    queryKey: QUERY_KEYS.returnCollectionCountSummary(warehouseId),
    queryFn:  async () => {
      const [all, returns, recalls] = await Promise.all([
        returnCollectionApi.findAll({ warehouseId, page: 1, limit: 1 }),
        returnCollectionApi.findAll({ warehouseId, type: 'RETURN', page: 1, limit: 1 }),
        returnCollectionApi.findAll({ warehouseId, type: 'RECALL', page: 1, limit: 1 }),
      ])
      return { ALL: all.total, RETURN: returns.total, RECALL: recalls.total }
    },
    enabled:  !!warehouseId,
  })

  const rows = useMemo(() => page?.items ?? [], [page?.items])
  const summaryItems = useMemo(() => (
    ['', 'RETURN', 'RECALL'] as (ReturnCollectionType | '')[]
  ).map((value) => ({
    value,
    label: value === '' ? '전체' : RETURN_COLLECTION_TYPE_LABEL[value],
    count: countSummary?.[value === '' ? 'ALL' : value] ?? 0,
    styleKey: value === '' ? 'ALL' as const : value,
  })), [countSummary])

  const refresh = () => {
    setPendingDeleteIds(new Set())
    gridRef.current?.api.deselectAll()
    setSelectedRowCount(0)
    void qc.invalidateQueries({ queryKey: ['return-collections'] })
  }

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => returnCollectionApi.deleteAll(ids),
    onSuccess: () => { refresh() },
    onError: () => toast.error('삭제에 실패했습니다'),
  })

  const handleMarkDelete = () => {
    const selectedRows = gridRef.current?.api.getSelectedRows() ?? []
    if (!selectedRows.length) { toast.error('삭제할 항목을 선택해주세요'); return }
    setPendingDeleteIds((current) => {
      const next = new Set(current)
      selectedRows.forEach((row) => next.add(row.id))
      return next
    })
    gridRef.current?.api.deselectAll()
    setSelectedRowCount(0)
    toast(`${selectedRows.length}건이 삭제 예정입니다. 저장해야 반영됩니다.`, { icon: '🗑️' })
  }

  const handleSaveDeletes = async () => {
    const ids = [...pendingDeleteIds]
    if (!ids.length) { toast.error('저장할 변경사항이 없습니다'); return }
    if (!window.confirm(`삭제 예정 ${ids.length}건을 최종 삭제하시겠습니까?`)) return
    try {
      await deleteMutation.mutateAsync(ids)
      setPendingDeleteIds(new Set())
      toast.success(`${ids.length}건의 변경사항을 저장했습니다`)
    } catch {
      refresh()
    }
  }

  const handleResetFilters = () => {
    setSearchInput('')
    setSearch('')
    setDateFrom('')
    setDateTo('')
    setTypeFilter('')
  }

  const columns = useMemo<ColDef<ReturnCollection>[]>(() => [
    {
      headerName: '',
      width: 48, minWidth: 48, maxWidth: 48,
      checkboxSelection: true,
      headerCheckboxSelection: true,
      pinned: 'left', sortable: false, filter: false, resizable: false,
    },
    {
      headerName: '처리일시',
      field: 'createdAt',
      width: 112,
      pinned: 'left',
      cellRenderer: (p: { data?: ReturnCollection }) => <DateTimeCell value={p.data?.createdAt} />,
      cellClass: 'flex items-center',
    },
    {
      headerName: '유형',
      field: 'type',
      width: 84,
      cellRenderer: (p: { data?: ReturnCollection }) => p.data
        ? <StatusBadge label={RETURN_COLLECTION_TYPE_LABEL[p.data.type]} variant={TYPE_BADGE_VARIANT[p.data.type]} />
        : null,
      cellClass: 'flex items-center',
    },
    { headerName: '상품명', valueGetter: (p) => p.data?.product?.name ?? '-', minWidth: 180, flex: 1 },
    { headerName: '상품코드', valueGetter: (p) => p.data?.product?.code ?? '-', width: 120, cellClass: 'font-mono text-xs text-gray-500' },
    { headerName: '수량', field: 'quantity', width: 90, type: 'numericColumn', valueFormatter: (p) => formatNumber(Number(p.value ?? 0)) },
    { headerName: '위치', valueGetter: (p) => p.data?.location?.code ?? '-', width: 100 },
    { headerName: '사유', field: 'reason', width: 130 },
    { headerName: '처리번호', field: 'batchNo', width: 190, cellClass: 'font-mono text-[11px] text-gray-400' },
    { headerName: '바코드', field: 'barcodeScanned', width: 130, cellClass: 'font-mono text-xs text-gray-500' },
  ], [])

  return (
    <div className="flex h-[calc(100vh-128px)] min-h-0 flex-col gap-2 overflow-hidden">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h2 className={ui.h2Cls}>반품/회수 관리</h2>
            <p className="mt-0.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              바코드 스캔으로 반품/회수를 기록합니다. 판매 가능 재고에는 합산되지 않습니다.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          {summaryItems.map((item) => {
            const isSelected = typeFilter === item.value
            return (
              <button
                key={item.value || 'all'}
                type="button"
                onClick={() => setTypeFilter(item.value)}
                aria-pressed={isSelected}
                className={cn(
                  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-all',
                  TYPE_SUMMARY_STYLE[item.styleKey],
                  isSelected
                    ? 'shadow-sm ring-2 ring-current ring-offset-1 ring-offset-white dark:ring-offset-gray-950'
                    : 'opacity-75 hover:opacity-100',
                )}
              >
                <span className="grid h-3.5 w-3.5 place-items-center" aria-hidden="true">
                  {isSelected
                    ? <Check size={13} strokeWidth={3} />
                    : <span className={cn('h-2 w-2 rounded-full', TYPE_DOT_STYLE[item.styleKey])} />}
                </span>
                <span>{item.label}</span>
                <span className="rounded-full bg-black/5 px-1.5 py-0.5 tabular-nums dark:bg-white/10">
                  {formatNumber(item.count)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
        <div className="app-surface flex min-h-0 flex-1 flex-col overflow-hidden border border-gray-300 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="wms-grid-toolbar flex items-center gap-2 border-b px-2 py-1.5 min-w-0">
            <div className="flex flex-1 min-w-0 items-center gap-1.5 overflow-x-auto scrollbar-hide">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-7 shrink-0 rounded border border-gray-200 px-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <span className="shrink-0 text-xs text-gray-400">~</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-7 shrink-0 rounded border border-gray-200 px-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') setSearch(searchInput) }}
                placeholder="상품명/코드/바코드/사유"
                className="h-7 w-44 shrink-0 rounded border border-gray-200 px-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <button
                type="button"
                onClick={() => setSearch(searchInput)}
                className="wms-toolbar-action shrink-0 inline-flex h-7 items-center gap-1 rounded px-2.5 text-xs font-semibold transition-colors"
              >
                <Search size={13} />
                검색
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="wms-toolbar-action shrink-0 inline-flex h-7 items-center gap-1 rounded px-2.5 text-xs font-semibold transition-colors"
              >
                <RotateCcw size={13} />
                초기화
              </button>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setScanOpen(true)}
                title="바코드 스캔으로 반품/회수 처리"
                className="wms-toolbar-action inline-flex h-7 w-7 items-center justify-center rounded transition-colors"
              >
                <Plus size={15} strokeWidth={2.5} />
              </button>
              <button type="button" onClick={handleMarkDelete} disabled={selectedRowCount === 0 || deleteMutation.isPending}
                title="선택 항목 삭제 예정"
                className="wms-toolbar-action inline-flex h-7 w-7 items-center justify-center rounded transition-colors disabled:opacity-40">
                <Minus size={16} strokeWidth={2.5} />
              </button>
              <button type="button" onClick={() => { void handleSaveDeletes() }} disabled={pendingDeleteIds.size === 0 || deleteMutation.isPending}
                className="wms-toolbar-action inline-flex h-7 items-center gap-1 rounded px-3 text-xs font-semibold transition-colors disabled:opacity-40">
                <Save size={14} /> {deleteMutation.isPending ? '저장 중' : '저장'}
              </button>
              <button
                type="button"
                title="새로고침"
                onClick={refresh}
                className="wms-toolbar-action inline-flex h-7 w-7 items-center justify-center rounded transition-colors"
              >
                <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <div className="ag-theme-quartz ag-theme-wms wms-ag-grid min-h-0 w-full flex-1">
            <AgGridReact<ReturnCollection>
              ref={gridRef}
              rowData={rows}
              columnDefs={columns}
              defaultColDef={{ sortable: true, resizable: true, filter: true, suppressHeaderMenuButton: true, minWidth: 70 }}
              rowSelection="multiple"
              suppressRowClickSelection={false}
              headerHeight={34}
              rowHeight={46}
              animateRows
              loading={isLoading}
              overlayLoadingTemplate="<span class='ag-overlay-loading-center'>불러오는 중...</span>"
              overlayNoRowsTemplate="<span class='ag-overlay-no-rows-center'>조회된 반품/회수 기록이 없습니다.</span>"
              getRowId={(params) => params.data.id}
              rowClassRules={{
                'row-pending-delete': (params) => Boolean(params.data && pendingDeleteIds.has(params.data.id)),
              }}
              onSelectionChanged={() => setSelectedRowCount(gridRef.current?.api.getSelectedRows().length ?? 0)}
            />
          </div>

          <div className="flex shrink-0 items-center justify-between border-t border-gray-200 px-4 py-2 text-xs text-gray-400 dark:border-gray-800">
            <span>{formatNumber(rows.length)}건</span>
          </div>
        </div>

      </div>

      {scanOpen && (
        <ReturnCollectionScanModal
          warehouseId={warehouseId}
          onClose={() => setScanOpen(false)}
          onCreated={refresh}
        />
      )}
    </div>
  )
}

function DateTimeCell({ value }: { value?: string }) {
  if (!value) return <span className="text-gray-400">-</span>
  const date = new Date(value)
  const dateText = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date).replace(/\.\s?/g, '.').replace(/\.$/, '')
  const timeText = new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date)
  return (
    <div className="flex flex-col justify-center leading-tight">
      <span className="text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-200">{dateText}</span>
      <span className="mt-0.5 text-[11px] tabular-nums text-gray-400">{timeText}</span>
    </div>
  )
}
