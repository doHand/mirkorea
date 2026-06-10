'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardPlus, PackageCheck, Printer, Search, Send, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { outboundOrderApi, type OutboundOrderRequest } from '@/api/outbound-order.api'
import { productApi } from '@/api/product.api'
import { stockApi } from '@/api/stock.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { buildDailyPickingRows, printDailyPickingList } from '@/utils/printPickingList'
import { formatNumber } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { OutboundOrderStatus, Product } from '@/types/api.types'

const STATUS_LABEL: Record<OutboundOrderStatus, string> = {
  COLLECTED: '수집완료',
  INSTRUCTED: '출고지시',
  CANCELLED: '취소',
}
const STATUS_STYLE: Record<OutboundOrderStatus, string> = {
  COLLECTED: 'bg-blue-100 text-blue-700',
  INSTRUCTED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}
const today = () => new Date().toISOString().slice(0, 10)

export default function OutboundPage() {
  const warehouse = useWarehouseStore((s) => s.selectedWarehouse)
  const qc = useQueryClient()
  const [status, setStatus] = useState<OutboundOrderStatus | ''>('')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [pickingDate, setPickingDate] = useState(today())

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
  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory', 'outbound-picking', warehouse?.id],
    queryFn: () => stockApi.getInventory(warehouse!.id),
    enabled: !!warehouse?.id,
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['outbound-orders'] })
  const instruct = useMutation({
    mutationFn: outboundOrderApi.instruct,
    onSuccess: () => { toast.success('출고지시를 생성했습니다'); refresh() },
    onError: () => toast.error('출고지시 생성에 실패했습니다'),
  })
  const orders = data?.items ?? []
  const allOrders = allData?.items ?? []
  const dailyOrders = allOrders.filter((order) =>
    order.status === 'INSTRUCTED' && order.requestedShipDate === pickingDate
  )
  const dailyPickingRows = buildDailyPickingRows(dailyOrders, inventory)
  const dailyBoxes = dailyOrders.flatMap((order) => order.items).reduce((sum, item) => sum + item.boxCount, 0)

  if (!warehouse) return <div className="flex h-64 items-center justify-center text-gray-400">창고를 먼저 선택하세요</div>

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">출고 관리</h2>
          <p className="mt-0.5 text-sm text-gray-500">주문수집 → 출고지시 생성 → BOX 단위 피킹리스트 출력</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <input type="date" value={pickingDate} onChange={(e) => setPickingDate(e.target.value)}
              className="rounded-l-xl bg-transparent px-3 py-2 text-sm outline-none" />
            <button onClick={() => printDailyPickingList(pickingDate, dailyOrders, inventory)}
              disabled={!dailyOrders.length}
              className="flex items-center gap-1.5 rounded-r-xl bg-[#2D4033] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
              <Printer size={15} /> 통합 피킹리스트 출력
            </button>
          </div>
          <button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-[#D2691E] px-4 py-2 text-sm font-semibold text-white">
            <ClipboardPlus size={16} /> 주문수집
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#D4BF99] bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5D3B3] bg-[#F9F7F2] px-4 py-3 dark:border-gray-800 dark:bg-gray-800">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">{pickingDate} 당일 통합 피킹리스트</h3>
            <p className="text-xs text-gray-500">출고지시된 주문을 실제 재고 위치순으로 합산했습니다.</p>
          </div>
          <b className="text-sm text-[#D2691E]">{dailyOrders.length}건 / {formatNumber(dailyBoxes)} BOX</b>
        </div>
        <div className="max-h-80 overflow-auto">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="sticky top-0 bg-[#2D4033] text-white"><tr>
              <th className="px-3 py-2">위치</th><th className="px-3 py-2">상품코드</th>
              <th className="px-3 py-2 text-left">상품명</th><th className="px-3 py-2">피킹수량</th>
              <th className="px-3 py-2 text-left">요청처별 수량</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {!dailyPickingRows.length && <tr><td colSpan={5} className="py-8 text-center text-gray-400">해당 날짜에 출고지시된 주문이 없습니다</td></tr>}
              {dailyPickingRows.map((row) => <tr key={row.key} className={row.insufficient ? 'bg-red-50 text-red-700 dark:bg-red-950/20' : ''}>
                <td className="px-3 py-2 text-center font-mono font-bold">{row.locationCode}</td>
                <td className="px-3 py-2 text-center font-mono text-xs">{row.product?.code}</td>
                <td className="px-3 py-2">{row.product?.name}</td>
                <td className="px-3 py-2 text-right text-base font-bold">{formatNumber(row.boxCount)} BOX</td>
                <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">{row.requests}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-[#2D4033] text-white"><tr>
            <th className="px-3 py-3">출고번호</th><th className="px-3 py-3">채널/외부주문번호</th>
            <th className="px-3 py-3">거래처</th><th className="px-3 py-3">수령인</th>
            <th className="px-3 py-3">출고요청일</th><th className="px-3 py-3">품목</th>
            <th className="px-3 py-3">BOX</th><th className="px-3 py-3">상태</th><th className="px-3 py-3">작업</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading && <tr><td colSpan={9} className="py-12 text-center text-gray-400">불러오는 중...</td></tr>}
            {!isLoading && orders.length === 0 && <tr><td colSpan={9} className="py-12 text-center text-gray-400">수집된 주문이 없습니다</td></tr>}
            {orders.map((order) => {
              const boxes = order.items.reduce((sum, item) => sum + item.boxCount, 0)
              return <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-3 py-3 font-mono text-xs font-semibold text-[#2D4033] dark:text-emerald-400">{order.orderNo}</td>
                <td className="px-3 py-3"><p>{order.channel || '-'}</p><p className="text-xs text-gray-400">{order.externalOrderNo || '-'}</p></td>
                <td className="px-3 py-3">{order.customer}</td><td className="px-3 py-3">{order.recipient || '-'}</td>
                <td className="px-3 py-3 text-center">{order.requestedShipDate || '-'}</td>
                <td className="px-3 py-3 text-right">{formatNumber(order.items.length)}종</td>
                <td className="px-3 py-3 text-right font-bold text-[#D2691E]">{formatNumber(boxes)} BOX</td>
                <td className="px-3 py-3 text-center"><span className={cn('rounded-full px-2 py-1 text-xs font-semibold', STATUS_STYLE[order.status])}>{STATUS_LABEL[order.status]}</span></td>
                <td className="px-3 py-3"><div className="flex justify-center gap-1.5">
                  {order.status === 'COLLECTED' && <button title="출고지시 생성" onClick={() => instruct.mutate(order.id)}
                    className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:border-[#2D4033] hover:text-[#2D4033]"><Send size={15} /></button>}
                </div></td>
              </tr>
            })}
          </tbody>
        </table>
      </div>

      {createOpen && <CollectOrderModal warehouseId={warehouse.id} onClose={() => setCreateOpen(false)}
        onSaved={() => { setCreateOpen(false); refresh() }} />}
    </div>
  )
}

function Summary({ label, value, active, onClick }: { label: string; value: number; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={cn('rounded-xl border bg-white p-3 text-left dark:bg-gray-900',
    active ? 'border-[#D2691E] ring-1 ring-[#D2691E]' : 'border-gray-200 dark:border-gray-800')}>
    <p className="text-xl font-bold text-gray-900 dark:text-white">{formatNumber(value)}</p><p className="text-xs text-gray-500">{label}</p>
  </button>
}

function CollectOrderModal({ warehouseId, onClose, onSaved }: { warehouseId: string; onClose: () => void; onSaved: () => void }) {
  const [channel, setChannel] = useState('')
  const [externalOrderNo, setExternalOrderNo] = useState('')
  const [customer, setCustomer] = useState('')
  const [recipient, setRecipient] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [orderDate, setOrderDate] = useState(today())
  const [requestedShipDate, setRequestedShipDate] = useState(today())
  const [memo, setMemo] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [items, setItems] = useState<{ productId: string; boxCount: number; product: Product }[]>([])

  const { data: products } = useQuery({
    queryKey: QUERY_KEYS.products({ search: productSearch, outbound: true }),
    queryFn: () => productApi.findAll({ search: productSearch, limit: 20 }),
    enabled: productSearch.trim().length > 0,
  })
  const candidates = useMemo(() => products?.items.filter((p) => !items.some((item) => item.productId === p.id)) ?? [], [items, products])
  const save = useMutation({
    mutationFn: (request: OutboundOrderRequest) => outboundOrderApi.create(request),
    onSuccess: () => { toast.success('주문을 수집했습니다'); onSaved() },
    onError: () => toast.error('주문수집에 실패했습니다'),
  })
  const totalBoxes = items.reduce((sum, item) => sum + item.boxCount, 0)

  const submit = () => {
    if (!customer.trim()) return toast.error('거래처를 입력하세요')
    if (!items.length) return toast.error('상품을 1개 이상 추가하세요')
    save.mutate({
      warehouseId, channel: channel || undefined, externalOrderNo: externalOrderNo || undefined,
      customer: customer.trim(), recipient: recipient || undefined, phone: phone || undefined,
      address: address || undefined, orderDate, requestedShipDate: requestedShipDate || undefined,
      memo: memo || undefined, items: items.map((item) => ({ productId: item.productId, boxCount: item.boxCount })),
    })
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
    <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
      <div className="flex items-center justify-between border-b px-5 py-4 dark:border-gray-800">
        <div><h3 className="font-bold">주문수집</h3><p className="text-xs text-gray-400">모든 주문 수량은 BOX 단위입니다</p></div>
        <button onClick={onClose}><X size={18} /></button>
      </div>
      <div className="space-y-4 overflow-y-auto p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="수집 채널"><input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="전화, 네이버, 엑셀 등" /></Field>
          <Field label="외부 주문번호"><input value={externalOrderNo} onChange={(e) => setExternalOrderNo(e.target.value)} /></Field>
          <Field label="거래처 *"><input value={customer} onChange={(e) => setCustomer(e.target.value)} /></Field>
          <Field label="수령인"><input value={recipient} onChange={(e) => setRecipient(e.target.value)} /></Field>
          <Field label="연락처"><input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <Field label="주소"><input value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
          <Field label="주문일"><input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} /></Field>
          <Field label="출고 요청일"><input type="date" value={requestedShipDate} onChange={(e) => setRequestedShipDate(e.target.value)} /></Field>
        </div>
        <Field label="메모"><input value={memo} onChange={(e) => setMemo(e.target.value)} /></Field>
        <div className="relative">
          <Field label="상품 추가"><input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="상품명 또는 코드 검색" /></Field>
          {!!productSearch && candidates.length > 0 && <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
            {candidates.map((product) => <button key={product.id} onClick={() => { setItems((prev) => [...prev, { productId: product.id, boxCount: 1, product }]); setProductSearch('') }}
              className="flex w-full justify-between px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
              <span>{product.name}</span><span className="font-mono text-xs text-gray-400">{product.code}</span>
            </button>)}
          </div>}
        </div>
        <div className="overflow-hidden rounded-xl border dark:border-gray-800">
          <table className="w-full text-sm"><thead className="bg-gray-50 dark:bg-gray-800"><tr>
            <th className="p-2 text-left">상품</th><th className="p-2">기본위치</th><th className="p-2">박스수량</th><th className="w-10"></th>
          </tr></thead><tbody className="divide-y dark:divide-gray-800">
            {!items.length && <tr><td colSpan={4} className="py-8 text-center text-gray-400">상품을 추가하세요</td></tr>}
            {items.map((item, index) => <tr key={item.productId}>
              <td className="p-2"><p>{item.product.name}</p><p className="font-mono text-xs text-gray-400">{item.product.code}</p></td>
              <td className="p-2 text-center font-mono text-xs">{item.product.defaultLocation?.code || '-'}</td>
              <td className="p-2"><div className="flex items-center justify-center gap-2"><input type="number" min={1} value={item.boxCount}
                step={1}
                onChange={(e) => setItems((prev) => prev.map((row, i) => i === index
                  ? { ...row, boxCount: Math.max(1, Math.floor(Number(e.target.value) || 1)) }
                  : row))}
                className="w-20 rounded-lg border px-2 py-1 text-right dark:border-gray-700 dark:bg-gray-800" /><b>BOX</b></div></td>
              <td><button onClick={() => setItems((prev) => prev.filter((row) => row.productId !== item.productId))} className="text-gray-400 hover:text-red-500"><X size={14} /></button></td>
            </tr>)}
          </tbody></table>
        </div>
      </div>
      <div className="flex items-center justify-between border-t px-5 py-4 dark:border-gray-800">
        <b className="text-[#D2691E]">합계 {formatNumber(totalBoxes)} BOX</b>
        <div className="flex gap-2"><button onClick={onClose} className="rounded-xl border px-4 py-2 text-sm">취소</button>
          <button onClick={submit} disabled={save.isPending} className="flex items-center gap-1.5 rounded-xl bg-[#2D4033] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
            <PackageCheck size={15} /> 수집 저장
          </button></div>
      </div>
    </div>
  </div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{label}
    <div className="[&_input]:mt-1 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-gray-200 [&_input]:px-3 [&_input]:py-2 [&_input]:text-sm [&_input]:outline-none [&_input]:focus:border-[#2D4033] dark:[&_input]:border-gray-700 dark:[&_input]:bg-gray-800">{children}</div>
  </label>
}
