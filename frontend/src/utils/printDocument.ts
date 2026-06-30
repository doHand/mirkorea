import { DEFAULT_SUPPLIER_INFO } from '@/stores/supplier-info.store'
import { openPrintHtmlBlob, writePrintHtml } from '@/utils/printWindow'
import type { Quote, Client } from '@/types/api.types'
import type { SupplierInfo } from '@/stores/supplier-info.store'

export type { SupplierInfo }

export const QUOTE_PRINT_TITLES = ['견적서', '발주서', '청구서', '납품서', '지시서', '의뢰서'] as const
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

function formatPrintTitle(label: string) {
  return label.split('').join('   ')
}

function buildQuoteSheet(
  doc: Quote,
  client: Client | null | undefined,
  supplier: SupplierInfo,
  printTitle: string | undefined,
  printMode: 'DEFAULT' | 'OUTBOUND',
) {
  const isStatement = doc.docType === 'STATEMENT'
  const isOutbound = printMode === 'OUTBOUND'
  const stampUrl = `${window.location.origin}/company-stamp.png`
  const title = isOutbound ? '출 고 증' : isStatement ? '거 래 명 세 서' : formatPrintTitle(printTitle || '견적서')
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
      if (isOutbound) {
        return `<tr>
          <td></td><td></td>
          <td class="left" style="${isFirstBlank ? 'color:#bbb;font-size:9px;text-align:center' : ''}">${isFirstBlank ? '*** 이하여백 ***' : ''}</td>
          <td></td><td></td><td></td><td></td><td></td>
        </tr>`
      }
      return `<tr>
        <td></td>
        <td class="left" style="${isFirstBlank ? 'color:#bbb;font-size:9px;text-align:center' : ''}">${isFirstBlank ? '*** 이하여백 ***' : ''}</td>
        <td></td><td></td><td></td><td></td>
      </tr>`
    }
    if (isOutbound) {
      return `<tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(item.barcode)}</td>
        <td class="left">${escapeHtml(item.productName)}</td>
        <td>${escapeHtml(item.spec)}</td>
        <td>${escapeHtml(item.unit || 'OUT')}</td>
        <td class="right">${money(item.qty)}</td>
        <td class="right">${money(item.unitPrice)}</td>
        <td class="right">${money(item.amount)}</td>
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
      <img class="stamp" src="${stampUrl}" alt="직인">
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
        <img class="stamp" src="${stampUrl}" alt="직인">
      </div>
    </div>
    <div class="quote-total-line"><span class="tl-label">합계금액 : ${toKoreanMoney(total)}원정</span><span class="tl-num">( ${money(total)} )</span><span class="tl-vat">부가세별도</span></div>`

  const sheetHtml = `
  <div class="sheet ${isStatement ? 'statement' : 'quote'}">
    <h1 class="title">${title}</h1>
    ${isStatement ? statementHeader : quoteHeader}
    <table class="items"><colgroup>${isOutbound
      ? '<col style="width:12mm"><col style="width:32mm"><col style="width:51mm"><col style="width:30mm"><col style="width:14mm"><col style="width:15mm"><col style="width:16mm"><col style="width:20mm">'
      : isStatement
      ? '<col style="width:15mm"><col style="width:80mm"><col style="width:16mm"><col style="width:29mm"><col style="width:15mm"><col style="width:35mm">'
      : '<col style="width:4.2105%"><col style="width:43.1579%"><col style="width:6.8421%"><col style="width:9.4737%"><col style="width:14.2105%"><col style="width:22.1053%">'
    }</colgroup><thead><tr>${isOutbound
      ? '<th>순번</th><th>바코드</th><th>품명</th><th>규격</th><th>단위</th><th>수량</th><th>단가</th><th>금액</th>'
      : `<th>${isStatement ? '순번' : 'No'}</th><th>품명 / 규격</th><th>단위</th><th>수량</th><th>단가</th><th>금액</th>`
    }</tr></thead><tbody>${rows}</tbody></table>
    ${isStatement
      ? `<table class="statement-footer"><colgroup><col style="width:15mm"><col style="width:31mm"><col style="width:16mm"><col style="width:33mm"><col style="width:16mm"><col style="width:29mm"><col style="width:15mm"><col style="width:35mm"></colgroup><tbody><tr><th class="label">전표메모</th><td></td><th class="label">공급가</th><td class="right">${money(supplyTotal)}</td><th class="label">부가세</th><td class="right">${money(vat)}</td><th class="label">합계</th><td class="right">${money(total)}</td></tr><tr><th class="label">전미수</th><td></td><th class="label">입금액</th><td></td><th class="label">미수잔액</th><td class="right">${money(total)}</td><th class="label">인수자</th><td class="right">(인)</td></tr></tbody></table>`
      : `<table class="summary"><colgroup><col style="width:4.2105%"><col style="width:43.1579%"><col style="width:6.8421%"><col style="width:9.4737%"><col style="width:14.2105%"><col style="width:22.1053%"></colgroup><tbody><tr><td rowspan="3" colspan="4"></td><th>공급가</th><td>${money(supplyTotal)}</td></tr><tr><th>부가세</th><td>${money(vat)}</td></tr><tr><th>합계금액</th><td>${money(total)}</td></tr></tbody></table><div class="footer-page">Page: 1 / 1</div>`
    }
  </div>`

  return { isStatement, title, sheetHtml }
}

function wrapQuoteHtml(sheetsHtml: string, isStatement: boolean, docTitle: string) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>${docTitle}</title>
  <style>
    @page { size: A4; margin: 12mm 10mm; }
    * { margin: 0; padding: 0; OUT-sizing: border-OUT; }
    body { background: #fff; color: #000; font-family: 'Malgun Gothic', '맑은 고딕', Arial, sans-serif; font-size: 11px; }
    .sheet { width: 190mm; min-height: 270mm; margin: 0 auto; position: relative; padding: 10mm 2mm 6mm; }
    .sheet:not(:last-child) { break-after: page; }
    .statement { color: #17251c; --line: #2d4033; padding: 8mm 0 4mm; }
    .quote { color: #17251c; --line: #2d4033; border: 1px solid var(--line); padding: 8mm 0 5mm; position: relative; }
    .title { position: relative; display: table; text-align: center; font-size: 26px; letter-spacing: 12px; font-weight: 700; margin: 0 auto 8mm; padding-bottom: 2.2mm; }
    .title::after { content: ""; position: absolute; left: 0; right: 10px; bottom: 0; height: 1.4mm; border-top: 1px solid currentColor; border-bottom: 1px solid currentColor; }
    .quote .title { letter-spacing: 16px; margin-bottom: 10mm; }
    .statement .title { font-size: 23px; letter-spacing: 10px; margin-bottom: 7mm; }
    .doc-top { display: flex; justify-content: space-between; margin-bottom: 2mm; }
    .statement .doc-top { margin-bottom: 0; padding: 0 1mm; font-size: 10px; }
    .quote-fax { position: absolute; right: 2mm; top: 3mm; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid var(--line); height: 6.2mm; padding: 1mm 1.5mm; font-size: 10px; text-align: center; vertical-align: middle; }
    .left { text-align: left; } .right { text-align: right; }
    .party-grid { position: relative; display: grid; grid-template-columns: 8mm 87mm 8mm 87mm; align-items: stretch; margin-bottom: -1px; }
    .party-label { border: 1px solid var(--line); border-right: 0; display: flex; align-items: center; justify-content: center; text-align: center; font-weight: 700; line-height: 1.25; background: #edf0ec; }
    .party-table th { width: 18mm; background: #edf0ec; font-weight: 700; }
    .party-table td { text-align: left; }
    .statement .party-table th, .statement .party-table td { height: 5.4mm; padding: 0.4mm 1mm; font-size: 9px; }
    .statement .party-label { font-size: 10px; background: #edf0ec; }
    .stamp { position: absolute; width: 17mm; height: 17mm; object-fit: contain; z-index: 1; }
    .party-grid .stamp { left: calc(50% - 9mm); top: 8mm; }
    .quote-header-grid { display: grid; grid-template-columns: 1fr 92mm; gap: 3mm; margin-bottom: 0; align-items: start; }
    .quote-to { line-height: 2.4; padding-right: 2mm; }
    .quote-to .client-line { display: block; border-bottom: 1px solid #000; text-align: center; font-size: 13px; margin: 2mm 0; padding-bottom: 1mm; }
    .quote-msg { margin-top: 3mm; }
    .quote-party { position: relative; display: grid; grid-template-columns: 8mm 1fr; }
    .quote-party .stamp { left: auto; right: 3mm; top: 3mm; }
    .quote-total-line { display: flex; align-items: center; height: 9mm; border: 1px solid var(--line); margin-top: -1px; font-size: 13px; font-weight: 700; padding: 0 3mm; gap: 6mm; background: #edf0ec; }
    .tl-label { flex: 1; }
    .tl-num { text-align: center; min-width: 28mm; }
    .tl-vat { text-align: right; }
    .items { margin-top: 0; }
    .items th { background: #2d4033; color: white; font-weight: 700; height: 6mm; }
    .items td { height: ${isStatement ? '5.95mm' : '7.1mm'}; }
    .statement .items th, .statement .items td { padding: 0.35mm 1mm; font-size: 9px; }
    .statement .items, .statement-footer { width: 190mm; min-width: 190mm; max-width: 190mm; table-layout: fixed; }
    .quote .items, .quote .summary { width: 100%; min-width: 100%; max-width: 100%; table-layout: fixed; }
    .summary { margin-top: -1px; } .summary th { background: #edf0ec; font-weight: 700; } .summary td { text-align: right; }
    .footer-page { position: absolute; bottom: 5mm; right: 4mm; font-size: 10px; }
    .statement-footer { margin-top: -1px; }
    .statement-footer th, .statement-footer td { height: 6.2mm; padding: 0.6mm 1mm; font-size: 9px; }
    .statement-footer .label { background: #edf0ec; font-weight: 700; text-align: center; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .sheet { margin: 0 auto; } }
  </style>
</head>
<body>
  ${sheetsHtml}
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`
}

function openHtml(html: string, targetWindow?: Window | null) {
  if (targetWindow) {
    writePrintHtml(html, targetWindow)
    return
  }

  openPrintHtmlBlob(html, 'width=820,height=1060')
}

export function printQuoteDocument(
  doc: Quote,
  targetWindow?: Window | null,
  client?: Client | null,
  supplier: SupplierInfo = DEFAULT_SUPPLIER_INFO,
  printTitle?: string,
  printMode: 'DEFAULT' | 'OUTBOUND' = 'DEFAULT',
) {
  const { isStatement, title, sheetHtml } = buildQuoteSheet(doc, client, supplier, printTitle, printMode)
  const html = wrapQuoteHtml(sheetHtml, isStatement, `${title.replaceAll(' ', '')} - ${escapeHtml(doc.docNo)}`)
  openHtml(html, targetWindow)
}

export function printQuoteDocuments(
  docs: { doc: Quote; client?: Client | null }[],
  targetWindow?: Window | null,
  supplier: SupplierInfo = DEFAULT_SUPPLIER_INFO,
  printTitle?: string,
  printMode: 'DEFAULT' | 'OUTBOUND' = 'DEFAULT',
) {
  if (!docs.length) return
  const sheets = docs.map(({ doc, client }) => buildQuoteSheet(doc, client, supplier, printTitle, printMode))
  const html = wrapQuoteHtml(sheets.map((s) => s.sheetHtml).join(''), sheets[0].isStatement, sheets[0].title.replaceAll(' ', ''))
  openHtml(html, targetWindow)
}
