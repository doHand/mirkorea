'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, FileText, FilePlus2, Pencil, Plus, Printer, Search, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { clientApi } from '@/api/client.api'
import { productApi } from '@/api/product.api'
import { quoteApi } from '@/api/quote.api'
import { PurchaseOrdersContent } from '@/components/PurchaseOrdersContent'
import { useSupplierInfoStore } from '@/stores/supplier-info.store'
import { formatNumber } from '@/utils/format'
import { cn } from '@/utils/cn'
import { editableRowProps } from '@/utils/table'
import * as ui from '@/styles/ui'
import {
  QUOTE_PRINT_TITLES,
  printQuoteDocument,
} from '@/utils/printDocument'
import type { Client, Product, Quote } from '@/types/api.types'

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
  unit: string
  qty: number
  unitPrice: number
  amount: number
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

const today = () => new Date().toISOString().slice(0, 10)
const EMPTY_ITEM: ItemRow = { productName: '', unit: '', qty: 1, unitPrice: 0, amount: 0 }
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
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const tabParam = (typeof q.tab === 'string' ? q.tab : '').toUpperCase()
  const [docTypeFilter, setDocTypeFilter] = useState(() => tabParam || 'STATEMENT')
  const [page, setPage] = useState(1)
  const [purchaseCreateTrigger, setPurchaseCreateTrigger] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Quote | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [prefillKey, setPrefillKey] = useState('')
  const [listPrint, setListPrint] = useState<{ quote: Quote; title: string } | null>(null)
  const [showClientPicker, setShowClientPicker] = useState(false)
  const [productPickerIdx, setProductPickerIdx] = useState<number | null>(null)
  const [showProductAdder, setShowProductAdder] = useState(false)
  const productIdsParam = (typeof q.productIds === 'string' ? q.productIds : '')
  const docTypeParam = ((typeof q.docType === 'string' ? q.docType : '')).toUpperCase()
  const autoPrintParam = ['1', 'true'].includes(((typeof q.print === 'string' ? q.print : '')).toLowerCase())

  useEffect(() => {
    if (['STATEMENT', 'QUOTE', 'PURCHASE'].includes(tabParam)) {
      setDocTypeFilter(tabParam)
    }
  }, [tabParam])

  const { data, isLoading } = useQuery({
    queryKey: ['quotes', { search, docTypeFilter, page }],
    queryFn: () => quoteApi.findAll({ docType: docTypeFilter || undefined, search: search || undefined, page }),
    placeholderData: (prev) => prev,
  })

  const { data: clients } = useQuery({ queryKey: ['clients-all'], queryFn: clientApi.findAllActive })
  const { data: products } = useQuery({ queryKey: ['products-all'], queryFn: () => productApi.findAll({ limit: 999 }) })

  const findClientForQuote = (quote: Quote) =>
    clients?.find((client) => client.id === quote.clientId)
    ?? clients?.find((client) => client.name === quote.clientName)
    ?? null

  const selectedClient = clients?.find((c) => c.id === form.clientId)

  const buildPayload = () => ({
    docType: form.docType,
    clientId: form.clientId || undefined,
    clientName: form.clientName || undefined,
    docDate: form.docDate,
    memo: form.memo || undefined,
    items: form.items.map((it) => ({
      productId: it.productId,
      productCode: it.productCode,
      productName: it.productName,
      unit: it.unit,
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
    onSuccess: () => { toast.success('문서 수정 완료'); qc.invalidateQueries({ queryKey: ['quotes'] }); closeModal() },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => quoteApi.delete(id),
    onSuccess: () => { toast.success('문서 삭제 완료'); qc.invalidateQueries({ queryKey: ['quotes'] }) },
  })

  const closeModal = () => { setShowModal(false); setEditing(null); setForm({ ...EMPTY_FORM, docDate: today() }) }
  const commitSearch = () => { setSearch(searchInput); setPage(1) }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, docDate: today() })
    setShowModal(true)
  }

  const openEdit = (quote: Quote) => {
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
        unit: it.unit ?? '',
        qty: it.qty,
        unitPrice: Number(it.unitPrice),
        amount: Number(it.amount),
      })),
    })
    setShowModal(true)
  }

  useEffect(() => {
    if (!productIdsParam || productIdsParam === prefillKey) return
    const prefillProducts = async () => {
      const ids = productIdsParam.split(',').filter(Boolean)
      const selectedProducts = await Promise.all(ids.map((id) => productApi.findById(id)))
      const docType: Quote['docType'] = docTypeParam === 'QUOTE' ? 'QUOTE' : 'STATEMENT'
      const items = selectedProducts.map((product, index) => ({
        id: String(index),
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        unit: product.unit ?? '',
        qty: 1,
        unitPrice: Number(product.sellPrice ?? 0),
        amount: Number(product.sellPrice ?? 0),
        sortOrder: index,
      }))
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
  }, [prefillKey, productIdsParam, docTypeParam, autoPrintParam, supplierInfo])

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

  const selectProduct = (idx: number, product: Product) => updateItem(idx, {
    productId: product.id,
    productCode: product.code,
    productName: product.name,
    unit: product.unit ?? '',
    unitPrice: Number(product.sellPrice ?? 0),
    amount: Number(product.sellPrice ?? 0) * (form.items[idx]?.qty ?? 1),
  })

  const onSelectClient = (client: Client) => {
    setForm((p) => ({ ...p, clientId: client.id, clientName: client.name }))
    setShowClientPicker(false)
  }

  const onSelectProductFromPicker = (product: Product) => {
    if (productPickerIdx !== null) selectProduct(productPickerIdx, product)
    setProductPickerIdx(null)
  }

  const onAddProductsFromPicker = (selected: Product[]) => {
    const newItems: ItemRow[] = selected.map((product) => ({
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      unit: product.unit ?? '',
      qty: 1,
      unitPrice: Number(product.sellPrice ?? 0),
      amount: Number(product.sellPrice ?? 0),
    }))
    setForm((p) => {
      const existing = p.items.filter((it) => it.productName.trim())
      return { ...p, items: [...existing, ...newItems] }
    })
    setShowProductAdder(false)
  }

  const submitForm = async (printAfterSave = false) => {
    const printWindow = printAfterSave ? window.open('', '_blank', 'width=820,height=1060') : null
    if (printAfterSave && !printWindow) { toast.error('팝업 차단을 해제해주세요'); return }
    try {
      const saved = editing ? await updateMutation.mutateAsync() : await createMutation.mutateAsync()
      if (printAfterSave) printQuoteDocument(saved, printWindow, findClientForQuote(saved), supplierInfo, form.printTitle)
    } catch {
      printWindow?.close()
      toast.error('저장 실패')
    }
  }

  const totalAmount = form.items.reduce((sum, item) => sum + item.amount, 0)
  const inputCls = 'w-full border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm outline-none focus:border-[#2D4033] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400'
  const tdInput = 'w-full border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-sm outline-none focus:border-[#2D4033] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'

  const DOC_TABS = [
    { value: 'STATEMENT', label: '거래명세서', href: null },
    { value: 'QUOTE',     label: '견적서',     href: null },
    { value: 'PURCHASE',  label: '발주서',     href: null },
  ]

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
            <FileText size={14} /> 거래명세서/견적서 작성
          </button>
          <button onClick={() => { setDocTypeFilter('PURCHASE'); setPurchaseCreateTrigger((n) => n + 1) }} className="flex items-center gap-1.5 rounded bg-[#2D4033] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#24352a]">
            <FilePlus2 size={14} /> 발주서 작성
          </button>
        </div>
      </div>

      {/* 공통 탭 */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 shrink-0">
        {DOC_TABS.map((tab) => (
          <button key={tab.value} onClick={() => { setDocTypeFilter(tab.value); setPage(1) }}
            className={['px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              docTypeFilter === tab.value
                ? 'border-[#2D4033] text-[#2D4033] dark:text-[#7ba885] dark:border-[#7ba885]'
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
      <div className="flex flex-wrap gap-2 border border-[#d8ddd8] bg-white p-3 shadow-sm dark:bg-gray-900 shrink-0">
        <div className="relative min-w-60 flex-1 flex gap-1.5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commitSearch()} placeholder="문서번호, 거래처명 검색" className="w-full border border-gray-200 dark:border-gray-700 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#2D4033] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400" />
          </div>
          <button onClick={commitSearch} className="px-3 py-2 text-sm bg-[#2D4033] text-white hover:bg-[#24352a] transition-colors font-medium">검색</button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col border border-[#d8ddd8] bg-white shadow-sm dark:bg-gray-900">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className={ui.thead}>
                <th className={cn(ui.th, 'text-left')}>거래처</th>
                <th className={cn(ui.th, 'text-left')}>문서번호</th>
                <th className={ui.th}>종류</th>
                <th className={ui.th}>날짜</th>
                <th className={ui.thR}>합계금액</th>
                <th className={ui.th}>상태</th>
                <th className="w-28 px-3 py-3" />
              </tr>
            </thead>
            <tbody className={ui.tbody}>
              {isLoading && <tr><td colSpan={7} className="text-center py-10 text-gray-400">불러오는 중...</td></tr>}
              {!isLoading && data?.items.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-gray-400">문서가 없습니다</td></tr>}
              {data?.items.map((quote) => {
                const { className: editableClass, ...editableHandlers } = editableRowProps(true, () => openEdit(quote))
                return (
                <tr key={quote.id} {...editableHandlers} className={cn(ui.tr, editableClass)}>
                  <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{quote.clientName ?? '-'}</td>
                  <td className="px-3 py-3 font-mono text-xs text-[#2D4033] dark:text-gray-300 font-semibold">{quote.docNo}</td>
                  <td className="px-3 py-3 text-center"><span className={`px-2 py-0.5 text-xs font-medium ${quote.docType === 'STATEMENT' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400'}`}>{DOC_TYPE_LABEL[quote.docType]}</span></td>
                  <td className="px-3 py-3 text-center text-gray-500">{quote.docDate}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">￦{formatNumber(quote.totalAmount)}</td>
                  <td className="px-3 py-3 text-center"><span className={`px-2 py-1 text-xs font-medium ${STATUS_STYLE[quote.status]}`}>{STATUS_LABEL[quote.status]}</span></td>
                  <td className="px-3 py-2">
                    <div className="flex justify-center gap-1">
                      {quote.docType === 'QUOTE' ? (
                        <button onClick={(e) => { e.stopPropagation(); setListPrint({ quote, title: '견적서' }) }} className={ui.btnIconPrint} title="인쇄 (제목 선택)"><Printer size={14} /></button>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); printQuoteDocument(quote, null, findClientForQuote(quote), supplierInfo) }} className={ui.btnIconPrint} title="인쇄"><Printer size={14} /></button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); openEdit(quote) }} className={ui.btnIconEdit} title="수정"><Pencil size={14} /></button>
                      <button onClick={(e) => { e.stopPropagation(); if (confirm('삭제하시겠습니까?')) deleteMutation.mutate(quote.id) }} className={ui.btnIconDelete} title="삭제"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 shrink-0">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg border border-gray-200 disabled:opacity-40"><ChevronLeft size={16} /></button>
          <span className="text-sm text-gray-500">{formatNumber(page)} / {formatNumber(data.totalPages)}</span>
          <button onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages} className="p-2 rounded-lg border border-gray-200 disabled:opacity-40"><ChevronRight size={16} /></button>
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
                  className={`px-3 py-1.5 text-sm border transition-colors font-medium ${listPrint.title === t ? 'bg-[#2D4033] text-white border-[#2D4033]' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-[#2D4033]'}`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setListPrint(null)} className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">취소</button>
              <button onClick={() => { printQuoteDocument(listPrint.quote, null, findClientForQuote(listPrint.quote), supplierInfo, listPrint.title); setListPrint(null) }}
                className="flex-1 px-3 py-2 text-sm bg-[#2D4033] text-white hover:bg-[#24352a] font-medium flex items-center justify-center gap-1.5">
                <Printer size={13} />인쇄
              </button>
            </div>
          </div>
        </div>
      )}

      {showClientPicker && (
        <ClientPickerModal clients={clients ?? []} onSelect={onSelectClient} onClose={() => setShowClientPicker(false)} />
      )}
      {productPickerIdx !== null && (
        <ProductPickerModal products={products?.items ?? []} onSelect={onSelectProductFromPicker} onClose={() => setProductPickerIdx(null)} />
      )}
      {showProductAdder && (
        <ProductMultiPickerModal products={products?.items ?? []} onConfirm={onAddProductsFromPicker} onClose={() => setShowProductAdder(false)} />
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-none flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <div className="w-9 h-9 flex items-center justify-center shrink-0 bg-[#edf0ec]"><FileText size={16} className="text-[#2D4033]" /></div>
              <div className="flex-1"><h3 className="font-semibold text-gray-900 dark:text-white">{editing ? '문서 수정' : '문서 작성'}</h3>{editing && <p className="text-xs text-gray-400 font-mono mt-0.5">{editing.docNo}</p>}</div>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"><X size={18} /></button>
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
                    <div className="flex items-center gap-2 border border-[#2D4033] bg-[#edf0ec] dark:bg-gray-800/60 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#2D4033] dark:text-[#7ba885] truncate">{form.clientName}</p>
                        {(selectedClient?.businessNo || selectedClient?.phone) && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                            {[selectedClient.businessNo, selectedClient.phone].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <button type="button" onClick={() => setShowClientPicker(true)} className="shrink-0 p-1 text-[#2D4033] dark:text-[#7ba885] hover:bg-[#d8ddd8] dark:hover:bg-gray-700" title="변경">
                        <Pencil size={13} />
                      </button>
                      <button type="button" onClick={() => setForm((p) => ({ ...p, clientId: '', clientName: '' }))} className="shrink-0 p-1 text-gray-400 hover:text-red-500" title="삭제">
                        <X size={14} />
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
                        className="shrink-0 px-3 border border-gray-200 dark:border-gray-700 text-gray-500 hover:border-[#2D4033] hover:text-[#2D4033] bg-white dark:bg-gray-800"
                        title="거래처 검색"
                      >
                        <Search size={14} />
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
                  <button type="button" onClick={() => setShowProductAdder(true)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-[#2D4033] text-white hover:bg-[#24352a]">
                    <Plus size={12} />상품 추가
                  </button>
                </div>

                {form.items.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-sm text-gray-400 mb-2">추가된 상품이 없습니다</p>
                    <button type="button" onClick={() => setShowProductAdder(true)} className="text-xs text-[#2D4033] dark:text-[#7ba885] hover:underline">
                      상품 추가하기
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead>
                        <tr className="bg-[#2D4033] text-white text-xs">
                          <th className="text-left px-3 py-2 font-semibold">상품</th>
                          <th className="text-center px-2 py-2 w-20 font-semibold">단위</th>
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
                <button type="button" onClick={closeModal} className="px-4 py-2 border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">취소</button>
                <button type="button" onClick={() => submitForm(true)} disabled={createMutation.isPending || updateMutation.isPending} className="px-4 py-2 border border-[#2D4033]/30 text-[#2D4033] dark:text-[#7ba885] dark:border-[#7ba885]/30 text-sm hover:bg-[#edf0ec] dark:hover:bg-gray-800/60 disabled:opacity-50"><Printer size={14} className="inline mr-1" />저장 후 인쇄</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-5 py-2 bg-[#2D4033] text-white text-sm font-semibold hover:bg-[#24352a] disabled:opacity-50">{createMutation.isPending || updateMutation.isPending ? '저장 중...' : '저장'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function QuoteItemRow({ item, tdInput, onChange, onReplacePicker, onRemove }: {
  item: ItemRow
  tdInput: string
  onChange: (patch: Partial<ItemRow>) => void
  onReplacePicker: () => void
  onRemove: () => void
}) {
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
          <button type="button" onClick={onReplacePicker} className="shrink-0 p-1 text-gray-400 hover:text-[#2D4033] border border-gray-200 dark:border-gray-700 hover:border-[#2D4033]" title="상품 교체">
            <Pencil size={11} />
          </button>
        </div>
      </td>
      <td className="px-2 py-2"><input value={item.unit} onChange={(e) => onChange({ unit: e.target.value })} className={`${tdInput} text-center`} /></td>
      <td className="px-2 py-2"><input type="number" min={0} value={item.qty} onChange={(e) => onChange({ qty: Number(e.target.value) || 0 })} className={`${tdInput} text-right`} /></td>
      <td className="px-2 py-2"><input type="number" min={0} value={item.unitPrice} onChange={(e) => onChange({ unitPrice: Number(e.target.value) || 0 })} className={`${tdInput} text-right`} /></td>
      <td className="px-2 py-2 text-right tabular-nums font-medium">￦{formatNumber(item.amount)}</td>
      <td className="px-2 py-2 text-center"><button type="button" onClick={onRemove} className="p-1 rounded text-gray-400 hover:text-red-500"><Trash2 size={13} /></button></td>
    </tr>
  )
}

function ClientPickerModal({ clients, onSelect, onClose }: {
  clients: Client[]
  onSelect: (client: Client) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const q = search.toLowerCase()
  const filtered = q
    ? clients.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q) || (c.businessNo ?? '').includes(q))
    : clients

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-2xl max-h-[80vh] flex flex-col border border-gray-200 dark:border-gray-700 shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">거래처 선택</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={16} /></button>
        </div>
        <div className="px-4 py-1.5 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="거래처명, 전화번호, 사업자번호 검색" className="w-full border border-gray-200 dark:border-gray-700 pl-8 pr-3 py-2 text-sm outline-none focus:border-[#2D4033] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="bg-[#2D4033] text-white">
                <th className="px-4 py-1.5 text-left font-semibold">거래처명</th>
                <th className="px-4 py-1.5 text-left font-semibold">전화번호</th>
                <th className="px-4 py-1.5 text-left font-semibold">사업자번호</th>
                <th className="px-4 py-1.5 text-left font-semibold">주소</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-400">검색 결과가 없습니다</td></tr>}
              {filtered.map((client) => (
                <tr key={client.id} onClick={() => onSelect(client)} className="cursor-pointer hover:bg-[#f7f8f5] dark:hover:bg-gray-800/40">
                  <td className="px-4 py-1.5 font-medium text-gray-900 dark:text-gray-100">{client.name}</td>
                  <td className="px-4 py-1.5 text-gray-500 dark:text-gray-400">{client.phone ?? '-'}</td>
                  <td className="px-4 py-1.5 text-gray-500 dark:text-gray-400 font-mono text-xs">{client.businessNo ?? '-'}</td>
                  <td className="px-4 py-1.5 text-gray-500 dark:text-gray-400 truncate max-w-[180px]">{client.address ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400 text-right shrink-0">
          전체 {clients.length}개 · 검색 {filtered.length}개
        </div>
      </div>
    </div>
  )
}

function ProductPickerModal({ products, onSelect, onClose }: {
  products: Product[]
  onSelect: (product: Product) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const q = search.toLowerCase()
  const filtered = q
    ? products.filter((p) => p.name.toLowerCase().includes(q) || (p.code ?? '').toLowerCase().includes(q) || (p.spec ?? '').toLowerCase().includes(q))
    : products

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-3xl max-h-[80vh] flex flex-col border border-gray-200 dark:border-gray-700 shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">상품 교체</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={16} /></button>
        </div>
        <div className="px-4 py-1.5 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="상품명, 상품코드, 규격 검색" className="w-full border border-gray-200 dark:border-gray-700 pl-8 pr-3 py-2 text-sm outline-none focus:border-[#2D4033] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="bg-[#2D4033] text-white">
                <th className="px-4 py-1.5 text-left font-semibold">코드</th>
                <th className="px-4 py-1.5 text-left font-semibold">상품명</th>
                <th className="px-4 py-1.5 text-left font-semibold">규격</th>
                <th className="px-4 py-1.5 text-center font-semibold">단위</th>
                <th className="px-4 py-1.5 text-right font-semibold">판매단가</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400">검색 결과가 없습니다</td></tr>}
              {filtered.map((product) => (
                <tr key={product.id} onClick={() => onSelect(product)} className="cursor-pointer hover:bg-[#f7f8f5] dark:hover:bg-gray-800/40">
                  <td className="px-4 py-1.5 font-mono text-xs text-[#2D4033] dark:text-[#7ba885]">{product.code}</td>
                  <td className="px-4 py-1.5 font-medium text-gray-900 dark:text-gray-100">{product.name}</td>
                  <td className="px-4 py-1.5 text-gray-500 dark:text-gray-400 text-xs">{product.spec ?? '-'}</td>
                  <td className="px-4 py-1.5 text-center text-gray-600 dark:text-gray-400">{product.unit}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums text-gray-900 dark:text-gray-100">￦{formatNumber(product.sellPrice ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400 text-right shrink-0">
          전체 {products.length}개 · 검색 {filtered.length}개
        </div>
      </div>
    </div>
  )
}

function ProductMultiPickerModal({ products, onConfirm, onClose }: {
  products: Product[]
  onConfirm: (selected: Product[]) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const q = search.toLowerCase()
  const filtered = q
    ? products.filter((p) => p.name.toLowerCase().includes(q) || (p.code ?? '').toLowerCase().includes(q) || (p.spec ?? '').toLowerCase().includes(q))
    : products

  const toggle = (id: string) =>
    setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id))

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) filtered.forEach((p) => next.delete(p.id))
      else filtered.forEach((p) => next.add(p.id))
      return next
    })
  }

  const selectedCount = selectedIds.size
  const selectedProducts = products.filter((p) => selectedIds.has(p.id))

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-3xl max-h-[80vh] flex flex-col border border-gray-200 dark:border-gray-700 shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">상품 추가</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={16} /></button>
        </div>
        <div className="px-4 py-1.5 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="상품명, 상품코드, 규격 검색" className="w-full border border-gray-200 dark:border-gray-700 pl-8 pr-3 py-2 text-sm outline-none focus:border-[#2D4033] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="bg-[#2D4033] text-white">
                <th className="px-3 py-1.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleAll}
                    className="w-3.5 h-3.5 accent-white cursor-pointer"
                  />
                </th>
                <th className="px-4 py-1.5 text-left font-semibold">코드</th>
                <th className="px-4 py-1.5 text-left font-semibold">상품명</th>
                <th className="px-4 py-1.5 text-left font-semibold">규격</th>
                <th className="px-4 py-1.5 text-center font-semibold">단위</th>
                <th className="px-4 py-1.5 text-right font-semibold">판매단가</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-400">검색 결과가 없습니다</td></tr>}
              {filtered.map((product) => {
                const checked = selectedIds.has(product.id)
                return (
                  <tr
                    key={product.id}
                    onClick={() => toggle(product.id)}
                    className={`cursor-pointer transition-colors ${checked ? 'bg-[#edf0ec] dark:bg-[#2D4033]/20' : 'hover:bg-[#f7f8f5] dark:hover:bg-gray-800/40'}`}
                  >
                    <td className="px-3 py-1.5 text-center">
                      <input type="checkbox" checked={checked} onChange={() => toggle(product.id)} onClick={(e) => e.stopPropagation()} className="w-3.5 h-3.5 accent-[#2D4033] cursor-pointer" />
                    </td>
                    <td className="px-4 py-1.5 font-mono text-xs text-[#2D4033] dark:text-[#7ba885]">{product.code}</td>
                    <td className="px-4 py-1.5 font-medium text-gray-900 dark:text-gray-100">{product.name}</td>
                    <td className="px-4 py-1.5 text-gray-500 dark:text-gray-400 text-xs">{product.spec ?? '-'}</td>
                    <td className="px-4 py-1.5 text-center text-gray-600 dark:text-gray-400">{product.unit}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums text-gray-900 dark:text-gray-100">￦{formatNumber(product.sellPrice ?? 0)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {selectedCount > 0
              ? <span className="text-[#2D4033] dark:text-[#7ba885] font-medium">{selectedCount}개 선택됨</span>
              : `전체 ${products.length}개 · 검색 ${filtered.length}개`}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">취소</button>
            <button
              type="button"
              onClick={() => selectedCount > 0 && onConfirm(selectedProducts)}
              disabled={selectedCount === 0}
              className="px-4 py-1.5 text-sm bg-[#2D4033] text-white hover:bg-[#24352a] disabled:opacity-40 font-medium min-w-[80px]"
            >
              추가 {selectedCount > 0 ? `(${selectedCount})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
