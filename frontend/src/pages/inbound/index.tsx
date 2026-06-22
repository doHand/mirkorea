'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays, ClipboardList, FileText, PackageCheck, Plus, Search, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { inboundApi } from '@/api/inbound.api'
import type { CreateInboundOrderRequest } from '@/api/inbound.api'
import { productApi } from '@/api/product.api'
import { purchaseOrderApi } from '@/api/purchase-order.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { cn } from '@/utils/cn'
import * as ui from '@/styles/ui'
import { formatNumber } from '@/utils/format'
import type { InboundStatus, Product } from '@/types/api.types'

const STATUS_LABEL: Record<InboundStatus, string> = {
  PENDING:    '입고 예정',
  RECEIVING:  '수령 중',
  INSPECTING: '검수 중',
  COMPLETED:  '완료',
  CANCELLED:  '취소',
}
const STATUS_COLOR: Record<InboundStatus, string> = {
  PENDING:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  RECEIVING:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  INSPECTING: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  COMPLETED:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  CANCELLED:  'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
}

function fmtDate(s?: string | null) {
  if (!s) return '-'
  return s.slice(0, 10)
}

export default function InboundPage() {
  const router    = useRouter()
  const warehouse = useWarehouseStore((s) => s.selectedWarehouse)
  const qc        = useQueryClient()
  const [searchInput,  setSearchInput]  = useState('')
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<InboundStatus | ''>('')
  const [createOpen,   setCreateOpen]   = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<import('@/types/api.types').InboundOrder | null>(null)

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
    if (!search) return orders
    const s = search.toLowerCase()
    return orders.filter((o) =>
      o.orderNo.toLowerCase().includes(s) || (o.supplier ?? '').toLowerCase().includes(s)
    )
  }, [orders, search])
  const lines = useMemo(() => filtered.flatMap((order) => order.items.map((item, index) => ({ order, item, index }))), [filtered])
  const activeOrder = selectedOrder && filtered.some((order) => order.id === selectedOrder.id) ? selectedOrder : filtered[0] ?? null

  if (!warehouse) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
        창고를 먼저 선택하세요
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">입고 관리</h2>
          <p className="mt-0.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            발주서 작성·출력 → 입고 예정 등록 → 수령 · 검수 · 재고 증가
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {(['', 'PENDING', 'RECEIVING', 'INSPECTING', 'COMPLETED'] as (InboundStatus | '')[]).map((value) => {
            const count = value === '' ? allOrders.length : allOrders.filter((order) => order.status === value).length
            const label = value === '' ? '전체' : STATUS_LABEL[value]
            return <button key={value || 'all'} onClick={() => setStatusFilter(value)} className={cn('rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors', statusFilter === value ? 'border-[#2D4033] bg-[#2D4033] text-white' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200')}>
              {label} <span className="ml-1 tabular-nums">{formatNumber(count)}</span>
            </button>
          })}
          <button onClick={() => router.push('/quotes?tab=PURCHASE')} title="발주서 작성·출력" aria-label="발주서 작성·출력" className="responsive-icon-action bg-[#2D4033] text-white">
            <ClipboardList size={15} /> <span className="responsive-action-label">발주서 작성·출력</span>
          </button>
          <button onClick={() => setCreateOpen(true)} title="직접 입고 예정 등록" aria-label="직접 입고 예정 등록" className="responsive-icon-action bg-[#D2691E] text-white">
            <Plus size={15} /> <span className="responsive-action-label">직접 입고 예정 등록</span>
          </button>
        </div>
      </div>

      <section className="overflow-hidden border border-[#b9c7d3] bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-[#cdd8e1] bg-[#eef3f7] px-4 py-2 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#2D4033] text-white"><FileText size={16} /></span><p className="font-bold text-gray-900 dark:text-white">매입(입고) 전표정보</p></div>
          <span className="inline-flex items-center gap-1 text-xs text-gray-500"><CalendarDays size={14} /> {new Date().toLocaleDateString('ko-KR')}</span>
        </div>
        <div className="grid gap-x-5 gap-y-2 p-4 md:grid-cols-2 xl:grid-cols-4">
          <InboundInfo label="공급업체" value={activeOrder?.supplier || '전표를 선택하세요'} /><InboundInfo label="입고전표번호" value={activeOrder?.orderNo || '-'} mono /><InboundInfo label="입고예정일" value={fmtDate(activeOrder?.expectedDate)} /><InboundInfo label="입고상태" value={activeOrder ? STATUS_LABEL[activeOrder.status] : '-'} /><InboundInfo label="품목 수" value={activeOrder ? `${formatNumber(activeOrder.items.length)}종` : '-'} /><InboundInfo label="등록일" value={fmtDate(activeOrder?.createdAt)} /><InboundInfo label="메모" value={activeOrder?.memo || '-'} /><InboundInfo label="열기" value="행을 더블클릭하면 새 창에서 상세를 엽니다." />
        </div>
      </section>

      {/* 요약 카드 */}
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
          const count = s === ''
            ? allOrders.length
            : allOrders.filter((o) => o.status === s).length
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

      {/* 필터 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 p-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 flex gap-1.5">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setSearch(searchInput) }}
              placeholder="주문번호 또는 공급업체 검색"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 transition-shadow"
            />
          </div>
          <button
            onClick={() => setSearch(searchInput)}
            className="px-3.5 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors font-medium whitespace-nowrap"
          >
            검색
          </button>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as InboundStatus | '')}
          className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="">전체 상태</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* 목록 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] table-fixed text-sm">
            <thead>
              <tr className={ui.thead}>
                <th className={cn(ui.th, 'w-12')}>No</th><th className={cn(ui.th, 'w-24')}>입고일</th><th className={cn(ui.th, 'w-32')}>전표번호</th><th className={cn(ui.th, 'w-32')}>공급업체</th><th className={cn(ui.th, 'w-44')}>품명</th><th className={cn(ui.th, 'w-28')}>규격</th><th className={cn(ui.th, 'w-20')}>예정수량</th><th className={cn(ui.th, 'w-20')}>입고수량</th><th className={cn(ui.th, 'w-14')}>단위</th><th className={cn(ui.th, 'w-20')}>단가</th><th className={cn(ui.th, 'w-28')}>자재번호</th><th className={cn(ui.th, 'w-20')}>상태</th>
              </tr>
            </thead>
            <tbody className={ui.tbody}>
              {isLoading && (
                <tr><td colSpan={12} className="text-center py-10 text-gray-400">로딩 중...</td></tr>
              )}
              {!isLoading && lines.length === 0 && (
                <tr><td colSpan={12} className="text-center py-10 text-gray-400">입고 품목이 없습니다</td></tr>
              )}
              {lines.map(({ order, item }, rowIndex) => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedOrder(order)}
                  onDoubleClick={() => window.open(`/inbound/${order.id}`, '_blank')}
                  className={cn('group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors', activeOrder?.id === order.id && 'bg-indigo-50/60 dark:bg-indigo-950/20')}
                >
                  <td className="px-4 py-3 text-center text-gray-400">{rowIndex + 1}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500">{fmtDate(order.expectedDate)}</td>
                  <td className="truncate px-4 py-3 font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">{order.orderNo}</td>
                  <td className="truncate px-4 py-3 text-gray-700 dark:text-gray-300">{order.supplier || '-'}</td>
                  <td className="truncate px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{item.product?.name || '-'}</td>
                  <td className="truncate px-4 py-3 text-gray-500">{item.product?.spec || item.product?.optionName || '-'}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatNumber(item.expectedQty)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.receivedQty)}</td>
                  <td className="px-4 py-3 text-center">{item.product?.unit || '-'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{item.product?.costPrice ? formatNumber(item.product.costPrice) : '-'}</td>
                  <td className="truncate px-4 py-3 font-mono text-xs">{item.product?.materialNo || item.product?.code || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn('inline-block px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLOR[order.status])}>
                      {STATUS_LABEL[order.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 입고 예정 등록 모달 */}
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

function InboundInfo({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><p className="text-xs font-medium text-gray-500">{label}</p><p className={cn('mt-1 min-h-5 border-b border-gray-200 pb-1 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-white', mono && 'font-mono text-xs')}>{value}</p></div>
}

// ── 입고 예정 등록 모달 ────────────────────────────────────────────
function CreateModal({
  warehouseId, onClose, onCreated,
}: {
  warehouseId: string
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [supplier,     setSupplier]     = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [memo,         setMemo]         = useState('')
  const [items, setItems] = useState<{
    productId: string; expectedQty: number; lotNumber: string; expireDate: string; locationId: string
    product?: Product
  }[]>([])
  const [productSearch, setProductSearch] = useState('')

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
    setItems((prev) => [...prev, { productId: product.id, expectedQty: 1, lotNumber: '', expireDate: '', locationId: '', product }])
    setProductSearch('')
  }

  const removeItem = (productId: string) => setItems((prev) => prev.filter((i) => i.productId !== productId))

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
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">입고 예정 등록</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">공급업체</label>
              <input value={supplier} onChange={(e) => setSupplier(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="공급업체명" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">입고 예정일</label>
              <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">메모</label>
            <input value={memo} onChange={(e) => setMemo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="메모 (선택)" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">상품 추가</label>
            <div className="relative">
              <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="상품명 또는 코드 입력" />
              {productPage && productPage.items.length > 0 && productSearch && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto">
                  {productPage.items.map((p) => (
                    <button key={p.id} onClick={() => addItem(p)}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 text-sm text-gray-800 dark:text-gray-200 flex items-center justify-between">
                      <span>{p.name}</span>
                      <span className="text-xs text-gray-400">{p.code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {items.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">품목 ({formatNumber(items.length)}개)</p>
              {items.map((item, idx) => (
                <div key={item.productId} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 rounded p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{item.product?.name}</p>
                    <p className="text-xs text-gray-400">{item.product?.code}</p>
                  </div>
                  <input
                    type="number" min={1} value={item.expectedQty}
                    onChange={(e) => setItems((prev) => prev.map((i, j) => j === idx ? { ...i, expectedQty: parseInt(e.target.value) || 1 } : i))}
                    className="w-20 px-2 py-1 text-sm text-right tabular-nums border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="수량"
                  />
                  <span className="w-10 text-center text-xs text-gray-400">{item.product?.unit}</span>
                  <button onClick={() => removeItem(item.productId)} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2 border border-gray-200 dark:border-gray-600 rounded text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            취소
          </button>
          <button onClick={handleSubmit} disabled={createMutation.isPending}
            className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium disabled:opacity-50 transition-colors">
            {createMutation.isPending ? '등록 중...' : '등록 후 상세 이동'}
          </button>
        </div>
      </div>
    </div>
  )
}
