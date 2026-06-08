'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ClipboardList, FilePlus2, PackageCheck, PackageSearch, Printer, Search, Send, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { purchaseOrderApi, type PurchaseOrderRequest } from '@/api/purchase-order.api'
import { productApi } from '@/api/product.api'
import { clientApi } from '@/api/client.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { useWarehouseStore } from '@/stores/warehouse.store'
import type { Product, PurchaseOrder, PurchaseOrderStatus } from '@/types/api.types'
import { printPurchaseOrder } from '@/utils/printPurchaseOrder'
import { formatPhoneInput } from '@/utils/format'

const STATUS: Record<PurchaseOrderStatus, string> = {
  DRAFT: '작성 중', ORDERED: '발주 완료', CONVERTED: '입고예정 등록', CANCELLED: '취소',
}
const STATUS_STYLE: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700', ORDERED: 'bg-orange-100 text-orange-700',
  CONVERTED: 'bg-emerald-100 text-emerald-700', CANCELLED: 'bg-red-100 text-red-600',
}
const today = () => new Date().toISOString().slice(0, 10)

export function PurchaseOrdersContent({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter()
  const qc = useQueryClient()
  const warehouse = useWarehouseStore((s) => s.selectedWarehouse)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<PurchaseOrderStatus | ''>('')
  const [editing, setEditing] = useState<PurchaseOrder | null | undefined>(undefined)

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.purchaseOrders({ warehouseId: warehouse?.id, status, search }),
    queryFn: () => purchaseOrderApi.findAll({ warehouseId: warehouse!.id, status: status || undefined, search: search || undefined }),
    enabled: !!warehouse,
  })
  const orders = data?.items ?? []
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['purchase-orders'] })
    qc.invalidateQueries({ queryKey: ['inbound'] })
  }
  const action = useMutation({
    mutationFn: ({ kind, id }: { kind: 'ordered' | 'convert'; id: string }) =>
      kind === 'ordered' ? purchaseOrderApi.markOrdered(id) : purchaseOrderApi.convertToInbound(id),
    onSuccess: (order, vars) => {
      refresh()
      toast.success(vars.kind === 'ordered' ? '발주 완료로 처리했습니다' : '입고 예정으로 등록했습니다')
      if (vars.kind === 'convert' && order.inboundOrderId) router.push(`/inbound/${order.inboundOrderId}`)
    },
    onError: () => toast.error('처리에 실패했습니다'),
  })

  if (!warehouse) return <div className="py-20 text-center text-gray-400">창고를 먼저 선택하세요</div>
  return (
    <div className="space-y-4">
      {!embedded && <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">발주서</h2>
          <p className="text-sm text-gray-500">발주서 작성·출력 후 확정된 건만 입고예정으로 등록합니다</p>
        </div>
        <button onClick={() => setEditing(null)} className="flex items-center gap-2 rounded-lg bg-[#2D4033] px-4 py-2 text-sm font-semibold text-white hover:bg-[#24352a]">
          <FilePlus2 size={16} /> 발주서 작성
        </button>
      </div>}
      {embedded && <div className="flex justify-end">
        <button onClick={() => setEditing(null)} className="flex items-center gap-2 rounded-lg bg-[#2D4033] px-4 py-2 text-sm font-semibold text-white hover:bg-[#24352a]">
          <FilePlus2 size={16} /> 발주서 작성
        </button>
      </div>}

      <div className="flex flex-wrap gap-2 border border-[#d8ddd8] bg-white p-3 shadow-sm dark:bg-gray-900">
        <div className="relative min-w-60 flex-1"><Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="발주번호 또는 공급업체 검색" className="w-full border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#2D4033] dark:bg-gray-800" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as PurchaseOrderStatus | '')} className="border border-gray-200 px-3 py-2 text-sm dark:bg-gray-800">
          <option value="">전체 상태</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto border border-[#d8ddd8] bg-white shadow-sm dark:bg-gray-900">
        <table className="w-full min-w-[900px] text-sm"><thead className="bg-[#2D4033] text-white"><tr>
          <th className="px-3 py-3 text-left">발주번호</th><th className="px-3 py-3 text-left">공급업체</th>
          <th className="px-3 py-3">발주일</th><th className="px-3 py-3">납기예정일</th><th className="px-3 py-3">품목</th>
          <th className="px-3 py-3 text-right">총금액</th><th className="px-3 py-3">상태</th><th className="px-3 py-3">작업</th>
        </tr></thead><tbody className="divide-y divide-gray-100">
          {isLoading && <tr><td colSpan={8} className="py-12 text-center text-gray-400">로딩 중...</td></tr>}
          {!isLoading && orders.length === 0 && <tr><td colSpan={8} className="py-12 text-center text-gray-400">작성된 발주서가 없습니다</td></tr>}
          {orders.map((o) => <tr key={o.id} className="hover:bg-[#f7f8f5]">
            <td className="px-3 py-3 font-mono font-semibold text-[#2D4033]">{o.orderNo}</td><td className="px-3 py-3">{o.supplier || '-'}</td>
            <td className="px-3 py-3 text-center">{o.orderDate}</td><td className="px-3 py-3 text-center">{o.expectedDate || '-'}</td>
            <td className="px-3 py-3 text-center">{o.items.length}종</td><td className="px-3 py-3 text-right font-semibold">{total(o).toLocaleString()}원</td>
            <td className="px-3 py-3 text-center"><span className={`px-2 py-1 text-xs font-medium ${STATUS_STYLE[o.status]}`}>{STATUS[o.status]}</span></td>
            <td className="px-3 py-2"><div className="flex justify-center gap-1">
              <IconButton title="출력" onClick={() => printPurchaseOrder(o)}><Printer size={15} /></IconButton>
              {(o.status === 'DRAFT' || o.status === 'ORDERED') && <IconButton title="수정" onClick={() => setEditing(o)}><ClipboardList size={15} /></IconButton>}
              {o.status === 'DRAFT' && <IconButton title="발주 완료" onClick={() => action.mutate({ kind: 'ordered', id: o.id })}><Send size={15} /></IconButton>}
              {o.status === 'ORDERED' && <button onClick={() => action.mutate({ kind: 'convert', id: o.id })} className="flex items-center gap-1 bg-[#D2691E] px-2 py-1.5 text-xs font-semibold text-white hover:bg-[#b85b19]"><PackageCheck size={14} />입고예정 등록</button>}
            </div></td>
          </tr>)}
        </tbody></table>
      </div>
      {editing !== undefined && <OrderModal warehouseId={warehouse.id} order={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); refresh() }} />}
    </div>
  )
}

function IconButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return <button title={title} onClick={onClick} className="border border-gray-200 p-1.5 text-gray-600 hover:border-[#2D4033] hover:text-[#2D4033]">{children}</button>
}
const total = (o: PurchaseOrder) => o.items.reduce((sum, i) => sum + Number(i.unitPrice || 0) * i.quantity, 0)

function OrderModal({ warehouseId, order, onClose, onSaved }: { warehouseId: string; order: PurchaseOrder | null; onClose: () => void; onSaved: () => void }) {
  const [supplier, setSupplier] = useState(order?.supplier ?? '')
  const [orderDate, setOrderDate] = useState(order?.orderDate ?? today())
  const [expectedDate, setExpectedDate] = useState(order?.expectedDate ?? '')
  const [manager, setManager] = useState(order?.manager ?? '')
  const [phone, setPhone] = useState(order?.phone ?? '')
  const [fax, setFax] = useState(order?.fax ?? '')
  const [memo, setMemo] = useState(order?.memo ?? '')
  const [clientId, setClientId] = useState('')
  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const [items, setItems] = useState((order?.items ?? []).map((i) => ({
    productId: i.productId, product: i.product, boxCount: i.boxCount ?? 0,
    quantity: i.quantity, capSize: i.capSize ?? '', unitPrice: Number(i.unitPrice || 0),
  })))
  const { data: clients } = useQuery({ queryKey: ['clients-all'], queryFn: clientApi.findAllActive })
  const save = useMutation({
    mutationFn: (req: PurchaseOrderRequest) => order ? purchaseOrderApi.update(order.id, req) : purchaseOrderApi.create(req),
    onSuccess: () => { toast.success('발주서를 저장했습니다'); onSaved() }, onError: () => toast.error('저장에 실패했습니다'),
  })
  const totalBoxes = useMemo(() => items.reduce((sum, item) => sum + item.boxCount, 0), [items])
  const totalEa = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items])
  const addProducts = (products: Product[]) => {
    const existing = new Set(items.map((item) => item.productId))
    const added = products.filter((product) => !existing.has(product.id)).map((product) => ({
      productId: product.id, product, boxCount: 1, quantity: Math.max(1, product.boxQty || 1),
      capSize: product.spec ?? '', unitPrice: Number(product.costPrice || 0),
    }))
    setItems([...items, ...added])
    setProductPickerOpen(false)
  }
  const selectClient = (id: string) => {
    setClientId(id)
    const client = clients?.find((item) => item.id === id)
    if (!client) return
    setSupplier(client.name)
    setManager(client.contactName || client.managerName || client.salesperson || '')
    setPhone(client.phone || client.mobile || '')
    setFax(client.fax || '')
  }
  const submit = () => {
    if (!supplier.trim()) return toast.error('공급업체를 입력하세요')
    if (!items.length) return toast.error('품목을 추가하세요')
    save.mutate({
      warehouseId, supplier, orderDate, expectedDate: expectedDate || undefined,
      manager: manager || undefined, phone: phone || undefined, fax: fax || undefined, memo: memo || undefined,
      items: items.map(({ productId, boxCount, quantity, capSize, unitPrice }) => ({
        productId, boxCount, quantity, capSize: capSize || undefined, unitPrice,
      })),
    })
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"><div className="flex max-h-[92vh] w-full max-w-4xl flex-col bg-white shadow-2xl dark:bg-gray-900">
    <div className="flex items-center justify-between border-b px-5 py-4"><h3 className="font-bold">{order ? '발주서 수정' : '발주서 작성'}</h3><button onClick={onClose}><X size={18} /></button></div>
    <div className="flex-1 space-y-4 overflow-y-auto p-5">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="block text-xs font-medium text-gray-600">
          거래처 불러오기
          <select
            value={clientId}
            onChange={(e) => selectClient(e.target.value)}
            className="mt-1 w-full border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#2D4033] dark:bg-gray-800"
          >
            <option value="">거래처를 선택하세요</option>
            {(clients ?? []).map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </label>
        <Field label="업체명"><input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="업체명" /></Field>
        <Field label="발주일"><input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} /></Field>
        <Field label="담당자"><input value={manager} onChange={(e) => setManager(e.target.value)} placeholder="담당자명" /></Field>
        <Field label="입고일"><input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} /></Field>
        <Field label="전화번호"><input value={phone} onChange={(e) => setPhone(formatPhoneInput(e.target.value))} inputMode="numeric" placeholder="전화번호" /></Field>
        <Field label="팩스"><input value={fax} onChange={(e) => setFax(formatPhoneInput(e.target.value))} inputMode="numeric" placeholder="팩스번호" /></Field>
      </div>
      <div className="flex items-center justify-between border border-[#d8ddd8] bg-[#f7f8f5] px-4 py-3">
        <div><p className="text-sm font-semibold text-gray-800">발주 제품</p><p className="text-xs text-gray-500">상품 마스터에 등록된 제품을 불러옵니다</p></div>
        <button type="button" onClick={() => setProductPickerOpen(true)} className="flex items-center gap-2 bg-[#2D4033] px-3 py-2 text-sm font-semibold text-white hover:bg-[#24352a]">
          <PackageSearch size={16} /> 등록 상품 불러오기
        </button>
      </div>
      <div className="overflow-x-auto border"><table className="w-full min-w-[760px] text-sm"><thead className="bg-[#edf0ec]"><tr><th className="p-2">번호</th><th className="p-2 text-left">제품명</th><th>박스수량</th><th>수량(EA)</th><th>캡사이즈</th><th></th></tr></thead><tbody>
        {items.map((i, idx) => <tr key={i.productId} className="border-t"><td className="p-2 text-center">{idx + 1}</td>
          <td className="p-2"><b>{i.product?.name}</b><div className="text-xs text-gray-400">{i.product?.code}</div></td>
          <td className="p-2"><input type="number" min={0} value={i.boxCount} onChange={(e) => setItems(items.map((x, n) => n === idx ? { ...x, boxCount: Math.max(0, Number(e.target.value)) } : x))} /></td>
          <td className="p-2"><input type="number" min={1} value={i.quantity} onChange={(e) => setItems(items.map((x, n) => n === idx ? { ...x, quantity: Math.max(1, Number(e.target.value)) } : x))} /></td>
          <td className="p-2"><input value={i.capSize} onChange={(e) => setItems(items.map((x, n) => n === idx ? { ...x, capSize: e.target.value } : x))} placeholder="캡사이즈" /></td>
          <td><button onClick={() => setItems(items.filter((_, n) => n !== idx))} className="text-red-500"><X size={15} /></button></td></tr>)}
      </tbody></table></div>
      <Field label="메모"><input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="발주 관련 메모" /></Field>
    </div><div className="flex items-center justify-between border-t px-5 py-4"><b className="text-[#D2691E]">합계 {totalBoxes.toLocaleString()} BOX / {totalEa.toLocaleString()} EA</b><div className="flex gap-2"><button onClick={onClose} className="border px-4 py-2 text-sm">취소</button><button onClick={submit} disabled={save.isPending} className="bg-[#2D4033] px-5 py-2 text-sm font-semibold text-white">저장</button></div></div>
    {productPickerOpen && <ProductPicker existingIds={items.map((item) => item.productId)} onClose={() => setProductPickerOpen(false)} onAdd={addProducts} />}
  </div></div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-gray-600">{label}<div className="[&_input]:mt-1 [&_input]:w-full [&_input]:border [&_input]:border-gray-200 [&_input]:px-3 [&_input]:py-2 [&_input]:text-sm [&_input]:outline-none [&_input]:focus:border-[#2D4033]">{children}</div></label>
}

function ProductPicker({ existingIds, onClose, onAdd }: { existingIds: string[]; onClose: () => void; onAdd: (products: Product[]) => void }) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.products({ search, picker: true }),
    queryFn: () => productApi.findAll({ search: search || undefined, limit: 100 }),
  })
  const products = data?.items ?? []
  const existing = new Set(existingIds)
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const selectedProducts = products.filter((product) => selected.includes(product.id))

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4">
    <div className="flex max-h-[82vh] w-full max-w-4xl flex-col bg-white shadow-2xl dark:bg-gray-900">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div><h3 className="font-bold text-gray-900 dark:text-white">등록 상품 불러오기</h3><p className="mt-0.5 text-xs text-gray-500">추가할 상품을 여러 개 선택할 수 있습니다</p></div>
        <button type="button" onClick={onClose} className="p-1.5 text-gray-500 hover:bg-gray-100"><X size={18} /></button>
      </div>
      <div className="border-b p-4">
        <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="상품명, 상품코드, 자재번호, 거래처 검색" className="w-full border border-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#2D4033] dark:bg-gray-800" />
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[720px] text-sm"><thead className="sticky top-0 bg-[#2D4033] text-white"><tr>
          <th className="w-14 px-3 py-3"></th><th className="px-3 py-3 text-left">상품코드</th><th className="px-3 py-3 text-left">제품명</th><th className="px-3 py-3 text-left">거래처</th><th className="px-3 py-3">박스당 EA</th><th className="px-3 py-3 text-left">규격/캡사이즈</th>
        </tr></thead><tbody className="divide-y divide-gray-100">
          {isLoading && <tr><td colSpan={6} className="py-12 text-center text-gray-400">상품을 불러오는 중...</td></tr>}
          {!isLoading && products.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-gray-400">등록된 상품이 없습니다</td></tr>}
          {products.map((product) => {
            const alreadyAdded = existing.has(product.id)
            const checked = selected.includes(product.id)
            return <tr key={product.id} onClick={() => !alreadyAdded && toggle(product.id)} className={alreadyAdded ? 'bg-gray-50 text-gray-400' : 'cursor-pointer hover:bg-[#f4f7f3]'}>
              <td className="px-3 py-3 text-center"><span className={`inline-flex h-5 w-5 items-center justify-center border ${checked ? 'border-[#2D4033] bg-[#2D4033] text-white' : 'border-gray-300'}`}>{checked && <Check size={13} />}</span></td>
              <td className="px-3 py-3 font-mono text-xs">{product.code}</td><td className="px-3 py-3 font-medium">{product.name}{alreadyAdded && <span className="ml-2 text-xs text-[#D2691E]">추가됨</span>}</td>
              <td className="px-3 py-3">{product.client?.name || '-'}</td><td className="px-3 py-3 text-center">{product.boxQty?.toLocaleString() || 1}</td><td className="px-3 py-3">{product.spec || '-'}</td>
            </tr>
          })}
        </tbody></table>
      </div>
      <div className="flex items-center justify-between border-t px-5 py-4"><span className="text-sm font-semibold text-[#2D4033]">{selected.length}개 선택</span><div className="flex gap-2"><button type="button" onClick={onClose} className="border px-4 py-2 text-sm">취소</button><button type="button" disabled={!selected.length} onClick={() => onAdd(selectedProducts)} className="bg-[#D2691E] px-5 py-2 text-sm font-semibold text-white disabled:opacity-40">선택 상품 추가</button></div></div>
    </div>
  </div>
}
