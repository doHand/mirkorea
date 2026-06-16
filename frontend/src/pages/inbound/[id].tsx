'use client'
import { useState } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Truck, PackageCheck, ClipboardCheck, Check,
  Ban, BarChart3, AlertTriangle, RefreshCw, Save, Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { inboundApi } from '@/api/inbound.api'
import type { ReceiveItemRequest, InspectItemRequest } from '@/api/inbound.api'
import { warehouseApi } from '@/api/warehouse.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { cn } from '@/utils/cn'
import * as ui from '@/styles/ui'
import { formatNumber } from '@/utils/format'
import type { InboundStatus, InboundOrder } from '@/types/api.types'

// ── 상수 ──────────────────────────────────────────────────────────
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

const STEPS: { status: InboundStatus; label: string; icon: React.ElementType }[] = [
  { status: 'PENDING',    label: '입고 예정',  icon: Truck },
  { status: 'RECEIVING',  label: '수령',       icon: PackageCheck },
  { status: 'INSPECTING', label: '검수',       icon: ClipboardCheck },
  { status: 'COMPLETED',  label: '완료',       icon: Check },
]
const STEP_ORDER: InboundStatus[] = ['PENDING', 'RECEIVING', 'INSPECTING', 'COMPLETED']

function fmtDate(s?: string | null) {
  if (!s) return '-'
  return s.slice(0, 10)
}
function fmtDateTime(s?: string | null) {
  if (!s) return '-'
  return s.slice(0, 16).replace('T', ' ')
}

// ── 메인 ──────────────────────────────────────────────────────────
export default function InboundDetailPage() {
  const router  = useRouter()
  const id      = router.query.id as string
  const qc      = useQueryClient()

  const { data: order, isLoading, refetch } = useQuery({
    queryKey: QUERY_KEYS.inboundOrder(id),
    queryFn:  () => inboundApi.findById(id),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        로딩 중...
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
        <p>입고 주문을 찾을 수 없습니다</p>
        <button onClick={() => router.push('/inbound')} className="text-sm text-indigo-500 hover:underline">
          목록으로 돌아가기
        </button>
      </div>
    )
  }

  const handleRefresh = async () => {
    await refetch()
    qc.invalidateQueries({ queryKey: ['inbound'] })
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* 상단 내비게이션 */}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <button
          onClick={() => router.push('/inbound')}
          className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <ArrowLeft size={14} />
          입고 관리
        </button>
        <span>/</span>
        <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">{order.orderNo}</span>
      </div>

      {/* 주문 헤더 카드 */}
      <OrderHeader order={order} onRefresh={handleRefresh} onCancel={() => handleRefresh()} qc={qc} />

      {/* 진행 스텝 */}
      <StepBar status={order.status} />

      {/* 단계별 작업 패널 */}
      {(order.status === 'PENDING' || order.status === 'RECEIVING') && (
        <ReceivePanel order={order} onDone={handleRefresh} />
      )}
      {order.status === 'INSPECTING' && (
        <InspectPanel order={order} onDone={handleRefresh} />
      )}
      {order.status === 'COMPLETED' && (
        <CompletedPanel order={order} />
      )}
      {order.status === 'CANCELLED' && (
        <CancelledPanel />
      )}

      {/* 품목 상세 테이블 */}
      <ItemsTable order={order} />
    </div>
  )
}

// ── 주문 헤더 ─────────────────────────────────────────────────────
function OrderHeader({
  order, onRefresh, onCancel, qc,
}: {
  order: InboundOrder
  onRefresh: () => void
  onCancel: () => void
  qc: ReturnType<typeof useQueryClient>
}) {
  const router  = useRouter()
  const isFinal = order.status === 'COMPLETED' || order.status === 'CANCELLED'

  const cancelMutation = useMutation({
    mutationFn: () => inboundApi.cancel(order.id),
    onSuccess: () => {
      toast.success('입고 주문이 취소되었습니다')
      qc.invalidateQueries({ queryKey: ['inbound'] })
      onCancel()
    },
    onError: () => toast.error('취소에 실패했습니다'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => inboundApi.delete(order.id),
    onSuccess: () => {
      toast.success('입고 주문이 삭제되었습니다')
      qc.invalidateQueries({ queryKey: ['inbound'] })
      router.push('/inbound')
    },
    onError: () => toast.error('삭제에 실패했습니다'),
  })

  const handleCancel = () => {
    if (!confirm('입고 주문을 취소하시겠습니까?')) return
    cancelMutation.mutate()
  }

  const handleDelete = () => {
    const message = order.status === 'COMPLETED'
      ? `${order.orderNo} 입고 주문을 삭제하시겠습니까?\n이미 증가된 재고는 자동으로 되돌려지지 않습니다.`
      : `${order.orderNo} 입고 주문을 삭제하시겠습니까?`
    if (!confirm(message)) return
    deleteMutation.mutate()
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xl font-bold text-indigo-600 dark:text-indigo-400">
              {order.orderNo}
            </span>
            <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold', STATUS_COLOR[order.status])}>
              {STATUS_LABEL[order.status]}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-1 text-sm">
            <div>
              <span className="text-gray-400 text-xs">공급업체</span>
              <p className="font-medium text-gray-800 dark:text-gray-200">{order.supplier || '-'}</p>
            </div>
            <div>
              <span className="text-gray-400 text-xs">입고 예정일</span>
              <p className="font-medium text-gray-800 dark:text-gray-200">{fmtDate(order.expectedDate)}</p>
            </div>
            <div>
              <span className="text-gray-400 text-xs">등록일시</span>
              <p className="font-medium text-gray-800 dark:text-gray-200">{fmtDateTime(order.createdAt)}</p>
            </div>
            <div>
              <span className="text-gray-400 text-xs">품목수</span>
              <p className="font-medium tabular-nums text-gray-800 dark:text-gray-200">{formatNumber(order.items.length)}종</p>
            </div>
          </div>
          {order.memo && (
            <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-lg">
              {order.memo}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onRefresh}
            className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="새로고침"
          >
            <RefreshCw size={15} />
          </button>
          {!isFinal && (
            <button
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl transition-colors disabled:opacity-50"
            >
              <Ban size={13} />
              주문 취소
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50"
          >
            <Trash2 size={13} />
            삭제
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 스텝 바 ───────────────────────────────────────────────────────
function StepBar({ status }: { status: InboundStatus }) {
  const currentIdx = STEP_ORDER.indexOf(status)
  const isCancelled = status === 'CANCELLED'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 px-6 py-5">
      <div className="flex items-center">
        {STEPS.map((step, idx) => {
          const done    = !isCancelled && STEP_ORDER.indexOf(step.status) < currentIdx
          const current = !isCancelled && step.status === status
          const Icon    = step.icon
          return (
            <div key={step.status} className="flex items-center flex-1">
              <div className="flex flex-col items-center min-w-[64px]">
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                  isCancelled
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                    : done
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200 dark:shadow-indigo-900'
                    : current
                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                )}>
                  {done ? <Check size={16} /> : <Icon size={16} />}
                </div>
                <span className={cn(
                  'text-xs mt-1.5 font-medium whitespace-nowrap',
                  isCancelled ? 'text-gray-400'
                  : done || current ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-400'
                )}>
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={cn(
                  'flex-1 h-0.5 mx-2 mb-4 rounded-full',
                  !isCancelled && done ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-gray-700'
                )} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 수령 패널 ────────────────────────────────────────────────────
function ReceivePanel({ order, onDone }: { order: InboundOrder; onDone: () => void }) {
  const [state, setState] = useState<Record<string, { qty: string; locationId: string }>>(() =>
    Object.fromEntries(order.items.map((i) => [i.id, {
      qty:        String(i.receivedQty || i.expectedQty),
      locationId: i.locationId ?? '',
    }]))
  )

  const { data: locations = [] } = useQuery({
    queryKey: QUERY_KEYS.locations(order.warehouseId),
    queryFn:  () => warehouseApi.findLocations(order.warehouseId),
  })
  const filteredReceivingLocations = locations.filter(
    (l) => l.zone?.type === 'RECEIVING' || l.zone?.type === 'STORAGE'
  )
  const receivingLocations = filteredReceivingLocations.length > 0 ? filteredReceivingLocations : locations

  const receiveMutation = useMutation({
    mutationFn: (items: ReceiveItemRequest[]) => inboundApi.receive(order.id, items),
  })

  const inspectMutation = useMutation({
    mutationFn: (items: InspectItemRequest[]) => inboundApi.inspect(order.id, items),
  })

  const completeMutation = useMutation({
    mutationFn: () => inboundApi.complete(order.id),
  })

  const buildReceiveItems = (): ReceiveItemRequest[] => order.items.map((i) => ({
      itemId:      i.id,
      receivedQty: parseInt(state[i.id]?.qty ?? '0') || 0,
      locationId:  state[i.id]?.locationId || undefined,
  }))

  const handleReceive = async () => {
    try {
      await receiveMutation.mutateAsync(buildReceiveItems())
      toast.success('수령 정보가 저장되었습니다')
      onDone()
    } catch {
      toast.error('저장에 실패했습니다')
    }
  }

  const handleMoveToInspect = async () => {
    try {
      const saved = await receiveMutation.mutateAsync(buildReceiveItems())
      const items: InspectItemRequest[] = saved.items.map((i) => ({
        itemId: i.id, passedQty: i.receivedQty, defectQty: 0,
      }))
      await inspectMutation.mutateAsync(items)
      toast.success('수령 정보를 저장하고 검수 단계로 이동했습니다')
      onDone()
    } catch {
      toast.error('수령 정보 저장 또는 단계 이동에 실패했습니다')
    }
  }

  const handleComplete = async () => {
    if (!confirm('검수 없이 바로 입고 완료 처리합니다. 계속하시겠습니까?')) return
    try {
      await receiveMutation.mutateAsync(buildReceiveItems())
      await completeMutation.mutateAsync()
      toast.success('수령 정보를 저장하고 입고를 완료했습니다')
      onDone()
    } catch {
      toast.error('수령 정보 저장 또는 완료 처리에 실패했습니다')
    }
  }

  const isPending = receiveMutation.isPending || inspectMutation.isPending || completeMutation.isPending

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
        <Truck size={16} className="text-amber-500" />
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">수령 처리</h3>
        <span className="ml-auto text-xs tabular-nums text-gray-400">{formatNumber(order.items.length)}개 품목</span>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {order.items.map((item) => (
          <div key={item.id} className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{item.product?.name}</p>
                <p className="text-xs text-gray-400">{item.product?.code} · 예정 {formatNumber(item.expectedQty)}{item.product?.unit}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">현재 수령</p>
                <p className="text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400">{formatNumber(item.receivedQty)}{item.product?.unit}</p>
              </div>
            </div>
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">수령 수량</label>
                <input
                  type="number" min={0}
                  value={state[item.id]?.qty ?? ''}
                  onChange={(e) => setState((p) => ({ ...p, [item.id]: { ...p[item.id], qty: e.target.value } }))}
                  className="w-28 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-right tabular-nums font-semibold"
                />
              </div>
              <div className="flex-1 min-w-48">
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">입고 위치</label>
                <select
                  value={state[item.id]?.locationId ?? ''}
                  onChange={(e) => setState((p) => ({ ...p, [item.id]: { ...p[item.id], locationId: e.target.value } }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">위치 선택</option>
                  {receivingLocations.map((l) => (
                    <option key={l.id} value={l.id}>{l.code}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 py-4 bg-gray-50 dark:bg-gray-700/30 flex gap-3 flex-wrap">
        <button
          onClick={handleReceive}
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors shadow-sm"
        >
          <Save size={14} />
          {receiveMutation.isPending ? '저장 중...' : '수령 정보 저장'}
        </button>
        {order.status === 'RECEIVING' && (
          <>
            <button
              onClick={handleMoveToInspect}
              disabled={isPending}
              className="flex items-center gap-2 px-5 py-2.5 border-2 border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
            >
              <ClipboardCheck size={14} />
              {inspectMutation.isPending ? '이동 중...' : '검수 단계로'}
            </button>
            <button
              onClick={handleComplete}
              disabled={isPending}
              className="flex items-center gap-2 px-5 py-2.5 border-2 border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
            >
              <Check size={14} />
              {completeMutation.isPending ? '처리 중...' : '바로 완료'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── 검수 패널 ────────────────────────────────────────────────────
function InspectPanel({ order, onDone }: { order: InboundOrder; onDone: () => void }) {
  const [state, setState] = useState<Record<string, { passed: string; defect: string; defectLoc: string }>>(() =>
    Object.fromEntries(order.items.map((i) => [i.id, {
      passed:    String(i.passedQty || i.receivedQty || 0),
      defect:    String(i.defectQty || 0),
      defectLoc: i.defectLocationId ?? '',
    }]))
  )

  const { data: locations = [] } = useQuery({
    queryKey: QUERY_KEYS.locations(order.warehouseId),
    queryFn:  () => warehouseApi.findLocations(order.warehouseId),
  })
  const damagedLocations = locations.filter((l) => l.zone?.type === 'DAMAGED')

  const inspectMutation = useMutation({
    mutationFn: (items: InspectItemRequest[]) => inboundApi.inspect(order.id, items),
  })

  const completeMutation = useMutation({
    mutationFn: () => inboundApi.complete(order.id),
  })

  const buildInspectItems = (): InspectItemRequest[] | null => {
    for (const i of order.items) {
      const passed = parseInt(state[i.id]?.passed ?? '0') || 0
      const defect = parseInt(state[i.id]?.defect ?? '0') || 0
      if (passed + defect > i.receivedQty) {
        toast.error(`${i.product?.name}: 검수 수량(${formatNumber(passed + defect)})이 수령 수량(${formatNumber(i.receivedQty)})을 초과합니다`)
        return null
      }
    }
    return order.items.map((i) => ({
      itemId:           i.id,
      passedQty:        parseInt(state[i.id]?.passed ?? '0') || 0,
      defectQty:        parseInt(state[i.id]?.defect ?? '0') || 0,
      defectLocationId: state[i.id]?.defectLoc || undefined,
    }))
  }

  const handleInspect = async () => {
    const items = buildInspectItems()
    if (!items) return
    try {
      await inspectMutation.mutateAsync(items)
      toast.success('검수 정보가 저장되었습니다')
      onDone()
    } catch {
      toast.error('저장에 실패했습니다')
    }
  }

  const handleComplete = async () => {
    if (!confirm('입고를 완료하면 검수 합격 수량만큼 재고가 자동으로 증가합니다. 계속하시겠습니까?')) return
    const items = buildInspectItems()
    if (!items) return
    try {
      await inspectMutation.mutateAsync(items)
      await completeMutation.mutateAsync()
      toast.success('검수 정보를 저장하고 입고를 완료했습니다')
      onDone()
    } catch {
      toast.error('검수 정보 저장 또는 완료 처리에 실패했습니다')
    }
  }

  const isPending = inspectMutation.isPending || completeMutation.isPending

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
        <ClipboardCheck size={16} className="text-purple-500" />
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">검수 처리</h3>
        <span className="ml-auto text-xs tabular-nums text-gray-400">{formatNumber(order.items.length)}개 품목</span>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {order.items.map((item) => {
          const s      = state[item.id]
          const passed = parseInt(s?.passed ?? '0') || 0
          const defect = parseInt(s?.defect ?? '0') || 0
          const over   = passed + defect > item.receivedQty
          return (
            <div key={item.id} className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{item.product?.name}</p>
                  <p className="text-xs text-gray-400">{item.product?.code} · 수령 {formatNumber(item.receivedQty)}{item.product?.unit}</p>
                </div>
                <div className="flex items-center gap-2">
                  {over && (
                    <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg">
                      <AlertTriangle size={11} /> 수량 초과
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    합격+불량: <span className={cn('font-bold tabular-nums', over ? 'text-red-500' : 'text-gray-700 dark:text-gray-300')}>{formatNumber(passed + defect)}</span>/{formatNumber(item.receivedQty)}
                  </span>
                </div>
              </div>
              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <label className="text-xs text-emerald-600 dark:text-emerald-400 font-medium block mb-1">합격 수량</label>
                  <input
                    type="number" min={0}
                    value={s?.passed ?? ''}
                    onChange={(e) => setState((p) => ({ ...p, [item.id]: { ...p[item.id], passed: e.target.value } }))}
                    className={cn(
                      'w-28 px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-right tabular-nums font-semibold',
                      over ? 'border-red-400' : 'border-gray-200 dark:border-gray-600'
                    )}
                  />
                </div>
                <div>
                  <label className="text-xs text-red-600 dark:text-red-400 font-medium block mb-1">불량 수량</label>
                  <input
                    type="number" min={0}
                    value={s?.defect ?? ''}
                    onChange={(e) => {
                      const defect = parseInt(e.target.value) || 0
                      const passed = Math.max(0, item.receivedQty - defect)
                      setState((p) => ({ ...p, [item.id]: { ...p[item.id], defect: e.target.value, passed: String(passed) } }))
                    }}
                    className={cn(
                      'w-28 px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-right tabular-nums font-semibold',
                      over ? 'border-red-400' : 'border-gray-200 dark:border-gray-600'
                    )}
                  />
                </div>
                {defect > 0 && (
                  <div className="flex-1 min-w-48">
                    <label className="text-xs text-red-500 font-medium block mb-1">불량 보관 위치</label>
                    <select
                      value={s?.defectLoc ?? ''}
                      onChange={(e) => setState((p) => ({ ...p, [item.id]: { ...p[item.id], defectLoc: e.target.value } }))}
                      className="w-full px-3 py-2 text-sm border border-red-200 dark:border-red-900/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">위치 선택</option>
                      {damagedLocations.length > 0
                        ? damagedLocations.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)
                        : locations.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)
                      }
                    </select>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="px-5 py-4 bg-gray-50 dark:bg-gray-700/30 flex gap-3 flex-wrap">
        <button
          onClick={handleInspect}
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors shadow-sm"
        >
          <Save size={14} />
          {inspectMutation.isPending ? '저장 중...' : '검수 정보 저장'}
        </button>
        <button
          onClick={handleComplete}
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors shadow-sm"
        >
          <BarChart3 size={14} />
          {completeMutation.isPending ? '처리 중...' : '입고 완료 · 재고 증가'}
        </button>
      </div>
    </div>
  )
}

// ── 완료 요약 패널 ────────────────────────────────────────────────
function CompletedPanel({ order }: { order: InboundOrder }) {
  const totalExpected = order.items.reduce((s, i) => s + i.expectedQty, 0)
  const totalReceived = order.items.reduce((s, i) => s + i.receivedQty, 0)
  const totalPassed   = order.items.reduce((s, i) => s + i.passedQty,   0)
  const totalDefect   = order.items.reduce((s, i) => s + i.defectQty,   0)

  return (
    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-200 dark:border-emerald-800 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center">
          <Check size={16} className="text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400">입고 완료</h3>
          <p className="text-xs text-emerald-600 dark:text-emerald-500">재고가 자동으로 증가되었습니다</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: '예정 수량', value: totalExpected, color: 'text-gray-700 dark:text-gray-300' },
          { label: '수령 수량', value: totalReceived, color: 'text-amber-600 dark:text-amber-400' },
          { label: '합격 수량', value: totalPassed,   color: 'text-emerald-700 dark:text-emerald-400' },
          { label: '불량 수량', value: totalDefect,   color: 'text-red-600 dark:text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center">
            <p className={cn('text-2xl font-bold tabular-nums', color)}>{formatNumber(value)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 취소 패널 ─────────────────────────────────────────────────────
function CancelledPanel() {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-2xl border border-gray-200 dark:border-gray-600 p-8 flex items-center justify-center gap-3 text-gray-400">
      <Ban size={20} />
      <span className="text-sm font-medium">취소된 입고 주문입니다</span>
    </div>
  )
}

// ── 품목 상세 테이블 ──────────────────────────────────────────────
function ItemsTable({ order }: { order: InboundOrder }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">품목 상세</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className={ui.thead}>
              <th className={ui.th}>상품</th>
              <th className={ui.th}>예정</th>
              <th className={ui.th}>수령</th>
              <th className={ui.th}>합격</th>
              <th className={ui.th}>불량</th>
              <th className={ui.th}>입고 위치</th>
              <th className={ui.th}>LOT / 유통기한</th>
            </tr>
          </thead>
          <tbody className={ui.tbody}>
            {order.items.map((item) => (
              <tr key={item.id} className={ui.tr}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800 dark:text-gray-200">{item.product?.name}</p>
                  <p className="text-xs text-gray-400">{item.product?.code}</p>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-400">
                  {formatNumber(item.expectedQty)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-amber-600 dark:text-amber-400">
                  {formatNumber(item.receivedQty)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                  {item.passedQty > 0 ? formatNumber(item.passedQty) : <span className="text-gray-300 dark:text-gray-600">-</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-red-500">
                  {item.defectQty > 0 ? formatNumber(item.defectQty) : <span className="text-gray-300 dark:text-gray-600">-</span>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                  {item.location?.code ?? <span className="text-gray-300 dark:text-gray-600">-</span>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                  {item.lotNumber && <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{item.lotNumber}</span>}
                  {item.expireDate && <span className="ml-1">{fmtDate(item.expireDate)}</span>}
                  {!item.lotNumber && !item.expireDate && <span className="text-gray-300 dark:text-gray-600">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
