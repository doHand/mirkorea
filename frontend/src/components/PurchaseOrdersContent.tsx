'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { purchaseOrderApi, type PurchaseOrderRequest } from '@/api/purchase-order.api'
import { productApi } from '@/api/product.api'
import { clientApi } from '@/api/client.api'
import { userApi } from '@/api/user.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { cn } from '@/utils/cn'
import * as ui from '@/styles/ui'
import type { Product, PurchaseOrder, PurchaseOrderStatus } from '@/types/api.types'
import { printPurchaseOrder } from '@/utils/printPurchaseOrder'
import { StatusBadge } from '@/components/StatusBadge'
import { ActionDropdown } from '@/components/ActionDropdown'

const STATUS: Record<PurchaseOrderStatus, string> = {
  DRAFT: '작성 중', ORDERED: '발주 완료', CONVERTED: '입고예정 등록', CANCELLED: '취소',
}

const STATUS_VARIANT: Record<PurchaseOrderStatus, 'gray' | 'orange' | 'emerald' | 'red'> = {
  DRAFT:     'gray',
  ORDERED:   'orange',
  CONVERTED: 'emerald',
  CANCELLED: 'red',
}

const today = () => new Date().toISOString().slice(0, 10)

interface Props {
  createTrigger?: number
}

export function PurchaseOrdersContent({ createTrigger }: Props) {
  const router = useRouter()
  const qc = useQueryClient()
  const warehouse = useWarehouseStore((s) => s.selectedWarehouse)
  const [search, setSearch]         = useState('')
  const [status, setStatus]         = useState<PurchaseOrderStatus | ''>('')
  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')
  const [editing, setEditing]       = useState<PurchaseOrder | null | undefined>(undefined)
  const [printByDateOpen, setPrintByDateOpen] = useState(false)

  useEffect(() => {
    if (router.query.create !== '1') return
    setEditing(null)
    router.replace('/quotes?tab=PURCHASE', undefined, { shallow: true })
  }, [router, router.query.create])

  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    if (!createTrigger) return
    setEditing(null)
  }, [createTrigger])

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.purchaseOrders({ warehouseId: warehouse?.id, status, search }),
    queryFn: () => purchaseOrderApi.findAll({ warehouseId: warehouse!.id, status: status || undefined, search: search || undefined }),
    enabled: !!warehouse,
  })
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-all'],
    queryFn: clientApi.findAllActive,
  })
  const rawOrders = data?.items ?? []

  // 날짜 범위 클라이언트 사이드 필터
  const orders = useMemo(() => {
    return rawOrders.filter((o) => {
      if (dateFrom && o.orderDate < dateFrom) return false
      if (dateTo && o.orderDate > dateTo) return false
      return true
    })
  }, [rawOrders, dateFrom, dateTo])

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

  const handleReset = () => {
    setSearch('')
    setStatus('')
    setDateFrom('')
    setDateTo('')
  }

  const handleExcelDownload = () => {
    const header = ['발주번호', '공급업체', '발주일', '납기예정일', '품목수', '총금액', '상태']
    const rows = orders.map((o) => [
      o.orderNo,
      o.supplier || '',
      o.orderDate,
      o.expectedDate || '',
      String(o.items.length),
      String(calcTotal(o)),
      STATUS[o.status],
    ])
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `발주서_${today()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!warehouse) return <div className="py-20 text-center text-gray-400">창고를 먼저 선택하세요</div>

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* 필터 영역 */}
      <div className="border border-[#d8ddd8] bg-white p-3 shadow-sm dark:bg-gray-900 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {/* 날짜 범위 */}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-[#2D4033]"
          />
          <span className="text-xs text-gray-400">~</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-[#2D4033]"
          />

          {/* 공급업체 검색 */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="발주번호 또는 공급업체 검색"
            className="min-w-48 flex-1 border border-gray-200 dark:border-gray-700 py-2 pl-3 pr-3 text-sm outline-none focus:border-[#2D4033] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />

          {/* 상태 필터 */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as PurchaseOrderStatus | '')}
            className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-[#2D4033]"
          >
            <option value="">전체 상태</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>

          {/* 버튼 그룹 */}
          <button
            onClick={() => {/* 서버 필터는 status/search로 이미 적용됨 */}}
            className="bg-[#2D4033] text-white px-4 py-2 text-sm font-semibold hover:bg-[#24352a]"
          >
            검색
          </button>
          <button
            onClick={handleReset}
            className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            초기화
          </button>

          <ActionDropdown
            label="출력"
            items={[
              {
                label: '날짜별 일괄 출력',
                onClick: () => setPrintByDateOpen(true),
              },
              {
                label: '엑셀 다운로드',
                onClick: handleExcelDownload,
              },
            ]}
          />

          <span className="text-xs text-gray-400 self-center ml-1">총 {orders.length}건</span>
        </div>
      </div>

      {/* 테이블 */}
      <div className="flex min-h-0 flex-1 flex-col border border-[#d8ddd8] bg-white shadow-sm dark:bg-gray-900">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className={ui.thead}>
                <th className={cn(ui.th, 'text-left')}>발주번호</th>
                <th className={cn(ui.th, 'text-left')}>공급업체</th>
                <th className={ui.th}>발주일</th>
                <th className={ui.th}>납기예정일</th>
                <th className={ui.th}>품목</th>
                <th className={ui.thR}>총금액</th>
                <th className={ui.th}>상태</th>
                <th className={ui.th}>작업</th>
              </tr>
            </thead>
            <tbody className={ui.tbody}>
              {isLoading && (
                <tr><td colSpan={8} className="py-12 text-center text-gray-400">로딩 중...</td></tr>
              )}
              {!isLoading && orders.length === 0 && (
                <tr><td colSpan={8} className="py-12 text-center text-gray-400">작성된 발주서가 없습니다</td></tr>
              )}
              {orders.map((o) => (
                <tr key={o.id} className={cn(ui.tr, 'cursor-pointer')} onDoubleClick={() => setEditing(o)}>
                  <td className="px-3 py-3 font-mono font-semibold text-[#2D4033] dark:text-emerald-400 text-xs">{o.orderNo}</td>
                  <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{o.supplier || '-'}</td>
                  <td className="px-3 py-3 text-center text-gray-500 dark:text-gray-400">{o.orderDate}</td>
                  <td className="px-3 py-3 text-center text-gray-500 dark:text-gray-400">{o.expectedDate || '-'}</td>
                  <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-400">{o.items.length}종</td>
                  <td className="px-3 py-3 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                    {calcTotal(o).toLocaleString()}원
                  </td>
                  <td className="px-3 py-3 text-center">
                    <StatusBadge label={STATUS[o.status]} variant={STATUS_VARIANT[o.status]} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-center gap-1">
                      <button
                        title="출력"
                        onClick={(e) => { e.stopPropagation(); printPurchaseOrder(o, clients.find((c) => c.id === o.clientId) ?? clients.find((c) => c.name === o.supplier)) }}
                        className={ui.btnIconPrint}
                      >
                        출력
                      </button>
                      {(o.status === 'DRAFT' || o.status === 'ORDERED') && (
                        <button title="수정" onClick={(e) => { e.stopPropagation(); setEditing(o) }} className={ui.btnIconEdit}>
                          수정
                        </button>
                      )}
                      {o.status === 'DRAFT' && (
                        <button title="발주 완료" onClick={(e) => { e.stopPropagation(); action.mutate({ kind: 'ordered', id: o.id }) }} className={ui.btnIconEdit}>
                          발주완료
                        </button>
                      )}
                      {o.status === 'ORDERED' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); action.mutate({ kind: 'convert', id: o.id }) }}
                          className="flex items-center gap-1 bg-[#D2691E] px-2 py-1 text-xs font-semibold text-white hover:bg-[#b85b19]"
                        >
                          입고예정
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing !== undefined && (
        <OrderModal
          warehouseId={warehouse.id}
          order={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => { setEditing(undefined); refresh() }}
        />
      )}

      {printByDateOpen && (
        <PrintByDateModal
          orders={rawOrders}
          clients={clients}
          onClose={() => setPrintByDateOpen(false)}
        />
      )}
    </div>
  )
}

const calcTotal = (o: PurchaseOrder) => o.items.reduce((sum, i) => sum + Number(i.unitPrice || 0) * i.quantity, 0)

// ── PrintByDateModal ──────────────────────────────────────────────────────────

function PrintByDateModal({ orders, clients, onClose }: {
  orders: PurchaseOrder[]
  clients: { id: string; name: string; phone?: string; mobile?: string; fax?: string }[]
  onClose: () => void
}) {
  const [printDate, setPrintDate]       = useState(today())
  const [splitByClient, setSplitByClient] = useState(false)

  const filtered = useMemo(() =>
    orders.filter((o) => o.orderDate === printDate),
    [orders, printDate],
  )

  const handlePrint = () => {
    if (!filtered.length) {
      toast.error('해당 날짜의 발주서가 없습니다')
      return
    }
    const toPrint = splitByClient
      ? filtered.slice().sort((a, b) => (a.supplier || '').localeCompare(b.supplier || ''))
      : filtered
    toPrint.forEach((o) => {
      printPurchaseOrder(o, clients.find((c) => c.id === o.clientId) ?? clients.find((c) => c.name === o.supplier))
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-sm bg-white shadow-2xl dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-5 py-4">
          <h3 className="font-bold text-gray-900 dark:text-white text-sm">날짜별 일괄 출력</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">닫기</button>
        </div>

        {/* 본문 */}
        <div className="space-y-4 p-5">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
            발주일 선택
            <input
              type="date"
              value={printDate}
              onChange={(e) => setPrintDate(e.target.value)}
              className="mt-1 w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-[#2D4033] text-gray-900 dark:text-gray-100"
            />
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={splitByClient}
              onChange={(e) => setSplitByClient(e.target.checked)}
              className="h-4 w-4 accent-[#2D4033]"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">거래처별 구분 출력</span>
          </label>

          <p className="text-xs text-gray-400">
            {printDate ? `${printDate} 기준 발주서 ${filtered.length}건` : '날짜를 선택하세요'}
          </p>
        </div>

        {/* 푸터 */}
        <div className="flex justify-end gap-2 border-t border-gray-100 dark:border-gray-700 px-5 py-4">
          <button onClick={onClose} className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
            취소
          </button>
          <button
            onClick={handlePrint}
            disabled={!filtered.length}
            className="bg-[#2D4033] px-5 py-2 text-sm font-semibold text-white hover:bg-[#24352a] disabled:opacity-50"
          >
            출력 ({filtered.length}건)
          </button>
        </div>
      </div>
    </div>
  )
}

// ── OrderModal ────────────────────────────────────────────────────────────────

function OrderModal({ warehouseId, order, onClose, onSaved }: {
  warehouseId: string
  order: PurchaseOrder | null
  onClose: () => void
  onSaved: () => void
}) {
  const [supplier, setSupplier]         = useState(order?.supplier ?? '')
  const [orderDate, setOrderDate]       = useState(order?.orderDate ?? today())
  const [expectedDate, setExpectedDate] = useState(order?.expectedDate ?? '')
  const [manager, setManager]           = useState(order?.manager ?? '')
  const [phone, setPhone]               = useState(order?.phone ?? '')
  const [fax, setFax]                   = useState(order?.fax ?? '')
  const [memo, setMemo]                 = useState(order?.memo ?? '')
  const [clientId, setClientId]         = useState(order?.clientId ?? '')
  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const [items, setItems] = useState(
    (order?.items ?? []).map((i) => ({
      productId: i.productId, product: i.product, boxCount: i.boxCount ?? 0,
      quantity: i.quantity, capSize: i.capSize ?? '', unitPrice: Number(i.unitPrice || 0),
    }))
  )

  const { data: clients = [] } = useQuery({ queryKey: ['clients-all'], queryFn: clientApi.findAllActive })
  const { data: staff = [] }   = useQuery({ queryKey: ['users', 'staff'], queryFn: userApi.findStaff })

  useEffect(() => {
    if (clientId || !order?.supplier) return
    const matched = clients.find((c) => c.name === order.supplier)
    if (matched) setClientId(matched.id)
  }, [clientId, clients, order?.supplier])

  useEffect(() => {
    if (!clientId) return
    const client = clients.find((c) => c.id === clientId)
    if (!client) return
    setSupplier(client.name)
    setPhone(client.phone || client.mobile || '')
    setFax(client.fax || '')
  }, [clientId, clients])

  const save = useMutation({
    mutationFn: (req: PurchaseOrderRequest) =>
      order ? purchaseOrderApi.update(order.id, req) : purchaseOrderApi.create(req),
    onSuccess: () => { toast.success('발주서를 저장했습니다'); onSaved() },
    onError: () => toast.error('저장에 실패했습니다'),
  })

  const totalBoxes = useMemo(() => items.reduce((sum, i) => sum + i.boxCount, 0), [items])
  const totalEa    = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items])
  const totalAmt   = useMemo(() => items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0), [items])

  const addProducts = (products: Product[]) => {
    const existing = new Set(items.map((i) => i.productId))
    const added = products
      .filter((p) => !existing.has(p.id))
      .map((p) => ({
        productId: p.id, product: p, boxCount: 1,
        quantity: Math.max(1, p.boxQty || 1), capSize: p.spec ?? '', unitPrice: Number(p.costPrice || 0),
      }))
    setItems([...items, ...added])
    setProductPickerOpen(false)
  }

  const selectClient = (id: string) => {
    setClientId(id)
    if (!id) { setSupplier(''); setPhone(''); setFax('') }
  }

  const submit = () => {
    if (!clientId || !supplier.trim()) return toast.error('거래처를 선택하세요')
    if (!manager) return toast.error('담당 직원을 선택하세요')
    if (!items.length) return toast.error('품목을 추가하세요')
    save.mutate({
      warehouseId, clientId, supplier, orderDate,
      expectedDate: expectedDate || undefined,
      manager: manager || undefined, phone: phone || undefined,
      fax: fax || undefined, memo: memo || undefined,
      items: items.map(({ productId, boxCount, quantity, capSize, unitPrice }) => ({
        productId, boxCount, quantity, capSize: capSize || undefined, unitPrice,
      })),
    })
  }

  const fieldCls = 'mt-1 w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-[#2D4033] text-gray-900 dark:text-gray-100'
  const sectionTitle = (title: string) => (
    <p className="text-xs font-semibold text-gray-500 pb-1 mb-3 border-b border-gray-100">{title}</p>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col bg-white shadow-2xl dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-5 py-4 shrink-0">
          <h3 className="font-bold text-gray-900 dark:text-white">{order ? '발주서 수정' : '발주서 작성'}</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">
            닫기
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 space-y-6 overflow-y-auto p-5">

          {/* 섹션 1. 기본 정보 */}
          <div>
            {sectionTitle('기본 정보')}
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                거래처 선택
                <select value={clientId} onChange={(e) => selectClient(e.target.value)} className={fieldCls}>
                  <option value="">거래처를 선택하세요</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                업체명
                <input value={supplier} readOnly placeholder="거래처 선택 시 자동 입력" className={fieldCls} />
              </label>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                발주일
                <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className={fieldCls} />
              </label>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                납기예정일
                <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className={fieldCls} />
              </label>
            </div>
          </div>

          {/* 섹션 2. 담당자 정보 */}
          <div>
            {sectionTitle('담당자 정보')}
            <div className="grid gap-3 md:grid-cols-3">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                담당자
                <select value={manager} onChange={(e) => setManager(e.target.value)} className={fieldCls}>
                  <option value="">우리 직원 선택</option>
                  {manager && !staff.some((u) => u.fullName === manager) && <option value={manager}>{manager}</option>}
                  {staff.filter((u) => u.isActive).map((u) => <option key={u.id} value={u.fullName}>{u.fullName}</option>)}
                </select>
              </label>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                전화번호
                <input value={phone} readOnly placeholder="거래처 전화번호" className={fieldCls} />
              </label>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                팩스
                <input value={fax} readOnly placeholder="거래처 팩스번호" className={fieldCls} />
              </label>
            </div>
          </div>

          {/* 섹션 3. 품목 */}
          <div>
            {sectionTitle('품목')}

            {/* 상품 추가 버튼 */}
            <div className="flex items-center justify-between border border-[#d8ddd8] bg-[#f7f8f5] dark:bg-gray-800/40 px-4 py-3 mb-3">
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">발주 제품</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">상품 마스터에 등록된 제품을 불러옵니다</p>
              </div>
              <button
                type="button"
                onClick={() => setProductPickerOpen(true)}
                className="flex items-center gap-2 bg-[#2D4033] px-3 py-2 text-sm font-semibold text-white hover:bg-[#24352a]"
              >
                등록 상품 불러오기
              </button>
            </div>

            {/* 품목 테이블 */}
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700">
              <table className="w-full min-w-[820px] text-sm">
                <thead className={ui.thead}>
                  <tr>
                    <th className={cn(ui.th, 'text-left')}>상품명/규격</th>
                    <th className={ui.th}>BOX수</th>
                    <th className={ui.th}>EA수량</th>
                    <th className={ui.th}>규격/호환</th>
                    <th className={ui.thR}>단가</th>
                    <th className={ui.thR}>소계</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className={ui.tbody}>
                  {items.length === 0 && (
                    <tr><td colSpan={7} className="py-8 text-center text-gray-400 text-sm">품목을 추가하세요</td></tr>
                  )}
                  {items.map((item, idx) => (
                    <tr key={item.productId} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{item.product?.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{item.product?.code}</p>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="number" min={0} value={item.boxCount}
                          onChange={(e) => setItems(items.map((x, n) => n === idx ? { ...x, boxCount: Math.max(0, Number(e.target.value)) } : x))}
                          className="w-20 border border-gray-200 dark:border-gray-700 px-2 py-1 text-sm text-right bg-white dark:bg-gray-800 outline-none focus:border-[#2D4033]"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="number" min={1} value={item.quantity}
                          onChange={(e) => setItems(items.map((x, n) => n === idx ? { ...x, quantity: Math.max(1, Number(e.target.value)) } : x))}
                          className="w-20 border border-gray-200 dark:border-gray-700 px-2 py-1 text-sm text-right bg-white dark:bg-gray-800 outline-none focus:border-[#2D4033]"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={item.capSize}
                          onChange={(e) => setItems(items.map((x, n) => n === idx ? { ...x, capSize: e.target.value } : x))}
                          placeholder="규격/호환"
                          className="w-full border border-gray-200 dark:border-gray-700 px-2 py-1 text-sm bg-white dark:bg-gray-800 outline-none focus:border-[#2D4033]"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number" min={0} value={item.unitPrice}
                          onChange={(e) => setItems(items.map((x, n) => n === idx ? { ...x, unitPrice: Math.max(0, Number(e.target.value)) } : x))}
                          className="w-24 border border-gray-200 dark:border-gray-700 px-2 py-1 text-sm text-right bg-white dark:bg-gray-800 outline-none focus:border-[#2D4033]"
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-sm tabular-nums text-gray-700 dark:text-gray-300">
                        {(item.unitPrice * item.quantity).toLocaleString()}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => setItems(items.filter((_, n) => n !== idx))}
                          className="p-1 text-gray-400 hover:text-red-500"
                          title="삭제"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 섹션 4. 메모 */}
          <div>
            {sectionTitle('메모')}
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="발주 관련 메모"
              rows={3}
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-[#2D4033] text-gray-900 dark:text-gray-100 resize-none"
            />
          </div>
        </div>

        {/* 푸터 — 하단 고정 */}
        <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 px-5 py-4 shrink-0">
          <span className="text-sm font-semibold text-[#D2691E]">
            총 BOX {totalBoxes.toLocaleString()}박스&nbsp;|&nbsp;EA {totalEa.toLocaleString()}개&nbsp;|&nbsp;합계 {totalAmt.toLocaleString()}원
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">닫기</button>
            <button onClick={submit} disabled={save.isPending} className="bg-[#2D4033] px-5 py-2 text-sm font-semibold text-white hover:bg-[#24352a] disabled:opacity-50">
              {save.isPending ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>

        {productPickerOpen && (
          <ProductPicker
            existingIds={items.map((i) => i.productId)}
            onClose={() => setProductPickerOpen(false)}
            onAdd={addProducts}
          />
        )}
      </div>
    </div>
  )
}

// ── ProductPicker ─────────────────────────────────────────────────────────────

function ProductPicker({ existingIds, onClose, onAdd }: {
  existingIds: string[]
  onClose: () => void
  onAdd: (products: Product[]) => void
}) {
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.products({ search, picker: true }),
    queryFn: () => productApi.findAll({ search: search || undefined, limit: 100 }),
  })
  const products = data?.items ?? []
  const existing = new Set(existingIds)
  const toggle = (id: string) =>
    setSelected((curr) => curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id])
  const selectedProducts = products.filter((p) => selected.includes(p.id))

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4">
      <div className="flex max-h-[82vh] w-full max-w-4xl flex-col bg-white shadow-2xl dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-5 py-3 shrink-0">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-sm">등록 상품 불러오기</h3>
            <p className="mt-0.5 text-xs text-gray-500">추가할 상품을 여러 개 선택할 수 있습니다</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">
            닫기
          </button>
        </div>
        <div className="border-b border-gray-100 dark:border-gray-700 p-3 shrink-0">
          <div className="relative">
            <input
              autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="상품명, 상품코드, 자재번호, 거래처 검색"
              className="w-full border border-gray-200 dark:border-gray-700 py-2 pl-3 pr-3 text-sm outline-none focus:border-[#2D4033] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="sticky top-0">
              <tr className={ui.thead}>
                <th className="w-14 px-3 py-2" />
                <th className={cn(ui.th, 'text-left')}>상품코드</th>
                <th className={cn(ui.th, 'text-left')}>제품명</th>
                <th className={cn(ui.th, 'text-left')}>거래처</th>
                <th className={ui.th}>박스당 EA</th>
                <th className={cn(ui.th, 'text-left')}>규격/캡사이즈</th>
              </tr>
            </thead>
            <tbody className={ui.tbody}>
              {isLoading && <tr><td colSpan={6} className="py-12 text-center text-gray-400">상품을 불러오는 중...</td></tr>}
              {!isLoading && products.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-gray-400">등록된 상품이 없습니다</td></tr>}
              {products.map((product) => {
                const alreadyAdded = existing.has(product.id)
                const checked = selected.includes(product.id)
                return (
                  <tr
                    key={product.id}
                    onClick={() => !alreadyAdded && toggle(product.id)}
                    className={cn(
                      'transition-colors',
                      alreadyAdded ? 'bg-gray-50 dark:bg-gray-800/20 text-gray-400' : 'cursor-pointer hover:bg-[#f4f7f3] dark:hover:bg-gray-800/30',
                      checked && 'bg-[#edf0ec] dark:bg-[#2D4033]/20',
                    )}
                  >
                    <td className="px-3 py-2 text-center">
                      <span className={cn(
                        'inline-flex h-5 w-5 items-center justify-center border',
                        checked ? 'border-[#2D4033] bg-[#2D4033] text-white' : 'border-gray-300',
                      )}>
                        {checked && <span>✓</span>}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-[#2D4033] dark:text-emerald-400">{product.code}</td>
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                      {product.name}
                      {alreadyAdded && <span className="ml-2 text-xs text-[#D2691E]">추가됨</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{product.client?.name || '-'}</td>
                    <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-400">{product.boxQty?.toLocaleString() || 1}</td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{product.spec || '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 px-5 py-3 shrink-0">
          <span className="text-sm font-semibold text-[#2D4033] dark:text-emerald-400">{selected.length}개 선택</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">취소</button>
            <button
              type="button"
              disabled={!selected.length}
              onClick={() => onAdd(selectedProducts)}
              className="bg-[#D2691E] px-5 py-2 text-sm font-semibold text-white hover:bg-[#b85b19] disabled:opacity-40"
            >
              선택 상품 추가
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
