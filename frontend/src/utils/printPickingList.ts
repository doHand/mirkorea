import type { Inventory, OutboundOrder, Product } from '@/types/api.types'

const esc = (value?: string | number | null) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char] ?? char))

export interface DailyPickingRow {
  key: string
  productId: string
  product?: Product
  locationCode: string
  boxCount: number
  requests: string
  insufficient: boolean
}

export function buildDailyPickingRows(orders: OutboundOrder[], inventory: Inventory[]): DailyPickingRow[] {
  const requested = new Map<string, {
    product?: Product
    boxCount: number
    requests: Map<string, number>
  }>()

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const current = requested.get(item.productId) ?? {
        product: item.product,
        boxCount: 0,
        requests: new Map<string, number>(),
      }
      const requestName = order.recipient
        ? `${order.customer}/${order.recipient}`
        : order.customer
      current.boxCount += item.boxCount
      current.requests.set(requestName, (current.requests.get(requestName) ?? 0) + item.boxCount)
      requested.set(item.productId, current)
    })
  })

  const rows: DailyPickingRow[] = []
  requested.forEach((request, productId) => {
    const requests = Array.from(request.requests.entries())
      .map(([name, boxes]) => `${name} ${boxes.toLocaleString()}BOX`)
      .join(', ')
    const locationsById = new Map<string, { locationId: string; locationCode: string; quantity: number }>()
    inventory
      .filter((item) => item.productId === productId && item.availableQty > 0)
      .forEach((item) => {
        const current = locationsById.get(item.locationId)
        locationsById.set(item.locationId, {
          locationId: item.locationId,
          locationCode: item.location?.code ?? '-',
          quantity: (current?.quantity ?? 0) + item.availableQty,
        })
      })
    const locations = Array.from(locationsById.values())
      .sort((a, b) => a.locationCode.localeCompare(b.locationCode, 'ko'))

    let remaining = request.boxCount
    locations.forEach((stock) => {
      if (remaining <= 0) return
      const boxes = Math.min(remaining, stock.quantity)
      rows.push({
        key: `${productId}-${stock.locationId}`,
        productId,
        product: request.product,
        locationCode: stock.locationCode,
        boxCount: boxes,
        requests,
        insufficient: false,
      })
      remaining -= boxes
    })

    if (remaining > 0) {
      rows.push({
        key: `${productId}-insufficient`,
        productId,
        product: request.product,
        locationCode: '재고부족',
        boxCount: remaining,
        requests,
        insufficient: true,
      })
    }
  })

  return rows.sort((a, b) => {
    if (a.insufficient !== b.insufficient) return a.insufficient ? 1 : -1
    return a.locationCode.localeCompare(b.locationCode, 'ko')
      || (a.product?.name ?? '').localeCompare(b.product?.name ?? '', 'ko')
  })
}

export function printDailyPickingList(date: string, orders: OutboundOrder[], inventory: Inventory[]) {
  const pickingRows = buildDailyPickingRows(orders, inventory)
  const rows = pickingRows.map((row, index) => `
    <tr class="${row.insufficient ? 'insufficient' : ''}">
      <td>${index + 1}</td>
      <td>${esc(row.locationCode)}</td>
      <td class="left">${esc(row.product?.code)}</td>
      <td class="left">${esc(row.product?.name)}</td>
      <td class="boxes">${row.boxCount.toLocaleString()}</td>
      <td class="left requests">${esc(row.requests)}</td>
      <td></td>
    </tr>
  `).join('')
  const totalBoxes = orders.flatMap((order) => order.items)
    .reduce((sum, item) => sum + Number(item.boxCount || 0), 0)
  const blankRows = Array.from({ length: Math.max(18 - pickingRows.length, 0) },
    () => '<tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('')
  const win = window.open('', '_blank', 'width=1100,height=1100')
  if (!win) return

  win.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8">
  <title>통합 피킹리스트 ${esc(date)}</title><style>
  @page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:"Malgun Gothic",sans-serif;color:#111;font-size:9pt}
  h1{text-align:center;font-size:18pt;letter-spacing:.25em;margin:0 0 5mm}.meta{display:flex;justify-content:space-between;margin-bottom:3mm;font-size:10pt}
  table{width:100%;border-collapse:collapse;table-layout:fixed;border:2px solid #111}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}
  th,td{height:8mm;border:1px solid #111;padding:1mm 2mm;text-align:center;vertical-align:middle;overflow-wrap:anywhere}
  th{font-weight:700}.left{text-align:left}.boxes{font-size:12pt;font-weight:700}.requests{font-size:8pt;line-height:1.35}.summary{margin-top:3mm;text-align:right;font-size:12pt;font-weight:700}
  .insufficient{background:#eee;font-weight:700}.check{width:10%}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body><h1>당일 통합 피킹리스트</h1>
  <div class="meta"><b>피킹일: ${esc(date)}</b><b>출고지시 ${orders.length.toLocaleString()}건 / 총 ${totalBoxes.toLocaleString()} BOX</b></div>
  <table><thead><tr><th style="width:5%">번호</th><th style="width:11%">위치</th><th style="width:14%">상품코드</th><th style="width:22%">상품명</th><th style="width:9%">BOX</th><th>요청처별 수량</th><th class="check">피킹확인</th></tr></thead>
  <tbody>${rows}${blankRows}</tbody></table><div class="summary">총 ${totalBoxes.toLocaleString()} BOX</div>
  <script>window.onload=()=>window.print()<\/script></body></html>`)
  win.document.close()
}
