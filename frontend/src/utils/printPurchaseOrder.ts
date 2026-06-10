import { useSupplierInfoStore } from '@/stores/supplier-info.store'
import type { Client, PurchaseOrder } from '@/types/api.types'

const esc = (value?: string | number | null) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char] ?? char))

const MIN_ITEM_ROWS = 20

export function printPurchaseOrder(order: PurchaseOrder, client?: Client | null) {
  const supplierInfo = useSupplierInfoStore.getState().info
  const stampUrl = `${window.location.origin}/company-stamp.png`
  const supplierName = client?.name || order.supplier || '-'
  const supplierPhone = client?.phone || client?.mobile || order.phone || '-'
  const supplierFax = client?.fax || order.fax || '-'
  const itemRows = order.items.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td class="product-name">${esc(item.product?.name)}</td>
      <td>${Number(item.boxCount || 0).toLocaleString()}</td>
      <td>${Number(item.quantity || 0).toLocaleString()}</td>
      <td>${esc(item.capSize)}</td>
    </tr>
  `).join('')
  const blankRows = Array.from(
    { length: Math.max(MIN_ITEM_ROWS - order.items.length, 0) },
    () => '<tr class="blank-row"><td></td><td></td><td></td><td></td><td></td></tr>',
  ).join('')

  const win = window.open('', '_blank', 'width=900,height=1100')
  if (!win) return

  win.document.write(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>발주서 ${esc(order.orderNo)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 14mm 10mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      color: #111;
      font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
      font-size: 10pt;
    }
    .sheet {
      display: flex;
      min-height: 272mm;
      flex-direction: column;
      margin: 0 auto;
      border: .55mm solid #111;
    }
    .title {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 12mm;
      margin: 0;
      border-bottom: .35mm solid #111;
      text-align: center;
      font-size: 12pt;
      font-weight: 500;
      letter-spacing: .32em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th, td {
      border: .35mm solid #111;
      padding: 1.2mm 1.5mm;
      text-align: center;
      vertical-align: middle;
      overflow-wrap: anywhere;
    }
    .meta {
      margin: 0;
      border: 0;
    }
    .meta th, .meta td {
      height: 7mm;
      font-size: 9.5pt;
    }
    .meta th {
      width: 14%;
      font-weight: 500;
    }
    .meta td {
      width: 36%;
      text-align: left;
      padding-left: 3mm;
    }
    .items {
      border: 0;
    }
    .items col.no { width: 8%; }
    .items col.name { width: 44%; }
    .items col.box { width: 15%; }
    .items col.ea { width: 16%; }
    .items col.cap { width: 17%; }
    .items th {
      height: 7mm;
      font-size: 9.5pt;
      font-weight: 500;
    }
    .items td {
      height: 8mm;
      font-size: 10pt;
    }
    .items .product-name {
      padding-left: 3mm;
      text-align: left;
    }
    .blank-row td { height: 8mm; }
    .footer {
      margin-top: auto;
      min-height: 31mm;
      padding: 6mm 3mm 3mm;
      border-top: .35mm solid #111;
      text-align: center;
      line-height: 1.45;
    }
    .company-name {
      position: relative;
      display: inline-block;
      min-height: 17mm;
      padding: 4mm 15mm 0 0;
      margin-bottom: 1mm;
      font-size: 15pt;
      font-weight: 700;
    }
    .company-stamp {
      position: absolute;
      top: 0;
      right: 0;
      width: 17mm;
      height: 17mm;
      object-fit: contain;
    }
    .company-address { font-size: 9.5pt; }
    .company-contact { font-size: 9.5pt; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <main class="sheet">
    <h1 class="title">발 주 서 (${esc(supplierInfo.name)})</h1>

    <table class="meta">
      <tbody>
        <tr>
          <th>업체명</th>
          <td>${esc(supplierName)}</td>
          <th>발주일</th>
          <td>${esc(order.orderDate || '-')}</td>
        </tr>
        <tr>
          <th>담당자</th>
          <td>${esc(order.manager || '-')}</td>
          <th>입고일</th>
          <td>${esc(order.expectedDate || '-')}</td>
        </tr>
        <tr>
          <th>전화번호</th>
          <td>${esc(supplierPhone)}</td>
          <th>팩스</th>
          <td>${esc(supplierFax)}</td>
        </tr>
      </tbody>
    </table>

    <table class="items">
      <colgroup>
        <col class="no"><col class="name"><col class="box"><col class="ea"><col class="cap">
      </colgroup>
      <thead>
        <tr>
          <th>번호</th>
          <th>제품명</th>
          <th>박스수량</th>
          <th>수량(ea)</th>
          <th>캡사이즈</th>
        </tr>
      </thead>
      <tbody>${itemRows}${blankRows}</tbody>
    </table>

    <footer class="footer">
      <div class="company-name">
        ${esc(supplierInfo.name)}
        <img class="company-stamp" src="${stampUrl}" alt="직인">
      </div>
      <div class="company-address">${esc(supplierInfo.address)}</div>
      <div class="company-contact">TEL: ${esc(supplierInfo.phone)} &nbsp;&nbsp; FAX: ${esc(supplierInfo.fax)}</div>
    </footer>
  </main>
  <script>window.onload = () => window.print()<\/script>
</body>
</html>`)
  win.document.close()
}
