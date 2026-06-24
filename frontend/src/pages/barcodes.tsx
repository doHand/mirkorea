'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { productApi } from '@/api/product.api'
import { cn } from '@/utils/cn'
import { formatNumber } from '@/utils/format'
import type { Barcode as BarcodeType, BarcodeUnitType, Product } from '@/types/api.types'
import { ProductBarcodeModal } from '@/components/ProductBarcodeModal'

const TYPE_LABEL: Record<BarcodeUnitType, string> = {
  UNIT: '일반', CXD: 'CXD INBOX', CXD_BOX: 'CXD OUTBOX',
}
const TYPE_COLOR: Record<BarcodeUnitType, string> = {
  UNIT:    'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  CXD:     'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  CXD_BOX: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
}
const TYPE_ORDER: Record<BarcodeUnitType, number> = { UNIT: 0, CXD: 1, CXD_BOX: 2 }

function BarcodeRows({ productId }: { productId: string }) {
  const { data: barcodes = [], isLoading } = useQuery<BarcodeType[]>({
    queryKey: ['product-barcodes', productId],
    queryFn: () => productApi.findBarcodes(productId),
  })

  if (isLoading) {
    return <div className="px-5 pb-3 text-xs text-gray-400 animate-pulse">불러오는 중...</div>
  }
  if (barcodes.length === 0) {
    return <div className="px-5 pb-3 text-xs text-gray-400">등록된 바코드 없음</div>
  }

  return (
    <div className="px-5 pb-3 flex flex-wrap gap-2">
      {[...barcodes].sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type]).map((b) => (
        <div
          key={b.id}
          className="flex items-center gap-1.5 rounded border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 px-2.5 py-1.5 shadow-sm"
        >
          {b.isPrimary && <span className="wms-star shrink-0 text-[10px]">★</span>}
          <span className="font-mono text-xs text-gray-800 dark:text-gray-200">{b.barcode}</span>
          <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold', TYPE_COLOR[b.type])}>
            {TYPE_LABEL[b.type]}
          </span>
          {(b.type === 'CXD' || b.type === 'CXD_BOX') && (
            <span className="text-[10px] text-gray-400">{formatNumber(b.unitQty)}개</span>
          )}
        </div>
      ))}
    </div>
  )
}

export default function BarcodesPage() {
  const [searchInput, setSearchInput] = useState('')
  const [search,      setSearch]      = useState('')
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set())
  const [manageModal, setManageModal] = useState<Product | null>(null)

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['products', search],
    queryFn:  () => productApi.findAll({ search, limit: 200 }),
  })
  const products: Product[] = pageData?.items ?? []

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div>
        <h2 className="text-[15px] font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
          바코드 관리
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">상품을 선택하여 바코드를 추가·수정·삭제합니다</p>
      </div>

      {/* 검색 */}
      <div className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800 p-3 flex gap-2 shadow-sm">
        <div className="relative flex-1">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setSearch(searchInput) }}
            placeholder="상품코드 / 상품명"
            className="wms-input w-full dark:border-gray-700 dark:bg-gray-800"
          />
        </div>
        <button
          onClick={() => setSearch(searchInput)}
          className="wms-primary-button px-3.5 py-2 text-sm transition-colors font-medium"
        >
          검색
        </button>
      </div>

      {/* 상품 목록 */}
      <div className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm divide-y divide-gray-100 dark:divide-gray-800">
        {isLoading && <p className="text-center py-10 text-gray-400 text-sm animate-pulse">불러오는 중...</p>}
        {!isLoading && products.length === 0 && (
          <div className="text-center py-16 text-gray-400 dark:text-gray-600">
            <p className="text-sm">{search ? '검색 결과 없음' : '상품코드 또는 상품명으로 검색하세요'}</p>
          </div>
        )}
        {products.map((p) => {
          const isOpen = expanded.has(p.id)
          return (
            <div key={p.id} className="divide-y divide-gray-50 dark:divide-gray-800">
              <div className="flex items-center gap-2 px-4 py-3.5">
                {/* 펼치기 버튼 + 상품 정보 */}
                <button
                  onClick={() => toggleExpand(p.id)}
                  className="flex items-center gap-2.5 flex-1 text-left min-w-0"
                >
                  <span className={cn(
                      'shrink-0 text-gray-300 dark:text-gray-600 transition-transform duration-200 inline-block text-xs',
                      isOpen && 'rotate-180',
                    )}>▼</span>
                  <span className="font-mono text-xs text-[var(--color-text)] dark:text-emerald-400 w-28 shrink-0">{p.code}</span>
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1 truncate">{p.name}</span>
                  <span className="tabular-nums text-xs text-gray-400 mr-1">{formatNumber(p.stockQty ?? 0)}개 재고</span>
                </button>
                {/* 편집 버튼 */}
                <button
                  onClick={() => setManageModal(p)}
                  className="wms-icon-button shrink-0 p-1.5 rounded text-gray-300 dark:hover:bg-amber-900/10 transition-colors"
                  title="바코드 편집"
                >
                  수정
                </button>
              </div>

              {/* 바코드 목록 (펼쳐진 경우) */}
              {isOpen && (
                <div className="bg-gray-50/60 dark:bg-gray-800/20 pt-2.5">
                  <BarcodeRows productId={p.id} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {manageModal && (
        <ProductBarcodeModal
          product={manageModal}
          onClose={() => setManageModal(null)}
        />
      )}
    </div>
  )
}
