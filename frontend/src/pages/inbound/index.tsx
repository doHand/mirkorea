'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, FileDown, FileText, Menu, Minus, Plus, RefreshCw, RotateCcw, Search, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { inboundApi } from '@/api/inbound.api'
import type { CreateInboundOrderRequest } from '@/api/inbound.api'
import { productApi } from '@/api/product.api'
import { clientApi } from '@/api/client.api'
import { purchaseOrderApi } from '@/api/purchase-order.api'
import { stockApi } from '@/api/stock.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { cn } from '@/utils/cn'
import * as ui from '@/styles/ui'
import { datedExcelFilename, writeRowsToExcel } from '@/utils/excel'
import { formatNumber } from '@/utils/format'
import { formatUnitSpec, getPackageUnitQty } from '@/utils/unit-spec'
import type { Client, InboundOrder, InboundOrderItem, InboundStatus, Product, UnitType } from '@/types/api.types'
import { StatusBadge } from '@/components/StatusBadge'
import { ImportButton, type ImportConfig, type ImportRow } from '@/components/ImportButton'
import { ClientPickerModal } from '@/components/ClientPickerModal'
import { ReturnCollectionPanel } from '@/components/ReturnCollectionPanel'

interface InboundLineRow {
  id: string
  rowNo: number
  order: InboundOrder
  item: InboundOrderItem | undefined
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

const STATUS_SUMMARY_STYLE: Record<InboundStatus | 'ALL', string> = {
  ALL:        'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-gray-900 dark:text-slate-300',
  PENDING:    'border-blue-100 bg-blue-50/70 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-300',
  RECEIVING:  'border-amber-100 bg-amber-50/70 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300',
  INSPECTING: 'border-purple-100 bg-purple-50/70 text-purple-700 dark:border-purple-900/50 dark:bg-purple-950/20 dark:text-purple-300',
  COMPLETED:  'border-emerald-100 bg-emerald-50/70 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300',
  CANCELLED:  'border-gray-200 bg-gray-50/80 text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300',
}

const STATUS_DOT_STYLE: Record<InboundStatus | 'ALL', string> = {
  ALL:        'bg-slate-400',
  PENDING:    'bg-blue-500',
  RECEIVING:  'bg-amber-500',
  INSPECTING: 'bg-purple-500',
  COMPLETED:  'bg-emerald-500',
  CANCELLED:  'bg-gray-400',
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

  // 탭 (입고 / 반품·회수)
  const [tab, setTab] = useState<'INBOUND' | 'RETURNS'>('INBOUND')

  useEffect(() => {
    if (!router.isReady) return
    setTab(router.query.tab === 'returns' ? 'RETURNS' : 'INBOUND')
  }, [router.isReady, router.query.tab])

  // 모달 state
  const [createOpen,    setCreateOpen]    = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<InboundOrder | null>(null)
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)
  const [menuOpen,      setMenuOpen]      = useState(false)
  const [selectedRowCount, setSelectedRowCount] = useState(0)
  const [selectedDeletableCount, setSelectedDeletableCount] = useState(0)

  useEffect(() => {
    if (!router.isReady) return
    const detail = typeof router.query.detail === 'string' ? router.query.detail : ''
    if (detail) setDetailOrderId(detail)
  }, [router.isReady, router.query.detail])

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

  const orders    = useMemo(() => page?.items ?? [], [page?.items])
  const allOrders = useMemo(() => allPage?.items ?? [], [allPage?.items])
  const statusSummaryItems = useMemo(() => (
    ['', 'PENDING', 'RECEIVING', 'INSPECTING', 'COMPLETED', 'CANCELLED'] as (InboundStatus | '')[]
  ).map((value) => ({
    value,
    label: value === '' ? '전체' : STATUS_LABEL[value],
    count: value === '' ? allOrders.length : allOrders.filter((order) => order.status === value).length,
    styleKey: value === '' ? 'ALL' as const : value,
  })), [allOrders])

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

  const gridRows = useMemo<InboundLineRow[]>(() => filtered.map((order, rowIndex) => {
    const firstItem = order.items[0]
    const itemCount = order.items.length
    const firstName = firstItem?.product?.name || '-'
    const productName = itemCount > 1 ? `${firstName} 외 ${itemCount - 1}개` : firstName
    return {
      id: order.id,
      rowNo: rowIndex + 1,
      order,
      item: firstItem,
      expectedDate: fmtDate(order.expectedDate),
      orderNo: order.orderNo,
      supplier: order.supplier || '-',
      productName,
      productCode: itemCount === 1 ? (firstItem?.product?.code || '') : '',
      spec: itemCount === 1 ? formatUnitSpec(firstItem?.product) : `${itemCount}종`,
      expectedQty: order.items.reduce((s, i) => s + i.expectedQty, 0),
      receivedQty: order.items.reduce((s, i) => s + i.receivedQty, 0),
      passedQty: order.items.reduce((s, i) => s + i.passedQty, 0),
      defectQty: order.items.reduce((s, i) => s + i.defectQty, 0),
      unit: itemCount === 1 ? (firstItem?.product?.unit || firstItem?.inputUnit || '-') : '-',
      costPrice: null,
      materialNo: itemCount === 1 ? (firstItem?.product?.materialNo || firstItem?.product?.code || '-') : '-',
      status: order.status,
    }
  }), [filtered])

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
    const checkboxOrders = [...new Map(selectedRows.map((row) => [row.order.id, row.order])).values()]
    const ordersToDelete = checkboxOrders.length > 0
      ? checkboxOrders
      : selectedOrder
        ? [selectedOrder]
        : []
    if (!ordersToDelete.length) {
      toast.error('삭제할 전표를 선택해주세요')
      return
    }
    const blockedOrders = ordersToDelete.filter((order) => order.status !== 'PENDING')
    if (blockedOrders.length > 0) {
      toast.error('입고 예정 상태의 전표만 삭제할 수 있습니다.')
      return
    }

    const message = `${ordersToDelete.length}개 입고 예정 전표를 삭제하시겠습니까?`
    if (!window.confirm(message)) return

    try {
      for (const order of ordersToDelete) {
        await deleteMutation.mutateAsync(order.id)
      }
      toast.success(`${ordersToDelete.length}개 입고 전표를 삭제했습니다`)
      refresh()
      gridRef.current?.api.deselectAll()
      setSelectedRowCount(0)
      setSelectedDeletableCount(0)
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
    { headerName: '전표번호', field: 'orderNo', width: 170, pinned: 'left', cellClass: 'wms-code font-mono font-semibold' },
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

  const activeOrder = detailOrderId
    ? filtered.find((o) => o.id === detailOrderId) ?? selectedOrder ?? null
    : selectedOrder && filtered.some((o) => o.id === selectedOrder.id)
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
      await writeRowsToExcel(rows, datedExcelFilename('입고내역'), '입고내역')
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

      {/* ── 탭 전환 ── */}
      <div className="flex shrink-0 gap-1 border-b border-gray-200 dark:border-gray-800">
        {(['INBOUND', 'RETURNS'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t)
              void router.replace(
                { pathname: router.pathname, query: t === 'RETURNS' ? { tab: 'returns' } : {} },
                undefined,
                { shallow: true },
              )
            }}
            className={cn(
              'border-b-2 px-3 py-1.5 text-sm font-semibold transition-colors',
              tab === t
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
            )}
          >
            {t === 'INBOUND' ? '입고' : '반품/회수'}
          </button>
        ))}
      </div>

      {tab === 'RETURNS' ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <ReturnCollectionPanel warehouseId={warehouse.id} />
        </div>
      ) : (
      <>
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
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          {statusSummaryItems.map((item) => {
            const selected = statusFilter === item.value
            return (
              <button
                key={item.value || 'all'}
                type="button"
                onClick={() => setStatusFilter(item.value)}
                aria-pressed={selected}
                className={cn(
                  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-all',
                  STATUS_SUMMARY_STYLE[item.styleKey],
                  selected
                    ? 'shadow-sm ring-2 ring-current ring-offset-1 ring-offset-white dark:ring-offset-gray-950'
                    : 'opacity-75 hover:opacity-100',
                )}
              >
                <span className="grid h-3.5 w-3.5 place-items-center" aria-hidden="true">
                  {selected
                    ? <Check size={13} strokeWidth={3} />
                    : <span className={cn('h-2 w-2 rounded-full', STATUS_DOT_STYLE[item.styleKey])} />}
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
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      {/* ── 전표 정보 패널 ── */}
      <section className="wms-panel overflow-hidden border dark:border-gray-800 dark:bg-gray-900">
        <div className="wms-panel-header flex items-center justify-between border-b px-3 py-1.5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <span className="wms-modal-mark grid h-8 w-8 place-items-center rounded-lg"><FileText size={16} /></span>
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
        <div className="wms-grid-toolbar flex items-center gap-2 border-b px-2 py-1.5 min-w-0">
          <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto scrollbar-hide">
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="h-7 shrink-0 rounded border border-gray-200 px-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <span className="shrink-0 text-xs text-gray-400">~</span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="h-7 shrink-0 rounded border border-gray-200 px-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as InboundStatus | '')}
              className="h-7 shrink-0 rounded border border-gray-200 px-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
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
              className="h-7 w-40 shrink-0 rounded border border-gray-200 px-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
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
              onClick={() => setCreateOpen(true)}
              title="직접 입고 예정 등록"
              className="wms-toolbar-action inline-flex h-7 w-7 items-center justify-center rounded transition-colors"
            >
              <Plus size={15} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => { void handleDeleteSelected() }}
              disabled={(selectedDeletableCount === 0 && selectedOrder?.status !== 'PENDING') || deleteMutation.isPending}
              title={(selectedRowCount > 0 || selectedOrder) && selectedDeletableCount === 0 && selectedOrder?.status !== 'PENDING' ? '입고 예정 상태만 삭제할 수 있습니다' : '선택하거나 상세로 연 전표 삭제'}
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
            onSelectionChanged={() => {
              const selectedRows = gridRef.current?.api.getSelectedRows() ?? []
              setSelectedRowCount(selectedRows.length)
              setSelectedDeletableCount(new Set(selectedRows
                .filter((row) => row.order.status === 'PENDING')
                .map((row) => row.order.id)).size)
            }}
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
            getRowStyle={(params) => {
              if (!params.data) return undefined
              const isDark = document.documentElement.classList.contains('dark')
              if (params.data.order.id === activeOrder?.id) {
                return { backgroundColor: isDark ? 'rgba(45,64,51,0.40)' : 'rgba(224,236,227,0.90)' } as Record<string, string>
              }
              switch (params.data.status) {
                case 'PENDING':    return { backgroundColor: isDark ? 'rgba(59,130,246,0.10)'   : 'rgba(219,234,254,0.60)' } as Record<string, string>
                case 'RECEIVING':  return { backgroundColor: isDark ? 'rgba(245,158,11,0.10)'  : 'rgba(254,243,199,0.70)' } as Record<string, string>
                case 'INSPECTING': return { backgroundColor: isDark ? 'rgba(168,85,247,0.10)'  : 'rgba(243,232,255,0.70)' } as Record<string, string>
                case 'COMPLETED':  return { backgroundColor: isDark ? 'rgba(16,185,129,0.10)'  : 'rgba(209,250,229,0.60)' } as Record<string, string>
                case 'CANCELLED':  return { backgroundColor: isDark ? 'rgba(107,114,128,0.15)' : 'rgba(229,231,235,0.70)', opacity: '0.65' } as Record<string, string>
                default: return undefined
              }
            }}
          />
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-gray-200 px-4 py-2 text-xs text-gray-400 dark:border-gray-800">
          <span>전표 {formatNumber(gridRows.length)}건 · 품목 {formatNumber(gridRows.reduce((s, r) => s + r.order.items.length, 0))}종</span>
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

      {createOpen && (
        <CreateModal
          warehouseId={warehouse.id}
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false)
            refresh()
            toast.success('입고 예정이 등록되었습니다')
            setDetailOrderId(id)
          }}
        />
      )}
      </>
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
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false)
  const [supplierModalOpen, setSupplierModalOpen] = useState(false)
  const [expectedDate, setExpectedDate] = useState('')
  const [memo,         setMemo]         = useState('')
  const [items, setItems] = useState<{
    productId: string
    expectedQty: number
    inputUnit: UnitType
    lotNumber: string
    expireDate: string
    locationId: string
    product?: Product
  }[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [dropdownIdx,   setDropdownIdx]   = useState(-1)
  const [poConfirmId, setPoConfirmId] = useState<string | null>(null)

  const supplierRef   = useRef<HTMLInputElement>(null)
  const supplierPickerRef = useRef<HTMLDivElement>(null)
  const searchRef     = useRef<HTMLInputElement>(null)
  const dropdownRef   = useRef<HTMLDivElement>(null)

  // 모달 열리면 공급업체 포커스
  useEffect(() => { supplierRef.current?.focus() }, [])

  useEffect(() => {
    if (!supplierPickerOpen) return
    const handleOutsideClick = (event: MouseEvent) => {
      if (!supplierPickerRef.current?.contains(event.target as Node)) {
        setSupplierPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [supplierPickerOpen])

  // 검색어 바뀌면 드롭다운 선택 초기화
  useEffect(() => { setDropdownIdx(-1) }, [productSearch])

  // 하이라이트 항목 스크롤 보이기
  useEffect(() => {
    if (dropdownIdx >= 0 && dropdownRef.current) {
      const el = dropdownRef.current.children[dropdownIdx] as HTMLElement | undefined
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [dropdownIdx])

  // Escape → 모달 닫기 (검색창 비어있을 때)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !productSearch && poConfirmId === null) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [productSearch, poConfirmId, onClose])

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

  const { data: productPage, isFetching: productFetching } = useQuery({
    queryKey: QUERY_KEYS.products({ search: productSearch }),
    queryFn:  () => productApi.findAll({ search: productSearch, limit: 20 }),
    enabled:  productSearch.length > 0,
  })

  const { data: supplierPage, isFetching: supplierFetching, isError: supplierError } = useQuery({
    queryKey: ['inbound-suppliers', supplier],
    queryFn: () => clientApi.findAll({ search: supplier.trim(), limit: 20 }),
    enabled: supplierPickerOpen,
  })

  const { data: supplierClients = [], refetch: refetchSupplierClients } = useQuery({
    queryKey: ['clients-all'],
    queryFn: clientApi.findAllActive,
    enabled: supplierModalOpen,
  })

  const selectSupplier = (client: Client) => {
    setSupplier(client.name)
    setSupplierPickerOpen(false)
  }

  const createMutation = useMutation({
    mutationFn: (req: CreateInboundOrderRequest) => inboundApi.create(req),
    onSuccess: (data) => setPoConfirmId(data.id),
    onError:   () => toast.error('등록에 실패했습니다'),
  })

  const purchaseMutation = useMutation({
    mutationFn: () => purchaseOrderApi.create({
      warehouseId,
      supplier: supplier || undefined,
      orderDate: new Date().toISOString().slice(0, 10),
      expectedDate: expectedDate || undefined,
      memo: memo || undefined,
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.expectedQty,
        boxCount: 0,
        unitPrice: i.product?.costPrice ?? 0,
      })),
    }),
    onSuccess: () => { toast.success('발주서도 함께 등록되었습니다'); onCreated(poConfirmId!) },
    onError:   () => { toast.error('발주서 등록에 실패했습니다');    onCreated(poConfirmId!) },
  })

  const addItem = (product: Product) => {
    if (items.some((i) => i.productId === product.id)) {
      toast('이미 추가된 상품입니다', { icon: '⚠️' })
      return
    }
    setItems((prev) => [
      ...prev,
      {
        productId: product.id,
        expectedQty: 1,
        inputUnit: getPackageUnitQty(product, 'IN') ? 'IN' : 'EA',
        lotNumber: '', expireDate: '', locationId: '', product,
      },
    ])
    setProductSearch('')
    setDropdownIdx(-1)
    // 상품 추가 후 검색창으로 포커스 복귀
    setTimeout(() => searchRef.current?.focus(), 0)
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
        inputUnit:   i.inputUnit !== 'EA' ? i.inputUnit : undefined,
        lotNumber:   i.lotNumber || undefined,
        expireDate:  i.expireDate || undefined,
        locationId:  i.locationId || undefined,
      })),
    })
  }

  const totalEa = items.reduce((s, i) => {
    const p = i.product
    const f = i.inputUnit === 'IN' ? (p ? (getPackageUnitQty(p, 'IN') ?? 1) : 1)
            : i.inputUnit === 'OUT' ? (p ? (getPackageUnitQty(p, 'OUT') ?? 1) : 1)
            : 1
    return s + i.expectedQty * f
  }, 0)

  const updateQty = (idx: number, val: number) =>
    setItems((prev) => prev.map((i, j) => j === idx ? { ...i, expectedQty: Math.max(1, val) } : i))

  const draftItemColumns = useMemo<ColDef<(typeof items)[number]>[]>(() => [
    {
      headerName: '상품명',
      minWidth: 180,
      flex: 1,
      valueGetter: (params) => params.data?.product?.name ?? '-',
      cellClass: '!bg-gray-100 text-gray-600 dark:!bg-gray-900/70 dark:text-gray-300',
    },
    {
      headerName: '상품코드',
      width: 125,
      valueGetter: (params) => params.data?.product?.code ?? '-',
      cellClass: '!bg-gray-100 font-mono text-xs text-gray-600 dark:!bg-gray-900/70 dark:text-gray-300',
    },
    {
      headerName: '예정수량',
      field: 'expectedQty',
      width: 105,
      editable: true,
      type: 'numericColumn',
      cellClass: '!bg-white dark:!bg-gray-800',
      cellEditor: 'agNumberCellEditor',
      valueParser: (params) => Math.max(1, Math.floor(Number(params.newValue) || 1)),
    },
    {
      headerName: '단위',
      field: 'inputUnit',
      width: 115,
      editable: (params) => Boolean(
        params.data?.product && (
          getPackageUnitQty(params.data.product, 'IN') || getPackageUnitQty(params.data.product, 'OUT')
        ),
      ),
      cellClass: (params) => params.data?.product && (
        getPackageUnitQty(params.data.product, 'IN') || getPackageUnitQty(params.data.product, 'OUT')
      )
        ? '!bg-white dark:!bg-gray-800'
        : '!bg-gray-100 text-gray-500 dark:!bg-gray-900/70 dark:text-gray-400',
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: (params: { data?: (typeof items)[number] }) => {
        const values: UnitType[] = ['EA']
        if (params.data?.product && getPackageUnitQty(params.data.product, 'IN')) values.push('IN')
        if (params.data?.product && getPackageUnitQty(params.data.product, 'OUT')) values.push('OUT')
        return { values }
      },
    },
    {
      headerName: 'EA 환산',
      width: 105,
      type: 'numericColumn',
      valueGetter: (params) => {
        const item = params.data
        if (!item?.product) return 0
        const factor = item.inputUnit === 'IN'
          ? getPackageUnitQty(item.product, 'IN') ?? 1
          : item.inputUnit === 'OUT'
            ? getPackageUnitQty(item.product, 'OUT') ?? 1
            : 1
        return item.expectedQty * factor
      },
      valueFormatter: (params) => formatNumber(Number(params.value ?? 0)),
      cellClass: '!bg-gray-100 text-gray-600 dark:!bg-gray-900/70 dark:text-gray-300',
    },
    {
      headerName: '현재재고',
      width: 105,
      type: 'numericColumn',
      valueGetter: (params) => inventoryMap[params.data?.productId ?? ''] ?? 0,
      valueFormatter: (params) => formatNumber(Number(params.value ?? 0)),
      cellClass: '!bg-gray-100 text-gray-600 dark:!bg-gray-900/70 dark:text-gray-300',
    },
    {
      headerName: '',
      width: 54,
      minWidth: 54,
      maxWidth: 54,
      sortable: false,
      filter: false,
      cellClass: '!bg-gray-100 dark:!bg-gray-900/70',
      cellRenderer: (params: { data?: (typeof items)[number] }) => params.data ? (
        <button type="button" onClick={() => removeItem(params.data!.productId)} className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-500" title="행 삭제">
          <X size={13} />
        </button>
      ) : null,
    },
  ], [inventoryMap])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl dark:bg-gray-800">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
              <FileText size={14} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">입고 예정 등록</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* 등록 완료 → 발주서 확인 */}
        {poConfirmId !== null ? (
          <div className="flex flex-col items-center gap-3 py-8 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 text-xl">✓</div>
            <p className="text-base font-semibold text-gray-900 dark:text-white">입고 예정이 등록되었습니다</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">발주서도 함께 등록하시겠습니까?</p>
            <div className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-3 text-left">
              <p className="mb-2 text-xs font-medium text-gray-400">등록될 발주서 품목</p>
              {items.map((item) => (
                <div key={item.productId} className="flex items-center justify-between py-0.5 text-sm">
                  <span className="text-gray-700 dark:text-gray-300">{item.product?.name}</span>
                  <span className="text-gray-500 tabular-nums">{formatNumber(item.expectedQty)} {item.inputUnit}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* 본문 */}
        <div className={cn('overflow-y-auto flex-1 px-5 py-4 space-y-4', poConfirmId !== null && 'hidden')}>

          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-3">
            <div ref={supplierPickerRef} className="relative">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">공급업체</label>
              <div className="relative">
                <input
                  ref={supplierRef}
                  value={supplier}
                  onFocus={() => setSupplierPickerOpen(true)}
                  onChange={(e) => {
                    setSupplier(e.target.value)
                    setSupplierPickerOpen(true)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setSupplierPickerOpen(false)
                    if (e.key === 'Enter' && supplierPage?.items[0]) {
                      e.preventDefault()
                      selectSupplier(supplierPage.items[0])
                    }
                  }}
                  className={cn(ui.formInput, 'pr-9')}
                  placeholder="공급업체명 검색"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSupplierPickerOpen(false)
                    setSupplierModalOpen(true)
                  }}
                  className="absolute right-1 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-emerald-600 dark:hover:bg-gray-700"
                  aria-label="공급업체 전체 목록"
                >
                  <Search size={14} />
                </button>
              </div>
              {supplierPickerOpen && (
                <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-800">
                  {supplierFetching && !supplierPage ? (
                    <p className="px-3 py-4 text-center text-xs text-gray-400">거래처 조회 중...</p>
                  ) : supplierError ? (
                    <p className="px-3 py-4 text-center text-xs text-red-500">거래처 목록을 불러오지 못했습니다.</p>
                  ) : supplierPage?.items.length ? (
                    supplierPage.items.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectSupplier(client)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-emerald-50 dark:hover:bg-gray-700"
                      >
                        <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{client.name}</span>
                        <span className="shrink-0 font-mono text-xs text-gray-400">{client.businessNo || client.phone || '-'}</span>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-4 text-center text-xs text-gray-400">검색된 거래처가 없습니다.</p>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">입고 예정일</label>
              <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)}
                className={ui.formInput} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                메모 <span className="font-normal text-gray-300 dark:text-gray-600">(선택)</span>
              </label>
              <input value={memo} onChange={(e) => setMemo(e.target.value)}
                className={ui.formInput} placeholder="특이사항, 담당자 등" />
            </div>
          </div>

          <div className="border-t border-dashed border-gray-200 dark:border-gray-700" />

          {/* 상품 검색 */}
          <div className="relative">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                ref={searchRef}
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                onKeyDown={(e) => {
                  const results = productPage?.items ?? []
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setDropdownIdx((i) => Math.min(i + 1, results.length - 1))
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setDropdownIdx((i) => Math.max(i - 1, -1))
                  } else if (e.key === 'Enter') {
                    e.preventDefault()
                    const target = dropdownIdx >= 0 ? results[dropdownIdx] : results[0]
                    if (target) addItem(target)
                  } else if (e.key === 'Escape') {
                    e.stopPropagation()
                    if (productSearch) {
                      setProductSearch('')
                      setDropdownIdx(-1)
                    } else {
                      onClose()
                    }
                  }
                }}
                className="wms-input pl-9"
                placeholder="상품명 또는 코드 검색 — ↑↓ 선택, Enter 추가, Esc 닫기"
              />
            </div>
            {productSearch && (
              <div ref={dropdownRef} className="absolute z-[100] top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                {productFetching ? (
                  <p className="px-4 py-3 text-xs text-gray-400 text-center">검색 중...</p>
                ) : productPage && productPage.items.length > 0 ? (
                  productPage.items.map((p, i) => {
                    const stock = inventoryMap[p.id] ?? 0
                    const spec  = formatUnitSpec(p)
                    const highlighted = i === dropdownIdx
                    return (
                      <button key={p.id} onClick={() => addItem(p)}
                        className={cn(
                          'w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-600/50 last:border-0 transition-colors',
                          highlighted
                            ? 'bg-indigo-50 dark:bg-indigo-900/30'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-600',
                        )}>
                        <div className="min-w-0">
                          <p className={cn('text-sm font-medium truncate', highlighted ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-800 dark:text-gray-200')}>{p.name}</p>
                          <p className="text-xs text-gray-400 font-mono">{p.code}{spec !== '-' ? ` · ${spec}` : ''}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={cn('text-xs font-semibold tabular-nums', stock <= 0 ? 'text-red-500' : stock < 10 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400')}>
                            {formatNumber(stock)}
                          </p>
                          <p className="text-[10px] text-gray-400">현재고</p>
                        </div>
                      </button>
                    )
                  })
                ) : (
                  <p className="px-4 py-3 text-xs text-gray-400 text-center">검색 결과 없음</p>
                )}
              </div>
            )}
          </div>

          {/* 품목 테이블 */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                품목 <span className="font-bold text-gray-900 dark:text-white">{items.length}개</span>
              </span>
              {items.length > 0 && (
                <span className="text-xs text-gray-400 tabular-nums">
                  총 <span className="font-semibold text-gray-700 dark:text-gray-300">{formatNumber(totalEa)} EA</span> 입고 예정
                </span>
              )}
            </div>
            <div className="ag-theme-quartz ag-theme-wms wms-ag-grid h-[230px] w-full">
              <AgGridReact<(typeof items)[number]>
                rowData={items}
                columnDefs={draftItemColumns}
                defaultColDef={{ resizable: true, sortable: false, filter: false, suppressHeaderMenuButton: true }}
                getRowId={(params) => params.data.productId}
                headerHeight={34}
                rowHeight={34}
                singleClickEdit
                stopEditingWhenCellsLoseFocus
                onCellValueChanged={() => setItems((current) => [...current])}
                overlayNoRowsTemplate="<span class='ag-overlay-no-rows-center'>상품을 검색해서 행을 추가하세요.</span>"
              />
            </div>
            <table className="hidden w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-400 w-36">상품명</th>
                  <th className="px-2 py-1.5 text-center text-xs font-medium text-gray-400">수량</th>
                  <th className="px-2 py-1.5 text-center text-xs font-medium text-gray-400 w-28">단위</th>
                  <th className="px-2 py-1.5 text-right text-xs font-medium text-gray-400 w-20 whitespace-nowrap">현재재고</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-xs text-gray-400">
                      위 검색창에서 상품을 검색하여 추가하세요
                    </td>
                  </tr>
                ) : items.map((item, idx) => {
                  const currentStock = inventoryMap[item.productId] ?? 0
                  const inQty  = item.product ? getPackageUnitQty(item.product, 'IN')  : null
                  const outQty = item.product ? getPackageUnitQty(item.product, 'OUT') : null
                  const factor = item.inputUnit === 'IN' ? (inQty ?? 1) : item.inputUnit === 'OUT' ? (outQty ?? 1) : 1
                  const eaCount = item.expectedQty * factor
                  return (
                    <tr key={item.productId} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[130px] text-xs leading-tight">{item.product?.name}</p>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">{item.product?.code}</p>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => updateQty(idx, item.expectedQty - 1)}
                            className="h-6 w-6 rounded border border-gray-200 dark:border-gray-600 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 flex items-center justify-center text-sm font-medium transition-colors shrink-0"
                          >−</button>
                          <input
                            type="number" min={1} value={item.expectedQty}
                            onChange={(e) => updateQty(idx, parseInt(e.target.value) || 1)}
                            className="wms-input w-14 px-1 py-0.5 text-center tabular-nums dark:border-gray-600 dark:bg-gray-700 text-sm"
                          />
                          <button
                            onClick={() => updateQty(idx, item.expectedQty + 1)}
                            className="h-6 w-6 rounded border border-gray-200 dark:border-gray-600 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 flex items-center justify-center text-sm font-medium transition-colors shrink-0"
                          >＋</button>
                        </div>
                        {item.inputUnit !== 'EA' && factor > 1 && (
                          <p className="text-[10px] text-blue-500 tabular-nums mt-0.5 text-center">= {formatNumber(eaCount)} EA</p>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {(inQty || outQty) ? (
                          <select
                            value={item.inputUnit}
                            onChange={(e) => setItems((prev) => prev.map((i, j) => j === idx ? { ...i, inputUnit: e.target.value as UnitType } : i))}
                            className="wms-input px-1 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-700 w-full"
                          >
                            <option value="EA">EA</option>
                            {inQty  && <option value="IN">IN ({inQty})</option>}
                            {outQty && <option value="OUT">OUT ({outQty})</option>}
                          </select>
                        ) : (
                          <span className="text-xs text-gray-400">{item.product?.unit || 'EA'}</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <span className="text-xs tabular-nums text-gray-400 dark:text-gray-500">
                          {formatNumber(currentStock)}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => removeItem(item.productId)}
                          className="h-5 w-5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center mx-auto"
                          title="품목 삭제">
                          <X size={11} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-t border-gray-200 dark:border-gray-700 shrink-0">
          {poConfirmId !== null ? (
            <>
              <button onClick={() => onCreated(poConfirmId)} className={cn(ui.btnSecondary, 'flex-1 py-2 text-sm')}>건너뛰기</button>
              <button onClick={() => purchaseMutation.mutate()} disabled={purchaseMutation.isPending}
                className="wms-primary-button flex-1 py-2 rounded text-sm font-medium disabled:opacity-50 transition-colors">
                {purchaseMutation.isPending ? '등록 중...' : '발주서 등록'}
              </button>
            </>
          ) : (
            <>
              {items.length > 0 && (
                <span className="text-xs text-gray-400 tabular-nums mr-auto">
                  {items.length}개 품목 · {formatNumber(totalEa)} EA
                </span>
              )}
              <button onClick={onClose} className={cn(ui.btnSecondary, 'px-5 py-2 text-sm')}>취소</button>
              <button onClick={handleSubmit} disabled={createMutation.isPending}
                className="wms-primary-button px-6 py-2 rounded text-sm font-medium disabled:opacity-50 transition-colors">
                {createMutation.isPending ? '등록 중...' : '입고 등록'}
              </button>
            </>
          )}
        </div>
      </div>
      {supplierModalOpen && (
        <ClientPickerModal
          clients={supplierClients}
          onSelect={(client) => {
            if (client) selectSupplier(client)
            setSupplierModalOpen(false)
          }}
          onClose={() => setSupplierModalOpen(false)}
          onRefresh={refetchSupplierClients}
        />
      )}
    </div>
  )
}
