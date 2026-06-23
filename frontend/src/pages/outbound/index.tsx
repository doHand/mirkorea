'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ClipboardPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { outboundOrderApi } from '@/api/outbound-order.api'
import { clientApi } from '@/api/client.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { useSupplierInfoStore } from '@/stores/supplier-info.store'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { printExternalPickingList } from '@/utils/printPickingList'
import { formatNumber } from '@/utils/format'
import { cn } from '@/utils/cn'
import * as ui from '@/styles/ui'
import { CollectOrderModal } from '@/components/CollectOrderModal'
import type { OutboundOrder, OutboundOrderStatus } from '@/types/api.types'

const STATUS_LABEL: Record<OutboundOrderStatus, string> = {
  COLLECTED: '수집완료', INSTRUCTED: '출고지시', PICKED: '피킹완료', CANCELLED: '취소',
}
const STATUS_STYLE: Record<OutboundOrderStatus, string> = {
  COLLECTED: 'bg-blue-100 text-blue-700', INSTRUCTED: 'bg-amber-100 text-amber-700',
  PICKED: 'bg-emerald-100 text-emerald-700', CANCELLED: 'bg-gray-100 text-gray-500',
}

export default function OutboundPage() {
  const warehouse = useWarehouseStore((s) => s.selectedWarehouse)
  const supplierInfo = useSupplierInfoStore((s) => s.info)
  const qc = useQueryClient()
  const [status, setStatus] = useState<OutboundOrderStatus | ''>('')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editOrder, setEditOrder] = useState<OutboundOrder | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<OutboundOrder | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.outboundOrders({ warehouseId: warehouse?.id, status, search }),
    queryFn: () => outboundOrderApi.findAll({ warehouseId: warehouse!.id, status: status || undefined, search: search || undefined, limit: 100 }),
    enabled: !!warehouse?.id,
  })
  const { data: clients = [] } = useQuery({ queryKey: ['clients', 'active'], queryFn: clientApi.findAllActive })
  const refresh = () => qc.invalidateQueries({ queryKey: ['outbound-orders'] })
  const instruct = useMutation({ mutationFn: outboundOrderApi.instruct, onSuccess: () => { toast.success('출고지시를 생성했습니다.'); refresh() }, onError: () => toast.error('출고지시 생성에 실패했습니다.') })
  const deleteOrder = useMutation({ mutationFn: outboundOrderApi.delete, onSuccess: () => { toast.success('출고 전표를 삭제했습니다.'); refresh() }, onError: () => toast.error('수집완료 상태의 전표만 삭제할 수 있습니다.') })
  const orders = data?.items ?? []
  const activeOrder = selectedOrder && orders.some((order) => order.id === selectedOrder.id) ? selectedOrder : orders[0] ?? null
  const lines = useMemo(() => orders.flatMap((order) => order.items.map((item, index) => ({ order, item, index }))), [orders])

  if (!warehouse) return <div className="flex h-64 items-center justify-center text-gray-400">창고를 먼저 선택하세요.</div>

  const canEdit = (order: OutboundOrder) => (order.status === 'COLLECTED' || order.status === 'INSTRUCTED') && order.items.every((item) => Number(item.pickedBoxCount || 0) === 0)
  const unitPrice = (order: OutboundOrder, index: number) => Number(order.items[index]?.product?.sellPrice ?? 0)

  return (
    <div className="flex h-[calc(100vh-150px)] min-h-0 flex-col gap-4 overflow-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className={ui.h2Cls}>출고관리</h2><p className="mt-0.5 text-sm text-gray-500">판매 전표처럼 거래처와 출고 품목을 한 화면에서 관리합니다.</p></div>
        <button onClick={() => setCreateOpen(true)} className="flex items-center justify-center gap-1.5 rounded-xl bg-[#D2691E] px-4 py-2 text-sm font-semibold text-white shadow-sm"><ClipboardPlus size={16} /> 신규 출고전표</button>
      </div>

      <section className="overflow-hidden border border-[#d4c2b1] bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-[#e4d7cb] bg-[#f7f1eb] px-4 py-2 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#D2691E] text-white text-[11px] font-bold">전표</span><p className="font-bold text-gray-900 dark:text-white">판매(출고) 전표정보</p></div>
          <span className="inline-flex items-center gap-1 text-xs text-gray-500"><CalendarDays size={14} /> {new Date().toLocaleDateString('ko-KR')}</span>
        </div>
        <div className="grid gap-x-5 gap-y-2 p-4 md:grid-cols-2 xl:grid-cols-4">
          <Info label="거래처" value={activeOrder?.customer ?? '전표를 선택하세요'} />
          <Info label="출고전표번호" value={activeOrder?.orderNo ?? '-'} mono />
          <Info label="출고요청일" value={activeOrder?.requestedShipDate ?? activeOrder?.orderDate ?? '-'} />
          <Info label="수령인" value={activeOrder?.recipient ?? '-'} />
          <Info label="판매채널" value={activeOrder?.channel ?? '-'} />
          <Info label="외부주문번호" value={activeOrder?.externalOrderNo ?? '-'} />
          <Info label="출고상태" value={activeOrder ? STATUS_LABEL[activeOrder.status] : '-'} />
          <Info label="비고" value={activeOrder?.memo ?? '-'} />
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col border border-gray-300 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
          <div><h3 className="text-sm font-bold text-gray-900 dark:text-white">판매(출고) 세부내역</h3><p className="text-xs text-gray-500">전표를 선택하면 상단 거래처 정보가 바뀝니다.</p></div>
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-56"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="전표번호, 거래처, 품목 검색" className="w-full rounded-lg border border-gray-200 py-2 px-3 text-sm outline-none focus:border-[#D2691E] dark:border-gray-700 dark:bg-gray-800" /></div>
            <select value={status} onChange={(e) => setStatus(e.target.value as OutboundOrderStatus | '')} className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"><option value="">전체 상태</option>{Object.entries(STATUS_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[1110px] table-fixed text-sm">
            <thead className={ui.thead}><tr><th className={cn(ui.th, 'w-12')}>No</th><th className={cn(ui.th, 'w-24')}>출고일</th><th className={cn(ui.th, 'w-32')}>전표번호</th><th className={cn(ui.th, 'w-32')}>거래처</th><th className={cn(ui.th, 'w-44')}>품명</th><th className={cn(ui.th, 'w-28')}>규격</th><th className={cn(ui.th, 'w-16')}>수량</th><th className={cn(ui.th, 'w-14')}>단위</th><th className={cn(ui.th, 'w-20')}>단가</th><th className={cn(ui.th, 'w-24')}>금액</th><th className={cn(ui.th, 'w-28')}>자재번호</th><th className={cn(ui.th, 'w-20')}>상태</th><th className={cn(ui.th, 'w-24')}>작업</th></tr></thead>
            <tbody className={ui.tbody}>
              {isLoading && <tr><td colSpan={13} className="py-12 text-center text-gray-400">불러오는 중…</td></tr>}
              {!isLoading && lines.length === 0 && <tr><td colSpan={13} className="py-12 text-center text-gray-400">조회된 출고 품목이 없습니다.</td></tr>}
              {lines.map(({ order, item, index }, rowIndex) => {
                const price = unitPrice(order, index)
                const amount = price * item.boxCount
                const editable = canEdit(order)
                return <tr key={item.id} onClick={() => setSelectedOrder(order)} className={cn(ui.tr, 'cursor-pointer', activeOrder?.id === order.id && 'bg-orange-50/70 dark:bg-orange-950/20')}>
                  <td className={cn(ui.td, 'text-center text-gray-400')}>{rowIndex + 1}</td><td className={cn(ui.td, 'whitespace-nowrap')}>{order.requestedShipDate || order.orderDate}</td><td className={cn(ui.td, 'truncate font-mono text-xs font-semibold text-[#9a4d16]')}>{order.orderNo}</td><td className={cn(ui.td, 'truncate')}>{order.customer}</td><td className={cn(ui.td, 'truncate font-medium')}>{item.product?.name || '-'}</td><td className={cn(ui.td, 'truncate')}>{item.product?.spec || item.product?.optionName || '-'}</td><td className={cn(ui.td, 'text-right font-semibold')}>{formatNumber(item.boxCount)}</td><td className={cn(ui.td, 'text-center')}>{item.product?.unit || 'BOX'}</td><td className={cn(ui.td, 'text-right')}>{price ? formatNumber(price) : '-'}</td><td className={cn(ui.td, 'text-right font-semibold')}>{amount ? formatNumber(amount) : '-'}</td><td className={cn(ui.td, 'truncate font-mono text-xs')}>{item.product?.materialNo || item.product?.code || '-'}</td><td className={cn(ui.td, 'text-center')}><span className={cn('rounded-full px-2 py-1 text-xs font-semibold', STATUS_STYLE[order.status])}>{STATUS_LABEL[order.status]}</span></td>
                  <td className={ui.td}><div className="flex justify-center gap-1">{order.orderType === 'EXTERNAL' && <button title="출고증 출력" onClick={(e) => { e.stopPropagation(); printExternalPickingList(order.requestedShipDate || order.orderDate, [order], clients, supplierInfo) }} className={ui.btnIconPrint}>출력</button>}{editable && <button title="전표 수정" onClick={(e) => { e.stopPropagation(); setEditOrder(order) }} className={ui.btnIconEdit}>수정</button>}{editable && <button title="전표 삭제" onClick={(e) => { e.stopPropagation(); if (window.confirm(`${order.orderNo} 전표를 삭제할까요?`)) deleteOrder.mutate(order.id) }} className={ui.btnIconDelete}>삭제</button>}{order.status === 'COLLECTED' && <button title="출고지시 생성" onClick={(e) => { e.stopPropagation(); instruct.mutate(order.id) }} className={ui.btnIconPrint}>지시</button>}</div></td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-xs text-gray-500 dark:border-gray-800"><span>품목 {formatNumber(lines.length)}건 · 전표 {formatNumber(orders.length)}건</span><span>피킹 완료 {formatNumber(orders.filter((order) => order.status === 'PICKED').length)}건</span></div>
      </section>

      {createOpen && <CollectOrderModal warehouseId={warehouse.id} onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); refresh() }} />}
      {editOrder && <CollectOrderModal warehouseId={warehouse.id} order={editOrder} onClose={() => setEditOrder(null)} onSaved={() => { setEditOrder(null); refresh() }} />}
    </div>
  )
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><p className="text-xs font-medium text-gray-500">{label}</p><p className={cn('mt-1 min-h-5 border-b border-gray-200 pb-1 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-white', mono && 'font-mono text-xs')}>{value}</p></div>
}
