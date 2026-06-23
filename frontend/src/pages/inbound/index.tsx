'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
import type { InboundStatus, Product, Inventory } from '@/types/api.types'
import { StatusBadge } from '@/components/StatusBadge'
import { StockSummaryBox } from '@/components/StockSummaryBox'

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

export default function InboundPage() {
  const router    = useRouter()
  const warehouse = useWarehouseStore((s) => s.selectedWarehouse)
  const qc        = useQueryClient()

  // 검색 / 필터 state
  const [searchInput,  setSearchInput]  = useState('')
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<InboundStatus | ''>('')
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')

  // 모달 state
  const [createOpen,    setCreateOpen]    = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<import('@/types/api.types').InboundOrder | null>(null)
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)

  const { data: page, isLoading } = useQuery({
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
  const activeOrder = selectedOrder && filtered.some((o) => o.id === selectedOrder.id)
    ? selectedOrder
    : filtered[0] ?? null

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
    <div className="flex h-[calc(100vh-150px)] min-h-0 flex-col gap-4 overflow-hidden">

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
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => router.push('/quotes?tab=PURCHASE')}
              title="발주서 작성·출력"
              className={cn(ui.btnSecondary, 'px-4 py-2 text-sm whitespace-nowrap')}
            >
              발주서 작성·출력
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              title="직접 입고 예정 등록"
              className="px-4 py-2 text-sm font-medium rounded bg-[#D2691E] text-white hover:bg-[#b8581a] transition-colors whitespace-nowrap"
            >
              직접 입고 예정 등록
            </button>
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
                    ? 'border-[#2D4033] bg-[#2D4033] text-white'
                    : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200',
                )}
              >
                {label} <span className="ml-1 tabular-nums">{formatNumber(count)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── 전표 정보 패널 ── */}
      <section className="overflow-hidden border border-[#b9c7d3] bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-[#cdd8e1] bg-[#eef3f7] px-4 py-2 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#2D4033] text-white">전표</span>
            <p className="font-bold text-gray-900 dark:text-white">매입(입고) 전표정보</p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            {new Date().toLocaleDateString('ko-KR')}
          </span>
        </div>
        <div className="grid gap-x-5 gap-y-2 p-4 md:grid-cols-2 xl:grid-cols-4">
          <InboundInfo label="공급업체"    value={activeOrder?.supplier || '전표를 선택하세요'} />
          <InboundInfo label="입고전표번호" value={activeOrder?.orderNo || '-'} mono />
          <InboundInfo label="입고예정일"  value={fmtDate(activeOrder?.expectedDate)} />
          <InboundInfo label="입고상태"    value={activeOrder ? STATUS_LABEL[activeOrder.status] : '-'} />
          <InboundInfo label="품목 수"     value={activeOrder ? `${formatNumber(activeOrder.items.length)}종` : '-'} />
          <InboundInfo label="등록일"      value={fmtDate(activeOrder?.createdAt)} />
          <InboundInfo label="메모"        value={activeOrder?.memo || '-'} />
          <InboundInfo label="열기"        value="행을 더블클릭하면 새 창에서 상세를 엽니다." />
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

      {/* ── 필터 카드 ── */}
      <div className={cn(ui.filterCard, 'flex-wrap gap-3')}>
        {/* 날짜 범위 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <label className="text-xs text-gray-500 whitespace-nowrap">입고예정일</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={cn(ui.formInput, 'w-36 py-1.5')}
          />
          <span className="text-xs text-gray-400">~</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={cn(ui.formInput, 'w-36 py-1.5')}
          />
        </div>

        {/* 공급업체 검색 */}
        <div className="flex flex-1 min-w-44 gap-1.5">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setSearch(searchInput) }}
            placeholder="주문번호 또는 공급업체 검색"
            className={cn(ui.formInput, 'flex-1 py-1.5')}
          />
        </div>

        {/* 상태 select */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as InboundStatus | '')}
          className={cn(ui.selectCls, 'py-1.5')}
        >
          <option value="">전체 상태</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        {/* 검색 / 초기화 버튼 */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setSearch(searchInput)}
            className="px-4 py-1.5 text-sm font-medium rounded bg-[#2D4033] text-white hover:bg-[#23312a] transition-colors whitespace-nowrap"
          >
            검색
          </button>
          <button
            onClick={handleResetFilters}
            className={cn(ui.btnSecondary, 'py-1.5 whitespace-nowrap')}
          >
            초기화
          </button>
        </div>
      </div>

      {/* ── 목록 그리드 ── */}
      <div className="flex min-h-0 flex-1 flex-col bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 overflow-hidden">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[1200px] table-fixed text-sm">
            <thead>
              <tr className={ui.thead}>
                <th className={cn(ui.th, 'w-12')}>No</th>
                <th className={cn(ui.th, 'w-24')}>입고예정일</th>
                <th className={cn(ui.th, 'w-32')}>전표번호</th>
                <th className={cn(ui.th, 'w-32')}>공급업체</th>
                <th className={cn(ui.th, 'w-44')}>품명</th>
                <th className={cn(ui.th, 'w-28')}>규격</th>
                <th className={cn(ui.th, 'w-20')}>예정수량</th>
                <th className={cn(ui.th, 'w-20')}>입고수량</th>
                <th className={cn(ui.th, 'w-14')}>단위</th>
                <th className={cn(ui.th, 'w-20')}>단가</th>
                <th className={cn(ui.th, 'w-28')}>자재번호</th>
                <th className={cn(ui.th, 'w-20')}>상태</th>
                <th className={cn(ui.th, 'w-24')}>작업</th>
              </tr>
            </thead>
            <tbody className={ui.tbody}>
              {isLoading && (
                <tr>
                  <td colSpan={13} className="text-center py-10 text-gray-400">로딩 중...</td>
                </tr>
              )}
              {!isLoading && lines.length === 0 && (
                <tr>
                  <td colSpan={13} className="text-center py-10 text-gray-400">입고 품목이 없습니다</td>
                </tr>
              )}
              {lines.map(({ order, item }, rowIndex) => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedOrder(order)}
                  onDoubleClick={() => setDetailOrderId(order.id)}
                  title="더블클릭하면 상세 보기"
                  className={cn(
                    'group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors',
                    activeOrder?.id === order.id && 'bg-indigo-50/60 dark:bg-indigo-950/20',
                  )}
                >
                  <td className="px-4 py-3 text-center text-gray-400">{rowIndex + 1}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500">{fmtDate(order.expectedDate)}</td>
                  <td className="truncate px-4 py-3 font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">{order.orderNo}</td>
                  <td className="truncate px-4 py-3 text-gray-700 dark:text-gray-300">{order.supplier || '-'}</td>
                  <td className="truncate px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{item.product?.name || '-'}</td>
                  <td className="truncate px-4 py-3 text-gray-500">{formatUnitSpec(item.product)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatNumber(item.expectedQty)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.receivedQty)}</td>
                  <td className="px-4 py-3 text-center">{item.product?.unit || '-'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {item.product?.costPrice ? formatNumber(item.product.costPrice) : '-'}
                  </td>
                  <td className="truncate px-4 py-3 font-mono text-xs">
                    {item.product?.materialNo || item.product?.code || '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge
                      label={STATUS_LABEL[order.status]}
                      variant={STATUS_BADGE_VARIANT[order.status]}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); setDetailOrderId(order.id) }}
                      className="px-2 py-0.5 text-xs rounded border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:text-indigo-400 transition-colors"
                      title="더블클릭으로도 열 수 있습니다"
                    >
                      상세보기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 하단 요약 바 */}
        <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 px-4 py-1.5 text-xs text-gray-500 shrink-0">
          <span>총 <b className="text-gray-700 dark:text-gray-200">{formatNumber(lines.length)}</b>건</span>
          {activeOrder && (
            <span>
              선택: <b className="text-indigo-600 dark:text-indigo-400">{activeOrder.orderNo}</b>
            </span>
          )}
        </div>
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

      {/* ── 상세 iframe 모달 ── */}
      {detailOrderId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5"
          onClick={() => setDetailOrderId(null)}
        >
          <div
            className="flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded border bg-white shadow-2xl dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-2">
              <b className="text-sm">입고 상세</b>
              <button
                onClick={() => setDetailOrderId(null)}
                className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
                title="닫기"
              >
                닫기
              </button>
            </div>
            <iframe
              src={`/inbound/${detailOrderId}?embed=1`}
              title="입고 상세"
              className="h-full w-full border-0"
            />
          </div>
        </div>
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
        'mt-1 min-h-5 border-b border-gray-200 pb-1 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-white',
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
                            className="w-20 px-2 py-1 text-sm text-right tabular-nums border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:border-[#2D4033] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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

                      {/* 재고 요약 박스 */}
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
            className="flex-1 py-2 bg-[#2D4033] hover:bg-[#23312a] text-white rounded text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {createMutation.isPending ? '등록 중...' : '등록'}
          </button>
        </div>
      </div>
    </div>
  )
}
