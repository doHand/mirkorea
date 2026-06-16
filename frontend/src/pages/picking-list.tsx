'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Printer, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { clientApi } from '@/api/client.api'
import { outboundOrderApi } from '@/api/outbound-order.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { useSupplierInfoStore } from '@/stores/supplier-info.store'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { buildDailyPickingRows, printExternalPickingList, printInternalPickingList } from '@/utils/printPickingList'
import { formatNumber } from '@/utils/format'
import { CollectOrderModal } from '@/components/CollectOrderModal'
import type { OutboundOrder } from '@/types/api.types'

const today = () => new Date().toISOString().slice(0, 10)

export default function PickingListPage() {
  const warehouse = useWarehouseStore((s) => s.selectedWarehouse)
  const supplierInfo = useSupplierInfoStore((s) => s.info)
  const qc = useQueryClient()
  const [pickingDate, setPickingDate] = useState(today())
  const [printType, setPrintType] = useState<'INTERNAL' | 'EXTERNAL'>('INTERNAL')
  const [dateInitialized, setDateInitialized] = useState(false)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [excludedOrderIds, setExcludedOrderIds] = useState<Set<string>>(new Set())
  const [detailOrder, setDetailOrder] = useState<OutboundOrder | null>(null)
  const [editOrder, setEditOrder] = useState<OutboundOrder | null>(null)

  const { data } = useQuery({
    queryKey: QUERY_KEYS.outboundOrders({ warehouseId: warehouse?.id, picking: true }),
    queryFn: () => outboundOrderApi.findAll({ warehouseId: warehouse!.id, limit: 9999 }),
    enabled: !!warehouse?.id,
  })
  const { data: clients = [] } = useQuery({
    queryKey: ['clients', 'active'],
    queryFn: clientApi.findAllActive,
  })
  const orders = data?.items ?? []
  const instructedDates = useMemo(() => Array.from(new Set(
    orders.filter((order) => order.status === 'INSTRUCTED' && order.requestedShipDate)
      .map((order) => order.requestedShipDate!),
  )).sort((a, b) => b.localeCompare(a)), [orders])
  const availableOrders = orders.filter((order) => order.status === 'INSTRUCTED' && order.requestedShipDate === pickingDate)
  const dailyOrders = availableOrders.filter((order) => !excludedOrderIds.has(order.id))
  const excludedOrders = availableOrders.filter((order) => excludedOrderIds.has(order.id))
  const printOrders = printType === 'INTERNAL'
    ? dailyOrders
    : dailyOrders.filter((order) => order.orderType === 'EXTERNAL')
  const rows = buildDailyPickingRows(dailyOrders)
  const totalBoxes = rows.reduce((sum, row) => sum + row.boxCount, 0)
  const allSelected = rows.length > 0 && rows.every((row) => selectedRows.has(row.key))

  useEffect(() => {
    setSelectedRows(new Set())
    setExcludedOrderIds(new Set())
  }, [pickingDate])
  useEffect(() => {
    if (!data || dateInitialized) return
    setDateInitialized(true)
    if (!dailyOrders.length && instructedDates.length) setPickingDate(instructedDates[0])
  }, [dailyOrders.length, data, dateInitialized, instructedDates])

  const completePicking = useMutation({
    mutationFn: outboundOrderApi.completePicking,
    onSuccess: () => {
      toast.success('선택한 피킹을 완료했습니다')
      setSelectedRows(new Set())
      qc.invalidateQueries({ queryKey: ['outbound-orders'] })
    },
    onError: () => toast.error('피킹완료 처리에 실패했습니다'),
  })
  const completeRows = (selected: typeof rows) => {
    if (!selected.length) return
    const boxes = selected.reduce((sum, row) => sum + row.boxCount, 0)
    if (!window.confirm(`선택한 ${selected.length}개 항목 / ${formatNumber(boxes)} BOX를 완료 처리할까요?`)) return
    completePicking.mutate({
      orderIds: dailyOrders.map((order) => order.id),
      items: selected.map((row) => ({ productId: row.productId, boxCount: row.boxCount })),
    })
  }

  if (!warehouse) return <div className="flex h-64 items-center justify-center text-gray-400">창고를 먼저 선택하세요</div>

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-bold">날짜별 피킹리스트</h2><p className="text-sm text-gray-500">출고지시 주문을 상품별 BOX 수량으로 합산합니다.</p></div>
      <div className="flex items-center rounded-xl border bg-white dark:border-gray-700 dark:bg-gray-900">
        <input type="date" value={pickingDate} onChange={(e) => setPickingDate(e.target.value)} className="rounded-l-xl bg-transparent px-3 py-2 text-sm outline-none" />
        <select value={printType} onChange={(e) => setPrintType(e.target.value as 'INTERNAL' | 'EXTERNAL')}
          className="border-l bg-transparent px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900">
          <option value="INTERNAL">내부용 피킹리스트</option><option value="EXTERNAL">외부용 출고확인서</option>
        </select>
        <button onClick={() => printType === 'INTERNAL'
          ? printInternalPickingList(pickingDate, printOrders)
          : printExternalPickingList(pickingDate, printOrders, clients, supplierInfo)}
          disabled={!printOrders.length} className="flex items-center gap-1.5 rounded-r-xl bg-[#2D4033] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
          <Printer size={15} /> 전체 출력
        </button>
      </div>
    </div>

    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-xl border bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-3 flex items-center justify-between">
          <b>출고증 리스트 ({dailyOrders.length})</b>
          {!!dailyOrders.length && <button onClick={() => setExcludedOrderIds(new Set(availableOrders.map((order) => order.id)))}
            className="text-xs font-semibold text-red-600">전체 제외</button>}
        </div>
        <div className="max-h-44 space-y-2 overflow-auto">
          {!dailyOrders.length && <p className="py-4 text-center text-sm text-gray-400">포함된 출고 주문이 없습니다.</p>}
          {dailyOrders.map((order) => {
            const canEdit = order.items.every((item) => !Number(item.pickedBoxCount))
            return <div key={order.id} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800">
            <button onClick={() => setDetailOrder(order)} className="min-w-0 text-left hover:underline"><b>{order.orderNo}</b><span className="ml-2 text-gray-500">{order.customer}</span>
              <span className="ml-2 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] dark:bg-gray-700">{order.orderType === 'EXTERNAL' ? '외부' : '내부'}</span>
            </button>
            <div className="flex shrink-0 items-center gap-1">
              <button onClick={() => canEdit && setEditOrder(order)} disabled={!canEdit}
                title={canEdit ? '주문 수정' : '피킹이 진행된 주문은 수정할 수 없습니다'}
                className={canEdit
                  ? 'rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                  : 'rounded p-1 text-gray-300 cursor-not-allowed dark:text-gray-600'}>
                <Pencil size={14} />
              </button>
              {order.orderType === 'EXTERNAL' && <button onClick={() => printExternalPickingList(pickingDate, dailyOrders.filter(
                (item) => item.orderType === 'EXTERNAL' && (order.clientId ? item.clientId === order.clientId : item.customer === order.customer),
              ), clients, supplierInfo)}
                className="rounded border px-2 py-1 text-xs font-semibold text-[#2D4033] dark:border-gray-600 dark:text-gray-200"><Printer size={12} className="mr-1 inline" />출고증 출력</button>}
              <button onClick={() => setExcludedOrderIds((prev) => new Set(prev).add(order.id))}
                title="피킹리스트에서 제외" className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-gray-700"><X size={15} /></button>
            </div>
          </div>
          })}
        </div>
      </div>
      <div className="rounded-xl border bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-3 flex items-center justify-between">
          <b>제외된 주문 ({excludedOrders.length})</b>
          {!!excludedOrders.length && <button onClick={() => setExcludedOrderIds(new Set())}
            className="text-xs font-semibold text-emerald-700 dark:text-emerald-400"><Plus size={13} className="mr-1 inline" />전체 추가</button>}
        </div>
        <div className="max-h-44 space-y-2 overflow-auto">
          {!excludedOrders.length && <p className="py-4 text-center text-sm text-gray-400">제외된 출고 주문이 없습니다.</p>}
          {excludedOrders.map((order) => <div key={order.id} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800">
            <button onClick={() => setDetailOrder(order)} className="min-w-0 text-left hover:underline"><b>{order.orderNo}</b><span className="ml-2 text-gray-500">{order.customer}</span></button>
            <button onClick={() => setExcludedOrderIds((prev) => {
              const next = new Set(prev); next.delete(order.id); return next
            })} className="shrink-0 rounded border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <Plus size={12} className="mr-1 inline" />추가
            </button>
          </div>)}
        </div>
      </div>
    </div>

    <div className="overflow-hidden rounded-xl border border-[#D4BF99] bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-[#F9F7F2] px-4 py-3 dark:border-gray-800 dark:bg-gray-800">
        <b>[ {pickingDate} ] 피킹 해야 할 총 리스트</b>
        <div className="flex items-center gap-3"><b className="text-[#D2691E]">{dailyOrders.length}건 / 남은 {formatNumber(totalBoxes)} BOX</b>
          <button onClick={() => completeRows(rows.filter((row) => selectedRows.has(row.key)))} disabled={!selectedRows.size || completePicking.isPending}
            className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">선택 완료 처리 ({selectedRows.size})</button>
        </div>
      </div>
      <div className="max-h-[calc(100vh-230px)] overflow-auto">
        <table className="w-full min-w-[850px] text-sm"><thead className="sticky top-0 bg-[#2D4033] text-white"><tr>
          <th className="w-12 px-3 py-2"><input type="checkbox" checked={allSelected} onChange={(e) => setSelectedRows(e.target.checked ? new Set(rows.map((row) => row.key)) : new Set())} /></th>
          <th className="px-3 py-2">기본위치</th><th className="px-3 py-2">상품코드</th><th className="px-3 py-2 text-left">상품명</th>
          <th className="px-3 py-2">가져올 BOX</th><th className="px-3 py-2 text-left">요청처별 수량</th><th className="px-3 py-2">작업</th>
        </tr></thead><tbody className="divide-y dark:divide-gray-800">
          {!rows.length && <tr><td colSpan={7} className="py-12 text-center text-gray-400">해당 날짜에 남은 피킹 작업이 없습니다</td></tr>}
          {rows.map((row) => {
            const toggleRow = () => setSelectedRows((prev) => {
              const next = new Set(prev); if (next.has(row.key)) next.delete(row.key); else next.add(row.key); return next
            })
            return <tr key={row.key} onClick={toggleRow} className="cursor-pointer border-l-4 border-gray-300 !bg-gray-200 dark:border-gray-600 dark:!bg-gray-700/70">
            <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedRows.has(row.key)} onChange={toggleRow} /></td>
            <td className="px-3 py-2 text-center font-mono font-bold">{row.locationCode}</td><td className="px-3 py-2 text-center font-mono text-xs">{row.product?.code}</td>
            <td className="px-3 py-2">{row.product?.name}</td><td className="px-3 py-2 text-right text-base font-bold text-[#D2691E]">{formatNumber(row.boxCount)} BOX</td>
            <td className="px-3 py-2 text-xs text-gray-500">{row.requests}</td><td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}><button onClick={() => completeRows([row])}
              disabled={completePicking.isPending} className="rounded-lg border border-violet-300 px-2.5 py-1.5 text-xs font-semibold text-violet-700 disabled:opacity-40">완료 처리</button></td>
          </tr>
          })}
        </tbody></table>
      </div>
    </div>

    {detailOrder && <OrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} />}
    {editOrder && <CollectOrderModal warehouseId={warehouse.id} order={editOrder} onClose={() => setEditOrder(null)}
      onSaved={() => { setEditOrder(null); qc.invalidateQueries({ queryKey: ['outbound-orders'] }) }} />}
  </div>
}

function OrderDetailModal({ order, onClose }: { order: OutboundOrder; onClose: () => void }) {
  const totalBoxes = order.items.reduce((sum, item) => sum + item.boxCount, 0)
  const pickedBoxes = order.items.reduce((sum, item) => sum + Number(item.pickedBoxCount || 0), 0)
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
    <div onClick={(e) => e.stopPropagation()} className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
      <div className="flex items-center justify-between border-b px-5 py-4 dark:border-gray-800">
        <div><h3 className="font-bold">{order.orderNo}</h3>
          <p className="text-xs text-gray-400">{order.orderType === 'EXTERNAL' ? '외부' : '내부'} 출고 · {order.requestedShipDate || '-'}</p></div>
        <button onClick={onClose}><X size={18} /></button>
      </div>
      <div className="space-y-3 overflow-y-auto p-5 text-sm">
        <dl className="grid grid-cols-2 gap-y-2">
          <dt className="text-gray-400">거래처</dt><dd>{order.customer}</dd>
          <dt className="text-gray-400">수령인</dt><dd>{order.recipient || '-'}</dd>
          <dt className="text-gray-400">연락처</dt><dd>{order.phone || '-'}</dd>
          <dt className="text-gray-400">주소</dt><dd className="break-words">{order.address || '-'}</dd>
          <dt className="text-gray-400">채널/외부주문번호</dt><dd>{order.channel || '-'} {order.externalOrderNo || ''}</dd>
          <dt className="text-gray-400">주문일</dt><dd>{order.orderDate}</dd>
          <dt className="text-gray-400">메모</dt><dd className="break-words">{order.memo || '-'}</dd>
        </dl>
        <div className="overflow-hidden rounded-xl border dark:border-gray-800">
          <table className="w-full text-xs"><thead className="bg-gray-50 dark:bg-gray-800"><tr>
            <th className="p-2 text-left">상품</th><th className="p-2">기본위치</th><th className="p-2">BOX</th><th className="p-2">피킹완료</th>
          </tr></thead><tbody className="divide-y dark:divide-gray-800">
            {order.items.map((item) => <tr key={item.id}>
              <td className="p-2"><p>{item.product?.name}</p><p className="font-mono text-gray-400">{item.product?.code}</p></td>
              <td className="p-2 text-center font-mono">{item.product?.defaultLocation?.code || '-'}</td>
              <td className="p-2 text-right">{formatNumber(item.boxCount)}</td>
              <td className="p-2 text-right">{formatNumber(item.pickedBoxCount)}</td>
            </tr>)}
          </tbody></table>
        </div>
        <p className="text-right font-bold text-[#D2691E]">총 {formatNumber(totalBoxes)} BOX (피킹완료 {formatNumber(pickedBoxes)})</p>
      </div>
    </div>
  </div>
}
