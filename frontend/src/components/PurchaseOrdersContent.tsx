'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { purchaseOrderApi, type PurchaseOrderRequest } from '@/api/purchase-order.api'
import { clientApi } from '@/api/client.api'
import { userApi } from '@/api/user.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { cn } from '@/utils/cn'
import * as ui from '@/styles/ui'
import type { Product, PurchaseOrder, PurchaseOrderStatus } from '@/types/api.types'
import { printPurchaseOrder } from '@/utils/printPurchaseOrder'
import { StatusBadge } from '@/components/StatusBadge'
import { ActionDropdown } from '@/components/ActionDropdown'
import { AppAgGrid } from '@/components/AppAgGrid'
import { ProductPickerModal } from '@/components/ProductPickerModal'
import type { ColDef } from 'ag-grid-community'

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

  const orderColumns = useMemo<ColDef<PurchaseOrder>[]>(() => [
    {
      headerName: '발주번호',
      field: 'orderNo',
      width: 150,
      cellClass: 'font-mono text-xs font-semibold text-[var(--color-primary)]',
    },
    {
      headerName: '공급업체',
      minWidth: 180,
      flex: 1,
      valueGetter: (p) => p.data?.supplier || '-',
      cellRenderer: (p: { data?: PurchaseOrder }) => (
        <div className="flex h-full min-w-0 flex-col justify-center leading-tight">
          <span className="truncate font-medium text-gray-800 dark:text-gray-100">{p.data?.supplier || '-'}</span>
          {p.data?.memo && <span className="truncate text-xs text-gray-400">{p.data.memo}</span>}
        </div>
      ),
    },
    { headerName: '발주일', field: 'orderDate', width: 115 },
    { headerName: '납기예정일', field: 'expectedDate', width: 125, valueGetter: (p) => p.data?.expectedDate || '-' },
    {
      headerName: '품목',
      width: 95,
      valueGetter: (p) => p.data?.items.length ?? 0,
      valueFormatter: (p) => `${p.value ?? 0}종`,
    },
    {
      headerName: '총금액',
      width: 135,
      type: 'rightAligned',
      valueGetter: (p) => p.data ? calcTotal(p.data) : 0,
      valueFormatter: (p) => `${Number(p.value ?? 0).toLocaleString()}원`,
      cellClass: 'font-semibold tabular-nums',
    },
    {
      headerName: '상태',
      width: 125,
      valueGetter: (p) => p.data ? STATUS[p.data.status] : '',
      cellRenderer: (p: { data?: PurchaseOrder }) => p.data ? (
        <StatusBadge label={STATUS[p.data.status]} variant={STATUS_VARIANT[p.data.status]} />
      ) : '-',
    },
    {
      headerName: '작업',
      width: 260,
      sortable: false,
      filter: false,
      cellRenderer: (p: { data?: PurchaseOrder }) => {
        if (!p.data) return '-'
        const order = p.data
        const client = clients.find((c) => c.id === order.clientId) ?? clients.find((c) => c.name === order.supplier)
        return (
          <div className="flex h-full items-center gap-1">
            <button
              type="button"
              title="출력"
              onClick={(e) => { e.stopPropagation(); printPurchaseOrder(order, client) }}
              className="rounded border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
            >
              출력
            </button>
            {(order.status === 'DRAFT' || order.status === 'ORDERED') && (
              <button
                type="button"
                title="수정"
                onClick={(e) => { e.stopPropagation(); setEditing(order) }}
                className="rounded border border-indigo-200 px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
              >
                수정
              </button>
            )}
            {order.status === 'DRAFT' && (
              <button
                type="button"
                title="발주 완료"
                onClick={(e) => { e.stopPropagation(); action.mutate({ kind: 'ordered', id: order.id }) }}
                className="rounded border border-amber-200 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-950/40"
              >
                발주완료
              </button>
            )}
            {order.status === 'ORDERED' && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); action.mutate({ kind: 'convert', id: order.id }) }}
                className="rounded bg-[#D2691E] px-2 py-1 text-xs font-semibold text-white hover:bg-[#b85b19]"
              >
                입고예정
              </button>
            )}
          </div>
        )
      },
    },
  ], [clients])

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
            className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-[var(--color-primary)]"
          />
          <span className="text-xs text-gray-400">~</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-[var(--color-primary)]"
          />

          {/* 공급업체 검색 */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="발주번호 또는 공급업체 검색"
            className="min-w-48 flex-1 border border-gray-200 dark:border-gray-700 py-2 pl-3 pr-3 text-sm outline-none focus:border-[var(--color-primary)] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />

          {/* 상태 필터 */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as PurchaseOrderStatus | '')}
            className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-[var(--color-primary)]"
          >
            <option value="">전체 상태</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>

          {/* 버튼 그룹 */}
          <button
            onClick={() => {/* 서버 필터는 status/search로 이미 적용됨 */}}
            className="bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-semibold hover:bg-[var(--color-primary-hover)]"
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
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="min-h-0 flex-1">
          <AppAgGrid
            rows={orders}
            columns={orderColumns}
            loading={isLoading}
            onRowDoubleClicked={setEditing}
          />
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
  useEscapeKey(onClose)
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
              className="mt-1 w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)] text-gray-900 dark:text-gray-100"
            />
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkOUT"
              checked={splitByClient}
              onChange={(e) => setSplitByClient(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-primary)]"
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
            className="bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
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
  useEscapeKey(onClose, !productPickerOpen)
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

  const totalOUTes = useMemo(() => items.reduce((sum, i) => sum + i.boxCount, 0), [items])
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

  const fieldCls = 'mt-1 w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)] text-gray-900 dark:text-gray-100'
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
                className="flex items-center gap-2 bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
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
                    <th className={ui.th}>OUT수</th>
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
                          className="w-20 border border-gray-200 dark:border-gray-700 px-2 py-1 text-sm text-right bg-white dark:bg-gray-800 outline-none focus:border-[var(--color-primary)]"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="number" min={1} value={item.quantity}
                          onChange={(e) => setItems(items.map((x, n) => n === idx ? { ...x, quantity: Math.max(1, Number(e.target.value)) } : x))}
                          className="w-20 border border-gray-200 dark:border-gray-700 px-2 py-1 text-sm text-right bg-white dark:bg-gray-800 outline-none focus:border-[var(--color-primary)]"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={item.capSize}
                          onChange={(e) => setItems(items.map((x, n) => n === idx ? { ...x, capSize: e.target.value } : x))}
                          placeholder="규격/호환"
                          className="w-full border border-gray-200 dark:border-gray-700 px-2 py-1 text-sm bg-white dark:bg-gray-800 outline-none focus:border-[var(--color-primary)]"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number" min={0} value={item.unitPrice}
                          onChange={(e) => setItems(items.map((x, n) => n === idx ? { ...x, unitPrice: Math.max(0, Number(e.target.value)) } : x))}
                          className="w-24 border border-gray-200 dark:border-gray-700 px-2 py-1 text-sm text-right bg-white dark:bg-gray-800 outline-none focus:border-[var(--color-primary)]"
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
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)] text-gray-900 dark:text-gray-100 resize-none"
            />
          </div>
        </div>

        {/* 푸터 — 하단 고정 */}
        <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 px-5 py-4 shrink-0">
          <span className="text-sm font-semibold text-[#D2691E]">
            총 OUT {totalOUTes.toLocaleString()}OUT&nbsp;|&nbsp;EA {totalEa.toLocaleString()}개&nbsp;|&nbsp;합계 {totalAmt.toLocaleString()}원
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">닫기</button>
            <button onClick={submit} disabled={save.isPending} className="bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50">
              {save.isPending ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>

        {productPickerOpen && (
          <ProductPickerModal
            multiSelect
            existingIds={items.map((i) => i.productId)}
            title="등록 상품 불러오기"
            onClose={() => setProductPickerOpen(false)}
            onConfirm={addProducts}
          />
        )}
      </div>
    </div>
  )
}
