'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { PackageCheck, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { clientApi } from '@/api/client.api'
import { outboundOrderApi, type OutboundOrderRequest } from '@/api/outbound-order.api'
import { productApi } from '@/api/product.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { formatNumber } from '@/utils/format'
import type { OutboundOrder, OutboundOrderType, Product } from '@/types/api.types'

const today = () => new Date().toISOString().slice(0, 10)

export function CollectOrderModal({ warehouseId, order, onClose, onSaved }: {
  warehouseId: string
  order?: OutboundOrder
  onClose: () => void
  onSaved: () => void
}) {
  const [orderType, setOrderType] = useState<OutboundOrderType>(order?.orderType ?? 'EXTERNAL')
  const [clientId, setClientId] = useState(order?.clientId ?? '')
  const [channel, setChannel] = useState(order?.channel ?? '')
  const [externalOrderNo, setExternalOrderNo] = useState(order?.externalOrderNo ?? '')
  const [customer, setCustomer] = useState(order?.customer ?? '')
  const [recipient, setRecipient] = useState(order?.recipient ?? '')
  const [phone, setPhone] = useState(order?.phone ?? '')
  const [address, setAddress] = useState(order?.address ?? '')
  const [orderDate, setOrderDate] = useState(order?.orderDate ?? today())
  const [requestedShipDate, setRequestedShipDate] = useState(order?.requestedShipDate ?? today())
  const [memo, setMemo] = useState(order?.memo ?? '')
  const [productSearch, setProductSearch] = useState('')
  const [items, setItems] = useState<{ productId: string; boxCount: number; product: Product }[]>(
    order?.items.flatMap((item) => item.product ? [{ productId: item.productId, boxCount: item.boxCount, product: item.product }] : []) ?? [],
  )
  const [clientSearch, setClientSearch] = useState('')
  const { data: clientResults } = useQuery({
    queryKey: ['clients-search', clientSearch],
    queryFn: () => clientApi.findAll({ search: clientSearch, limit: 20 }),
    enabled: clientSearch.trim().length > 0,
  })
  const clientCandidates = clientResults?.items ?? []

  const { data: products } = useQuery({
    queryKey: QUERY_KEYS.products({ search: productSearch, status: 'ACTIVE' }),
    queryFn: () => productApi.findAll({ search: productSearch, status: 'ACTIVE', limit: 20 }),
    enabled: productSearch.trim().length > 0,
  })
  const candidates = useMemo(() => products?.items.filter((p) => !items.some((item) => item.productId === p.id)) ?? [], [items, products])
  const save = useMutation({
    mutationFn: (request: OutboundOrderRequest) => order
      ? outboundOrderApi.update(order.id, request)
      : outboundOrderApi.create(request),
    onSuccess: () => { toast.success(order ? '출고 주문을 수정했습니다' : '주문을 수집했습니다'); onSaved() },
    onError: () => toast.error(order ? '출고 주문 수정에 실패했습니다' : '주문수집에 실패했습니다'),
  })
  const totalBoxes = items.reduce((sum, item) => sum + item.boxCount, 0)

  const submit = () => {
    if (!customer.trim()) return toast.error('거래처를 입력하세요')
    if (!items.length) return toast.error('상품을 1개 이상 추가하세요')
    save.mutate({
      warehouseId, clientId: clientId || undefined, orderType, channel: channel || undefined, externalOrderNo: externalOrderNo || undefined,
      customer: customer.trim(), recipient: recipient || undefined, phone: phone || undefined,
      address: address || undefined, orderDate, requestedShipDate: requestedShipDate || undefined,
      memo: memo || undefined, items: items.map((item) => ({ productId: item.productId, boxCount: item.boxCount })),
    })
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
    <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
      <div className="flex items-center justify-between border-b px-5 py-4 dark:border-gray-800">
        <div><h3 className="font-bold">{order ? '출고 주문 수정' : '주문수집'}</h3><p className="text-xs text-gray-400">모든 주문 수량은 BOX 단위입니다</p></div>
        <button onClick={onClose}><X size={18} /></button>
      </div>
      <div className="space-y-4 overflow-y-auto p-5">
        <div className="grid grid-cols-2 divide-x divide-gray-200 rounded-xl border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
          <div className="space-y-3 p-4">
            <p className="text-xs font-bold text-[#2D4033] dark:text-emerald-400">출고 / 거래처</p>
            <Field label="출고 구분 *"><select value={orderType} onChange={(e) => setOrderType(e.target.value as OutboundOrderType)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
              <option value="EXTERNAL">외부 출고</option><option value="INTERNAL">내부 출고</option>
            </select></Field>
            <div className="relative">
              <Field label="거래처 검색"><input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="거래처명 검색" /></Field>
              {!!clientSearch && clientCandidates.length > 0 && <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                {clientCandidates.map((client) => <button key={client.id} onClick={() => {
                  setClientId(client.id)
                  setCustomer(client.name)
                  setRecipient(client.contactName || client.managerName || client.ceoName || '')
                  setPhone(client.phone || client.mobile || '')
                  setAddress([client.address, client.addressDetail].filter(Boolean).join(' '))
                  setClientSearch('')
                }} className="flex w-full justify-between px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
                  <span>{client.name}</span><span className="text-xs text-gray-400">{client.businessNo || ''}</span>
                </button>)}
              </div>}
            </div>
            <Field label="거래처 *"><input value={customer} onChange={(e) => { setCustomer(e.target.value); setClientId('') }} /></Field>
            <Field label="수집 채널"><input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="전화, 네이버, 엑셀 등" /></Field>
            <Field label="외부 주문번호"><input value={externalOrderNo} onChange={(e) => setExternalOrderNo(e.target.value)} /></Field>
          </div>
          <div className="space-y-3 p-4">
            <p className="text-xs font-bold text-[#2D4033] dark:text-emerald-400">배송 정보</p>
            <Field label="수령인"><input value={recipient} onChange={(e) => setRecipient(e.target.value)} /></Field>
            <Field label="연락처"><input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            <Field label="주소"><input value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
            <Field label="주문일"><input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} /></Field>
            <Field label="출고 요청일"><input type="date" value={requestedShipDate} onChange={(e) => setRequestedShipDate(e.target.value)} /></Field>
          </div>
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
            <PackageCheck size={15} /> {order ? '수정 저장' : '수집 저장'}
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
