'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, FileText, Pencil, Plus, Printer, Search, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { clientApi } from '@/api/client.api'
import { productApi } from '@/api/product.api'
import { quoteApi } from '@/api/quote.api'
import { DEFAULT_SUPPLIER_INFO, useSupplierInfoStore } from '@/stores/supplier-info.store'
import { formatNumber } from '@/utils/format'
import type { Client, Product, Quote } from '@/types/api.types'
import type { SupplierInfo } from '@/stores/supplier-info.store'

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

function escapeHtml(value?: string | number | null) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function money(value?: number | string | null) {
  return Number(value ?? 0).toLocaleString('ko-KR')
}

function formatKoreanDate(s: string) {
  const p = (s || '').split('-')
  if (p.length !== 3) return s
  return `${p[0]} 년 ${p[1]} 월 ${p[2]} 일`
}

function toKoreanMoney(n: number): string {
  if (n === 0) return '영'
  const d = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
  const g = (x: number): string => {
    if (!x) return ''
    let r = ''
    const c = Math.floor(x / 1000); if (c) r += d[c] + '천'
    const b = Math.floor((x % 1000) / 100); if (b) r += d[b] + '백'
    const t = Math.floor((x % 100) / 10); if (t) r += d[t] + '십'
    const i = x % 10; if (i) r += d[i]
    return r
  }
  let r = ''; let v = Math.round(n)
  const jo = Math.floor(v / 1e12); if (jo) { r += g(jo) + '조'; v %= 1e12 }
  const eo = Math.floor(v / 1e8);  if (eo) { r += g(eo) + '억'; v %= 1e8 }
  const ma = Math.floor(v / 1e4);  if (ma) { r += g(ma) + '만'; v %= 1e4 }
  if (v) r += g(v)
  return r
}

const QUOTE_PRINT_TITLES = ['견적서', '발주서', '청구서', '납품서', '지시서', '의뢰서'] as const
type QuotePrintTitle = typeof QUOTE_PRINT_TITLES[number]

function formatPrintTitle(label: string) {
  return label.split('').join('   ')
}

function printQuoteDocument(doc: Quote, targetWindow?: Window | null, client?: Client | null, supplier: SupplierInfo = DEFAULT_SUPPLIER_INFO, printTitle?: string) {
  const isStatement = doc.docType === 'STATEMENT'
  const title = isStatement ? '거 래 명 세 서' : formatPrintTitle(printTitle || '견적서')
  const total = Number(doc.totalAmount ?? 0)
  const vat = 0
  const supplyTotal = total - vat
  const lineCount = isStatement ? 29 : 19
  const receiver = {
    name: doc.clientName || client?.name || '',
    businessNo: client?.businessNo || '',
    phone: client?.phone || '',
    ceo: client?.ceoName || client?.managerName || '',
    address: [client?.address, client?.addressDetail].filter(Boolean).join(' ') || '',
  }

  const rows = Array.from({ length: lineCount }, (_, idx) => {
    const item = doc.items?.[idx]
    if (!item) {
      const isFirstBlank = idx === (doc.items?.length ?? 0)
      return `<tr>
        <td></td>
        <td class="left" style="${isFirstBlank ? 'color:#bbb;font-size:9px;text-align:center' : ''}">${isFirstBlank ? '*** 이하여백 ***' : ''}</td>
        <td></td><td></td><td></td><td></td>
      </tr>`
    }
    const nameCell = escapeHtml(item.productName) + (item.productCode ? '&nbsp;&nbsp;' + escapeHtml(item.productCode) : '')
    return `<tr>
      <td>${idx + 1}</td>
      <td class="left">${nameCell}</td>
      <td>${escapeHtml(item.unit || 'Ea')}</td>
      <td class="right">${money(item.qty)}</td>
      <td class="right">${money(item.unitPrice)}</td>
      <td class="right">${money(item.amount)}</td>
    </tr>`
  }).join('')

  const statementHeader = `
    <div class="doc-top"><div>작성일자&nbsp;&nbsp;${escapeHtml(doc.docDate)}</div><div>Page: 1/1</div></div>
    <div class="party-grid">
      <div class="party-label">공<br/>급<br/>자</div>
      <table class="party-table"><tbody>
        <tr><th>사업번호</th><td colspan="3"><b>${escapeHtml(supplier.businessNo)}</b></td></tr>
        <tr><th>상&nbsp;&nbsp;&nbsp;&nbsp;호</th><td colspan="3">${escapeHtml(supplier.name)}</td></tr>
        <tr><th>전화번호</th><td>${escapeHtml(supplier.phone)}</td><th>대표자</th><td>${escapeHtml(supplier.ceo)}</td></tr>
        <tr><th>주&nbsp;&nbsp;&nbsp;&nbsp;소</th><td colspan="3">${escapeHtml(supplier.address)}</td></tr>
      </tbody></table>
      <div class="stamp">印</div>
      <div class="party-label">공<br/>급<br/>받<br/>는<br/>자</div>
      <table class="party-table"><tbody>
        <tr><th>사업번호</th><td colspan="3"><b>${escapeHtml(receiver.businessNo)}</b></td></tr>
        <tr><th>상&nbsp;&nbsp;&nbsp;&nbsp;호</th><td colspan="3">${escapeHtml(receiver.name)}</td></tr>
        <tr><th>전화번호</th><td>${escapeHtml(receiver.phone)}</td><th>대표자</th><td>${escapeHtml(receiver.ceo)}</td></tr>
        <tr><th>주&nbsp;&nbsp;&nbsp;&nbsp;소</th><td colspan="3">${escapeHtml(receiver.address)}</td></tr>
      </tbody></table>
    </div>`

  const quoteHeader = `
    <div class="quote-fax">FAX : ${escapeHtml(supplier.fax)}</div>
    <div class="quote-header-grid">
      <div class="quote-to">
        <div>서기 : ${formatKoreanDate(doc.docDate)}</div>
        <div class="client-line"><b>(${escapeHtml(receiver.name || doc.clientName || '')})</b>&nbsp;&nbsp;귀하</div>
        <div>대표전화 : ${escapeHtml(receiver.phone)}</div>
        <div class="quote-msg">아래와 같이 견적 합니다.</div>
      </div>
      <div class="quote-party">
        <div class="party-label">공<br/>급<br/>자</div>
        <table class="party-table"><tbody>
          <tr><th>사업번호</th><td colspan="3"><b>${escapeHtml(supplier.businessNo)}</b></td></tr>
          <tr><th>상&nbsp;&nbsp;&nbsp;&nbsp;호</th><td colspan="3">${escapeHtml(supplier.name)}</td></tr>
          <tr><th>전화번호</th><td>${escapeHtml(supplier.phone)}</td><th>대표자</th><td>${escapeHtml(supplier.ceo)}</td></tr>
          <tr><th>주&nbsp;&nbsp;&nbsp;&nbsp;소</th><td colspan="3">${escapeHtml(supplier.address)}</td></tr>
        </tbody></table>
        <div class="stamp">印</div>
      </div>
    </div>
    <div class="quote-total-line"><span class="tl-label">합계금액 : ${toKoreanMoney(total)} 원정</span><span class="tl-num">( ${money(total)} )</span><span class="tl-vat">부가세별도</span></div>`

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>${title.replaceAll(' ', '')} - ${escapeHtml(doc.docNo)}</title>
  <style>
    @page { size: A4; margin: 12mm 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #fff; color: #000; font-family: 'Malgun Gothic', '맑은 고딕', Arial, sans-serif; font-size: 11px; }
    .sheet { width: 190mm; min-height: 270mm; margin: 0 auto; position: relative; padding: 10mm 2mm 6mm; }
    .statement { color: #0018aa; --line: #0018aa; padding: 8mm 0 4mm; }
    .quote { color: #000; --line: #000; border: 1px solid var(--line); padding: 8mm 0 5mm; position: relative; }
    .title { position: relative; display: table; text-align: center; font-size: 22px; letter-spacing: 10px; font-weight: 700; margin: 0 auto 8mm; padding-bottom: 2.2mm; }
    .title::after { content: ""; position: absolute; left: 0; right: 10px; bottom: 0; height: 1.4mm; border-top: 1px solid currentColor; border-bottom: 1px solid currentColor; }
    .quote .title { letter-spacing: 14px; margin-bottom: 10mm; }
    .statement .title { font-size: 19px; letter-spacing: 8px; margin-bottom: 7mm; }
    .doc-top { display: flex; justify-content: space-between; margin-bottom: 2mm; }
    .statement .doc-top { margin-bottom: 0; padding: 0 1mm; font-size: 10px; }
    .quote-fax { position: absolute; right: 2mm; top: 3mm; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid var(--line); height: 6.2mm; padding: 1mm 1.5mm; font-size: 10px; text-align: center; vertical-align: middle; }
    .left { text-align: left; } .right { text-align: right; }
    .party-grid { position: relative; display: grid; grid-template-columns: 8mm 87mm 8mm 87mm; align-items: stretch; margin-bottom: -1px; }
    .party-label { border: 1px solid var(--line); border-right: 0; display: flex; align-items: center; justify-content: center; text-align: center; font-weight: 700; line-height: 1.25; background: #eef8ff; }
    .party-table th { width: 18mm; background: #f8fbff; font-weight: 700; }
    .party-table td { text-align: left; }
    .statement .party-table th, .statement .party-table td { height: 5.4mm; padding: 0.4mm 1mm; font-size: 9px; }
    .statement .party-label { font-size: 10px; background: #eef8ff; }
    .stamp { position: absolute; color: #e5002b; border: 2px solid #e5002b; width: 16mm; height: 16mm; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; transform: rotate(-12deg); z-index: 1; background: transparent; }
    .party-grid .stamp { left: calc(50% - 9mm); top: 8mm; }
    .quote-header-grid { display: grid; grid-template-columns: 1fr 92mm; gap: 3mm; margin-bottom: 0; align-items: start; }
    .quote-to { line-height: 2.4; padding-right: 2mm; }
    .quote-to .client-line { display: block; border-bottom: 1px solid #000; text-align: center; font-size: 13px; margin: 2mm 0; padding-bottom: 1mm; }
    .quote-msg { margin-top: 3mm; }
    .quote-party { position: relative; display: grid; grid-template-columns: 8mm 1fr; }
    .quote-party .stamp { left: auto; right: 3mm; top: 3mm; }
    .quote-total-line { display: flex; align-items: center; height: 9mm; border: 1px solid var(--line); margin-top: -1px; font-size: 13px; font-weight: 700; padding: 0 3mm; gap: 6mm; }
    .tl-label { flex: 1; }
    .tl-num { text-align: center; min-width: 28mm; }
    .tl-vat { text-align: right; }
    .items { margin-top: 0; }
    .items th { background: ${isStatement ? '#eef8ff' : '#e8f4f8'}; font-weight: 700; height: 6mm; }
    .items td { height: ${isStatement ? '5.95mm' : '7.1mm'}; }
    .statement .items th, .statement .items td { padding: 0.35mm 1mm; font-size: 9px; }
    .summary { width: 58mm; margin-left: auto; } .summary th { background: #eef8ff; font-weight: 700; } .summary td { text-align: right; }
    .bottom-row { display: grid; grid-template-columns: 1fr 58mm; }
    .memo-space { border-left: 1px solid var(--line); border-bottom: 1px solid var(--line); min-height: 21mm; }
    .footer-page { position: absolute; bottom: 5mm; right: 4mm; font-size: 10px; }
    .statement-footer { margin-top: -1px; }
    .statement-footer th, .statement-footer td { height: 6.2mm; padding: 0.6mm 1mm; font-size: 9px; }
    .statement-footer .label { background: #eef8ff; font-weight: 700; text-align: center; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .sheet { margin: 0 auto; } }
  </style>
</head>
<body>
  <div class="sheet ${isStatement ? 'statement' : 'quote'}">
    <h1 class="title">${title}</h1>
    ${isStatement ? statementHeader : quoteHeader}
    <table class="items"><colgroup><col style="width:8mm"><col style="width:82mm"><col style="width:13mm"><col style="width:18mm"><col style="width:27mm"><col style="width:34mm"></colgroup><thead><tr><th>${isStatement ? '순번' : 'No'}</th><th>품명 / 규격</th><th>단위</th><th>수량</th><th>단가</th><th>금액</th></tr></thead><tbody>${rows}</tbody></table>
    ${isStatement ? `<table class="statement-footer"><colgroup><col style="width:15mm"><col style="width:31mm"><col style="width:16mm"><col style="width:33mm"><col style="width:16mm"><col style="width:29mm"><col style="width:15mm"><col style="width:35mm"></colgroup><tbody><tr><th class="label">전표메모</th><td></td><th class="label">공급가</th><td class="right">${money(supplyTotal)}</td><th class="label">부가세</th><td class="right">${money(vat)}</td><th class="label">합계</th><td class="right">${money(total)}</td></tr><tr><th class="label">전미수</th><td></td><th class="label">입금액</th><td></td><th class="label">미수잔액</th><td class="right">${money(total)}</td><th class="label">인수자</th><td class="right">(인)</td></tr></tbody></table>` : `<div class="bottom-row"><div class="memo-space"></div><table class="summary"><tbody><tr><th>공급가</th><td>${money(supplyTotal)}</td></tr><tr><th>부가세</th><td>${money(vat)}</td></tr><tr><th>합계금액</th><td>${money(total)}</td></tr></tbody></table></div><div class="footer-page">Page: 1 / 1</div>`}
  </div>
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`

  if (targetWindow) {
    targetWindow.document.write(html)
    targetWindow.document.close()
    return
  }

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank', 'width=820,height=1060')
  if (!win) {
    URL.revokeObjectURL(url)
    toast.error('팝업 차단을 해제해주세요')
    return
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
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
      setEditing(null)
      setForm({
        ...EMPTY_FORM,
        docDate: today(),
        items: selectedProducts.map((product) => ({
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          unit: product.unit ?? '',
          qty: 1,
          unitPrice: Number(product.sellPrice ?? 0),
          amount: Number(product.sellPrice ?? 0),
        })),
      })
      setShowModal(true)
      setPrefillKey(productIdsParam)
    }
    prefillProducts().catch(() => toast.error('상품 정보를 불러오지 못했습니다'))
  }, [prefillKey, productIdsParam])

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
          {data && <p className="text-xs text-gray-400 mt-0.5">전체 {data.total}건</p>}
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">문서번호</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">종류</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">거래처</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">날짜</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">합계금액</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">상태</th>
                <th className="px-4 py-3 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading && <tr><td colSpan={7} className="text-center py-10 text-gray-400">불러오는 중...</td></tr>}
              {!isLoading && data?.items.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-gray-400">문서가 없습니다</td></tr>}
              {data?.items.map((quote) => (
                <tr key={quote.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{quote.docNo}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${quote.docType === 'STATEMENT' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400'}`}>{DOC_TYPE_LABEL[quote.docType]}</span></td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{quote.clientName ?? '-'}</td>
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
          <span className="text-sm text-gray-500">{page} / {data.totalPages}</span>
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
                    <thead><tr className="bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500"><th className="text-left px-3 py-2">상품</th><th className="px-2 py-2 w-20">단위</th><th className="px-2 py-2 w-20">수량</th><th className="px-2 py-2 w-28">단가</th><th className="px-2 py-2 w-28">금액</th><th className="w-10" /></tr></thead>
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
      <td className="px-2 py-2"><input value={item.unit} onChange={(e) => onChange({ unit: e.target.value })} className={tdInput} /></td>
      <td className="px-2 py-2"><input type="number" min={0} value={item.qty} onChange={(e) => onChange({ qty: Number(e.target.value) || 0 })} className={`${tdInput} text-right`} /></td>
      <td className="px-2 py-2"><input type="number" min={0} value={item.unitPrice} onChange={(e) => onChange({ unitPrice: Number(e.target.value) || 0 })} className={`${tdInput} text-right`} /></td>
      <td className="px-2 py-2 text-right tabular-nums font-medium">￦{formatNumber(item.amount)}</td>
      <td className="px-2 py-2 text-center"><button type="button" onClick={onRemove} disabled={!canRemove} className="p-1 rounded text-gray-400 hover:text-red-500 disabled:opacity-30"><Trash2 size={13} /></button></td>
    </tr>
  )
}
