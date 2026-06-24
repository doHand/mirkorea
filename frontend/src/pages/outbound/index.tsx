'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { outboundOrderApi } from '@/api/outbound-order.api'
import { clientApi } from '@/api/client.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { useSupplierInfoStore } from '@/stores/supplier-info.store'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { printExternalPickingList } from '@/utils/printPickingList'
import { formatNumber } from '@/utils/format'
import { formatUnitSpec } from '@/utils/unit-spec'
import { cn } from '@/utils/cn'
import * as ui from '@/styles/ui'
import { CollectOrderModal } from '@/components/CollectOrderModal'
import { StatusBadge } from '@/components/StatusBadge'
import type { OutboundOrder, OutboundOrderStatus } from '@/types/api.types'

// ─── Types ───────────────────────────────────────────────────────────────────
type DerivedStatus = OutboundOrderStatus | 'PICKING'
type TabId = 'ALL' | 'COLLECTED' | 'INSTRUCTED' | 'PICKING' | 'PICKED' | 'SHIPPED' | 'HOLD_CANCEL'

// ─── Constants ───────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<DerivedStatus, string> = {
  COLLECTED: '출고대기',
  INSTRUCTED: '피킹대기',
  PICKING: '피킹중',
  PICKED: '피킹완료',
  SHIPPED: '출고완료',
  ON_HOLD: '보류',
  CANCELLED: '취소',
}

const STATUS_VARIANT: Record<DerivedStatus, 'blue' | 'amber' | 'orange' | 'emerald' | 'purple' | 'indigo' | 'gray'> = {
  COLLECTED: 'blue',
  INSTRUCTED: 'amber',
  PICKING: 'orange',
  PICKED: 'emerald',
  SHIPPED: 'purple',
  ON_HOLD: 'indigo',
  CANCELLED: 'gray',
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'ALL', label: '전체' },
  { id: 'COLLECTED', label: '출고대기' },
  { id: 'INSTRUCTED', label: '피킹대기' },
  { id: 'PICKING', label: '피킹중' },
  { id: 'PICKED', label: '피킹완료' },
  { id: 'SHIPPED', label: '출고완료' },
  { id: 'HOLD_CANCEL', label: '보류/취소' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getDerivedStatus(order: OutboundOrder): DerivedStatus {
  if (order.status === 'INSTRUCTED' && order.items.some((i) => i.pickedBoxCount > 0)) {
    return 'PICKING'
  }
  return order.status
}

function matchesTab(order: OutboundOrder, tab: TabId): boolean {
  if (tab === 'ALL') return true
  if (tab === 'HOLD_CANCEL') return order.status === 'ON_HOLD' || order.status === 'CANCELLED'
  const derived = getDerivedStatus(order)
  if (tab === 'PICKING') return derived === 'PICKING'
  if (tab === 'INSTRUCTED') return derived === 'INSTRUCTED'
  return order.status === tab
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function OutboundPage() {
  const warehouse = useWarehouseStore((s) => s.selectedWarehouse)
  const supplierInfo = useSupplierInfoStore((s) => s.info)
  const qc = useQueryClient()

  // filters
  const [activeTab, setActiveTab] = useState<TabId>('ALL')
  const [search, setSearch] = useState('')
  const [pendingSearch, setPendingSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')

  // modals
  const [createOpen, setCreateOpen] = useState(false)
  const [editOrder, setEditOrder] = useState<OutboundOrder | null>(null)

  // detail panel
  const [selectedOrder, setSelectedOrder] = useState<OutboundOrder | null>(null)
  const [pickQtys, setPickQtys] = useState<Record<string, number>>({})

  // ─── Data ──────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.outboundOrders({ warehouseId: warehouse?.id, search }),
    queryFn: () => outboundOrderApi.findAll({ warehouseId: warehouse!.id, search: search || undefined, limit: 200 }),
    enabled: !!warehouse?.id,
  })
  const { data: clients = [] } = useQuery({ queryKey: ['clients', 'active'], queryFn: clientApi.findAllActive })

  const orders = data?.items ?? []

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['outbound-orders'] })
    setSelectedOrder((prev) => {
      if (!prev) return null
      // sync selected order from refreshed data
      return prev
    })
  }

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const instruct = useMutation({
    mutationFn: outboundOrderApi.instruct,
    onSuccess: () => { toast.success('출고지시를 확정했습니다'); refresh() },
    onError: () => toast.error('출고지시 확정에 실패했습니다'),
  })
  const completePicking = useMutation({
    mutationFn: outboundOrderApi.completePicking,
    onSuccess: () => { toast.success('피킹 완료 처리했습니다'); refresh() },
    onError: () => toast.error('피킹 완료 처리에 실패했습니다'),
  })
  const ship = useMutation({
    mutationFn: outboundOrderApi.ship,
    onSuccess: () => { toast.success('출고를 확정했습니다'); refresh() },
    onError: () => toast.error('출고 확정에 실패했습니다'),
  })
  const hold = useMutation({
    mutationFn: outboundOrderApi.hold,
    onSuccess: () => { toast.success('보류 처리했습니다'); refresh() },
    onError: () => toast.error('보류 처리에 실패했습니다'),
  })
  const unhold = useMutation({
    mutationFn: outboundOrderApi.unhold,
    onSuccess: () => { toast.success('보류를 해제했습니다'); refresh() },
    onError: () => toast.error('보류 해제에 실패했습니다'),
  })
  const cancelOrder = useMutation({
    mutationFn: outboundOrderApi.cancel,
    onSuccess: () => { toast.success('취소했습니다'); setSelectedOrder(null); refresh() },
    onError: () => toast.error('취소에 실패했습니다'),
  })
  const deleteOrder = useMutation({
    mutationFn: outboundOrderApi.delete,
    onSuccess: () => { toast.success('전표를 삭제했습니다'); setSelectedOrder(null); refresh() },
    onError: () => toast.error('수집완료 상태의 전표만 삭제할 수 있습니다'),
  })

  // ─── Derived ───────────────────────────────────────────────────────────────
  const summary = useMemo(() => ({
    collected: orders.filter((o) => o.status === 'COLLECTED').length,
    instructed: orders.filter((o) => getDerivedStatus(o) === 'INSTRUCTED').length,
    picking: orders.filter((o) => getDerivedStatus(o) === 'PICKING').length,
    picked: orders.filter((o) => o.status === 'PICKED').length,
    shipped: orders.filter((o) => o.status === 'SHIPPED').length,
  }), [orders])

  const filteredLines = useMemo(() => {
    return orders
      .filter((order) => {
        if (!matchesTab(order, activeTab)) return false
        const date = order.requestedShipDate || order.orderDate || ''
        if (dateFrom && date < dateFrom) return false
        if (dateTo && date > dateTo) return false
        if (customerSearch && !order.customer.toLowerCase().includes(customerSearch.toLowerCase())) return false
        return true
      })
      .flatMap((order) => order.items.map((item, idx) => ({ order, item, idx })))
  }, [orders, activeTab, dateFrom, dateTo, customerSearch])

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectOrder = (order: OutboundOrder) => {
    setSelectedOrder(order)
    const qtys: Record<string, number> = {}
    order.items.forEach((item) => {
      qtys[item.productId] = Math.max(0, item.boxCount - item.pickedBoxCount)
    })
    setPickQtys(qtys)
  }

  const handlePickingComplete = () => {
    if (!selectedOrder) return
    const items = selectedOrder.items
      .filter((item) => (pickQtys[item.productId] ?? 0) > 0)
      .map((item) => ({ productId: item.productId, boxCount: pickQtys[item.productId] }))
    if (items.length === 0) { toast.error('피킹 수량을 입력하세요'); return }
    completePicking.mutate({ orderIds: [selectedOrder.id], items })
  }

  const handleExcelDownload = async () => {
    if (!filteredLines.length) { toast.error('내보낼 데이터가 없습니다'); return }
    try {
      const rows = filteredLines.map(({ order, item }) => ({
        출고일: order.requestedShipDate || order.orderDate || '',
        전표번호: order.orderNo,
        거래처: order.customer,
        품명: item.product?.name || '',
        규격: formatUnitSpec(item.product),
        출고수량: item.boxCount,
        단위: item.product?.unit || 'BOX',
        피킹수량: item.pickedBoxCount,
        미피킹: item.boxCount - item.pickedBoxCount,
        상태: STATUS_LABEL[getDerivedStatus(order)],
      }))
      const XLSX = await import('xlsx')
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '출고내역')
      XLSX.writeFile(wb, `출고내역_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch {
      toast.error('엑셀 다운로드에 실패했습니다')
    }
  }

  if (!warehouse) {
    return <div className="flex h-64 items-center justify-center text-gray-400">창고를 먼저 선택하세요.</div>
  }

  const canEdit = (order: OutboundOrder) =>
    (order.status === 'COLLECTED' || order.status === 'INSTRUCTED') &&
    order.items.every((item) => item.pickedBoxCount === 0)

  return (
    <div className="flex h-[calc(100vh-150px)] min-h-0 flex-col gap-3 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={ui.h2Cls}>출고관리</h2>
          <p className="text-xs text-gray-500">출고 등록 → 피킹 → 출고확정까지 한 화면에서 처리합니다.</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="wms-primary-button rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition-colors"
        >
          출고 전표 등록
        </button>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: '출고대기', count: summary.collected, tab: 'COLLECTED' as TabId, color: 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400' },
          { label: '피킹대기', count: summary.instructed, tab: 'INSTRUCTED' as TabId, color: 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400' },
          { label: '피킹중', count: summary.picking, tab: 'PICKING' as TabId, color: 'border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-400' },
          { label: '피킹완료', count: summary.picked, tab: 'PICKED' as TabId, color: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400' },
          { label: '출고완료', count: summary.shipped, tab: 'SHIPPED' as TabId, color: 'border-purple-300 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-400' },
        ].map(({ label, count, tab, color }) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'rounded-xl border p-3 text-left transition-all hover:shadow-sm',
              color,
              activeTab === tab && 'ring-2 ring-offset-1 ring-current',
            )}
          >
            <p className="text-xs font-medium opacity-70">{label}</p>
            <p className="mt-0.5 text-2xl font-bold">{formatNumber(count)}</p>
          </button>
        ))}
      </div>

      {/* ── Main Content ── */}
      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">

        {/* Grid Section */}
        <div className={cn(
          'flex min-h-0 flex-col overflow-hidden border border-gray-300 bg-white dark:border-gray-800 dark:bg-gray-900 transition-all duration-200',
          selectedOrder ? 'flex-1' : 'w-full',
        )}>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 border-b border-gray-200 px-3 pt-2 dark:border-gray-800">
            {TABS.map(({ id, label }) => {
              const count = id === 'ALL' ? orders.length
                : id === 'HOLD_CANCEL' ? orders.filter((o) => o.status === 'ON_HOLD' || o.status === 'CANCELLED').length
                : orders.filter((o) => matchesTab(o, id)).length
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    'flex items-center gap-1 rounded-t px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap',
                    activeTab === id
                      ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400',
                  )}
                >
                  {label}
                  <span className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                    activeTab === id ? 'wms-tab-active' : 'bg-gray-100 text-gray-500 dark:bg-gray-800',
                  )}>
                    {count}
                  </span>
                </button>
              )
            })}
            <div className="ml-auto flex items-center gap-2 pb-1">
              <input
                type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="rounded border border-gray-200 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <span className="text-xs text-gray-400">~</span>
              <input
                type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="rounded border border-gray-200 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <input
                value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="거래처"
                className="w-24 rounded border border-gray-200 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <input
                value={pendingSearch}
                onChange={(e) => setPendingSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setSearch(pendingSearch)}
                placeholder="전표번호·품목"
                className="w-32 rounded border border-gray-200 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <button
                onClick={() => setSearch(pendingSearch)}
                className="wms-primary-button rounded px-3 py-1 text-xs font-medium"
              >검색</button>
              <button
                onClick={() => { setPendingSearch(''); setSearch(''); setDateFrom(''); setDateTo(''); setCustomerSearch('') }}
                className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >초기화</button>
              <button
                onClick={handleExcelDownload}
                className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >엑셀</button>
            </div>
          </div>

          {/* Table */}
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[960px] table-fixed text-xs">
              <thead className={ui.thead}>
                <tr>
                  <th className={cn(ui.th, 'w-8')}>No</th>
                  <th className={cn(ui.th, 'w-20')}>출고일</th>
                  <th className={cn(ui.th, 'w-28')}>전표번호</th>
                  <th className={cn(ui.th, 'w-24')}>거래처</th>
                  <th className={cn(ui.th, 'w-36')}>상품명</th>
                  <th className={cn(ui.th, 'w-20')}>규격</th>
                  <th className={cn(ui.th, 'w-14 text-right')}>출고수량</th>
                  <th className={cn(ui.th, 'w-12 text-center')}>단위</th>
                  <th className={cn(ui.th, 'w-16 text-right')}>EA환산</th>
                  <th className={cn(ui.th, 'w-14 text-right')}>피킹</th>
                  <th className={cn(ui.th, 'w-14 text-right')}>미피킹</th>
                  <th className={cn(ui.th, 'w-20 text-center')}>상태</th>
                </tr>
              </thead>
              <tbody className={ui.tbody}>
                {isLoading && (
                  <tr><td colSpan={12} className="py-12 text-center text-gray-400">불러오는 중…</td></tr>
                )}
                {!isLoading && filteredLines.length === 0 && (
                  <tr><td colSpan={12} className="py-12 text-center text-gray-400">조회된 출고 품목이 없습니다.</td></tr>
                )}
                {filteredLines.map(({ order, item }, rowIndex) => {
                  const remaining = item.boxCount - item.pickedBoxCount
                  const derived = getDerivedStatus(order)
                  const isSelected = selectedOrder?.id === order.id
                  return (
                    <tr
                      key={item.id}
                      onClick={() => handleSelectOrder(order)}
                      className={cn(
                        ui.tr, 'cursor-pointer text-xs',
                        isSelected && 'bg-orange-50 dark:bg-orange-950/20',
                      )}
                    >
                      <td className={cn(ui.td, 'text-center text-gray-400')}>{rowIndex + 1}</td>
                      <td className={cn(ui.td, 'whitespace-nowrap')}>{order.requestedShipDate || order.orderDate}</td>
                      <td className={cn(ui.td, 'wms-code truncate font-mono font-semibold')}>{order.orderNo}</td>
                      <td className={cn(ui.td, 'truncate')}>{order.customer}</td>
                      <td className={cn(ui.td, 'truncate font-medium')}>{item.product?.name || '-'}</td>
                      <td className={cn(ui.td, 'truncate text-gray-500')}>{formatUnitSpec(item.product)}</td>
                      <td className={cn(ui.td, 'text-right font-semibold')}>{formatNumber(item.boxCount)}</td>
                      <td className={cn(ui.td, 'text-center text-gray-500')}>{item.product?.unit || 'BOX'}</td>
                      <td className={cn(ui.td, 'text-right text-gray-500')}>{formatNumber(item.convertedEaQty)}</td>
                      <td className={cn(ui.td, 'text-right', item.pickedBoxCount > 0 ? 'font-semibold text-emerald-600' : 'text-gray-400')}>
                        {item.pickedBoxCount > 0 ? formatNumber(item.pickedBoxCount) : '-'}
                      </td>
                      <td className={cn(ui.td, 'text-right', remaining > 0 ? 'font-semibold text-orange-500' : 'text-gray-400')}>
                        {remaining > 0 ? formatNumber(remaining) : '-'}
                      </td>
                      <td className={cn(ui.td, 'text-center')}>
                        <StatusBadge label={STATUS_LABEL[derived]} variant={STATUS_VARIANT[derived]} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2 text-xs text-gray-400 dark:border-gray-800">
            <span>품목 {formatNumber(filteredLines.length)}건 · 전표 {formatNumber([...new Set(filteredLines.map(l => l.order.id))].length)}건</span>
            <span>전체 {formatNumber(orders.length)}건 중 표시</span>
          </div>
        </div>

        {/* ── Detail / Picking Panel ── */}
        {selectedOrder && (
          <DetailPanel
            order={selectedOrder}
            pickQtys={pickQtys}
            setPickQtys={setPickQtys}
            clients={clients}
            supplierInfo={supplierInfo}
            canEdit={canEdit(selectedOrder)}
            onClose={() => setSelectedOrder(null)}
            onInstruct={() => instruct.mutate(selectedOrder.id)}
            onPickingComplete={handlePickingComplete}
            onShip={() => {
              if (window.confirm(`${selectedOrder.orderNo} 출고를 확정할까요?`)) ship.mutate(selectedOrder.id)
            }}
            onHold={() => {
              if (window.confirm(`${selectedOrder.orderNo} 전표를 보류 처리할까요?`)) hold.mutate(selectedOrder.id)
            }}
            onUnhold={() => unhold.mutate(selectedOrder.id)}
            onCancel={() => {
              if (window.confirm(`${selectedOrder.orderNo} 전표를 취소할까요?`)) cancelOrder.mutate(selectedOrder.id)
            }}
            onEdit={() => setEditOrder(selectedOrder)}
            onDelete={() => {
              if (window.confirm(`${selectedOrder.orderNo} 전표를 삭제할까요?`)) deleteOrder.mutate(selectedOrder.id)
            }}
            onPrint={() => printExternalPickingList(
              selectedOrder.requestedShipDate || selectedOrder.orderDate,
              [selectedOrder], clients, supplierInfo,
            )}
            isBusy={
              instruct.isPending || completePicking.isPending || ship.isPending ||
              hold.isPending || unhold.isPending || cancelOrder.isPending
            }
          />
        )}
      </div>

      {/* Modals */}
      {createOpen && (
        <CollectOrderModal
          warehouseId={warehouse.id}
          onClose={() => setCreateOpen(false)}
          onSaved={() => { setCreateOpen(false); refresh() }}
        />
      )}
      {editOrder && (
        <CollectOrderModal
          warehouseId={warehouse.id}
          order={editOrder}
          onClose={() => setEditOrder(null)}
          onSaved={() => { setEditOrder(null); refresh() }}
        />
      )}
    </div>
  )
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────
interface DetailPanelProps {
  order: OutboundOrder
  pickQtys: Record<string, number>
  setPickQtys: React.Dispatch<React.SetStateAction<Record<string, number>>>
  clients: { id: string; name: string }[]
  supplierInfo: unknown
  canEdit: boolean
  isBusy: boolean
  onClose(): void
  onInstruct(): void
  onPickingComplete(): void
  onShip(): void
  onHold(): void
  onUnhold(): void
  onCancel(): void
  onEdit(): void
  onDelete(): void
  onPrint(): void
}

function DetailPanel({
  order, pickQtys, setPickQtys, canEdit, isBusy,
  onClose, onInstruct, onPickingComplete, onShip,
  onHold, onUnhold, onCancel, onEdit, onDelete, onPrint,
}: DetailPanelProps) {
  const derived = getDerivedStatus(order)
  const isInstructed = order.status === 'INSTRUCTED'
  const canPrint = !['COLLECTED', 'ON_HOLD', 'CANCELLED'].includes(order.status)
  const totalBoxes = order.items.reduce((s, i) => s + i.boxCount, 0)
  const totalPicked = order.items.reduce((s, i) => s + i.pickedBoxCount, 0)
  const pickProgress = totalBoxes > 0 ? Math.round((totalPicked / totalBoxes) * 100) : 0

  const setQty = (productId: string, val: number) => {
    setPickQtys((prev) => ({ ...prev, [productId]: val }))
  }

  return (
    <div className="flex w-80 min-h-0 flex-col overflow-hidden border border-gray-300 bg-white dark:border-gray-800 dark:bg-gray-900 shrink-0">

      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2 min-w-0">
          <StatusBadge label={STATUS_LABEL[derived]} variant={STATUS_VARIANT[derived]} />
          <span className="wms-code truncate font-mono text-xs font-bold">{order.orderNo}</span>
        </div>
        <button onClick={onClose} className="ml-2 shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Order Info */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-b border-gray-100 p-3 dark:border-gray-800">
        <PanelField label="거래처" value={order.customer} />
        <PanelField label="출고일" value={order.requestedShipDate || order.orderDate || '-'} />
        <PanelField label="수령인" value={order.recipient || '-'} />
        <PanelField label="채널" value={order.channel || '-'} />
        {order.memo && <PanelField label="비고" value={order.memo} className="col-span-2" />}
      </div>

      {/* Picking Progress */}
      <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
        <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
          <span>피킹 진행률</span>
          <span className="font-semibold text-gray-700 dark:text-gray-300">{totalPicked} / {totalBoxes} BOX</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className={cn('h-full rounded-full transition-all', pickProgress === 100 ? 'bg-emerald-500' : 'bg-orange-400')}
            style={{ width: `${pickProgress}%` }}
          />
        </div>
      </div>

      {/* Items */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="px-3 py-2 text-left text-gray-500 font-medium">상품</th>
              <th className="px-2 py-2 text-right text-gray-500 font-medium w-10">출고</th>
              <th className="px-2 py-2 text-right text-gray-500 font-medium w-10">피킹</th>
              {isInstructed && <th className="px-2 py-2 text-center text-gray-500 font-medium w-16">수량입력</th>}
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => {
              const remaining = item.boxCount - item.pickedBoxCount
              return (
                <tr key={item.id} className="border-b border-gray-50 dark:border-gray-800/50">
                  <td className="px-3 py-2">
                    <p className="truncate font-medium text-gray-900 dark:text-white max-w-[120px]">{item.product?.name || '-'}</p>
                    <p className="text-gray-400">{item.product?.code || ''}</p>
                  </td>
                  <td className="px-2 py-2 text-right font-semibold">{item.boxCount}</td>
                  <td className={cn('px-2 py-2 text-right font-semibold', item.pickedBoxCount > 0 ? 'text-emerald-600' : 'text-gray-300')}>
                    {item.pickedBoxCount || '-'}
                  </td>
                  {isInstructed && (
                    <td className="px-2 py-2 text-center">
                      <input
                        type="number"
                        min={0}
                        max={remaining}
                        value={pickQtys[item.productId] ?? remaining}
                        onChange={(e) => setQty(item.productId, Math.max(0, Math.min(remaining, Number(e.target.value))))}
                        className="w-14 rounded border border-gray-200 px-1 py-0.5 text-center text-xs dark:border-gray-700 dark:bg-gray-800"
                      />
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 border-t border-gray-200 p-3 dark:border-gray-800">

        {/* Primary action */}
        {order.status === 'COLLECTED' && (
          <button
            onClick={onInstruct}
            disabled={isBusy}
            className="w-full rounded-lg bg-amber-500 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
          >
            출고지시 확정
          </button>
        )}
        {isInstructed && (
          <button
            onClick={onPickingComplete}
            disabled={isBusy}
            className="w-full rounded-lg bg-orange-500 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            피킹 완료
          </button>
        )}
        {order.status === 'PICKED' && (
          <button
            onClick={onShip}
            disabled={isBusy}
            className="w-full rounded-lg bg-purple-600 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
          >
            출고 확정
          </button>
        )}

        {/* Secondary actions */}
        <div className="flex gap-2">
          {order.orderType === 'EXTERNAL' && (
            <button
              onClick={canPrint ? onPrint : undefined}
              disabled={!canPrint}
              title={canPrint ? '출고증 출력' : order.status === 'COLLECTED' ? '출고지시 후 출력 가능' : '현재 상태에서는 출력 불가'}
              className={cn(
                'flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors',
                canPrint
                  ? 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
                  : 'cursor-not-allowed border-dashed border-gray-200 text-gray-300 dark:border-gray-700 dark:text-gray-600',
              )}
            >
              출고증 출력{!canPrint && <span className="ml-1 opacity-60">✕</span>}
            </button>
          )}
          {canEdit && (
            <button
              onClick={onEdit}
              className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              전표 수정
            </button>
          )}
          {order.status === 'ON_HOLD' ? (
            <button
              onClick={onUnhold}
              disabled={isBusy}
              className="flex-1 rounded-lg border border-indigo-200 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-800"
            >
              보류 해제
            </button>
          ) : (
            !['SHIPPED', 'CANCELLED'].includes(order.status) && (
              <button
                onClick={onHold}
                disabled={isBusy}
                className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                보류
              </button>
            )
          )}
        </div>

        {/* Danger actions */}
        <div className="flex gap-2">
          {!['SHIPPED', 'CANCELLED'].includes(order.status) && (
            <button
              onClick={onCancel}
              disabled={isBusy}
              className="flex-1 rounded-lg border border-red-200 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50 dark:border-red-900"
            >
              취소
            </button>
          )}
          {canEdit && (
            <button
              onClick={onDelete}
              disabled={isBusy}
              className="flex-1 rounded-lg border border-red-200 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50 dark:border-red-900"
            >
              삭제
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function PanelField({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{value}</p>
    </div>
  )
}
