import { productApi } from '@/api/product.api'
import { formatNumber } from '@/utils/format'
import type { ImportConfig } from '@/components/ImportButton'
import type { SaleStatus } from '@/types/api.types'

const STATUS_MAP: Record<string, SaleStatus> = {
  '판매중': 'ACTIVE',  '활성': 'ACTIVE',  ACTIVE: 'ACTIVE',
  '비활성': 'INACTIVE', INACTIVE: 'INACTIVE',
  '단종': 'DISCONTINUED', DISCONTINUED: 'DISCONTINUED',
}

export const productImportConfig: ImportConfig = {
  templateFilename: '상품등록_템플릿.xlsx',
  sheetName: '상품',
  templateRows: [{
    상품코드: 'PRD-001', 상품명: '샘플상품', 카테고리: '전자',
    브랜드: 'ACME', 단위: 'EA', OUT입수: 12,
    안전재고: 10, 재주문점: 5, 원가: 5000, 판매가: 8000, 상태: '판매중',
  }],
  parse: (raw) =>
    raw.map((row) => {
      const str = (...keys: string[]) => {
        for (const k of keys) {
          const v = row[k]
          if (v !== undefined && v !== '') return String(v)
        }
        return undefined
      }
      const num = (...keys: string[]) => {
        const v = str(...keys)
        const n = Number(v)
        return v !== undefined && !isNaN(n) ? n : undefined
      }
      const code      = str('상품코드', 'code') ?? ''
      const name      = str('상품명',   'name') ?? ''
      const statusRaw = str('상태', 'saleStatus') ?? 'ACTIVE'
      return {
        code, name,
        category:     str('카테고리', 'category'),
        brand:        str('브랜드',   'brand'),
        unit:         str('단위',     'unit') ?? 'EA',
        boxQty:       num('OUT입수', 'boxQty')    ?? 1,
        safetyStock:  num('안전재고', 'safetyStock') ?? 0,
        reorderPoint: num('재주문점', 'reorderPoint') ?? 0,
        costPrice:    num('원가',     'costPrice'),
        sellPrice:    num('판매가',   'sellPrice'),
        saleStatus:   STATUS_MAP[statusRaw] ?? 'ACTIVE',
        _error: !code || !name ? '코드/명 필수' : undefined,
      }
    }),
  previewColumns: [
    { key: 'code',      label: '코드',   mono: true },
    { key: 'name',      label: '상품명' },
    { key: 'category',  label: '카테고리' },
    { key: 'costPrice', label: '원가',   align: 'right',
      format: (v) => v != null ? `₩${formatNumber(Number(v))}` : '-' },
    { key: 'sellPrice', label: '판매가', align: 'right',
      format: (v) => v != null ? `₩${formatNumber(Number(v))}` : '-' },
  ],
  save: async (validRows, setProgress) => {
    let ok = 0, fail = 0
    for (let i = 0; i < validRows.length; i++) {
      try {
        await productApi.create(validRows[i] as Parameters<typeof productApi.create>[0])
        ok++
      } catch {
        fail++
      }
      setProgress(Math.round(((i + 1) / validRows.length) * 100))
    }
    return { ok, fail }
  },
}
