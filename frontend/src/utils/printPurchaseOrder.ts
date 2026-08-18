import { useSupplierInfoStore } from '@/stores/supplier-info.store'
import { openBlankPrintWindow, writePrintHtml } from '@/utils/printWindow'
import type { Client, PurchaseOrder } from '@/types/api.types'

const escapeHtml = (value?: string | number | null) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char] ?? char))

const formatDate = (value?: string | null) => {
  if (!value) return ''
  return value.replaceAll('-', '.')
}

const formatNumber = (value?: number | null) => {
  if (value === null || value === undefined || Number(value) === 0) return ''
  return Number(value).toLocaleString('ko-KR')
}

export function buildPurchaseOrderPrintHtml(order: PurchaseOrder, client?: Pick<Client, 'name' | 'phone' | 'mobile' | 'fax'> | null, autoPrint = false) {
  const company = useSupplierInfoStore.getState().info
  const supplierName = client?.name || order.supplier || ''
  const supplierPhone = client?.phone || client?.mobile || order.phone || ''
  const supplierFax = client?.fax || order.fax || ''
  const minimumRows = 20

  const itemRows = order.items.map((item) => {
    const isGroupHeader = !Number(item.boxCount) && !Number(item.quantity)

    return `
      <tr class="${isGroupHeader ? 'group-row' : ''}">
        <td></td>
        <td class="product-name">${escapeHtml(item.product?.name)}</td>
        <td>${formatNumber(item.boxCount)}</td>
        <td>${formatNumber(item.quantity)}</td>
        <td>${escapeHtml(item.capSize)}</td>
      </tr>`
  })

  const blankRows = Array.from(
    { length: Math.max(0, minimumRows - order.items.length) },
    () => '<tr class="blank-row"><td></td><td></td><td></td><td></td><td></td></tr>',
  )

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>발주서 ${escapeHtml(order.orderNo)}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      color: #111;
      background: #fff;
      font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
      font-size: 10pt;
    }
    .sheet {
      display: flex;
      flex-direction: column;
      width: 190mm;
      height: 277mm;
      margin: 0 auto;
      border: 0.75mm solid #111;
    }
    .title {
      display: flex;
      flex: 0 0 20mm;
      align-items: center;
      justify-content: center;
      height: 20mm;
      margin: 0;
      border-bottom: 0.45mm solid #111;
      font-size: 13pt;
      font-weight: 500;
      letter-spacing: 0.45em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th, td {
      border: 0.35mm solid #111;
      padding: 1mm 1.5mm;
      text-align: center;
      vertical-align: middle;
      overflow-wrap: anywhere;
    }
    tr > :first-child { border-left: 0; }
    tr > :last-child { border-right: 0; }
    .meta th, .meta td {
      height: 8.2mm;
      font-size: 10pt;
    }
    .meta {
      flex: 0 0 auto;
    }
    .meta th {
      width: 19%;
      font-weight: 500;
    }
    .meta td {
      width: 31%;
      padding-left: 2mm;
      text-align: left;
    }
    .spacer {
      flex: 0 0 8mm;
      height: 8mm;
      border-top: 0.35mm solid #111;
      border-bottom: 0.35mm solid #111;
    }
    .items-area {
      display: flex;
      flex: 1;
      min-height: 0;
    }
    .items {
      height: 100%;
    }
    .items col.no { width: 19%; }
    .items col.name { width: 36%; }
    .items col.box { width: 21%; }
    .items col.quantity { width: 12%; }
    .items col.cap { width: 12%; }
    .items th {
      height: 8.5mm;
      font-size: 10pt;
      font-weight: 500;
    }
    .items td {
      height: 8mm;
      font-size: 10pt;
    }
    .items .product-name {
      padding-left: 2mm;
      text-align: left;
    }
    .items .group-row td {
      height: 9mm;
    }
    .items .group-row .product-name {
      font-size: 15pt;
      font-weight: 700;
    }
    .items .blank-row td {
      height: 8mm;
    }
    .footer {
      display: flex;
      flex: 0 0 20mm;
      align-items: center;
      justify-content: center;
      border-top: 0.45mm solid #111;
      padding: 3mm 3mm;
    }
    .company {
      min-width: 82mm;
      line-height: 1.45;
      text-align: left;
    }
    .company-name {
      font-size: 11pt;
      font-weight: 700;
    }
    .company-address,
    .company-contact {
      font-size: 8pt;
      font-weight: 600;
    }
    @media screen {
      body { padding: 10mm; }
      .sheet { box-shadow: 0 1mm 5mm rgb(0 0 0 / 14%); }
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .sheet { height: 277mm; }
    }
  </style>
</head>
<body>
  <main class="sheet">
    <h1 class="title">발 주 서(${escapeHtml(company.name)})</h1>

    <table class="meta">
      <tbody>
        <tr>
          <th>업체명</th>
          <td>${escapeHtml(supplierName)}</td>
          <th>발주일</th>
          <td>${escapeHtml(formatDate(order.orderDate))}</td>
        </tr>
        <tr>
          <th>담당자</th>
          <td>${escapeHtml(order.manager)}</td>
          <th>입고일</th>
          <td>${escapeHtml(formatDate(order.expectedDate))}</td>
        </tr>
        <tr>
          <th>전화번호</th>
          <td>${escapeHtml(supplierPhone)}</td>
          <th>팩스</th>
          <td>${escapeHtml(supplierFax)}</td>
        </tr>
      </tbody>
    </table>

    <div class="spacer"></div>

    <div class="items-area">
      <table class="items">
        <colgroup>
          <col class="no"><col class="name"><col class="box"><col class="quantity"><col class="cap">
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
        <tbody>${[...itemRows, ...blankRows].join('')}</tbody>
      </table>
    </div>

    <footer class="footer">
      <div class="company">
        <div class="company-name">${escapeHtml(company.name)}</div>
        <div class="company-address">${escapeHtml(company.address)}</div>
        <div class="company-contact">TEL: ${escapeHtml(company.phone)}</div>
        <div class="company-contact">FAX: ${escapeHtml(company.fax)}</div>
      </div>
    </footer>
  </main>
  ${autoPrint
    ? '<script>window.onload = () => window.print()<\\/script>'
    : `<script>
      function fitPreview() {
        document.body.style.zoom = '1';
        document.body.style.width = 'auto';
        document.body.style.padding = '8px';
        document.documentElement.style.overflowX = 'hidden';
        document.body.style.overflowX = 'hidden';
        const sheet = document.querySelector('.sheet');
        if (!sheet) return;
        const available = document.documentElement.clientWidth - 16;
        const width = sheet.getBoundingClientRect().width + 16;
        const scale = Math.min(1, available / width);
        document.body.style.width = width + 'px';
        document.body.style.zoom = String(scale);
      }
      window.addEventListener('load', fitPreview);
      window.addEventListener('resize', fitPreview);
    <\/script>`}
</body>
</html>`
}

export function printPurchaseOrder(order: PurchaseOrder, client?: Pick<Client, 'name' | 'phone' | 'mobile' | 'fax'> | null) {
  const win = openBlankPrintWindow('width=900,height=1100')
  if (!win) return
  writePrintHtml(buildPurchaseOrderPrintHtml(order, client, true), win)
}
