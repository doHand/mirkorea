'use client'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Package, Pencil, Trash2, Filter, X, FileText, Building2, QrCode, Star, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'
import { productApi, unitApi } from '@/api/product.api'
import { clientApi } from '@/api/client.api'
import { warehouseApi } from '@/api/warehouse.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { SALE_STATUS_LABEL } from '@/constants/stock.constants'
import { formatNumber, formatDateTime } from '@/utils/format'
import { cn } from '@/utils/cn'
import { ExportButton } from '@/components/ExportButton'
import { useRouter } from 'next/navigation'
import { ImportButton } from '@/components/ImportButton'
import { useAuthStore } from '@/stores/auth.store'
import { useMenuPermissionStore } from '@/stores/menu-permission.store'
import { useSupplierInfoStore } from '@/stores/supplier-info.store'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { printQuoteDocument } from '@/utils/printDocument'
import type { Product, SaleStatus, Barcode, ProductUnit, Client, Location, BarcodeUnitType } from '@/types/api.types'

const EMPTY_PRODUCT_FORM = {
  code: '',
  name: '',
  category: '',
  clientId:   '',
  locationId: '',
  unit: 'EA',
  spec: '',
  materialNo: '',
  boxQty: 1,
  safetyStock: 0,
  reorderPoint: 0,
  costPrice: 0,
  sellPrice: 0,
  priceA: 0,
  priceB: 0,
  priceC: 0,
  retailPrice: 0,
  memo: '',
  saleStatus: 'ACTIVE' as SaleStatus,
}

const PAGE_SIZE = 10

type ClientOption = Pick<Client, 'id' | 'name' | 'phone' | 'email'>

const STATUS_STYLE: Record<SaleStatus, string> = {
  ACTIVE:       'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800',
  INACTIVE:     'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-800',
  DISCONTINUED: 'bg-gray-100 text-gray-500 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700',
}

const getBoxStockQty = (product: Product) => {
  return product.stockQty ?? 0
}

const getEachStockQty = (product: Product) => {
  const qtyPerBox = product.boxQty > 0 ? product.boxQty : 1
  return qtyPerBox * getBoxStockQty(product)
}

const getPrimaryBarcode = (barcodes?: Barcode[]) => {
  if (!barcodes || barcodes.length === 0) return '-'
  const barcode = barcodes.find((b) => b.isPrimary && b.isActive) ?? barcodes.find((b) => b.isActive) ?? barcodes[0]
  return barcode.barcode
}

/* 공통 셀 border 클래스 */
const TH = 'px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide border-r border-gray-200 dark:border-gray-700 last:border-r-0 whitespace-nowrap'
const TD_BASE = 'px-3 py-3.5 border-r border-gray-200 dark:border-gray-700 last:border-r-0'
const TD_TEXT = cn(TD_BASE, 'text-left text-gray-700 dark:text-gray-300')
const TD_NUM  = cn(TD_BASE, 'text-right tabular-nums text-gray-900 dark:text-gray-100')
const TD_CTR  = cn(TD_BASE, 'text-center text-gray-700 dark:text-gray-300')

export default function ProductsPage() {
  const qc = useQueryClient()
  const me = useAuthStore((s) => s.user)
  const warehouse = useWarehouseStore((s) => s.selectedWarehouse)
    const router = useRouter()
  const menus = useMenuPermissionStore((s) => s.menus)
  const supplierInfo = useSupplierInfoStore((s) => s.info)
  const [searchInput, setSearchInput]  = useState('')
  const [search, setSearch]           = useState('')
  const [status, setStatus]           = useState<SaleStatus | ''>('')
  const [page, setPage]               = useState(1)
  const [showModal, setShowModal]     = useState(false)
  const [editing, setEditing]         = useState<Product | null>(null)
  const [form, setForm]               = useState(EMPTY_PRODUCT_FORM)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showClientPicker, setShowClientPicker] = useState(false)
  const [clientPickerSearch, setClientPickerSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [locationPickerSearch, setLocationPickerSearch] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [newBcVal, setNewBcVal]       = useState('')
  const [newBcType, setNewBcType]     = useState<BarcodeUnitType>('UNIT')
  const [newBcQty, setNewBcQty]       = useState(1)
  const [newBcPrimary, setNewBcPrimary] = useState(false)
  const [showAddBc, setShowAddBc]     = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.products({ search, status, page, limit: PAGE_SIZE }),
    queryFn:  () => productApi.findAll({ search: search || undefined, status: status as SaleStatus || undefined, page, limit: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  })

  const { data: units = [] } = useQuery<ProductUnit[]>({
    queryKey: ['product-units'],
    queryFn:  () => unitApi.findAll(),
    placeholderData: [],
  })

  const { data: barcodes = [], refetch: refetchBarcodes } = useQuery<Barcode[]>({
    queryKey: ['product-barcodes', editing?.id],
    queryFn:  () => productApi.findBarcodes(editing!.id),
    enabled:  !!editing?.id,
    placeholderData: [],
  })

  const addBarcodeMutation = useMutation({
    mutationFn: () => productApi.addBarcode(editing!.id, { barcode: newBcVal.trim(), type: newBcType, unitQty: newBcQty, isPrimary: newBcPrimary }),
    onSuccess: () => {
      refetchBarcodes()
      setNewBcVal(''); setNewBcType('UNIT'); setNewBcQty(1); setNewBcPrimary(false); setShowAddBc(false)
      toast.success('바코드가 등록되었습니다')
    },
    onError: () => toast.error('바코드 추가 실패 (중복 또는 오류)'),
  })

  const delBarcodeMutation = useMutation({
    mutationFn: (barcodeId: string) => productApi.deleteBarcode(editing!.id, barcodeId),
    onSuccess: () => { refetchBarcodes(); toast.success('바코드가 삭제되었습니다') },
  })

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients-all'],
    queryFn:  () => clientApi.findAllActive(),
    enabled:  showModal,
    placeholderData: [],
  })

  const { data: allLocations = [] } = useQuery<Location[]>({
    queryKey: ['locations-for-product-form', warehouse?.id],
    queryFn:  () => warehouseApi.findLocations(warehouse!.id),
    enabled:  showModal && !!warehouse?.id,
    placeholderData: [],
  })

  const filteredClients = useMemo(() => {
    const q = clientPickerSearch.trim().toLowerCase()
    if (!q) return clients.slice(0, 50)
    return clients.filter((c) =>
      [c.name, c.businessNo, c.phone, c.contactName, c.managerName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    )
  }, [clients, clientPickerSearch])

  const filteredLocations = useMemo(() => {
    const q = locationPickerSearch.trim().toLowerCase()
    if (!q) return allLocations.slice(0, 80)
    return allLocations.filter((l) =>
      [l.code, l.aisle, l.rack, l.shelf, l.bin, l.zone?.name, l.zone?.code]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    )
  }, [allLocations, locationPickerSearch])

  const selectedClientLabel = selectedClient?.name
    ?? clients.find((c) => c.id === form.clientId)?.name
    ?? (editing?.clientId === form.clientId ? editing?.client?.name : undefined)
    ?? ''

  const selectedLocationLabel = selectedLocation?.code
    ?? allLocations.find((l) => l.id === form.locationId)?.code
    ?? (editing?.locationId === form.locationId || editing?.defaultLocation?.id === form.locationId ? editing?.defaultLocation?.code : undefined)
    ?? ''

  const canAccessQuotes = Boolean(me?.role && menus.find((m) => m.menuId === 'quotes')?.roles.includes(me.role))

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['products'] })
    qc.invalidateQueries({ queryKey: ['product'] })
    qc.invalidateQueries({ queryKey: ['product-barcodes'] })
    qc.invalidateQueries({ queryKey: ['inventory'] })
    qc.invalidateQueries({ queryKey: QUERY_KEYS.products({ search, status, page, limit: PAGE_SIZE }) })
  }

  const createMutation = useMutation({
    mutationFn: () => productApi.create({
      code: form.code, name: form.name, category: form.category || undefined,
      clientId:   form.clientId   || undefined,
      locationId: form.locationId || undefined,
      unit: form.unit, boxQty: form.boxQty, safetyStock: form.safetyStock, reorderPoint: form.reorderPoint,
      spec: form.spec || undefined, materialNo: form.materialNo || undefined,
      costPrice: form.costPrice || undefined, sellPrice: form.sellPrice || undefined,
      priceA: form.priceA || undefined, priceB: form.priceB || undefined,
      priceC: form.priceC || undefined, retailPrice: form.retailPrice || undefined,
      memo: form.memo || undefined,
    }),
    onSuccess: () => {
      toast.success('상품이 등록되었습니다')
      invalidateAll()
      closeModal()
    },
    onError: () => toast.error('상품 등록에 실패했습니다'),
  })

  const updateMutation = useMutation({
    mutationFn: () => productApi.update(editing!.id, {
      name: form.name, category: form.category,
      clientId:     form.clientId   || undefined,
      clearClient:  !form.clientId,
      locationId:   form.locationId || undefined,
      clearLocation: !form.locationId,
      unit: form.unit, boxQty: form.boxQty, safetyStock: form.safetyStock,
      reorderPoint: form.reorderPoint, spec: form.spec, materialNo: form.materialNo,
      costPrice: form.costPrice || undefined, sellPrice: form.sellPrice || undefined,
      priceA: form.priceA || undefined, priceB: form.priceB || undefined,
      priceC: form.priceC || undefined, retailPrice: form.retailPrice || undefined,
      memo: form.memo, saleStatus: form.saleStatus,
    }),
    onSuccess: () => {
      toast.success('상품이 수정되었습니다')
      invalidateAll()
      closeModal()
    },
    onError: () => toast.error('상품 수정에 실패했습니다'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_PRODUCT_FORM)
    setSelectedClient(null)
    setSelectedLocation(null)
    setShowModal(true)
  }

  const openEdit = (product: Product) => {
    setEditing(product)
    setForm({
      code:         product.code,
      name:         product.name,
      category:     product.category ?? '',
      clientId:     product.clientId ?? product.client?.id ?? '',
      locationId:   product.locationId ?? product.defaultLocation?.id ?? '',
      unit:         product.unit ?? 'EA',
      spec:         product.spec ?? '',
      materialNo:   product.materialNo ?? '',
      boxQty:       product.boxQty,
      safetyStock:  product.safetyStock,
      reorderPoint: product.reorderPoint,
      costPrice:    Number(product.costPrice ?? 0),
      sellPrice:    Number(product.sellPrice ?? 0),
      priceA:       Number(product.priceA ?? 0),
      priceB:       Number(product.priceB ?? 0),
      priceC:       Number(product.priceC ?? 0),
      retailPrice:  Number(product.retailPrice ?? 0),
      memo:         product.memo ?? '',
      saleStatus:   product.saleStatus,
    })
    setSelectedClient(product.client ?? null)
    setSelectedLocation(product.defaultLocation ?? null)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditing(null)
    setForm(EMPTY_PRODUCT_FORM)
    setSelectedClient(null)
    setSelectedLocation(null)
    setShowAddBc(false)
    setNewBcVal(''); setNewBcType('UNIT'); setNewBcQty(1); setNewBcPrimary(false)
  }

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    const ids = data?.items.map((p) => p.id) ?? []
    if (ids.length > 0 && ids.every((id) => selectedIds.has(id))) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(ids))
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`선택한 ${selectedIds.size}개 상품을 삭제하시겠습니까?`)) return
    const ids = [...selectedIds]
    for (const id of ids) {
      await deleteMutation.mutateAsync(id)
    }
    toast.success(`${formatNumber(ids.length)}개 상품이 삭제되었습니다`)
    setSelectedIds(new Set())
  }

  const handleEditSelected = () => {
    const id = [...selectedIds][0]
    const product = data?.items.find((p) => p.id === id)
    if (product) openEdit(product)
  }

  const currentPageIds = data?.items.map((p) => p.id) ?? []
  const selectedProductIds = useMemo(
    () => Array.from(new Set(data?.items.filter((p) => selectedIds.has(p.id)).map((p) => p.id))),
    [data?.items, selectedIds],
  )

  const handlePrintSelected = (docType: 'STATEMENT' | 'QUOTE') => {
    const selected = data?.items.filter((p) => selectedProductIds.includes(p.id)) ?? []
    if (selected.length === 0) {
      toast.error('출력할 상품을 먼저 선택해주세요')
      return
    }
    const today = new Date().toISOString().slice(0, 10)
    const items = selected.map((p, idx) => ({
      id: String(idx),
      productId: p.id,
      productCode: p.code,
      productName: p.name,
      unit: p.unit ?? '',
      qty: 1,
      unitPrice: Number(p.sellPrice ?? 0),
      amount: Number(p.sellPrice ?? 0),
      sortOrder: idx,
    }))
    const draftQuote = {
      id: '', docNo: '', docType,
      clientId: undefined, clientName: '',
      docDate: today, memo: '',
      totalAmount: items.reduce((s, it) => s + it.amount, 0),
      status: 'DRAFT' as const,
      createdBy: '', createdAt: today,
      items,
    }
    printQuoteDocument(draftQuote, null, null, supplierInfo, docType === 'QUOTE' ? '견적서' : undefined)
  }

  const allChecked = currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.has(id))
  const someChecked = currentPageIds.some((id) => selectedIds.has(id))

  const inputCls = 'w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-shadow'
  const labelCls = 'block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide'

  const openQuoteScreen = () => {
    const ids = [...selectedIds]
    if (ids.length === 0) {
      toast.error('상품을 먼저 선택해주세요')
      return
    }
    router.push(`/quotes?productIds=${encodeURIComponent(ids.join(','))}`)
  }

  return (
    <div className="space-y-4">
      {/* 타이틀 + 액션 */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">상품 관리</h2>
          {data && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              전체 {formatNumber(data.total ?? data.items.length)}개 상품
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <ExportButton
            filename="상품목록"
            getData={async () => {
              const all = await productApi.findAll({ search: search || undefined, status: status as SaleStatus || undefined, limit: 9999 })
              return all.items.map((p: Product) => ({
                '상품코드': p.code,
                '상품명': p.name,
                '위치': p.defaultLocation?.code ?? '-',
                '기준단위': p.unit || 'EA',
                '1BOX(입수량)': p.boxQty,
                '재고수량(박스)': getBoxStockQty(p),
                '재고수량(낱개)': getEachStockQty(p),
                '카테고리': p.category ?? '',
                '거래처명': p.client?.name ?? '',
                '판매가': p.sellPrice ?? 0,
                '바코드': getPrimaryBarcode(p.barcodes),
                '현재고': getEachStockQty(p),
                '예약': 0,
                '가용': getEachStockQty(p),
                '안전재고': p.safetyStock,
                '상태': SALE_STATUS_LABEL[p.saleStatus],
                '등록일': formatDateTime(p.createdAt),
              }))
            }}
          />
          <ImportButton
            onImported={() => qc.invalidateQueries({ queryKey: ['products'] })}
          />
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm shadow-indigo-500/20"
          >
            <Plus size={15} />상품 추가
          </button>
          {canAccessQuotes && (
           <button
            onClick={openQuoteScreen}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-40 disabled:hover:bg-transparent transition-colors font-medium"
          >
            <FileText size={14} />
            <span className="hidden sm:inline">거래명세서/견적서</span>
          </button>
          )}
        </div>
      </div>

      {/* 검색/필터 */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-3 flex gap-2.5 shadow-sm">
        <div className="relative flex-1 flex gap-1.5">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1) } }}
              placeholder="상품명, 코드 검색"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 transition-shadow"
            />
          </div>
          <button
            onClick={() => { setSearch(searchInput); setPage(1) }}
            className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium whitespace-nowrap"
          >
            검색
          </button>
        </div>
        <div className="relative flex items-center">
          <Filter size={13} className="absolute left-3 text-gray-400 pointer-events-none" />
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value as SaleStatus | ''); setPage(1) }}
            className="appearance-none pl-8 pr-8 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 transition-shadow cursor-pointer"
          >
            <option value="">전체</option>
            {Object.entries(SALE_STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 선택 액션 바 */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-indigo-600 text-white px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
          <span className="text-sm font-semibold flex-1">{formatNumber(selectedIds.size)}개 선택됨</span>
          {selectedIds.size === 1 && (
            <button
              onClick={handleEditSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              <Pencil size={13} />수정
            </button>
          )}

          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/80 hover:bg-red-600 rounded-lg text-sm font-medium transition-colors"
          >
            <Trash2 size={13} />삭제
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            title="선택 해제"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 테이블 */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[2000px] text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50/80 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                <th className="px-3 py-3 w-10 border-r border-gray-200 dark:border-gray-700">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked }}
                    onChange={toggleAll}
                    className="rounded accent-indigo-600 cursor-pointer"
                  />
                </th>
                <th className={TH + ' text-left'}>상품코드</th>
                <th className={TH + ' text-left'}>상품명</th>
                <th className={TH + ' text-left'}>위치</th>
                <th className={TH + ' text-center'}>기준단위</th>
                <th className={TH + ' text-right'}>1BOX(입수량)</th>
                <th className={TH + ' text-right'}>재고수량(박스)</th>
                <th className={TH + ' text-right'}>재고수량(낱개)</th>
                <th className={TH + ' text-left'}>카테고리</th>
                <th className={cn(TH, 'text-left bg-sky-50/60 dark:bg-sky-900/10')}>거래처명</th>
                <th className={TH + ' text-right'}>판매가</th>
                <th className={TH + ' text-left'}>바코드</th>
                <th className={TH + ' text-right'}>현재고</th>
                <th className={TH + ' text-right'}>예약</th>
                <th className={TH + ' text-right'}>가용</th>
                <th className={TH + ' text-right'}>안전재고</th>
                <th className={TH + ' text-center'}>상태</th>
                <th className={TH + ' text-left'}>등록일</th>
                <th className="px-3 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading && (
                <tr><td colSpan={19} className="text-center py-12 text-gray-400 dark:text-gray-500">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    로딩 중...
                  </div>
                </td></tr>
              )}
              {!isLoading && data?.items.length === 0 && (
                <tr><td colSpan={19} className="text-center py-12 text-gray-400 dark:text-gray-500">
                  <Package size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">상품이 없습니다</p>
                </td></tr>
              )}
              {data?.items.map((p: Product) => {
                const isSelected = selectedIds.has(p.id)
                const boxStockQty = getBoxStockQty(p)
                const eachStockQty = getEachStockQty(p)
                const isBelowSafety = boxStockQty < p.safetyStock
                const rowBase = isSelected
                  ? 'bg-indigo-50/60 dark:bg-indigo-900/10'
                  : isBelowSafety
                    ? 'bg-red-50 dark:bg-red-900/10 hover:bg-red-100/60 dark:hover:bg-red-900/20'
                    : 'hover:bg-indigo-50/40 dark:hover:bg-indigo-900/5'
                /* 거래처명 열 배경: 행 배경보다 한 단계 진한 파란빛 */
                const clientBg = isSelected
                  ? 'bg-indigo-100/60 dark:bg-indigo-900/20'
                  : isBelowSafety
                    ? 'bg-red-100/50 dark:bg-red-900/20'
                    : 'bg-sky-50/70 dark:bg-sky-900/10 group-hover:bg-sky-100/60 dark:group-hover:bg-sky-900/20'
                return (
                  <tr
                    key={p.id}
                    onClick={() => toggleRow(p.id)}
                    className={cn('group cursor-pointer transition-colors', rowBase)}
                  >
                    <td className="px-3 py-3.5 border-r border-gray-200 dark:border-gray-700 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(p.id)}
                        className="rounded accent-indigo-600 cursor-pointer"
                      />
                    </td>
                    {/* 상품코드 */}
                    <td className={cn(TD_TEXT, 'font-mono text-xs text-gray-500 dark:text-gray-400')}>{p.code}</td>
                    {/* 상품명 */}
                    <td className={cn(TD_TEXT, 'font-semibold text-gray-900 dark:text-gray-100')}>{p.name}</td>
                    {/* 위치 */}
                    <td className={TD_TEXT}>{p.defaultLocation?.code || '—'}</td>
                    {/* 기준단위 */}
                    <td className={TD_CTR}>{p.unit || 'EA'}</td>
                    {/* 1BOX */}
                    <td className={TD_NUM}>{formatNumber(p.boxQty)}</td>
                    {/* 재고수량(박스) */}
                    <td className={TD_NUM}>{formatNumber(boxStockQty)}</td>
                    {/* 재고수량(낱개) */}
                    <td className={TD_NUM}>{formatNumber(eachStockQty)}</td>
                    {/* 카테고리 */}
                    <td className={TD_TEXT}>{p.category || '—'}</td>
                    {/* 거래처명 - 배경 강조 */}
                    <td className={cn(TD_TEXT, clientBg)}>{p.client?.name || '—'}</td>
                    {/* 판매가 */}
                    <td className={TD_NUM}>{p.sellPrice ? `₩${formatNumber(p.sellPrice)}` : '—'}</td>
                    {/* 바코드 */}
                    <td className={TD_TEXT}>{getPrimaryBarcode(p.barcodes)}</td>
                    {/* 현재고 */}
                    <td className={TD_NUM}>{formatNumber(eachStockQty)}</td>
                    {/* 예약 */}
                    <td className={cn(TD_NUM, 'text-gray-500 dark:text-gray-400')}>0</td>
                    {/* 가용 */}
                    <td className={TD_NUM}>{formatNumber(eachStockQty)}</td>
                    {/* 안전재고 */}
                    <td className={cn(TD_NUM, isBelowSafety ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-400 dark:text-gray-500')}>
                      {formatNumber(p.safetyStock)}
                    </td>
                    {/* 상태 */}
                    <td className={TD_CTR}>
                      <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', STATUS_STYLE[p.saleStatus])}>
                        {SALE_STATUS_LABEL[p.saleStatus]}
                      </span>
                    </td>
                    {/* 등록일 */}
                    <td className={cn(TD_TEXT, 'text-xs text-gray-400 dark:text-gray-500')}>{formatDateTime(p.createdAt)}</td>
                    {/* 액션 */}
                    <td className="px-3 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/20 transition-colors"
                          title="수정"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMutation.mutate(p.id, { onSuccess: () => toast.success('삭제되었습니다') }) }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                          title="삭제"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 페이지네이션 */}
      {data && data.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3.5 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors font-medium"
          >
            이전
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
            {formatNumber(page)} / {formatNumber(data.totalPages)}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            10개씩 보기
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page === data.totalPages}
            className="px-3.5 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors font-medium"
          >
            다음
          </button>
        </div>
      )}

      {/* 상품 등록/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
            {/* 모달 헤더 */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <div className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                editing ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'
              )}>
                {editing
                  ? <Pencil size={16} className="text-indigo-600 dark:text-indigo-400" />
                  : <Package size={16} className="text-emerald-600 dark:text-emerald-400" />
                }
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {editing ? editing.name : '새 상품 등록'}
                </h3>
                {editing && <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5">{editing.code}</p>}
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* ── 기본 정보 ── */}
              <section>
                <p className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wide mb-3">기본 정보</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>상품코드 *</label>
                    <input
                      type="text"
                      placeholder="PRD-001"
                      value={form.code}
                      disabled={editing !== null}
                      onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                      className={cn(inputCls, 'disabled:bg-gray-50 disabled:text-gray-400 dark:disabled:bg-gray-800 dark:disabled:text-gray-500')}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>상품명 *</label>
                    <input
                      type="text"
                      placeholder="상품명 입력"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>규격</label>
                    <input type="text" placeholder="규격" value={form.spec}
                      onChange={(e) => setForm((p) => ({ ...p, spec: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>자재번호</label>
                    <input type="text" placeholder="자재번호" value={form.materialNo}
                      onChange={(e) => setForm((p) => ({ ...p, materialNo: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>카테고리(품목분류)</label>
                    <input type="text" placeholder="카테고리" value={form.category}
                      onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>거래처</label>
                    <button
                      type="button"
                      onClick={() => { setClientPickerSearch(''); setShowClientPicker(true) }}
                      className={cn(
                        inputCls,
                        'w-full flex items-center justify-between gap-2 text-left cursor-pointer',
                        form.clientId ? '' : 'text-gray-400 dark:text-gray-500',
                      )}
                    >
                      <span className="truncate">
                        {form.clientId ? (selectedClientLabel || '거래처 선택...') : '거래처 선택...'}
                      </span>
                      <Search size={13} className="shrink-0 text-gray-400" />
                    </button>
                    {form.clientId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClient(null)
                          setForm((p) => ({ ...p, clientId: '' }))
                        }}
                        className="mt-1 flex items-center gap-1 text-xs text-gray-400 hover:text-rose-500 transition-colors"
                      >
                        <X size={11} /> 선택 해제
                      </button>
                    )}
                  </div>
                </div>
              </section>

              {/* ── 수량 / 위치 ── */}
              <section className="border-t border-gray-100 dark:border-gray-700 pt-4">
                <p className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wide mb-3">수량 / 위치</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>단위</label>
                    <select
                      value={form.unit}
                      onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                      className={inputCls}
                    >
                      {!units.some((u) => u.code === form.unit) && (
                        <option value={form.unit}>{form.unit || '선택'}</option>
                      )}
                      {units.map((u) => (
                        <option key={u.id} value={u.code}>
                          {u.code}{u.label ? ` (${u.label})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>기준BOX 입수</label>
                    <input type="number" min={1} value={form.boxQty}
                      onChange={(e) => setForm((p) => ({ ...p, boxQty: +e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>안전재고</label>
                    <input type="number" min={0} value={form.safetyStock}
                      onChange={(e) => setForm((p) => ({ ...p, safetyStock: +e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>재주문점</label>
                    <input type="number" min={0} value={form.reorderPoint}
                      onChange={(e) => setForm((p) => ({ ...p, reorderPoint: +e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>보관위치</label>
                    <button
                      type="button"
                      onClick={() => { setLocationPickerSearch(''); setShowLocationPicker(true) }}
                      className={cn(
                        inputCls,
                        'w-full flex items-center justify-between gap-2 text-left cursor-pointer',
                        form.locationId ? '' : 'text-gray-400 dark:text-gray-500',
                      )}
                    >
                      <span className="truncate">
                        {form.locationId ? (selectedLocationLabel || '위치 선택...') : '위치 선택...'}
                      </span>
                      <MapPin size={13} className="shrink-0 text-gray-400" />
                    </button>
                    {form.locationId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLocation(null)
                          setForm((p) => ({ ...p, locationId: '' }))
                        }}
                        className="mt-1 flex items-center gap-1 text-xs text-gray-400 hover:text-rose-500 transition-colors"
                      >
                        <X size={11} /> 선택 해제
                      </button>
                    )}
                  </div>
                </div>
              </section>

              {/* ── 가격 ── */}
              <section className="border-t border-gray-100 dark:border-gray-700 pt-4">
                <p className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wide mb-3">가격 정보</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>매입단가 (₩)</label>
                    <input type="number" min={0} value={form.costPrice}
                      onChange={(e) => setForm((p) => ({ ...p, costPrice: +e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>매출단가 (₩)</label>
                    <input type="number" min={0} value={form.sellPrice}
                      onChange={(e) => setForm((p) => ({ ...p, sellPrice: +e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>소매단가 (₩)</label>
                    <input type="number" min={0} value={form.retailPrice}
                      onChange={(e) => setForm((p) => ({ ...p, retailPrice: +e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>A 단가 (₩)</label>
                    <input type="number" min={0} value={form.priceA}
                      onChange={(e) => setForm((p) => ({ ...p, priceA: +e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>B 단가 (₩)</label>
                    <input type="number" min={0} value={form.priceB}
                      onChange={(e) => setForm((p) => ({ ...p, priceB: +e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>C 단가 (₩)</label>
                    <input type="number" min={0} value={form.priceC}
                      onChange={(e) => setForm((p) => ({ ...p, priceC: +e.target.value }))}
                      className={inputCls} />
                  </div>
                </div>
              </section>

              {/* ── 상태 & 메모 ── */}
              <section className="border-t border-gray-100 dark:border-gray-700 pt-4">
                <p className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wide mb-3">상태 & 메모</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>판매 상태</label>
                    <select
                      value={form.saleStatus}
                      onChange={(e) => setForm((p) => ({ ...p, saleStatus: e.target.value as SaleStatus }))}
                      className={inputCls}
                    >
                      {Object.entries(SALE_STATUS_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>간단메모</label>
                    <textarea
                      rows={3}
                      placeholder="메모 입력..."
                      value={form.memo}
                      onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
                      className={cn(inputCls, 'resize-none')}
                    />
                  </div>
                </div>
              </section>

              {/* ── 바코드 관리 ── */}
              <section className="border-t border-gray-100 dark:border-gray-700 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wide flex items-center gap-1.5">
                    <QrCode size={13} /> 바코드
                  </p>
                  {editing && (
                    <button
                      type="button"
                      onClick={() => setShowAddBc((v) => !v)}
                      className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                    >
                      <Plus size={12} /> 바코드 추가
                    </button>
                  )}
                </div>

                {!editing && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 py-2">상품 저장 후 바코드를 등록할 수 있습니다.</p>
                )}

                {editing && (
                  <>
                    {barcodes.length === 0 && !showAddBc && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 py-2">등록된 바코드가 없습니다. 위 버튼으로 추가하세요.</p>
                    )}

                    {barcodes.length > 0 && (
                      <div className="space-y-1.5 mb-3">
                        {barcodes.map((bc) => (
                          <div key={bc.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 group">
                            <span className="font-mono text-sm text-gray-800 dark:text-gray-200 flex-1 truncate">{bc.barcode}</span>
                            <span className={cn(
                              'text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0',
                              bc.type === 'BOX'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                                : bc.type === 'CXD'
                                  ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400'
                                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
                            )}>
                              {bc.type === 'BOX' ? '박스' : bc.type === 'CXD' ? 'CXD' : '낱개'}
                            </span>
                            <span className="text-xs text-gray-400 tabular-nums shrink-0">×{bc.unitQty}</span>
                            {bc.isPrimary && <Star size={11} className="text-amber-400 fill-amber-400 shrink-0" />}
                            <button
                              type="button"
                              onClick={() => { if (confirm('이 바코드를 삭제할까요?')) delBarcodeMutation.mutate(bc.id) }}
                              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-rose-500 dark:text-gray-600 dark:hover:text-rose-400 transition-all shrink-0"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {showAddBc && (
                      <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-900/10">
                        <input
                          autoFocus
                          type="text"
                          placeholder="바코드 값"
                          value={newBcVal}
                          onChange={(e) => setNewBcVal(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && newBcVal.trim()) addBarcodeMutation.mutate() }}
                          className="font-mono text-sm px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 flex-1 min-w-32"
                        />
                        <select
                          value={newBcType}
                          onChange={(e) => setNewBcType(e.target.value as BarcodeUnitType)}
                          className="text-xs px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none"
                        >
                          <option value="UNIT">낱개</option>
                          <option value="BOX">박스</option>
                          <option value="CXD">CXD</option>
                        </select>
                        <input
                          type="number" min={1}
                          value={newBcQty}
                          onChange={(e) => setNewBcQty(Number(e.target.value))}
                          className="w-14 text-xs px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-right tabular-nums focus:outline-none"
                        />
                        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                          <input type="checkbox" checked={newBcPrimary} onChange={(e) => setNewBcPrimary(e.target.checked)} className="rounded accent-indigo-600" />
                          기본
                        </label>
                        <button
                          type="button"
                          onClick={() => addBarcodeMutation.mutate()}
                          disabled={!newBcVal.trim() || addBarcodeMutation.isPending}
                          className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                        >
                          저장
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddBc(false)}
                          className="px-2.5 py-1.5 text-xs text-gray-500 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          취소
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>

              <div className="flex gap-3 pt-2">
                <button onClick={closeModal}
                  className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  취소
                </button>
                <button
                  onClick={() => editing ? updateMutation.mutate() : createMutation.mutate()}
                  disabled={!form.code || !form.name || createMutation.isPending || updateMutation.isPending}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm shadow-indigo-500/20"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? '처리 중...' : (editing ? '수정 완료' : '등록')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 거래처 검색 팝업 */}
      {showClientPicker && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 flex flex-col max-h-[80vh]">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/30 shrink-0">
                <Building2 size={16} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">거래처 검색</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">선택하면 거래처명이 자동 입력됩니다</p>
              </div>
              <button
                onClick={() => setShowClientPicker(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  autoFocus
                  type="text"
                  placeholder="거래처명 검색..."
                  value={clientPickerSearch}
                  onChange={(e) => setClientPickerSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {filteredClients.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">
                  <Building2 size={28} className="mx-auto mb-2 opacity-30" />
                  {clientPickerSearch ? '검색 결과 없음' : '등록된 거래처가 없습니다'}
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredClients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedClient(c)
                        setForm((p) => ({ ...p, clientId: c.id }))
                        setShowClientPicker(false)
                      }}
                      className="w-full px-5 py-3 text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{c.name}</p>
                      {(c.phone || c.businessNo) && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {[c.businessNo, c.phone].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 shrink-0">
              <button
                type="button"
                onClick={() => setShowClientPicker(false)}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 보관위치 검색 팝업 */}
      {showLocationPicker && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 flex flex-col max-h-[80vh]">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30 shrink-0">
                <MapPin size={16} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">보관위치 선택</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">창고에 등록된 위치 중에서 선택하세요</p>
              </div>
              <button
                onClick={() => setShowLocationPicker(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  autoFocus
                  type="text"
                  placeholder="위치 코드 검색 (예: A-01)"
                  value={locationPickerSearch}
                  onChange={(e) => setLocationPickerSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {filteredLocations.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">
                  <MapPin size={28} className="mx-auto mb-2 opacity-30" />
                  {locationPickerSearch ? '검색 결과 없음' : '등록된 위치가 없습니다'}
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredLocations.map((loc) => (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => {
                        setSelectedLocation(loc)
                        setForm((p) => ({ ...p, locationId: loc.id }))
                        setShowLocationPicker(false)
                      }}
                      className="w-full px-5 py-3 text-left hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                    >
                      <p className="text-sm font-mono font-medium text-gray-800 dark:text-gray-100">{loc.code}</p>
                      {(loc.aisle || loc.rack) && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {[loc.aisle && `통로 ${loc.aisle}`, loc.rack && `랙 ${loc.rack}`, loc.shelf && `선반 ${loc.shelf}`].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 shrink-0">
              <button
                type="button"
                onClick={() => setShowLocationPicker(false)}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
