'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { clientApi } from '@/api/client.api'
import { outboundOrderApi, type OutboundOrderRequest } from '@/api/outbound-order.api'
import { productApi } from '@/api/product.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { formatNumber } from '@/utils/format'
import { getApiErrorMessage } from '@/utils/error'
import type { Client, OutboundOrder, OutboundOrderType, PageResponse, Product } from '@/types/api.types'

const today = () => new Date().toISOString().slice(0, 10)

async function fetchClientPage(search: string, page: number): Promise<PageResponse<Client>> {
  const params = new URLSearchParams({ page: String(page), limit: '20' })
  if (search) params.set('search', search)
  const url = `/api/v1/clients?${params.toString()}`
  const request = () => fetch(url, { credentials: 'same-origin' })
  let response = await request()

  if (response.status === 401 || response.status === 403) {
    const refreshed = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    if (refreshed.ok) response = await request()
  }

  const payload = await response.json().catch(() => null) as { data?: PageResponse<Client>; message?: string } | null
  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || `거래처 조회 실패 (${response.status})`)
  }
  return payload.data
}

export function CollectOrderModal({ warehouseId, order, onClose, onSaved }: {
  warehouseId: string
  order?: OutboundOrder
  onClose: () => void
  onSaved: () => void
}) {
  useEscapeKey(onClose)
  const [orderType, setOrderType] = useState<OutboundOrderType>(order?.orderType ?? 'EXTERNAL')
  const [clientId, setClientId] = useState(order?.clientId ?? '')
  const [channel, setChannel] = useState(order?.channel ?? '')
  const [externalOrderNo, setExternalOrderNo] = useState(order?.externalOrderNo ?? '')
  const [customer, setCustomer] = useState(order?.customer ?? '')
  const [recipient, setRecipient] = useState(order?.recipient ?? '')
  const [phone, setPhone] = useState(order?.phone ?? '')
  const [address, setAddress] = useState(order?.address ?? '')
  const [postcodeReady, setPostcodeReady] = useState(false)
  const [orderDate, setOrderDate] = useState(order?.orderDate ?? today())
  const [requestedShipDate, setRequestedShipDate] = useState(order?.requestedShipDate ?? today())
  const [memo, setMemo] = useState(order?.memo ?? '')
  const [productSearch, setProductSearch] = useState('')
  const [clientPickerOpen, setClientPickerOpen] = useState(false)
  const [items, setItems] = useState<{ productId: string; boxCount: number; product: Product }[]>(
    order?.items.flatMap((item) => item.product ? [{ productId: item.productId, boxCount: item.boxCount, product: item.product }] : []) ?? [],
  )
  const { data: clientResults } = useQuery({
    queryKey: ['clients-search', customer],
    queryFn: () => clientApi.findAll({ search: customer, limit: 20 }),
    enabled: customer.trim().length > 0 && !clientId,
  })
  const clientCandidates = clientResults?.items ?? []

  const { data: products, isFetching: isProductFetching, isError: isProductError, error: productError } = useQuery({
    queryKey: QUERY_KEYS.products({ search: productSearch, status: 'ACTIVE' }),
    queryFn: () => productApi.findAll({ search: productSearch.trim(), status: 'ACTIVE', limit: 20 }),
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
  const totalOUTes = items.reduce((sum, item) => sum + item.boxCount, 0)

  useEffect(() => {
    if (window.daum?.Postcode) {
      setPostcodeReady(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    script.async = true
    script.onload = () => setPostcodeReady(true)
    document.head.appendChild(script)
    return () => script.remove()
  }, [])

  const openAddressSearch = () => {
    if (!postcodeReady || !window.daum?.Postcode) return toast.error('주소검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.')
    new window.daum.Postcode({ oncomplete: (data) => setAddress(data.roadAddress || data.jibunAddress) }).open()
  }

  const selectClient = (client: Client) => {
    setClientId(client.id)
    setCustomer(client.name)
    setRecipient(client.contactName || client.managerName || client.ceoName || '')
    setPhone(client.phone || client.mobile || '')
    setAddress([client.address, client.addressDetail].filter(Boolean).join(' '))
    setClientPickerOpen(false)
  }

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
    <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded bg-white shadow-2xl dark:bg-gray-900">
      <div className="flex items-center justify-between border-b px-5 py-4 dark:border-gray-800">
        <div><h3 className="font-bold">{order ? '출고 주문 수정' : '주문수집'}</h3><p className="text-xs text-gray-400">모든 주문 수량은 OUT 단위입니다</p></div>
        <button onClick={onClose}>닫기</button>
      </div>
      <div className="space-y-4 overflow-y-auto p-5">
        <div className="grid grid-cols-2 divide-x divide-gray-200 rounded border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
          <div className="space-y-3 p-4">
            <p className="text-xs font-bold text-[var(--color-primary)] dark:text-emerald-400">출고 / 거래처</p>
            <Field label="출고 구분 *"><select value={orderType} onChange={(e) => setOrderType(e.target.value as OutboundOrderType)}
              className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
              <option value="EXTERNAL">외부 출고</option><option value="INTERNAL">내부 출고</option>
            </select></Field>
            <div className="relative">
              <Field label="거래처 *"><div className="relative">
                <input
                  value={customer}
                  onChange={(e) => {
                    setCustomer(e.target.value)
                    setClientId('')
                  }}
                  placeholder="거래처명을 입력하거나 돋보기를 누르세요"
                  autoComplete="off"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setClientPickerOpen(true)}
                  title="전체 거래처 보기"
                  aria-label="전체 거래처 보기"
                  className="wms-icon-button absolute right-1 top-1/2 mt-0.5 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded"
                >
                  <Search size={14} />
                </button>
              </div></Field>
              {!!customer.trim() && !clientId && clientCandidates.length > 0 && <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded border bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                {clientCandidates.map((client) => <button key={client.id} onClick={() => selectClient(client)} className="flex w-full justify-between px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
                  <span>{client.name}</span><span className="text-xs text-gray-400">{client.businessNo || ''}</span>
                </button>)}
              </div>}
            </div>
            <Field label="수집 채널"><input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="전화, 네이버, 엑셀 등" /></Field>
            <Field label="외부 주문번호"><input value={externalOrderNo} onChange={(e) => setExternalOrderNo(e.target.value)} /></Field>
          </div>
          <div className="space-y-3 p-4">
            <p className="text-xs font-bold text-[var(--color-primary)] dark:text-emerald-400">배송 정보</p>
            <Field label="수령인"><input value={recipient} onChange={(e) => setRecipient(e.target.value)} /></Field>
            <Field label="연락처"><input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            <Field label="주소"><div className="relative">
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="주소를 입력하거나 검색하세요" className="pr-20" />
              <button type="button" onClick={openAddressSearch} className="wms-icon-button absolute right-1 top-1/2 mt-0.5 inline-flex h-7 items-center gap-1 -translate-y-1/2 rounded px-2 text-xs" title="주소 검색">
                <Search size={13} /> 검색
              </button>
            </div></Field>
            <Field label="주문일"><input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} /></Field>
            <Field label="출고 요청일"><input type="date" value={requestedShipDate} onChange={(e) => setRequestedShipDate(e.target.value)} /></Field>
          </div>
        </div>
        <Field label="메모"><input value={memo} onChange={(e) => setMemo(e.target.value)} /></Field>
        <div className="relative">
          <Field label="상품 추가"><input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="상품명 또는 코드 검색" /></Field>
          {!!productSearch.trim() && <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded border bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
            {isProductFetching && !products ? (
              <p className="px-4 py-3 text-center text-sm text-gray-400">상품 조회 중...</p>
            ) : isProductError ? (
              <p className="px-4 py-3 text-center text-sm text-red-500">{productError instanceof Error ? productError.message : '상품을 조회하지 못했습니다.'}</p>
            ) : candidates.length > 0 ? candidates.map((product) => <button key={product.id} type="button" onClick={() => { setItems((prev) => [...prev, { productId: product.id, boxCount: 1, product }]); setProductSearch('') }}
              className="flex w-full justify-between px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
              <span>{product.name}</span><span className="font-mono text-xs text-gray-400">{product.code}</span>
            </button>) : (
              <p className="px-4 py-3 text-center text-sm text-gray-400">일치하는 활성 상품이 없습니다.</p>
            )}
          </div>}
        </div>
        <div className="overflow-hidden rounded border dark:border-gray-800">
          <table className="w-full text-sm"><thead className="bg-gray-50 dark:bg-gray-800"><tr>
            <th className="p-2 text-left">상품</th><th className="p-2">기본위치</th><th className="p-2">OUT수량</th><th className="w-10"></th>
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
                className="w-20 rounded-lg border px-2 py-1 text-right dark:border-gray-700 dark:bg-gray-800" /><b>OUT</b></div></td>
              <td><button onClick={() => setItems((prev) => prev.filter((row) => row.productId !== item.productId))} className="text-gray-400 hover:text-red-500">닫기</button></td>
            </tr>)}
          </tbody></table>
        </div>
      </div>
      <div className="flex items-center justify-between border-t px-5 py-4 dark:border-gray-800">
        <b className="text-[#D2691E]">합계 {formatNumber(totalOUTes)} OUT</b>
        <div className="flex gap-2"><button onClick={onClose} className="rounded border px-4 py-2 text-sm">취소</button>
          <button onClick={submit} disabled={save.isPending} className="flex items-center gap-1.5 rounded bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {order ? '수정 저장' : '수집 저장'}
          </button></div>
      </div>
    </div>
    {clientPickerOpen && createPortal(
      <ClientLookupDialog onClose={() => setClientPickerOpen(false)} onSelect={selectClient} />,
      document.body,
    )}
  </div>
}

function ClientLookupDialog({ onClose, onSelect }: { onClose: () => void; onSelect: (client: Client) => void }) {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { data, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['clients-picker', search, page],
    queryFn: () => fetchClientPage(search, page),
    refetchOnMount: 'always',
    retry: 2,
  })
  const commitSearch = () => {
    setSearch(searchInput.trim())
    setPage(1)
  }

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
    <div className="flex max-h-[75vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-gray-900" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-center justify-between border-b px-4 py-3 dark:border-gray-700">
        <div><h4 className="text-sm font-bold">거래처 선택</h4><p className="text-xs text-gray-400">전체 {formatNumber(data?.total ?? 0)}개</p></div>
        <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white">닫기</button>
      </div>
      <div className="flex gap-2 border-b p-3 dark:border-gray-700">
        <input autoFocus value={searchInput} onChange={(event) => setSearchInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') commitSearch() }} placeholder="거래처명, 전화번호, 사업자번호 검색" className="min-w-0 flex-1 rounded border px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)] dark:border-gray-700 dark:bg-gray-800" />
        <button type="button" onClick={commitSearch} className="wms-primary-button inline-flex items-center gap-1 rounded px-4 text-sm font-semibold"><Search size={14} /> 검색</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isError ? <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-red-500">
          <p>{error instanceof Error ? error.message : getApiErrorMessage(error, '거래처 목록을 불러오지 못했습니다.')}</p>
          <button type="button" onClick={() => void refetch()} className="rounded border border-red-200 px-3 py-1.5 text-xs font-semibold hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30">다시 조회</button>
        </div> : isFetching && !data ? <p className="py-10 text-center text-sm text-gray-400">조회 중...</p> : data?.items.length ? data.items.map((client) => (
          <button key={client.id} type="button" onClick={() => onSelect(client)} className="flex w-full items-center justify-between gap-4 border-b px-4 py-3 text-left hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800">
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{client.name}</p><p className="truncate text-xs text-gray-400">{client.phone || client.mobile || '연락처 없음'}</p></div>
            <span className="shrink-0 font-mono text-xs text-gray-400">{client.businessNo || '-'}</span>
          </button>
        )) : <p className="py-10 text-center text-sm text-gray-400">검색 결과가 없습니다.</p>}
      </div>
      <div className="flex items-center justify-between border-t px-4 py-3 text-xs dark:border-gray-700">
        <span className="text-gray-400">{data?.page ?? page} / {Math.max(1, data?.totalPages ?? 1)} 페이지</span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1 || isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded border px-3 py-1.5 disabled:opacity-40 dark:border-gray-700">이전</button>
          <button type="button" disabled={page >= (data?.totalPages ?? 1) || isFetching} onClick={() => setPage((value) => value + 1)} className="rounded border px-3 py-1.5 disabled:opacity-40 dark:border-gray-700">다음</button>
        </div>
      </div>
    </div>
  </div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{label}
    <div className="[&_input]:mt-1 [&_input]:w-full [&_input]:rounded [&_input]:border [&_input]:border-gray-200 [&_input]:px-3 [&_input]:py-2 [&_input]:text-sm [&_input]:outline-none [&_input]:focus:border-[var(--color-primary)] dark:[&_input]:border-gray-700 dark:[&_input]:bg-gray-800">{children}</div>
  </label>
}
