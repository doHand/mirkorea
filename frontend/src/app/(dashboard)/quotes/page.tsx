'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, FileText, Pencil, Plus, Printer, Search, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { clientApi } from '@/api/client.api'
import { productApi } from '@/api/product.api'
import { quoteApi } from '@/api/quote.api'
import { useSupplierInfoStore } from '@/stores/supplier-info.store'
import { formatNumber } from '@/utils/format'
import {
  QUOTE_PRINT_TITLES, type QuotePrintTitle,
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
  items: [{ ...EMPTY_ITEM }],
  printTitle: '견적서',
}

export default function QuotesPage() {
  const qc = useQueryClient()
  const searchParams = useSearchParams()
  const supplierInfo = useSupplierInfoStore((state) => state.info)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [docTypeFilter, setDocTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Quote | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [prefillKey, setPrefillKey] = useState('')
  const [listPrint, setListPrint] = useState<{ quote: Quote; title: string } | null>(null)
  const productIdsParam = searchParams.get('productIds') ?? ''
  const docTypeParam = (searchParams.get('docType') ?? '').toUpperCase()
  const autoPrintParam = ['1', 'true'].includes((searchParams.get('print') ?? '').toLowerCase())

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

  const closeModal = () => { setShowModal(false); setEditing(null); setForm({ ...EMPTY_FORM, docDate: today(), items: [{ ...EMPTY_ITEM }] }) }
  const commitSearch = () => { setSearch(searchInput); setPage(1) }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, docDate: today(), items: [{ ...EMPTY_ITEM }] })
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
      const docType = docTypeParam === 'QUOTE' ? 'QUOTE' : 'STATEMENT'
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
      setForm({
        ...EMPTY_FORM,
        docType,
        docDate: today(),
        items,
      })
      setShowModal(true)
      setPrefillKey(productIdsParam)

      if (autoPrintParam) {
        const draftQuote = {
          id: '',
          docNo: '',
          docType,
          clientId: undefined,
          clientName: '',
          docDate: today(),
          memo: '',
          totalAmount: items.reduce((sum, item) => sum + item.amount, 0),
          status: 'DRAFT' as const,
          createdBy: '',
          createdAt: today(),
          items,
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

  const addItem = () => setForm((prev) => ({ ...prev, items: [...prev.items, { ...EMPTY_ITEM }] }))
  const removeItem = (idx: number) => setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))

  const selectProduct = (idx: number, product: Product) => updateItem(idx, {
    productId: product.id,
    productCode: product.code,
    productName: product.name,
    unit: product.unit ?? '',
    unitPrice: Number(product.sellPrice ?? 0),
    amount: Number(product.sellPrice ?? 0) * (form.items[idx]?.qty ?? 1),
  })

  const handleClientChange = (clientId: string) => {
    const client = clients?.find((c) => c.id === clientId)
    setForm((prev) => ({ ...prev, clientId, clientName: client?.name ?? prev.clientName }))
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
  const inputCls = 'w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400'
  const tdInput = 'w-full border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">거래명세서 / 견적서</h2>
          {data && <p className="text-xs text-gray-400 mt-0.5">전체 {formatNumber(data.total)}건</p>}
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm shadow-indigo-500/20">
          <Plus size={15} />문서 작성
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-3 flex gap-2 shadow-sm flex-wrap">
        <div className="relative flex-1 min-w-[220px] flex gap-1.5">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commitSearch()} placeholder="문서번호, 거래처명 검색" className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400" />
          </div>
          <button onClick={commitSearch} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium">검색</button>
        </div>
        <select value={docTypeFilter} onChange={(e) => { setDocTypeFilter(e.target.value); setPage(1) }} className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          <option value="">전체</option>
          <option value="STATEMENT">거래명세서</option>
          <option value="QUOTE">견적서</option>
        </select>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-gray-50/80 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">거래처</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">문서번호</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">종류</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">날짜</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">합계금액</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">상태</th>
                <th className="px-4 py-3 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading && <tr><td colSpan={7} className="text-center py-10 text-gray-400">불러오는 중...</td></tr>}
              {!isLoading && data?.items.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-gray-400">문서가 없습니다</td></tr>}
              {data?.items.map((quote) => (
                <tr key={quote.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{quote.clientName ?? '-'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{quote.docNo}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${quote.docType === 'STATEMENT' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400'}`}>{DOC_TYPE_LABEL[quote.docType]}</span></td>
                  <td className="px-4 py-3 text-gray-500">{quote.docDate}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">￦{formatNumber(quote.totalAmount)}</td>
                  <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[quote.status]}`}>{STATUS_LABEL[quote.status]}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {quote.docType === 'QUOTE' ? (
                        <button onClick={() => setListPrint({ quote, title: '견적서' })} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50" title="인쇄 (제목 선택)"><Printer size={14} /></button>
                      ) : (
                        <button onClick={() => printQuoteDocument(quote, null, findClientForQuote(quote), supplierInfo)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50" title="인쇄"><Printer size={14} /></button>
                      )}
                      <button onClick={() => openEdit(quote)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50" title="수정"><Pencil size={14} /></button>
                      <button onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMutation.mutate(quote.id) }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50" title="삭제"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg border border-gray-200 disabled:opacity-40"><ChevronLeft size={16} /></button>
          <span className="text-sm text-gray-500">{formatNumber(page)} / {formatNumber(data.totalPages)}</span>
          <button onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages} className="p-2 rounded-lg border border-gray-200 disabled:opacity-40"><ChevronRight size={16} /></button>
        </div>
      )}

      {/* 리스트에서 견적서 인쇄 제목 선택 */}
      {listPrint && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-xs p-5 border border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">출력 제목 선택</h3>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {QUOTE_PRINT_TITLES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setListPrint({ ...listPrint, title: t })}
                  className={`px-3 py-1.5 text-sm rounded-xl border transition-colors font-medium ${
                    listPrint.title === t
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-indigo-400'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setListPrint(null)} className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">취소</button>
              <button
                onClick={() => {
                  printQuoteDocument(listPrint.quote, null, findClientForQuote(listPrint.quote), supplierInfo, listPrint.title)
                  setListPrint(null)
                }}
                className="flex-1 px-3 py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium flex items-center justify-center gap-1.5"
              >
                <Printer size={13} />인쇄
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0"><FileText size={16} className="text-indigo-600 dark:text-indigo-400" /></div>
              <div className="flex-1"><h3 className="font-semibold text-gray-900 dark:text-white">{editing ? '문서 수정' : '문서 작성'}</h3>{editing && <p className="text-xs text-gray-400 font-mono mt-0.5">{editing.docNo}</p>}</div>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"><X size={18} /></button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); submitForm() }} className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">문서 종류</label>
                  <select value={form.docType} onChange={(e) => setForm((p) => ({ ...p, docType: e.target.value }))} className={inputCls}>
                    <option value="STATEMENT">거래명세서</option>
                    <option value="QUOTE">견적서류</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">날짜 *</label>
                  <input type="date" value={form.docDate} onChange={(e) => setForm((p) => ({ ...p, docDate: e.target.value }))} required className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">거래처 선택</label>
                  <select value={form.clientId} onChange={(e) => handleClientChange(e.target.value)} className={inputCls}>
                    <option value="">직접 입력</option>
                    {(clients ?? []).map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">거래처명</label>
                  <input value={form.clientName} onChange={(e) => setForm((p) => ({ ...p, clientName: e.target.value }))} placeholder="거래처명" className={inputCls} />
                </div>
              </div>
              {form.docType === 'QUOTE' && (
                <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl px-4 py-2.5 border border-indigo-100 dark:border-indigo-800">
                  <Printer size={14} className="text-indigo-500 shrink-0" />
                  <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300 shrink-0">출력 제목</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {QUOTE_PRINT_TITLES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, printTitle: t }))}
                        className={`px-2.5 py-1 text-xs rounded-lg border transition-colors font-medium ${
                          form.printTitle === t
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-indigo-400'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/70 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">품목</span>
                  <button type="button" onClick={addItem} className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"><Plus size={12} />행 추가</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead><tr className="bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500"><th className="text-center px-3 py-2">상품</th><th className="text-center px-2 py-2 w-20">단위</th><th className="text-center px-2 py-2 w-20">수량</th><th className="text-center px-2 py-2 w-28">단가</th><th className="text-center px-2 py-2 w-28">금액</th><th className="w-10" /></tr></thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {form.items.map((item, idx) => <QuoteItemRow key={idx} item={item} products={products?.items ?? []} tdInput={tdInput} onSelectProduct={(product) => selectProduct(idx, product)} onChange={(patch) => updateItem(idx, patch)} onRemove={() => removeItem(idx)} canRemove={form.items.length > 1} />)}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px]">
                <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">비고</label><textarea value={form.memo} onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))} rows={3} className={inputCls} /></div>
                <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 flex flex-col justify-between"><span className="text-sm text-gray-500">합계금액</span><span className="text-base font-bold text-gray-900 dark:text-white">￦{formatNumber(totalAmount)}</span></div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">취소</button>
                <button type="button" onClick={() => submitForm(true)} disabled={createMutation.isPending || updateMutation.isPending} className="px-4 py-2 border border-indigo-200 text-indigo-700 dark:text-indigo-400 dark:border-indigo-800 rounded-xl text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50"><Printer size={14} className="inline mr-1" />저장 후 인쇄</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">{createMutation.isPending || updateMutation.isPending ? '저장 중...' : '저장'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function QuoteItemRow({ item, products, tdInput, onChange, onSelectProduct, onRemove, canRemove }: {
  item: ItemRow
  products: Product[]
  tdInput: string
  onChange: (patch: Partial<ItemRow>) => void
  onSelectProduct: (product: Product) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const [query, setQuery] = useState(item.productName)
  const [open, setOpen] = useState(false)
  const matches = query ? products.filter((product) => product.name.includes(query) || product.code.includes(query)).slice(0, 8) : []

  return (
    <tr>
      <td className="px-3 py-2 relative">
        <input value={query} onChange={(e) => { setQuery(e.target.value); onChange({ productName: e.target.value }); setOpen(true) }} onFocus={() => setOpen(true)} placeholder="상품명 또는 코드 입력" className={tdInput} />
        {open && matches.length > 0 && (
          <div className="absolute z-20 mt-1 w-[360px] max-h-48 overflow-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl">
            {matches.map((product) => (
              <button key={product.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onSelectProduct(product); setQuery(product.name); setOpen(false) }} className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{product.name}</p>
                <p className="text-xs text-gray-400 font-mono">{product.code}</p>
              </button>
            ))}
          </div>
        )}
      </td>
      <td className="px-2 py-2"><input value={item.unit} onChange={(e) => onChange({ unit: e.target.value })} className={`${tdInput} text-center`} /></td>
      <td className="px-2 py-2"><input type="number" min={0} value={item.qty} onChange={(e) => onChange({ qty: Number(e.target.value) || 0 })} className={`${tdInput} text-right`} /></td>
      <td className="px-2 py-2"><input type="number" min={0} value={item.unitPrice} onChange={(e) => onChange({ unitPrice: Number(e.target.value) || 0 })} className={`${tdInput} text-right`} /></td>
      <td className="px-2 py-2 text-right tabular-nums font-medium">￦{formatNumber(item.amount)}</td>
      <td className="px-2 py-2 text-center"><button type="button" onClick={onRemove} disabled={!canRemove} className="p-1 rounded text-gray-400 hover:text-red-500 disabled:opacity-30"><Trash2 size={13} /></button></td>
    </tr>
  )
}
