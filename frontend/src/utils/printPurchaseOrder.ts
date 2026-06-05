import type { PurchaseOrder } from '@/types/api.types'

const esc = (value?: string | number | null) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char] ?? char))

export function printPurchaseOrder(order: PurchaseOrder) {
  const rows = order.items.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td class="left">${esc(item.product?.name)}</td>
      <td class="number">${Number(item.boxCount || 0).toLocaleString()}</td>
      <td class="number">${Number(item.quantity || 0).toLocaleString()}</td>
      <td>${esc(item.capSize || '-')}</td>
    </tr>
  `).join('')
  const totalBoxes = order.items.reduce((sum, item) => sum + Number(item.boxCount || 0), 0)
  const totalEa = order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  const win = window.open('', '_blank', 'width=900,height=1100')
  if (!win) return

  win.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>발주서 ${esc(order.orderNo)}</title><style>
    @page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:"Malgun Gothic",sans-serif;color:#17251c;font-size:12px}
    .sheet{max-width:190mm;margin:auto}.title{text-align:center;font-size:28px;letter-spacing:12px;margin:20px 0 28px}
    .meta{display:grid;grid-template-columns:1fr 1fr;border:2px solid #2d4033;margin-bottom:16px}
    .meta div{padding:9px 10px;border:1px solid #cbd4cc}.meta b{display:inline-block;width:82px;color:#2d4033}
    table{width:100%;border-collapse:collapse}th,td{border:1px solid #9eada1;padding:9px;text-align:center}
    th{background:#2d4033;color:white}.left{text-align:left}.number{text-align:right}
    tfoot td{background:#edf0ec;font-weight:bold}.memo{margin-top:20px;border:1px solid #9eada1;min-height:60px;padding:10px}
    .note{margin-top:12px;color:#647069;font-size:11px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body><div class="sheet">
    <h1 class="title">발 주 서</h1>
    <div class="meta">
      <div><b>업체명</b>${esc(order.supplier || '-')}</div><div><b>발주일</b>${esc(order.orderDate)}</div>
      <div><b>담당자</b>${esc(order.manager || '-')}</div><div><b>입고일</b>${esc(order.expectedDate || '-')}</div>
      <div><b>전화번호</b>${esc(order.phone || '-')}</div><div><b>팩스</b>${esc(order.fax || '-')}</div>
    </div>
    <table><thead><tr><th style="width:9%">번호</th><th>제품명</th><th style="width:16%">박스수량</th><th style="width:18%">수량(EA)</th><th style="width:20%">캡사이즈</th></tr></thead>
      <tbody>${rows}</tbody><tfoot><tr><td colspan="2">합계</td><td class="number">${totalBoxes.toLocaleString()}</td><td class="number">${totalEa.toLocaleString()}</td><td></td></tr></tfoot>
    </table>
    ${order.memo ? `<div class="memo">${esc(order.memo)}</div>` : ''}
    <div class="note">본 발주서는 입고예정 등록 전까지 재고 및 입고예정 수량에 반영되지 않습니다.</div>
  </div><script>window.onload=()=>window.print()<\/script></body></html>`)
  win.document.close()
}
