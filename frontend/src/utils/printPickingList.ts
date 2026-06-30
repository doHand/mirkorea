import type { Client, OutboundOrder, Product, Quote } from '@/types/api.types'
import type { SupplierInfo } from '@/stores/supplier-info.store'
import { printQuoteDocuments } from '@/utils/printDocument'
import { openBlankPrintWindow, writePrintHtml } from '@/utils/printWindow'

const esc = (value?: string | number | null) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char] ?? char))

export interface DailyPickingRow {
  key: string
  productId: string
  product?: Product
  locationId?: string
  locationCode: string
  boxCount: number
  requests: string
}

export function buildDailyPickingRows(orders: OutboundOrder[]): DailyPickingRow[] {
  const requested = new Map<string, {
    product?: Product
    boxCount: number
    requests: Map<string, number>
  }>()

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const remainingOuts = Math.max(0, item.boxCount - Number(item.pickedBoxCount || 0))
      if (remainingOuts === 0) return
      const current = requested.get(item.productId) ?? {
        product: item.product,
        boxCount: 0,
        requests: new Map<string, number>(),
      }
      const requestName = order.recipient
        ? `${order.customer}/${order.recipient}`
        : order.customer
      current.boxCount += remainingOuts
      current.requests.set(requestName, (current.requests.get(requestName) ?? 0) + remainingOuts)
      requested.set(item.productId, current)
    })
  })

  const rows: DailyPickingRow[] = []
  requested.forEach((request, productId) => {
    const requests = Array.from(request.requests.entries())
      .map(([name, outs]) => `${name} ${outs.toLocaleString()}OUT`)
      .join(', ')
    rows.push({
      key: productId,
      productId,
      product: request.product,
      locationId: request.product?.defaultLocation?.id,
      locationCode: request.product?.defaultLocation?.code ?? '-',
      boxCount: request.boxCount,
      requests,
    })
  })

  return rows.sort((a, b) => {
    return a.locationCode.localeCompare(b.locationCode, 'ko')
      || (a.product?.name ?? '').localeCompare(b.product?.name ?? '', 'ko')
  })
}

export function printInternalPickingList(date: string, orders: OutboundOrder[]) {
  const pickingRows = buildDailyPickingRows(orders)
  const rows = pickingRows.map((row, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${esc(row.locationCode)}</td>
      <td class="left">${esc(row.product?.code)}</td>
      <td class="left">${esc(row.product?.name)}</td>
      <td class="OUTes">${row.boxCount.toLocaleString()}</td>
      <td class="left requests">${esc(row.requests)}</td>
      <td></td>
    </tr>
  `).join('')
  const totalOUTes = pickingRows.reduce((sum, row) => sum + row.boxCount, 0)
  const blankRows = Array.from({ length: Math.max(18 - pickingRows.length, 0) },
    () => '<tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('')
  const win = openBlankPrintWindow('width=1100,height=1100')
  if (!win) return

  writePrintHtml(`<!doctype html><html lang="ko"><head><meta charset="utf-8">
  <title>내부용 통합 피킹리스트 ${esc(date)}</title><style>
  @page{size:A4 landscape;margin:10mm}*{OUT-sizing:border-OUT}html,body{margin:0;padding:0}body{font-family:"Malgun Gothic",sans-serif;color:#111;font-size:9pt}
  h1{text-align:center;font-size:18pt;letter-spacing:.25em;margin:0 0 5mm}.meta{display:flex;justify-content:space-between;margin-bottom:3mm;font-size:10pt}
  table{width:100%;border-collapse:collapse;table-layout:fixed;border:2px solid #111}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}
  th,td{height:8mm;border:1px solid #111;padding:1mm 2mm;text-align:center;vertical-align:middle;overflow-wrap:anywhere}
  th{font-weight:700}.left{text-align:left}.OUTes{font-size:12pt;font-weight:700}.requests{font-size:8pt;line-height:1.35}.summary{margin-top:3mm;text-align:right;font-size:12pt;font-weight:700}
  .check{width:10%}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body><h1>날짜별 피킹리스트 (내부용)</h1>
  <div class="meta"><b>피킹일: ${esc(date)}</b><b>출고지시 ${orders.length.toLocaleString()}건 / 총 ${totalOUTes.toLocaleString()} OUT</b></div>
  <table><thead><tr><th style="width:5%">번호</th><th style="width:11%">기본위치</th><th style="width:14%">상품코드</th><th style="width:22%">상품명</th><th style="width:10%">가져올 OUT</th><th>요청처별 수량</th><th class="check">피킹확인</th></tr></thead>
  <tbody>${rows}${blankRows}</tbody></table><div class="summary">총 ${totalOUTes.toLocaleString()} OUT</div>
  <script>window.onload=()=>window.print()<\/script></body></html>`, win)
}

function printLegacyExternalPickingList(date: string, orders: OutboundOrder[]) {
  const activeOrders = orders
    .map((order) => ({
      ...order,
      remainingItems: order.items
        .map((item) => ({
          ...item,
          remainingOUTes: Math.max(0, item.boxCount - Number(item.pickedBoxCount || 0)),
        }))
        .filter((item) => item.remainingOUTes > 0),
    }))
    .filter((order) => order.remainingItems.length > 0)

  const pages = activeOrders.map((order) => {
    const totalOUTes = order.remainingItems.reduce((sum, item) => sum + item.remainingOUTes, 0)
    const rows = order.remainingItems.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td class="left">${esc(item.product?.code)}</td>
        <td class="left">${esc(item.product?.name)}</td>
        <td class="OUTes">${item.remainingOUTes.toLocaleString()}</td>
        <td></td>
      </tr>`).join('')
    const blankRows = Array.from({ length: Math.max(12 - order.remainingItems.length, 0) },
      () => '<tr><td></td><td></td><td></td><td></td><td></td></tr>').join('')

    return `<section class="sheet">
      <h1>출고 확인서 (외부용)</h1>
      <div class="meta"><b>출고일: ${esc(date)}</b><b>출고번호: ${esc(order.orderNo)}</b></div>
      <table class="party"><tbody>
        <tr><th>거래처</th><td>${esc(order.customer)}</td><th>수령인</th><td>${esc(order.recipient)}</td></tr>
        <tr><th>연락처</th><td>${esc(order.phone)}</td><th>채널 / 주문번호</th><td>${esc(order.channel)} ${esc(order.externalOrderNo)}</td></tr>
        <tr><th>배송주소</th><td colspan="3">${esc(order.address)}</td></tr>
        <tr><th>요청사항</th><td colspan="3">${esc(order.memo)}</td></tr>
      </tbody></table>
      <table class="items"><thead><tr><th style="width:7%">번호</th><th style="width:18%">상품코드</th><th>상품명</th><th style="width:14%">OUT</th><th style="width:18%">수령확인</th></tr></thead>
      <tbody>${rows}${blankRows}</tbody></table>
      <div class="summary">총 ${totalOUTes.toLocaleString()} OUT</div>
      <div class="sign"><span>인계자: ____________________</span><span>수령자: ____________________</span></div>
    </section>`
  }).join('')

  const win = openBlankPrintWindow('width=900,height=1100')
  if (!win) return
  writePrintHtml(`<!doctype html><html lang="ko"><head><meta charset="utf-8">
  <title>외부용 출고 확인서 ${esc(date)}</title><style>
  @page{size:A4 portrait;margin:12mm}*{OUT-sizing:border-OUT}html,body{margin:0;padding:0}body{font-family:"Malgun Gothic",sans-serif;color:#111;font-size:9pt}
  .sheet{min-height:270mm;position:relative;break-after:page}.sheet:last-child{break-after:auto}h1{text-align:center;font-size:18pt;letter-spacing:.2em;margin:0 0 7mm}
  .meta{display:flex;justify-content:space-between;margin-bottom:3mm;font-size:10pt}table{width:100%;border-collapse:collapse;table-layout:fixed}
  th,td{border:1px solid #111;padding:1.5mm 2mm;text-align:center;vertical-align:middle;overflow-wrap:anywhere}.party{margin-bottom:5mm}.party th{width:18%;background:#f3f3f3}.party td{text-align:left}
  .items{border:2px solid #111}.items th{height:8mm;background:#f3f3f3}.items td{height:9mm}.left{text-align:left}.OUTes{font-size:12pt;font-weight:700}
  .summary{margin-top:4mm;text-align:right;font-size:13pt;font-weight:700}.sign{position:absolute;left:0;right:0;bottom:5mm;display:flex;justify-content:space-between;font-size:10pt}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>${pages}<script>window.onload=()=>window.print()<\/script></body></html>`, win)
}

function toStatement(order: OutboundOrder): Quote {
  const items = order.items
    .map((item, index) => {
      const qty = Math.max(0, item.boxCount - Number(item.pickedBoxCount || 0))
      const unitPrice = Number(item.product?.sellPrice || 0)
      const OUTBarcode = item.product?.barcodes?.find((barcode) => barcode.type === 'CXD_OUT' && barcode.isPrimary)
        ?? item.product?.barcodes?.find((barcode) => barcode.type === 'CXD_OUT')
      return {
        id: item.id,
        productId: item.productId,
        productCode: item.product?.code,
        productName: item.product?.name,
        category: item.product?.category,
        barcode: OUTBarcode?.barcode,
        spec: item.product?.spec,
        unit: 'OUT',
        qty,
        unitPrice,
        amount: qty * unitPrice,
        sortOrder: index,
      }
    })
    .filter((item) => item.qty > 0)

  return {
    id: order.id,
    docNo: order.orderNo,
    docType: 'STATEMENT',
    clientId: order.clientId,
    clientName: order.customer,
    docDate: order.requestedShipDate || order.orderDate,
    memo: order.memo,
    totalAmount: items.reduce((sum, item) => sum + item.amount, 0),
    status: 'CONFIRMED',
    createdBy: '',
    createdAt: order.createdAt,
    items,
  }
}

function toReceiver(order: OutboundOrder, clients: Client[]): Client {
  const client = clients.find((item) => item.id === order.clientId)
    ?? clients.find((item) => item.name === order.customer)

  return {
    ...client,
    id: client?.id ?? order.clientId ?? order.id,
    name: order.customer,
    phone: order.phone || client?.phone,
    address: order.address || client?.address,
    contactName: order.recipient || client?.contactName,
    isActive: client?.isActive ?? true,
    createdAt: client?.createdAt ?? order.createdAt,
  }
}

export function printExternalPickingList(
  _date: string,
  orders: OutboundOrder[],
  clients: Client[] = [],
  supplier?: SupplierInfo,
) {
  const printableOrders = orders.filter((order) => order.orderType === 'EXTERNAL' && order.items.some(
    (item) => Math.max(0, item.boxCount - Number(item.pickedBoxCount || 0)) > 0,
  ))
  const groupedOrders = Array.from(printableOrders.reduce((groups, order) => {
    const key = order.clientId || order.customer
    const current = groups.get(key)
    if (!current) {
      groups.set(key, { ...order, items: order.items.map((item) => ({ ...item })) })
      return groups
    }

    current.orderNo = `${current.orderNo}, ${order.orderNo}`
    current.memo = [current.memo, order.memo].filter(Boolean).join(' / ')
    order.items.forEach((item) => {
      const existing = current.items.find((currentItem) => currentItem.productId === item.productId)
      if (existing) {
        existing.boxCount += item.boxCount
        existing.pickedBoxCount += Number(item.pickedBoxCount || 0)
      } else {
        current.items.push({ ...item })
      }
    })
    return groups
  }, new Map<string, OutboundOrder>()).values())

  const win = openBlankPrintWindow('width=900,height=1100')
  if (!win) return
  printQuoteDocuments(
    groupedOrders.map((order) => ({ doc: toStatement(order), client: toReceiver(order, clients) })),
    win,
    supplier,
    undefined,
    'OUTBOUND',
  )
}
