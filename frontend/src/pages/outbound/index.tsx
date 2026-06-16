'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardPlus, Pencil, Printer, Search, Send, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { outboundOrderApi } from '@/api/outbound-order.api'
import { clientApi } from '@/api/client.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { useSupplierInfoStore } from '@/stores/supplier-info.store'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { printExternalPickingList } from '@/utils/printPickingList'
import { formatNumber } from '@/utils/format'
import { cn } from '@/utils/cn'
import { editableRowProps } from '@/utils/table'
import * as ui from '@/styles/ui'
import { CollectOrderModal } from '@/components/CollectOrderModal'
import type { OutboundOrder, OutboundOrderStatus, OutboundOrderType } from '@/types/api.types'

const STATUS_LABEL: Record<OutboundOrderStatus, string> = {
  COLLECTED: '수집완료',
  INSTRUCTED: '출고지시',
  PICKED: '피킹완료',
  CANCELLED: '취소',
}
const STATUS_STYLE: Record<OutboundOrderStatus, string> = {
  COLLECTED: 'bg-blue-100 text-blue-700',
  INSTRUCTED: 'bg-emerald-100 text-emerald-700',
  PICKED: 'bg-violet-100 text-violet-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}
const ORDER_TYPE_LABEL: Record<OutboundOrderType, string> = { INTERNAL: '내부', EXTERNAL: '외부' }

export default function OutboundPage() {
  const warehouse = useWarehouseStore((s) => s.selectedWarehouse)
  const supplierInfo = useSupplierInfoStore((s) => s.info)
  const qc = useQueryClient()
  const [status, setStatus] = useState<OutboundOrderStatus | ''>('')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editOrder, setEditOrder] = useState<OutboundOrder | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.outboundOrders({ warehouseId: warehouse?.id, status, search }),
    queryFn: () => outboundOrderApi.findAll({
      warehouseId: warehouse!.id,
      status: status || undefined,
      search: search || undefined,
      limit: 100,
    }),
    enabled: !!warehouse?.id,
  })
  const { data: allData } = useQuery({
    queryKey: QUERY_KEYS.outboundOrders({ warehouseId: warehouse?.id, summary: true }),
    queryFn: () => outboundOrderApi.findAll({ warehouseId: warehouse!.id, limit: 9999 }),
    enabled: !!warehouse?.id,
  })
  const { data: clients = [] } = useQuery({ queryKey: ['clients', 'active'], queryFn: clientApi.findAllActive })
  const refresh = () => qc.invalidateQueries({ queryKey: ['outbound-orders'] })
  const instruct = useMutation({
    mutationFn: outboundOrderApi.instruct,
    onSuccess: () => { toast.success('출고지시를 생성했습니다'); refresh() },
    onError: () => toast.error('출고지시 생성에 실패했습니다'),
  })
  const deleteOrder = useMutation({
    mutationFn: outboundOrderApi.delete,
    onSuccess: () => { toast.success('출고 주문을 삭제했습니다'); refresh() },
    onError: () => toast.error('수집완료 상태의 주문만 삭제할 수 있습니다'),
  })
  const orders = data?.items ?? []
  const allOrders = allData?.items ?? []
  if (!warehouse) return <div className="flex h-64 items-center justify-center text-gray-400">창고를 먼저 선택하세요</div>

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className={ui.h2Cls}>출고 예정 등록</h2>
          <p className="mt-0.5 text-sm text-gray-500">출고 주문을 등록하고 지시 상태를 관리합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-[#D2691E] px-4 py-2 text-sm font-semibold text-white">
            <ClipboardPlus size={16} /> 주문수집
          </button>
        </div>
      </div>

      <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">출고 리스트</h3>
          <p className="text-xs text-gray-500">등록된 출고 주문을 조회하고 수정합니다.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <Summary label="전체 주문" value={allData?.total ?? 0} active={status === ''} onClick={() => setStatus('')} />
        {(Object.keys(STATUS_LABEL) as OutboundOrderStatus[]).map((key) => (
          <Summary key={key} label={STATUS_LABEL[key]} value={allOrders.filter((o) => o.status === key).length}
            active={status === key} onClick={() => setStatus(key)} />
        ))}
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="relative min-w-64 flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="출고번호, 외부주문번호, 거래처, 수령인 검색"
            className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#2D4033] dark:border-gray-700 dark:bg-gray-800" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as OutboundOrderStatus | '')}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
          <option value="">전체 상태</option>
          {Object.entries(STATUS_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>

      <div className="max-h-[calc(100vh-360px)] overflow-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full min-w-[980px] text-sm">
          <thead className={ui.thead}><tr>
            <th className={ui.th}>구분</th><th className={ui.th}>출고번호</th><th className={ui.th}>채널/외부주문번호</th>
            <th className={ui.th}>거래처</th><th className={ui.th}>수령인</th>
            <th className={ui.th}>출고요청일</th><th className={ui.th}>품목</th>
            <th className={ui.th}>BOX</th><th className={ui.th}>상태</th><th className={ui.th}>작업</th>
          </tr></thead>
          <tbody className={ui.tbody}>
            {isLoading && <tr><td colSpan={10} className="py-12 text-center text-gray-400">불러오는 중...</td></tr>}
            {!isLoading && orders.length === 0 && <tr><td colSpan={10} className="py-12 text-center text-gray-400">수집된 주문이 없습니다</td></tr>}
            {orders.map((order) => {
              const boxes = order.items.reduce((sum, item) => sum + item.boxCount, 0)
              const pickedBoxes = order.items.reduce((sum, item) => sum + Number(item.pickedBoxCount || 0), 0)
              const remainingBoxes = Math.max(0, boxes - pickedBoxes)
              const canEdit = (order.status === 'COLLECTED' || order.status === 'INSTRUCTED') && pickedBoxes === 0
              const { className: editableClass, ...editableHandlers } = editableRowProps(canEdit, () => setEditOrder(order))
              return <tr key={order.id} {...editableHandlers} className={cn(ui.tr, editableClass)}>
                <td className={cn(ui.td, 'text-center')}><span className={cn('rounded-full px-2 py-1 text-xs font-semibold',
                  order.orderType === 'INTERNAL' ? 'bg-sky-100 text-sky-700' : 'bg-orange-100 text-orange-700')}>
                  {ORDER_TYPE_LABEL[order.orderType]}</span></td>
                <td className={cn(ui.td, 'font-mono text-xs font-semibold text-[#2D4033] dark:text-emerald-400')}>{order.orderNo}</td>
                <td className={ui.td}><p>{order.channel || '-'}</p><p className="text-xs text-gray-400">{order.externalOrderNo || '-'}</p></td>
                <td className={ui.td}>{order.customer}</td><td className={ui.td}>{order.recipient || '-'}</td>
                <td className={cn(ui.td, 'text-center')}>{order.requestedShipDate || '-'}</td>
                <td className={cn(ui.td, 'text-right')}>{formatNumber(order.items.length)}종</td>
                <td className={cn(ui.td, 'text-right')}>
                  <p className="font-bold text-[#D2691E]">{formatNumber(remainingBoxes)} BOX 남음</p>
                  {pickedBoxes > 0 && <p className="text-xs text-gray-400">전체 {formatNumber(boxes)} BOX</p>}
                </td>
                <td className={cn(ui.td, 'text-center')}><span className={cn('rounded-full px-2 py-1 text-xs font-semibold', STATUS_STYLE[order.status])}>{STATUS_LABEL[order.status]}</span></td>
                <td className={ui.td}><div className="flex justify-center gap-1">
                  {order.orderType === 'EXTERNAL' && <button title="출고증 출력"
                    onClick={(e) => { e.stopPropagation(); printExternalPickingList(order.requestedShipDate || order.orderDate, [order], clients, supplierInfo) }}
                    className={ui.btnIconPrint}><Printer size={15} /></button>}
                  {canEdit && <button title="수정" onClick={(e) => { e.stopPropagation(); setEditOrder(order) }}
                    className={ui.btnIconEdit}><Pencil size={15} /></button>}
                  {canEdit && <button title="삭제" onClick={(e) => {
                    e.stopPropagation()
                    if (window.confirm(`${order.orderNo} 출고 주문을 삭제할까요?`)) deleteOrder.mutate(order.id)
                  }} className={ui.btnIconDelete}><Trash2 size={15} /></button>}
                  {order.status === 'COLLECTED' && <button title="출고지시 생성" onClick={(e) => { e.stopPropagation(); instruct.mutate(order.id) }}
                    className={ui.btnIconPrint}><Send size={15} /></button>}
                </div></td>
              </tr>
            })}
          </tbody>
        </table>
      </div>
      </section>

      {createOpen && <CollectOrderModal warehouseId={warehouse.id} onClose={() => setCreateOpen(false)}
        onSaved={() => { setCreateOpen(false); refresh() }} />}
      {editOrder && <CollectOrderModal warehouseId={warehouse.id} order={editOrder} onClose={() => setEditOrder(null)}
        onSaved={() => { setEditOrder(null); refresh() }} />}
    </div>
  )
}

function Summary({ label, value, active, onClick }: { label: string; value: number; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={cn('rounded-xl border bg-white p-3 text-left dark:bg-gray-900',
    active ? 'border-[#D2691E] ring-1 ring-[#D2691E]' : 'border-gray-200 dark:border-gray-800')}>
    <p className="text-xl font-bold text-gray-900 dark:text-white">{formatNumber(value)}</p><p className="text-xs text-gray-500">{label}</p>
  </button>
}

