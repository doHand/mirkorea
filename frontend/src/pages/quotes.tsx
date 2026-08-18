'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, X, Pencil, Trash2, Plus, Search, Printer } from 'lucide-react'
import { useRouter } from 'next/router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { clientApi } from '@/api/client.api'
import { productApi, unitApi } from '@/api/product.api'
import { quoteApi } from '@/api/quote.api'
import { AppAgGrid } from '@/components/AppAgGrid'
import { PurchaseOrdersContent } from '@/components/PurchaseOrdersContent'
import { ClientPickerModal } from '@/components/ClientPickerModal'
import { ProductPickerModal } from '@/components/ProductPickerModal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useSupplierInfoStore } from '@/stores/supplier-info.store'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { formatNumber } from '@/utils/format'
import { getPackageUnitQty } from '@/utils/unit-spec'
import { cn } from '@/utils/cn'
import * as ui from '@/styles/ui'
import {
  buildQuotePrintHtml,
  QUOTE_PRINT_TITLES,
  printQuoteDocument,
} from '@/utils/printDocument'
import { openBlankPrintWindow } from '@/utils/printWindow'
import type { Client, Product, ProductUnit, Quote } from '@/types/api.types'
import type { ColDef } from 'ag-grid-community'

const DOC_TYPE_LABEL: Record<string, string> = {
  STATEMENT: '거래명세서',
  QUOTE: '견적서',
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '작성중',
  CONFIRMED: '확정',
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400',
  CONFIRMED: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400',
}

interface ItemRow {
  productId?: string
  productCode?: string
  productName: string
  category?: string
  barcode?: string
  unit: string
  qty: number
  unitPrice: number
  amount: number
  spec?: string
  inUnitQty?: number
  outUnitQty?: number
}

interface FormState {
  docType: string
  clientId: string
  clientName: string
  docDate: string
  memo: string
  items: ItemRow[]
  printTitle: string
}

const OUTPUT_DOC_UNIT = 'BOX'
const today = () => new Date().toISOString().slice(0, 10)
const EMPTY_ITEM: ItemRow = { productName: '', unit: OUTPUT_DOC_UNIT, qty: 1, unitPrice: 0, amount: 0 }

type UnitSpecSource = Pick<Product, 'spec' | 'inUnitQty' | 'outUnitQty'>

function normalizeOutputDocUnit(unit?: string | null, fallback = OUTPUT_DOC_UNIT) {
  const value = (unit ?? '').trim().toUpperCase()
  if (!value) return fallback
  return value
}

function unitCodeOptions(units: ProductUnit[]) {
  return units
    .filter((unit) => unit.isActive !== false)
    .map((unit) => unit.code.trim().toUpperCase())
    .filter(Boolean)
}

function pickDefaultUnit(options: string[], preferred?: string | null) {
  const preferredUnit = normalizeOutputDocUnit(preferred)
  if (options.includes(preferredUnit)) return preferredUnit
  const outUnit = options.find((option) => option.includes('OUT')) ?? options.find((option) => option === 'BOX')
  if (outUnit) return outUnit
  const inUnit = options.find((option) => option.includes('IN'))
  if (inUnit) return inUnit
  if (options.includes('EA')) return 'EA'
  return options[0] ?? OUTPUT_DOC_UNIT
}

function getSpecQtyForUnit(source: UnitSpecSource | undefined, unit: string) {
  if (!source) return 1
  const normalized = normalizeOutputDocUnit(unit)
  if (normalized.includes('IN')) {
    return getPackageUnitQty(source, 'IN') ?? 1
  }
  if (normalized.includes('OUT') || normalized === 'BOX') {
    return getPackageUnitQty(source, 'OUT') ?? 1
  }
  if (normalized === 'EA') return 1
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.spec?.match(new RegExp(`(\\d+)\\s*${escaped}\\b`, 'i'))
  const qty = match ? Number(match[1]) : 0
  return qty > 0 ? qty : 1
}

function itemSpecSource(item: ItemRow): UnitSpecSource {
  return { spec: item.spec, inUnitQty: item.inUnitQty, outUnitQty: item.outUnitQty }
}

function primaryBarcode(product: Product) {
  return product.barcodes?.find((barcode) => barcode.isPrimary)?.barcode
    ?? product.barcodes?.[0]?.barcode
}

function quoteItemsForSave(items: ItemRow[]) {
  return items.filter((item) => item.productName.trim() && item.qty > 0)
}

const EMPTY_FORM: FormState = {
  docType: 'STATEMENT',
  clientId: '',
  clientName: '',
  docDate: today(),
  memo: '',
  items: [],
  printTitle: '견적서',
}

export default function QuotesPage() {
  const qc = useQueryClient()
  const router = useRouter()
  const q = router.query
  const supplierInfo = useSupplierInfoStore((state) => state.info)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const tabParam = (typeof q.tab === 'string' ? q.tab : '').toUpperCase()
  const [docTypeFilter, setDocTypeFilter] = useState(() => tabParam || 'STATEMENT')
  const [page, setPage] = useState(1)
  const [purchaseCreateTrigger, setPurchaseCreateTrigger] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Quote | null>(null)
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null)
  const [previewQuoteId, setPreviewQuoteId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [prefillKey, setPrefillKey] = useState('')
  const [listPrint, setListPrint] = useState<{ quote: Quote; title: string } | null>(null)
  const [showClientPicker, setShowClientPicker] = useState(false)
  const [productPickerIdx, setProductPickerIdx] = useState<number | null>(null)
  const [showProductAdder, setShowProductAdder] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Quote | null>(null)
  const productIdsParam = (typeof q.productIds === 'string' ? q.productIds : '')
  const docTypeParam = ((typeof q.docType === 'string' ? q.docType : '')).toUpperCase()
  const autoPrintParam = ['1', 'true'].includes(((typeof q.print === 'string' ? q.print : '')).toLowerCase())

  useEffect(() => {
    if (['STATEMENT', 'QUOTE', 'PURCHASE'].includes(tabParam)) {
      setDocTypeFilter(tabParam)
    }
  }, [tabParam])

  const { data, isLoading } = useQuery({
    queryKey: ['quotes', { search, docTypeFilter, statusFilter, dateFrom, dateTo, page }],
    queryFn: () => quoteApi.findAll({
      docType: docTypeFilter || undefined,
      search: search || undefined,
      status: statusFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page,
    }),
    placeholderData: (prev) => prev,
  })

  const { data: clients, refetch: refetchClients } = useQuery({ queryKey: ['clients-all'], queryFn: clientApi.findAllActive })
  const { data: products } = useQuery({ queryKey: ['products-all'], queryFn: () => productApi.findAll({ limit: 999 }) })
  const { data: units = [] } = useQuery<ProductUnit[]>({ queryKey: ['product-units'], queryFn: unitApi.findAll })
  const unitOptions = useMemo(() => {
    const options = unitCodeOptions(units)
    return options.length ? options : [OUTPUT_DOC_UNIT]
  }, [units])
  const defaultUnit = useMemo(() => pickDefaultUnit(unitOptions), [unitOptions])

  const findClientForQuote = useCallback((quote: Quote) =>
    clients?.find((client) => client.id === quote.clientId)
    ?? clients?.find((client) => client.name === quote.clientName)
    ?? null, [clients])

  const selectedClient = clients?.find((c) => c.id === form.clientId)

  const buildPayload = () => ({
    docType: form.docType,
    clientId: form.clientId || undefined,
    clientName: form.clientName || undefined,
    docDate: form.docDate,
    memo: form.memo || undefined,
    items: quoteItemsForSave(form.items).map((it) => ({
      productId: it.productId,
      productCode: it.productCode,
      productName: it.productName,
      category: it.category,
      barcode: it.barcode,
      spec: it.spec,
      inUnitQty: it.inUnitQty,
      outUnitQty: it.outUnitQty,
      unit: normalizeOutputDocUnit(it.unit, defaultUnit),
      qty: it.qty,
      unitPrice: it.unitPrice,
    })),
  })

  const createMutation = useMutation({
    mutationFn: () => quoteApi.create(buildPayload()),
    onSuccess: () => { toast.success('문서 등록 완료'); qc.invalidateQueries({ queryKey: ['quotes'] }); closeModal() },
  })

  const updateMutation = useMutation({
    mutationFn: () => quoteApi.update(editing!.id, buildPayload()),
    onSuccess: (saved) => { setSelectedQuote(saved); toast.success('문서 수정 완료'); qc.invalidateQueries({ queryKey: ['quotes'] }); closeModal() },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => quoteApi.delete(id),
    onSuccess: () => { toast.success('문서 삭제 완료'); qc.invalidateQueries({ queryKey: ['quotes'] }); setDeleteTarget(null) },
  })
  const isSaving = createMutation.isPending || updateMutation.isPending

  const closeModal = () => { setShowModal(false); setEditing(null); setForm({ ...EMPTY_FORM, docDate: today() }) }
  const commitSearch = () => setPage(1)
  const resetFilters = () => {
    setSearch('')
    setStatusFilter('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }
  useEscapeKey(() => setListPrint(null), !!listPrint)
  useEscapeKey(closeModal, showModal && !listPrint && !showClientPicker && productPickerIdx === null && !showProductAdder)

  const openCreate = () => {
    const docType = docTypeFilter === 'QUOTE' ? 'QUOTE' : 'STATEMENT'
    setEditing(null)
    setForm({ ...EMPTY_FORM, docType, docDate: today() })
    setShowModal(true)
  }

  const openEdit = useCallback((quote: Quote) => {
    setSelectedQuote(quote)
    setEditing(quote)
    setForm({
      docType: quote.docType,
      clientId: quote.clientId ?? '',
      clientName: quote.clientName ?? '',
      docDate: quote.docDate,
      memo: quote.memo ?? '',
      printTitle: '견적서',
      items: (quote.items ?? []).map((it) => ({
        productId: it.productId,
        productCode: it.productCode,
        productName: it.productName ?? '',
        category: it.category,
        barcode: it.barcode,
        unit: normalizeOutputDocUnit(it.unit, defaultUnit),
        qty: it.qty,
        unitPrice: Number(it.unitPrice),
        amount: Number(it.amount),
        spec: it.spec,
        inUnitQty: it.inUnitQty,
        outUnitQty: it.outUnitQty,
      })),
    })
    setShowModal(true)
  }, [defaultUnit])

  useEffect(() => {
    if (!productIdsParam || productIdsParam === prefillKey) return
    const prefillProducts = async () => {
      const ids = productIdsParam.split(',').filter(Boolean)
      const selectedProducts = await Promise.all(ids.map((id) => productApi.findById(id)))
      const docType: Quote['docType'] = docTypeParam === 'QUOTE' ? 'QUOTE' : 'STATEMENT'
      const items = selectedProducts.map((product, index) => {
        const unit = pickDefaultUnit(unitOptions)
        const unitPrice = Number(product.sellPrice ?? 0)
        return {
          id: String(index),
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          category: product.category,
          barcode: primaryBarcode(product),
          unit,
          qty: 1,
          unitPrice,
          amount: unitPrice,
          sortOrder: index,
          spec: product.spec,
          inUnitQty: product.inUnitQty,
          outUnitQty: product.outUnitQty,
        }
      })
      setEditing(null)
      setForm({ ...EMPTY_FORM, docType, docDate: today(), items })
      setShowModal(true)
      setPrefillKey(productIdsParam)

      if (autoPrintParam) {
        const draftQuote = {
          id: '', docNo: '', docType, clientId: undefined, clientName: '', docDate: today(),
          memo: '', totalAmount: items.reduce((sum, item) => sum + item.amount, 0),
          status: 'DRAFT' as const, createdBy: '', createdAt: today(), items,
        }
        printQuoteDocument(draftQuote, null, null, supplierInfo, docType === 'QUOTE' ? '견적서' : undefined)
      }
    }
    prefillProducts().catch(() => toast.error('상품 정보를 불러오지 못했습니다'))
  }, [prefillKey, productIdsParam, docTypeParam, autoPrintParam, supplierInfo, unitOptions])

  const updateItem = (idx: number, patch: Partial<ItemRow>) => {
    setForm((prev) => {
      const items = [...prev.items]
      const merged = { ...items[idx], ...patch }
      merged.amount = merged.qty * merged.unitPrice
      items[idx] = merged
      return { ...prev, items }
    })
  }

  const removeItem = (idx: number) => setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))

  const selectProduct = (idx: number, product: Product) => {
    const unit = pickDefaultUnit(unitOptions)
    const unitPrice = Number(product.sellPrice ?? 0)
    updateItem(idx, {
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      category: product.category,
      barcode: primaryBarcode(product),
      unit,
      qty: 1,
      unitPrice,
      amount: unitPrice,
      spec: product.spec,
      inUnitQty: product.inUnitQty,
      outUnitQty: product.outUnitQty,
    })
  }

  const onSelectClient = (client: Client | null) => {
    if (!client) return
    setForm((p) => ({ ...p, clientId: client.id, clientName: client.name }))
    setShowClientPicker(false)
  }

  const onSelectProductFromPicker = (product: Product) => {
    if (productPickerIdx !== null) selectProduct(productPickerIdx, product)
    setProductPickerIdx(null)
  }

  const onAddProductsFromPicker = (selected: Product[]) => {
    const existingIds = new Set(form.items.map((item) => item.productId).filter(Boolean))
    const newItems: ItemRow[] = selected.filter((product) => !existingIds.has(product.id)).map((product) => {
      const unit = pickDefaultUnit(unitOptions)
      const unitPrice = Number(product.sellPrice ?? 0)
      return {
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        category: product.category,
        barcode: primaryBarcode(product),
        unit,
        qty: 1,
        unitPrice,
        amount: unitPrice,
        spec: product.spec,
        inUnitQty: product.inUnitQty,
        outUnitQty: product.outUnitQty,
      }
    })
    setForm((p) => {
      const existing = p.items.filter((it) => it.productName.trim())
      return { ...p, items: [...existing, ...newItems] }
    })
    setShowProductAdder(false)
  }

  const submitForm = async (printAfterSave = false) => {
    if (isSaving) return
    if (!form.clientId && !form.clientName.trim()) {
      toast.error('거래처를 선택하거나 입력해주세요')
      return
    }
    if (quoteItemsForSave(form.items).length === 0) {
      toast.error('저장할 품목을 1개 이상 추가해주세요')
      return
    }
    const printWindow = printAfterSave ? openBlankPrintWindow('width=820,height=1060') : null
    if (printAfterSave && !printWindow) return
    try {
      const saved = editing ? await updateMutation.mutateAsync() : await createMutation.mutateAsync()
      if (printAfterSave) printQuoteDocument(saved, printWindow, findClientForQuote(saved), supplierInfo, form.printTitle)
    } catch {
      printWindow?.close()
      toast.error('저장 실패')
    }
  }

  const totalAmount = form.items.reduce((sum, item) => sum + item.amount, 0)
  const inputCls = 'w-full border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400'
  const tdInput = 'w-full border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-sm outline-none focus:border-[var(--color-primary)] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'

  const DOC_TABS = [
    { value: 'STATEMENT', label: '거래명세서', href: null },
    { value: 'QUOTE',     label: '견적서',     href: null },
    { value: 'PURCHASE',  label: '발주서',     href: null },
  ]

  const quoteColumns = useMemo<ColDef<Quote>[]>(() => [
    {
      headerName: '거래처',
      minWidth: 180,
      flex: 1,
      valueGetter: (p) => p.data?.clientName || '-',
      cellRenderer: (p: { data?: Quote }) => (
        <div className="flex h-full min-w-0 flex-col justify-center leading-tight">
          <span className="truncate font-medium text-gray-800 dark:text-gray-100">{p.data?.clientName || '-'}</span>
          {p.data?.memo && <span className="truncate text-xs text-gray-400">{p.data.memo}</span>}
        </div>
      ),
    },
    {
      headerName: '문서번호',
      field: 'docNo',
      width: 150,
      cellClass: 'font-mono text-xs font-semibold text-[var(--color-primary)]',
    },
    {
      headerName: '종류',
      width: 115,
      valueGetter: (p) => p.data ? DOC_TYPE_LABEL[p.data.docType] : '',
      cellRenderer: (p: { data?: Quote }) => p.data ? (
        <span className={cn(
          'inline-flex rounded px-2 py-0.5 text-xs font-semibold',
          p.data.docType === 'STATEMENT'
            ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
            : 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
        )}>
          {DOC_TYPE_LABEL[p.data.docType]}
        </span>
      ) : '-',
    },
    { headerName: '날짜', field: 'docDate', width: 115 },
    {
      headerName: '합계금액',
      width: 135,
      type: 'rightAligned',
      valueGetter: (p) => Number(p.data?.totalAmount ?? 0),
      valueFormatter: (p) => `${formatNumber(Number(p.value ?? 0))}원`,
      cellClass: 'font-semibold tabular-nums',
    },
    {
      headerName: '상태',
      width: 105,
      valueGetter: (p) => p.data ? STATUS_LABEL[p.data.status] : '',
      cellRenderer: (p: { data?: Quote }) => p.data ? (
        <span className={cn('inline-flex rounded px-2 py-1 text-xs font-semibold', STATUS_STYLE[p.data.status])}>
          {STATUS_LABEL[p.data.status]}
        </span>
      ) : '-',
    },
    {
      headerName: '관리',
      width: 176,
      sortable: false,
      filter: false,
      cellRenderer: (p: { data?: Quote }) => {
        if (!p.data) return '-'
        const quote = p.data
        return (
          <div className="flex h-full items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (quote.docType === 'QUOTE') setListPrint({ quote, title: QUOTE_PRINT_TITLES[0] ?? '견적서' })
                else printQuoteDocument(quote, null, findClientForQuote(quote), supplierInfo)
              }}
              className="rounded border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
            >
              출력
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); openEdit(quote) }}
              className="rounded border border-indigo-200 px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
            >
              수정
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setDeleteTarget(quote)
              }}
              className="rounded border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
            >
              삭제
            </button>
          </div>
        )
      },
    },
  ], [findClientForQuote, openEdit, supplierInfo])

  return (
    <div className="flex h-[calc(100vh-150px)] min-h-0 flex-col gap-4 overflow-hidden">
      {/* 공통 헤더 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">출력서류관리</h2>
          {docTypeFilter !== 'PURCHASE' && data && (
            <p className="text-xs text-gray-400 mt-0.5">전체 {formatNumber(data.total)}건</p>
          )}
          {docTypeFilter === 'PURCHASE' && (
            <p className="text-xs text-gray-400 mt-0.5">발주서는 입고예정 등록 전까지 수량에 반영되지 않습니다</p>
          )}
        </div>
        <div className="self-start sm:self-auto flex gap-2">
          <button onClick={openCreate} className="flex items-center gap-1.5 rounded border border-emerald-200 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400">
            거래명세서/견적서 작성
          </button>
          <button onClick={() => { setDocTypeFilter('PURCHASE'); setPurchaseCreateTrigger((n) => n + 1) }} className="flex items-center gap-1.5 rounded bg-[var(--color-primary)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]">
            발주서 작성
          </button>
        </div>
      </div>

      {/* 공통 탭 */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 shrink-0">
        {DOC_TABS.map((tab) => (
          <button key={tab.value} onClick={() => { setDocTypeFilter(tab.value); setPage(1) }}
            className={['px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              docTypeFilter === tab.value
                ? 'border-[var(--color-primary)] text-[var(--color-primary)] dark:text-[var(--color-primary)] dark:border-[#7ba885]'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200',
            ].join(' ')}>{tab.label}</button>
        ))}
      </div>

      {/* 발주서 탭 콘텐츠 */}
      {docTypeFilter === 'PURCHASE' && (
        <PurchaseOrdersContent createTrigger={purchaseCreateTrigger} />
      )}

      {/* 거래명세서 / 견적서 탭 콘텐츠 */}
      {docTypeFilter !== 'PURCHASE' && (<>
      <div className="shrink-0 border border-[#d8ddd8] bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => { setDateFrom(event.target.value); setPage(1) }}
            className="border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[var(--color-primary)] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <span className="text-xs text-gray-400">~</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => { setDateTo(event.target.value); setPage(1) }}
            className="border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[var(--color-primary)] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1) }}
            onKeyDown={(event) => { if (event.key === 'Enter') commitSearch() }}
            placeholder="문서번호 또는 거래처명 검색"
            className="min-w-48 flex-1 border border-gray-200 bg-white py-2 pl-3 pr-3 text-sm text-gray-900 outline-none focus:border-[var(--color-primary)] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <select
            value={statusFilter}
            onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}
            className="border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[var(--color-primary)] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">전체 상태</option>
            {Object.entries(STATUS_LABEL).map(([key, value]) => (
              <option key={key} value={key}>{value}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={commitSearch}
            className="bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
          >
            검색
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            초기화
          </button>
          <span className="self-center text-xs text-gray-400">총 {formatNumber(data?.total ?? 0)}건</span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="min-h-0 flex-1">
            <AppAgGrid
              rows={data?.items ?? []}
              columns={quoteColumns}
              loading={isLoading}
              onRowClicked={(quote) => {
                if (editing && editing.id !== quote.id) closeModal()
                setPreviewQuoteId(null)
                setSelectedQuote(quote)
              }}
              onRowDoubleClicked={openEdit}
            />
          </div>
        </div>

        {selectedQuote && (
          <aside className="flex w-[380px] shrink-0 flex-col overflow-hidden rounded border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{DOC_TYPE_LABEL[selectedQuote.docType]} 상세</p>
                <p className="truncate font-mono text-xs text-gray-500">{selectedQuote.docNo}</p>
              </div>
              <div className="flex items-center gap-1">
                {editing?.id !== selectedQuote.id && <button type="button" onClick={() => setPreviewQuoteId((id) => id === selectedQuote.id ? null : selectedQuote.id)} className="rounded border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] dark:border-gray-700 dark:text-gray-300">{previewQuoteId === selectedQuote.id ? '상세정보' : '문서 미리보기'}</button>}
                <button type="button" onClick={() => { if (editing?.id === selectedQuote.id) closeModal(); setPreviewQuoteId(null); setSelectedQuote(null) }} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200" title="상세 닫기"><X size={17} /></button>
              </div>
            </div>
            {previewQuoteId === selectedQuote.id ? (
              <iframe
                title={`${DOC_TYPE_LABEL[selectedQuote.docType]} 출력 미리보기`}
                srcDoc={buildQuotePrintHtml(selectedQuote, findClientForQuote(selectedQuote), supplierInfo)}
                className="min-h-0 w-full flex-1 overflow-x-hidden border-0 bg-white"
              />
            ) : showModal && editing?.id === selectedQuote.id ? (
              <form onSubmit={(event) => { event.preventDefault(); void submitForm() }} className="flex min-h-0 flex-1 flex-col">
                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                  <label className="block text-xs font-medium text-gray-500">거래처
                    <div className="mt-1 flex gap-1.5">
                      <input value={form.clientName} onChange={(event) => setForm((prev) => ({ ...prev, clientId: '', clientName: event.target.value }))} className={inputCls} />
                      <button type="button" onClick={() => setShowClientPicker(true)} className="shrink-0 border border-gray-200 px-2.5 text-xs font-semibold text-gray-600 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] dark:border-gray-700 dark:text-gray-300">선택</button>
                    </div>
                  </label>
                  <label className="block text-xs font-medium text-gray-500">작성일
                    <input type="date" value={form.docDate} onChange={(event) => setForm((prev) => ({ ...prev, docDate: event.target.value }))} className={`${inputCls} mt-1`} />
                  </label>
                  <label className="block text-xs font-medium text-gray-500">메모
                    <textarea value={form.memo} onChange={(event) => setForm((prev) => ({ ...prev, memo: event.target.value }))} rows={3} className={`${inputCls} mt-1 resize-none`} />
                  </label>
                  <div className="border-t border-gray-200 pt-4 dark:border-gray-800">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-500">품목</p>
                      <button type="button" onClick={() => setShowProductAdder(true)} className="rounded bg-[var(--color-primary)] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)]">품목 추가</button>
                    </div>
                    <div className="space-y-2">
                      {form.items.map((item, index) => (
                        <div key={`${item.productId || item.productName}-${index}`} className="rounded bg-gray-50 p-3 dark:bg-gray-800/70">
                          <div className="mb-2 flex items-center gap-2">
                            <button type="button" onClick={() => setProductPickerIdx(index)} className="min-w-0 flex-1 truncate text-left text-sm font-medium text-gray-800 hover:text-[var(--color-primary)] dark:text-gray-100">{item.productName}</button>
                            <button type="button" onClick={() => removeItem(index)} className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30" title="품목 삭제"><Trash2 size={14} /></button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <label className="text-[11px] text-gray-400">수량<input type="number" min={1} value={item.qty} onChange={(event) => updateItem(index, { qty: Math.max(1, Number(event.target.value)) })} className={`${tdInput} mt-1`} /></label>
                            <label className="text-[11px] text-gray-400">단위<select value={item.unit} onChange={(event) => updateItem(index, { unit: event.target.value })} className={`${tdInput} mt-1`}>{unitOptions.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></label>
                            <label className="text-[11px] text-gray-400">단가<input type="number" min={0} value={item.unitPrice} onChange={(event) => updateItem(index, { unitPrice: Math.max(0, Number(event.target.value)) })} className={`${tdInput} mt-1`} /></label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-gray-200 p-4 dark:border-gray-800">
                  <button type="button" onClick={closeModal} className="border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">취소</button>
                  <button type="submit" disabled={isSaving} className="bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50">{isSaving ? '저장 중...' : '저장'}</button>
                </div>
              </form>
            ) : (<>
            <div className="flex-1 overflow-y-auto p-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div><dt className="text-xs text-gray-400">거래처</dt><dd className="mt-0.5 font-semibold text-gray-800 dark:text-gray-100">{selectedQuote.clientName || '-'}</dd></div>
                <div><dt className="text-xs text-gray-400">작성일</dt><dd className="mt-0.5 text-gray-700 dark:text-gray-200">{selectedQuote.docDate}</dd></div>
                <div><dt className="text-xs text-gray-400">상태</dt><dd className="mt-0.5"><span className={cn('inline-flex rounded px-2 py-0.5 text-xs font-semibold', STATUS_STYLE[selectedQuote.status])}>{STATUS_LABEL[selectedQuote.status]}</span></dd></div>
                <div><dt className="text-xs text-gray-400">품목 수</dt><dd className="mt-0.5 text-gray-700 dark:text-gray-200">{formatNumber(selectedQuote.items.length)}개</dd></div>
                <div className="col-span-2"><dt className="text-xs text-gray-400">메모</dt><dd className="mt-0.5 whitespace-pre-wrap text-gray-700 dark:text-gray-200">{selectedQuote.memo || '-'}</dd></div>
              </dl>
              <div className="mt-5 border-t border-gray-200 pt-4 dark:border-gray-800">
                <p className="mb-2 text-xs font-semibold text-gray-500">품목</p>
                <div className="space-y-2">
                  {selectedQuote.items.map((item) => (
                    <div key={item.id} className="rounded bg-gray-50 px-3 py-2 dark:bg-gray-800/70">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0"><p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{item.productName || '-'}</p><p className="truncate font-mono text-xs text-gray-400">{item.productCode || item.spec || '-'}</p></div>
                        <p className="shrink-0 text-sm font-semibold tabular-nums text-gray-700 dark:text-gray-200">{formatNumber(item.amount)}원</p>
                      </div>
                      <p className="mt-1 text-right text-xs text-gray-400">{formatNumber(item.qty)} {item.unit || ''} × {formatNumber(item.unitPrice)}원</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="border-t border-gray-200 p-4 dark:border-gray-800">
              <div className="mb-3 flex items-center justify-between"><span className="text-sm text-gray-500">합계</span><strong className="text-lg tabular-nums text-[var(--color-primary)]">{formatNumber(selectedQuote.totalAmount)}원</strong></div>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => openEdit(selectedQuote)} className="border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">수정</button>
                <button type="button" onClick={() => setPreviewQuoteId(selectedQuote.id)} className="border border-[var(--color-primary)] px-2 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-emerald-50 dark:hover:bg-emerald-950/30">미리보기</button>
                <button type="button" onClick={() => selectedQuote.docType === 'QUOTE' ? setListPrint({ quote: selectedQuote, title: QUOTE_PRINT_TITLES[0] ?? '견적서' }) : printQuoteDocument(selectedQuote, null, findClientForQuote(selectedQuote), supplierInfo)} className="bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]">출력</button>
              </div>
            </div>
            </>)}
          </aside>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 shrink-0">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg border border-gray-200 disabled:opacity-40">&lt;</button>
          <span className="text-sm text-gray-500">{formatNumber(page)} / {formatNumber(data.totalPages)}</span>
          <button onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages} className="p-2 rounded-lg border border-gray-200 disabled:opacity-40">&gt;</button>
        </div>
      )}
      </>)}

      {listPrint && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded shadow-xl w-full max-w-xs p-5 border border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">출력 제목 선택</h3>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {QUOTE_PRINT_TITLES.map((t) => (
                <button key={t} type="button" onClick={() => setListPrint({ ...listPrint, title: t })}
                  className={`px-3 py-1.5 text-sm border transition-colors font-medium ${listPrint.title === t ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-[var(--color-primary)]'}`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setListPrint(null)} className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">취소</button>
              <button onClick={() => { printQuoteDocument(listPrint.quote, null, findClientForQuote(listPrint.quote), supplierInfo, listPrint.title); setListPrint(null) }}
                className="flex-1 px-3 py-2 text-sm bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] font-medium flex items-center justify-center gap-1.5">
                인쇄
              </button>
            </div>
          </div>
        </div>
      )}

      {showClientPicker && (
        <ClientPickerModal clients={clients ?? []} onSelect={onSelectClient} onClose={() => setShowClientPicker(false)} onRefresh={refetchClients} />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        title="문서 삭제"
        description={`${deleteTarget?.docNo ?? '선택한 문서'}를 삭제할까요? 삭제한 문서는 복구할 수 없습니다.`}
        confirmLabel="삭제"
        variant="danger"
        isPending={deleteMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
        }}
      />
      {productPickerIdx !== null && (
        <ProductPickerModal
          products={products?.items ?? []}
          title="상품 교체"
          onConfirm={([p]) => onSelectProductFromPicker(p)}
          onClose={() => setProductPickerIdx(null)}
        />
      )}
      {showProductAdder && (
        <ProductPickerModal
          products={products?.items ?? []}
          multiSelect
          existingIds={form.items.map((item) => item.productId).filter((id): id is string => Boolean(id))}
          onConfirm={onAddProductsFromPicker}
          onClose={() => setShowProductAdder(false)}
        />
      )}

      {showModal && !editing && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-none flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <div className="w-9 h-9 flex items-center justify-center shrink-0 rounded-lg bg-[#edf0ec] dark:bg-[#2a3a2d]">
                <FileText className="w-5 h-5 text-[var(--color-primary)]" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white">문서 작성</h3>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title="닫기">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); submitForm() }} className="p-5 space-y-4 overflow-y-auto">
              {/* 기본 정보 */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">문서 종류</label>
                  <select value={form.docType === 'QUOTE' ? `QUOTE|${form.printTitle}` : 'STATEMENT'} onChange={(e) => {
                    const [docType, printTitle] = e.target.value.split('|')
                    setForm((p) => ({ ...p, docType, printTitle: printTitle || p.printTitle }))
                  }} className={inputCls}>
                    <option value="STATEMENT">거래명세서</option>
                    {QUOTE_PRINT_TITLES.map((title) => <option key={title} value={`QUOTE|${title}`}>{title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">날짜 *</label>
                  <input type="date" value={form.docDate} onChange={(e) => setForm((p) => ({ ...p, docDate: e.target.value }))} required className={inputCls} />
                </div>

                {/* 거래처 통합 필드 — 2칸 차지 */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">거래처</label>
                  {form.clientId ? (
                    <div className="flex items-center gap-2 border border-[var(--color-primary)] bg-[#edf0ec] dark:bg-gray-800/60 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--color-primary)] dark:text-[var(--color-primary)] truncate">{form.clientName}</p>
                        {(selectedClient?.businessNo || selectedClient?.phone) && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                            {[selectedClient.businessNo, selectedClient.phone].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <button type="button" onClick={() => setShowClientPicker(true)} className="shrink-0 p-1.5 rounded text-[var(--color-primary)] hover:bg-[#d8ddd8] dark:hover:bg-gray-700 transition-colors" title="거래처 변경">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => setForm((p) => ({ ...p, clientId: '', clientName: '' }))} className="shrink-0 p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors" title="거래처 해제">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <input
                        value={form.clientName}
                        onChange={(e) => setForm((p) => ({ ...p, clientName: e.target.value }))}
                        placeholder="거래처명 직접 입력 또는 목록 검색"
                        className={`${inputCls} flex-1`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowClientPicker(true)}
                        className="shrink-0 px-3 border border-gray-200 dark:border-gray-700 text-gray-500 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] bg-white dark:bg-gray-800"
                        title="거래처 검색"
                      >
                        검색
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 품목 */}
              <div className="border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/70 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    품목
                    {form.items.length > 0 && <span className="ml-1.5 text-xs font-normal text-gray-400">{form.items.length}개</span>}
                  </span>
                  <button type="button" onClick={() => setShowProductAdder(true)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] rounded transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                    상품 추가
                  </button>
                </div>

                {form.items.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-sm text-gray-400 mb-2">추가된 상품이 없습니다</p>
                    <button type="button" onClick={() => setShowProductAdder(true)} className="text-xs text-[var(--color-primary)] dark:text-[var(--color-primary)] hover:underline">
                      상품 추가하기
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead>
                        <tr className={cn(ui.thead, 'text-xs')}>
                          <th className="text-left px-3 py-2 font-semibold">상품</th>
                          <th className="text-center px-2 py-2 w-28 font-semibold">단위</th>
                          <th className="text-center px-2 py-2 w-20 font-semibold">낱개 단위</th>
                          <th className="text-center px-2 py-2 w-20 font-semibold">수량</th>
                          <th className="text-center px-2 py-2 w-28 font-semibold">단가</th>
                          <th className="text-center px-2 py-2 w-28 font-semibold">금액</th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {form.items.map((item, idx) => (
                          <QuoteItemRow
                            key={idx}
                            item={item}
                            tdInput={tdInput}
                            unitOptions={unitOptions}
                            onChange={(patch) => updateItem(idx, patch)}
                            onReplacePicker={() => setProductPickerIdx(idx)}
                            onRemove={() => removeItem(idx)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px]">
                <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">비고</label><textarea value={form.memo} onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))} rows={3} className={inputCls} /></div>
                <div className="bg-gray-50 dark:bg-gray-800/60 rounded p-4 flex flex-col justify-between"><span className="text-sm text-gray-500">합계금액</span><span className="text-base font-bold text-gray-900 dark:text-white">￦{formatNumber(totalAmount)}</span></div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <X className="w-4 h-4" />
                  취소
                </button>
                <button type="button" onClick={() => submitForm(true)} disabled={isSaving} className="flex items-center gap-1.5 px-4 py-2 border border-[var(--color-primary)]/30 text-[var(--color-primary)] dark:text-[var(--color-primary)] dark:border-[#7ba885]/30 rounded text-sm hover:bg-[#edf0ec] dark:hover:bg-gray-800/60 disabled:opacity-50 transition-colors">
                  <Printer className="w-4 h-4" />
                  저장 후 인쇄
                </button>
                <button type="submit" disabled={isSaving} className="flex items-center gap-1.5 px-5 py-2 bg-[var(--color-primary)] text-white rounded text-sm font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors">
                  {isSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function QuoteItemRow({ item, tdInput, unitOptions, onChange, onReplacePicker, onRemove }: {
  item: ItemRow
  tdInput: string
  unitOptions: string[]
  onChange: (patch: Partial<ItemRow>) => void
  onReplacePicker: () => void
  onRemove: () => void
}) {
  const options = unitOptions.length ? unitOptions : [OUTPUT_DOC_UNIT]
  const unit = options.includes(normalizeOutputDocUnit(item.unit)) ? normalizeOutputDocUnit(item.unit) : pickDefaultUnit(options)
  const handleUnitChange = (value: string) => {
    const nextUnit = normalizeOutputDocUnit(value)
    onChange({ unit: nextUnit })
  }

  return (
    <tr>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex-1 min-w-0">
            {item.productName ? (
              <>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.productName}</p>
                {item.productCode && <p className="text-xs text-gray-400 font-mono">{item.productCode}</p>}
              </>
            ) : (
              <p className="text-sm text-gray-400 italic">상품 미선택</p>
            )}
          </div>
          <button type="button" onClick={onReplacePicker} className="shrink-0 p-1.5 rounded text-gray-400 hover:text-[var(--color-primary)] border border-gray-200 dark:border-gray-700 hover:border-[var(--color-primary)] transition-colors" title="상품 교체">
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
      <td className="px-2 py-2">
        <select
          value={unit}
          onChange={(e) => handleUnitChange(e.target.value)}
          className={`${tdInput} cursor-pointer text-center font-semibold`}
        >
          {options.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </td>
      <td className="bg-gray-100 dark:bg-gray-800 text-center tabular-nums text-sm text-gray-500 dark:text-gray-400 select-none">
        {(() => { const s = getSpecQtyForUnit(itemSpecSource(item), unit); return s > 1 ? s : '-' })()}
      </td>
      <td className="px-2 py-2"><input type="number" min={0} value={item.qty} onChange={(e) => onChange({ qty: Number(e.target.value) || 0 })} className={`${tdInput} text-right`} /></td>
      <td className="px-2 py-2"><input type="number" min={0} value={item.unitPrice} onChange={(e) => onChange({ unitPrice: Number(e.target.value) || 0 })} className={`${tdInput} text-right`} /></td>
      <td className="px-2 py-2 text-right tabular-nums font-medium">￦{formatNumber(item.amount)}</td>
      <td className="px-2 py-2 text-center"><button type="button" onClick={onRemove} className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors" title="삭제"><Trash2 className="w-3.5 h-3.5" /></button></td>
    </tr>
  )
}
