'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { AgGridReact } from 'ag-grid-react'
import { ClientSideRowModelModule, ModuleRegistry, type ColDef } from 'ag-grid-community'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileDown, Menu, Minus, Plus, RefreshCw, RotateCcw, Search, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { inboundApi } from '@/api/inbound.api'
import type { CreateInboundOrderRequest } from '@/api/inbound.api'
import { productApi } from '@/api/product.api'
import { purchaseOrderApi } from '@/api/purchase-order.api'
import { stockApi } from '@/api/stock.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { cn } from '@/utils/cn'
import * as ui from '@/styles/ui'
import { formatNumber } from '@/utils/format'
import { formatUnitSpec } from '@/utils/unit-spec'
import type { InboundOrder, InboundOrderItem, InboundStatus, Product } from '@/types/api.types'
import { StatusBadge } from '@/components/StatusBadge'
import { StockSummaryBox } from '@/components/StockSummaryBox'
import { ImportButton, type ImportConfig, type ImportRow } from '@/components/ImportButton'

ModuleRegistry.registerModules([ClientSideRowModelModule])

interface InboundLineRow {
  id: string
  rowNo: number
  order: InboundOrder
  item: InboundOrderItem
  expectedDate: string
  orderNo: string
  supplier: string
  productName: string
  productCode: string
  spec: string
  expectedQty: number
  receivedQty: number
  passedQty: number
  defectQty: number
  unit: string
  costPrice: number | null
  materialNo: string
  status: InboundStatus
}

const STATUS_LABEL: Record<InboundStatus, string> = {
  PENDING:    '입고 예정',
  RECEIVING:  '수령 중',
  INSPECTING: '검수 중',
  COMPLETED:  '완료',
  CANCELLED:  '취소',
}

const STATUS_BADGE_VARIANT: Record<InboundStatus, 'blue' | 'amber' | 'purple' | 'emerald' | 'gray'> = {
  PENDING:    'blue',
  RECEIVING:  'amber',
  INSPECTING: 'purple',
  COMPLETED:  'emerald',
  CANCELLED:  'gray',
}

function fmtDate(s?: string | null) {
  if (!s) return '-'
  return s.slice(0, 10)
}

function readText(row: Record<string, string | number>, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (value != null && String(value).trim() !== '') return String(value).trim()
  }
  return ''
}

function readNumber(row: Record<string, string | number>, keys: string[]) {
  const value = readText(row, keys)
  const n = Number(String(value).replaceAll(',', ''))
  return Number.isFinite(n) ? n : 0
}

export default function InboundPage() {
  const router    = useRouter()
  const warehouse = useWarehouseStore((s) => s.selectedWarehouse)
  const qc        = useQueryClient()
  const gridRef   = useRef<AgGridReact<InboundLineRow>>(null)
  const menuRef   = useRef<HTMLDivElement>(null)

  // 검색 / 필터 state
  const [searchInput,  setSearchInput]  = useState('')
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<InboundStatus | ''>('')
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')

  // 모달 state
  const [createOpen,    setCreateOpen]    = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<InboundOrder | null>(null)
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)
  const [menuOpen,      setMenuOpen]      = useState(false)
  const [selectedRowCount, setSelectedRowCount] = useState(0)

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const { data: page, isLoading, isFetching } = useQuery({
    queryKey: QUERY_KEYS.inboundOrders({ warehouseId: warehouse?.id, status: statusFilter || undefined }),
    queryFn:  () => inboundApi.findAll({ warehouseId: warehouse!.id, status: statusFilter || undefined, limit: 50 }),
    enabled:  !!warehouse?.id,
  })

  // 요약 카드 전용: 필터 없이 전체 조회 (상태별 카운트 정확히 유지)
  const { data: allPage } = useQuery({
    queryKey: QUERY_KEYS.inboundOrders({ warehouseId: warehouse?.id }),
    queryFn:  () => inboundApi.findAll({ warehouseId: warehouse!.id, limit: 9999 }),
    enabled:  !!warehouse?.id,
  })

  const { data: draftPurchaseOrders } = useQuery({
    queryKey: ['purchase-orders', 'inbound-summary', warehouse?.id, 'DRAFT'],
    queryFn: () => purchaseOrderApi.findAll({
      warehouseId: warehouse!.id,
      status: 'DRAFT',
      limit: 1,
    }),
    enabled: !!warehouse?.id,
  })

  const orders    = page?.items ?? []
  const allOrders = allPage?.items ?? []

  const filtered = useMemo(() => {
    let result = orders
    // 텍스트 검색
    if (search) {
      const s = search.toLowerCase()
      result = result.filter((o) =>
        o.orderNo.toLowerCase().includes(s) || (o.supplier ?? '').toLowerCase().includes(s)
      )
    }
    // 날짜 범위 필터 (클라이언트 사이드)
    if (dateFrom) {
      result = result.filter((o) => o.expectedDate && o.expectedDate >= dateFrom)
    }
    if (dateTo) {
      result = result.filter((o) => o.expectedDate && o.expectedDate <= dateTo + 'T23:59:59')
    }
    return result
  }, [orders, search, dateFrom, dateTo])

  const lines = useMemo(
    () => filtered.flatMap((order) => order.items.map((item, index) => ({ order, item, index }))),
    [filtered]
  )

  const gridRows = useMemo<InboundLineRow[]>(() => lines.map(({ order, item }, rowIndex) => ({
    id: item.id || `${order.id}-${item.productId}-${rowIndex}`,
    rowNo: rowIndex + 1,
    order,
    item,
    expectedDate: fmtDate(order.expectedDate),
    orderNo: order.orderNo,
    supplier: order.supplier || '-',
    productName: item.product?.name || '-',
    productCode: item.product?.code || '',
    spec: formatUnitSpec(item.product),
    expectedQty: item.expectedQty,
    receivedQty: item.receivedQty,
    passedQty: item.passedQty,
    defectQty: item.defectQty,
    unit: item.product?.unit || item.inputUnit || '-',
    costPrice: item.product?.costPrice ?? null,
    materialNo: item.product?.materialNo || item.product?.code || '-',
    status: order.status,
  })), [lines])

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['inbound'] })
    void qc.invalidateQueries({ queryKey: QUERY_KEYS.inboundOrders({ warehouseId: warehouse?.id, status: statusFilter || undefined }) })
    void qc.invalidateQueries({ queryKey: QUERY_KEYS.inboundOrders({ warehouseId: warehouse?.id }) })
  }

  const deleteMutation = useMutation({
    mutationFn: inboundApi.delete,
    onSuccess: (_data, deletedId) => {
      if (detailOrderId === deletedId) setDetailOrderId(null)
      setSelectedOrder((current) => current?.id === deletedId ? null : current)
    },
    onError: () => toast.error('삭제에 실패했습니다'),
  })

  const handleDeleteSelected = async () => {
    const selectedRows = gridRef.current?.api.getSelectedRows() ?? []
    const ordersToDelete = [...new Map(selectedRows.map((row) => [row.order.id, row.order])).values()]
    if (!ordersToDelete.length) {
      toast.error('삭제할 전표를 선택해주세요')
      return
    }

    const hasCompleted = ordersToDelete.some((order) => order.status === 'COMPLETED')
    const message = hasCompleted
      ? `${ordersToDelete.length}개 입고 전표를 삭제하시겠습니까?\n완료 전표는 이미 증가된 재고가 자동으로 되돌려지지 않습니다.`
      : `${ordersToDelete.length}개 입고 전표를 삭제하시겠습니까?`
    if (!window.confirm(message)) return

    try {
      for (const order of ordersToDelete) {
        await deleteMutation.mutateAsync(order.id)
      }
      toast.success(`${ordersToDelete.length}개 입고 전표를 삭제했습니다`)
      refresh()
      gridRef.current?.api.deselectAll()
      setSelectedRowCount(0)
    } catch {
      refresh()
    }
  }

  const columns = useMemo<ColDef<InboundLineRow>[]>(() => [
    {
      headerName: '',
      width: 48,
      minWidth: 48,
      maxWidth: 48,
      checkboxSelection: true,
      headerCheckboxSelection: true,
      pinned: 'left',
      sortable: false,
      filter: false,
      resizable: false,
    },
    { headerName: 'No', field: 'rowNo', width: 68, pinned: 'left', type: 'numericColumn' },
    { headerName: '입고예정일', field: 'expectedDate', width: 118 },
    { headerName: '전표번호', field: 'orderNo', width: 148, pinned: 'left', cellClass: 'wms-code font-mono font-semibold' },
    { headerName: '공급업체', field: 'supplier', width: 150 },
    { headerName: '상품명', field: 'productName', minWidth: 190, flex: 1, tooltipField: 'productName' },
    { headerName: '상품코드', field: 'productCode', width: 126, cellClass: 'font-mono text-xs text-gray-500' },
    { headerName: '규격', field: 'spec', width: 128 },
    {
      headerName: '예정수량',
      field: 'expectedQty',
      width: 104,
      type: 'numericColumn',
      valueFormatter: (params) => formatNumber(Number(params.value ?? 0)),
    },
    {
      headerName: '입고수량',
      field: 'receivedQty',
      width: 104,
      type: 'numericColumn',
      valueFormatter: (params) => formatNumber(Number(params.value ?? 0)),
    },
    {
      headerName: '합격',
      field: 'passedQty',
      width: 88,
      type: 'numericColumn',
      valueFormatter: (params) => formatNumber(Number(params.value ?? 0)),
    },
    {
      headerName: '불량',
      field: 'defectQty',
      width: 88,
      type: 'numericColumn',
      cellClass: (params) => Number(params.value ?? 0) > 0 ? 'font-semibold text-red-500' : 'text-gray-400',
      valueFormatter: (params) => Number(params.value ?? 0) > 0 ? formatNumber(Number(params.value)) : '-',
    },
    { headerName: '단위', field: 'unit', width: 74, cellClass: 'text-center' },
    {
      headerName: '원가',
      field: 'costPrice',
      width: 96,
      type: 'numericColumn',
      valueFormatter: (params) => params.value == null ? '-' : formatNumber(Number(params.value)),
    },
    { headerName: '자재번호', field: 'materialNo', width: 126, cellClass: 'font-mono text-xs' },
    {
      headerName: '상태',
      field: 'status',
      width: 104,
      cellRenderer: (params: { data?: InboundLineRow }) => params.data
        ? <StatusBadge label={STATUS_LABEL[params.data.status]} variant={STATUS_BADGE_VARIANT[params.data.status]} />
        : null,
      cellClass: 'flex items-center justify-center',
    },
  ], [])

  const activeOrder = selectedOrder && filtered.some((o) => o.id === selectedOrder.id)
    ? selectedOrder
    : filtered[0] ?? null

  const handleExcelDownload = async () => {
    if (!gridRows.length) {
      toast.error('내보낼 데이터가 없습니다')
      return
    }
    try {
      const rows = gridRows.map((row) => ({
        입고예정일: row.expectedDate,
        전표번호: row.orderNo,
        공급업체: row.supplier,
        상품코드: row.productCode,
        상품명: row.productName,
        규격: row.spec,
        예정수량: row.expectedQty,
        입고수량: row.receivedQty,
        합격: row.passedQty,
        불량: row.defectQty,
        단위: row.unit,
        원가: row.costPrice ?? '',
        자재번호: row.materialNo,
        상태: STATUS_LABEL[row.status],
      }))
      const XLSX = await import('xlsx')
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '입고내역')
      XLSX.writeFile(wb, `입고내역_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch {
      toast.error('엑셀 다운로드에 실패했습니다')
    }
  }

  const inboundImportConfig = useMemo<ImportConfig>(() => ({
    templateFilename: '입고예정_가져오기_양식.xlsx',
    sheetName: '입고예정',
    templateRows: [
      {
        공급업체: '샘플공급사',
        입고예정일: new Date().toISOString().slice(0, 10),
        상품코드: 'P0001',
        예정수량: 10,
        로트번호: '',
        유통기한: '',
        메모: '',
      },
    ],
    parse: (raw) => raw.map((row, index): ImportRow => {
      const productCode = readText(row, ['상품코드', 'productCode', 'code'])
      const expectedQty = readNumber(row, ['예정수량', '수량', 'expectedQty', 'qty'])
      return {
        supplier: readText(row, ['공급업체', '거래처', 'supplier']),
        expectedDate: readText(row, ['입고예정일', '예정일', 'expectedDate']),
        productCode,
        expectedQty,
        lotNumber: readText(row, ['로트번호', 'LOT', 'lotNumber']),
        expireDate: readText(row, ['유통기한', '만료일', 'expireDate']),
        memo: readText(row, ['메모', 'memo']),
        _error: !productCode
          ? '상품코드 누락'
          : expectedQty <= 0
            ? '예정수량 오류'
            : undefined,
        rowNo: index + 1,
      }
    }),
    previewColumns: [
      { key: 'supplier', label: '공급업체' },
      { key: 'expectedDate', label: '입고예정일', mono: true },
      { key: 'productCode', label: '상품코드', mono: true },
      { key: 'expectedQty', label: '예정수량', align: 'right', format: (value) => formatNumber(Number(value ?? 0)) },
      { key: 'lotNumber', label: '로트번호', mono: true },
      { key: 'expireDate', label: '유통기한', mono: true },
      { key: 'memo', label: '메모' },
    ],
    save: async (validRows, setProgress) => {
      if (!warehouse?.id) return { ok: 0, fail: validRows.length }
      let ok = 0
      let fail = 0
      const groups = new Map<string, CreateInboundOrderRequest>()

      for (let i = 0; i < validRows.length; i += 1) {
        const row = validRows[i]
        const productCode = String(row.productCode ?? '').trim()
        try {
          const productPage = await productApi.findAll({ search: productCode, limit: 20 })
          const product = productPage.items.find((item) => item.code === productCode) ?? productPage.items[0]
          if (!product) {
            fail += 1
            continue
          }

          const supplier = String(row.supplier ?? '').trim()
          const expectedDate = String(row.expectedDate ?? '').trim()
          const memo = String(row.memo ?? '').trim()
          const key = `${supplier}|${expectedDate}|${memo}`
          const request = groups.get(key) ?? {
            warehouseId: warehouse.id,
            supplier: supplier || undefined,
            expectedDate: expectedDate || undefined,
            memo: memo || undefined,
            items: [],
          }
          request.items.push({
            productId: product.id,
            expectedQty: Number(row.expectedQty ?? 0),
            lotNumber: String(row.lotNumber ?? '').trim() || undefined,
            expireDate: String(row.expireDate ?? '').trim() || undefined,
          })
          groups.set(key, request)
        } catch {
          fail += 1
        } finally {
          setProgress(Math.round(((i + 1) / validRows.length) * 50))
        }
      }

      const requests = [...groups.values()].filter((request) => request.items.length > 0)
      for (let i = 0; i < requests.length; i += 1) {
        try {
          await inboundApi.create(requests[i])
          ok += requests[i].items.length
        } catch {
          fail += requests[i].items.length
        } finally {
          setProgress(50 + Math.round(((i + 1) / Math.max(1, requests.length)) * 50))
        }
      }
      return { ok, fail }
    },
  }), [warehouse?.id])

  const handleResetFilters = () => {
    setSearchInput('')
    setSearch('')
    setDateFrom('')
    setDateTo('')
    setStatusFilter('')
  }

  if (!warehouse) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
        창고를 먼저 선택하세요
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-128px)] min-h-0 flex-col gap-2 overflow-hidden">

      {/* ── 페이지 헤더 ── */}
      <div className="flex flex-col gap-3">
        {/* 상단 행: 제목 + 액션 버튼 */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h2 className={ui.h2Cls}>입고 관리</h2>
            <p className="mt-0.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              발주서 작성·출력 → 입고 예정 등록 → 수령 · 검수 · 재고 증가
            </p>
          </div>
        </div>

        {/* 하단 행: 상태 필터 버튼 */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(['', 'PENDING', 'RECEIVING', 'INSPECTING', 'COMPLETED'] as (InboundStatus | '')[]).map((value) => {
            const count = value === '' ? allOrders.length : allOrders.filter((o) => o.status === value).length
            const label = value === '' ? '전체' : STATUS_LABEL[value]
            return (
              <button
                key={value || 'all'}
                onClick={() => setStatusFilter(value)}
                className={cn(
                  'rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors',
                  statusFilter === value
                    ? 'wms-table-header border-[var(--color-grid-header)]'
                    : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200',
                )}
              >
                {label} <span className="ml-1 tabular-nums">{formatNumber(count)}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      {/* ── 전표 정보 패널 ── */}
      <section className="wms-panel overflow-hidden border dark:border-gray-800 dark:bg-gray-900">
        <div className="wms-panel-header flex items-center justify-between border-b px-3 py-1.5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <span className="wms-modal-mark grid h-8 w-8 place-items-center rounded-lg">전표</span>
            <p className="font-bold text-gray-900 dark:text-white">매입(입고) 전표정보</p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            {new Date().toLocaleDateString('ko-KR')}
          </span>
        </div>
        <div className="grid gap-x-4 gap-y-1.5 p-3 md:grid-cols-2 xl:grid-cols-4">
          <InboundInfo label="공급업체"    value={activeOrder?.supplier || '전표를 선택하세요'} />
          <InboundInfo label="입고전표번호" value={activeOrder?.orderNo || '-'} mono />
          <InboundInfo label="입고예정일"  value={fmtDate(activeOrder?.expectedDate)} />
          <InboundInfo label="입고상태"    value={activeOrder ? STATUS_LABEL[activeOrder.status] : '-'} />
          <InboundInfo label="품목 수"     value={activeOrder ? `${formatNumber(activeOrder.items.length)}종` : '-'} />
          <InboundInfo label="등록일"      value={fmtDate(activeOrder?.createdAt)} />
          <InboundInfo label="메모"        value={activeOrder?.memo || '-'} />
          <InboundInfo label="열기"        value="행을 클릭하면 오른쪽에 상세를 엽니다." />
        </div>
      </section>

      {/* 요약 카드 (숨김 유지) */}
      <div className="hidden">
        <button
          onClick={() => router.push('/quotes?tab=PURCHASE')}
          title="작성중인 발주서 보기"
          className="min-w-24 shrink-0 border border-orange-200 bg-orange-50 px-3 py-1.5 text-left transition-colors hover:bg-orange-100 dark:border-orange-900/60 dark:bg-orange-950/20"
        >
          <p className="text-xl font-bold tabular-nums text-orange-600 dark:text-orange-400">
            {formatNumber(draftPurchaseOrders?.total ?? 0)}
          </p>
          <p className="mt-0.5 text-xs text-orange-700 dark:text-orange-300">작성중인 발주서</p>
        </button>
        {(['', ...Object.keys(STATUS_LABEL)] as (InboundStatus | '')[]).map((s) => {
          const count = s === '' ? allOrders.length : allOrders.filter((o) => o.status === s).length
          const label = s === '' ? '전체' : STATUS_LABEL[s as InboundStatus]
          const color = s === '' ? 'text-gray-700 dark:text-gray-200' : {
            PENDING:    'text-blue-600 dark:text-blue-400',
            RECEIVING:  'text-amber-600 dark:text-amber-400',
            INSPECTING: 'text-purple-600 dark:text-purple-400',
            COMPLETED:  'text-emerald-600 dark:text-emerald-400',
            CANCELLED:  'text-gray-500 dark:text-gray-400',
          }[s as InboundStatus]
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s as InboundStatus | '')}
              className={cn(
                'min-w-20 shrink-0 border-0 bg-transparent px-2 py-1.5 text-left transition-colors hover:bg-white dark:hover:bg-gray-900',
                statusFilter === s
                  ? 'border-indigo-400 ring-1 ring-indigo-400'
                  : 'border-gray-200 dark:border-gray-800',
              )}
            >
              <p className={cn('text-xl font-bold tabular-nums', color)}>{formatNumber(count)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
            </button>
          )
        })}
      </div>

      {/* ── 목록 그리드 / 상세 패널 ── */}
      <div className={cn(
        'app-surface flex min-h-0 flex-col overflow-hidden border border-gray-300 bg-white dark:border-gray-800 dark:bg-gray-900',
        detailOrderId ? 'flex-1' : 'w-full flex-1',
      )}>
        <div className="wms-grid-toolbar flex flex-wrap items-center justify-between gap-2 border-b px-2 py-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="h-7 rounded border border-gray-200 px-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <span className="text-xs text-gray-400">~</span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="h-7 rounded border border-gray-200 px-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as InboundStatus | '')}
              className="h-7 rounded border border-gray-200 px-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="">전체 상태</option>
              {Object.entries(STATUS_LABEL).map(([key, value]) => (
                <option key={key} value={key}>{value}</option>
              ))}
            </select>
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') setSearch(searchInput) }}
              placeholder="전표번호/공급업체"
              className="h-7 w-40 rounded border border-gray-200 px-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <button
              type="button"
              onClick={() => setSearch(searchInput)}
              className="wms-toolbar-action inline-flex h-7 items-center gap-1 rounded px-2.5 text-xs font-semibold transition-colors"
            >
              <Search size={13} />
              검색
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="wms-toolbar-action inline-flex h-7 items-center gap-1 rounded px-2.5 text-xs font-semibold transition-colors"
            >
              <RotateCcw size={13} />
              초기화
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              title="직접 입고 예정 등록"
              className="wms-toolbar-action inline-flex h-7 w-7 items-center justify-center rounded transition-colors"
            >
              <Plus size={15} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => { void handleDeleteSelected() }}
              disabled={selectedRowCount === 0 || deleteMutation.isPending}
              title="선택 전표 삭제"
              className="wms-toolbar-action inline-flex h-7 w-7 items-center justify-center rounded transition-colors disabled:opacity-40"
            >
              <Minus size={16} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              title="새로고침"
              onClick={refresh}
              className="wms-toolbar-action inline-flex h-7 w-7 items-center justify-center rounded transition-colors"
            >
              <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            </button>
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                title="추가 작업"
                aria-label="추가 작업"
                aria-expanded={menuOpen}
                className="wms-toolbar-action inline-flex h-7 w-7 items-center justify-center rounded transition-colors"
              >
                <Menu size={16} strokeWidth={2.2} />
              </button>
              {menuOpen && (
                <div className="product-grid-overflow absolute right-0 top-8 z-50 flex min-w-[156px] flex-col gap-1 rounded border border-gray-200 bg-white p-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); void handleExcelDownload() }}
                    className="wms-toolbar-action inline-flex h-8 items-center gap-2 rounded px-2 text-xs font-semibold transition-colors"
                  >
                    <FileDown size={13} />
                    엑셀 내보내기
                  </button>
                  <ImportButton
                    config={inboundImportConfig}
                    label="엑셀 가져오기"
                    className="wms-toolbar-action inline-flex h-8 items-center gap-2 rounded px-2 text-xs font-semibold transition-colors"
                    labelClassName="whitespace-nowrap"
                    onImported={() => {
                      setMenuOpen(false)
                      refresh()
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); router.push('/quotes?tab=PURCHASE') }}
                    className="wms-toolbar-action inline-flex h-8 items-center gap-2 rounded px-2 text-xs font-semibold transition-colors"
                  >
                    발주서 작성·출력
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="ag-theme-quartz ag-theme-wms wms-ag-grid min-h-0 w-full flex-1">
          <AgGridReact<InboundLineRow>
            ref={gridRef}
            rowData={gridRows}
            columnDefs={columns}
            defaultColDef={{
              sortable: true,
              resizable: true,
              filter: true,
              suppressHeaderMenuButton: true,
              minWidth: 70,
            }}
            rowSelection="multiple"
            suppressRowClickSelection
            headerHeight={34}
            rowHeight={34}
            animateRows
            loading={isLoading}
            overlayLoadingTemplate="<span class='ag-overlay-loading-center'>불러오는 중...</span>"
            overlayNoRowsTemplate="<span class='ag-overlay-no-rows-center'>조회된 입고 품목이 없습니다.</span>"
            getRowId={(params) => params.data.id}
            onSelectionChanged={() => setSelectedRowCount(gridRef.current?.api.getSelectedRows().length ?? 0)}
            onRowClicked={(params) => {
              if (!params.data) return
              setSelectedOrder(params.data.order)
              setDetailOrderId(params.data.order.id)
            }}
            onRowDoubleClicked={(params) => {
              if (!params.data) return
              setSelectedOrder(params.data.order)
              setDetailOrderId(params.data.order.id)
            }}
            rowClassRules={{
              'bg-indigo-50/60 dark:bg-indigo-950/20': (params) => params.data?.order.id === activeOrder?.id,
            }}
          />
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-gray-200 px-4 py-2 text-xs text-gray-400 dark:border-gray-800">
          <span>품목 {formatNumber(gridRows.length)}건 · 전표 {formatNumber(new Set(gridRows.map((row) => row.order.id)).size)}건</span>
          {activeOrder && <span>선택: <b className="text-indigo-600 dark:text-indigo-400">{activeOrder.orderNo}</b></span>}
        </div>
      </div>
      </div>

      {detailOrderId && (
        <div className="wms-detail-panel-enter flex min-h-0 w-[520px] shrink-0 flex-col overflow-hidden border border-gray-300 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900">
            <div className="min-w-0">
              <b className="block truncate text-sm">입고 상세</b>
              <span className="block truncate font-mono text-xs text-gray-500">{activeOrder?.orderNo ?? detailOrderId}</span>
            </div>
            <button
              type="button"
              onClick={() => setDetailOrderId(null)}
              className="wms-toolbar-action ml-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors"
              title="닫기"
            >
              <X size={14} />
            </button>
          </div>
          <iframe
            src={`/inbound/${detailOrderId}?embed=1`}
            title="입고 상세"
            className="min-h-0 flex-1 border-0"
          />
        </div>
      )}
      </div>

      {/* ── 입고 예정 등록 모달 ── */}
      {createOpen && (
        <CreateModal
          warehouseId={warehouse.id}
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false)
            qc.invalidateQueries({ queryKey: ['inbound'] })
            toast.success('입고 예정이 등록되었습니다')
            router.push(`/inbound/${id}`)
          }}
        />
      )}

    </div>
  )
}

// ── 전표 정보 셀 ────────────────────────────────────────────────────────────
function InboundInfo({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={cn(
        'mt-0.5 min-h-4 border-b border-gray-200 pb-0.5 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-white',
        mono && 'font-mono text-xs',
      )}>
        {value}
      </p>
    </div>
  )
}


// ── 입고 예정 등록 모달 ────────────────────────────────────────────────────
function CreateModal({
  warehouseId,
  onClose,
  onCreated,
}: {
  warehouseId: string
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [supplier,     setSupplier]     = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [memo,         setMemo]         = useState('')
  const [items, setItems] = useState<{
    productId: string
    expectedQty: number
    lotNumber: string
    expireDate: string
    locationId: string
    product?: Product
  }[]>([])
  const [productSearch, setProductSearch] = useState('')

  // 창고 재고 조회 (품목별 현재 재고 표시용)
  const { data: inventoryList } = useQuery({
    queryKey: QUERY_KEYS.inventory({ warehouseId }),
    queryFn:  () => stockApi.getInventory(warehouseId),
    enabled:  !!warehouseId,
  })

  // productId → 합산 재고 map
  const inventoryMap = useMemo(() => {
    const map: Record<string, number> = {}
    if (!inventoryList) return map
    for (const inv of inventoryList) {
      map[inv.productId] = (map[inv.productId] ?? 0) + inv.quantity
    }
    return map
  }, [inventoryList])

  const { data: productPage } = useQuery({
    queryKey: QUERY_KEYS.products({ search: productSearch }),
    queryFn:  () => productApi.findAll({ search: productSearch, limit: 20 }),
    enabled:  productSearch.length > 0,
  })

  const createMutation = useMutation({
    mutationFn: (req: CreateInboundOrderRequest) => inboundApi.create(req),
    onSuccess: (data) => onCreated(data.id),
    onError:   () => toast.error('등록에 실패했습니다'),
  })

  const addItem = (product: Product) => {
    if (items.some((i) => i.productId === product.id)) {
      toast('이미 추가된 상품입니다', { icon: '⚠️' })
      return
    }
    setItems((prev) => [
      ...prev,
      { productId: product.id, expectedQty: 1, lotNumber: '', expireDate: '', locationId: '', product },
    ])
    setProductSearch('')
  }

  const removeItem = (productId: string) =>
    setItems((prev) => prev.filter((i) => i.productId !== productId))

  const handleSubmit = () => {
    if (items.length === 0) { toast.error('품목을 1개 이상 추가하세요'); return }
    createMutation.mutate({
      warehouseId,
      supplier:     supplier || undefined,
      expectedDate: expectedDate || undefined,
      memo:         memo || undefined,
      items: items.map((i) => ({
        productId:   i.productId,
        expectedQty: i.expectedQty,
        lotNumber:   i.lotNumber || undefined,
        expireDate:  i.expireDate || undefined,
        locationId:  i.locationId || undefined,
      })),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">

        {/* 모달 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">입고 예정 등록</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
          >
            닫기
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* ── 섹션 1: 기본 정보 ── */}
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">기본 정보</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={ui.label}>공급업체</label>
                <input
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className={ui.formInput}
                  placeholder="공급업체명"
                />
              </div>
              <div>
                <label className={ui.label}>입고 예정일</label>
                <input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className={ui.formInput}
                />
              </div>
            </div>
            <div className="mt-3">
              <label className={ui.label}>메모</label>
              <input
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className={ui.formInput}
                placeholder="메모 (선택)"
              />
            </div>
          </section>

          {/* ── 섹션 2: 품목 추가 ── */}
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">품목 추가</p>

            {/* 상품 검색 드롭다운 */}
            <div className="relative">
              <label className={ui.label}>상품 검색</label>
              <input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className={ui.formInput}
                placeholder="상품명 또는 코드 입력"
              />
              {productPage && productPage.items.length > 0 && productSearch && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto">
                  {productPage.items.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addItem(p)}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 text-sm text-gray-800 dark:text-gray-200 flex items-center justify-between"
                    >
                      <span>{p.name}</span>
                      <span className="text-xs text-gray-400">{p.code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 품목 목록 */}
            {items.length > 0 && (
              <div className="mt-3 space-y-3">
                <p className="text-xs font-medium text-gray-500">
                  품목 <span className="text-gray-900 dark:text-gray-100">{formatNumber(items.length)}개</span>
                </p>
                {items.map((item, idx) => {
                  const currentStock = inventoryMap[item.productId] ?? 0
                  return (
                    <div
                      key={item.productId}
                      className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 p-3 space-y-2"
                    >
                      {/* 품목 행 */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                            {item.product?.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {item.product?.code}
                            {item.product?.unit && (
                              <span className="ml-1.5 text-gray-400">({item.product.unit})</span>
                            )}
                          </p>
                        </div>
                        {/* 수량 입력 */}
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={1}
                            value={item.expectedQty}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((i, j) =>
                                  j === idx ? { ...i, expectedQty: parseInt(e.target.value) || 1 } : i
                                )
                              )
                            }
                            className="wms-input w-20 px-2 py-1 text-right tabular-nums dark:border-gray-600 dark:bg-gray-700"
                            placeholder="수량"
                          />
                          <span className="w-8 text-center text-xs text-gray-400">
                            {item.product?.unit || '-'}
                          </span>
                        </div>
                        {/* 삭제 */}
                        <button
                          onClick={() => removeItem(item.productId)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors text-xs"
                          title="품목 삭제"
                        >
                          ✕
                        </button>
                      </div>

                      {/* 재고 요약 영역 */}
                      <StockSummaryBox
                        currentStock={currentStock}
                        changeAmount={item.expectedQty}
                        unit={item.product?.unit || 'EA'}
                        type="inbound"
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        {/* 모달 푸터 */}
        <div className="flex gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <button
            onClick={onClose}
            className={cn(ui.btnSecondary, 'flex-1 py-2 text-sm')}
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="wms-primary-button flex-1 py-2 rounded text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {createMutation.isPending ? '등록 중...' : '등록'}
          </button>
        </div>
      </div>
    </div>
  )
}
