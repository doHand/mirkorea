'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Barcode, Search, Pencil } from 'lucide-react'
import { productApi } from '@/api/product.api'
import { formatNumber } from '@/utils/format'
import type { Product } from '@/types/api.types'
import { ProductBarcodeModal } from '@/components/ProductBarcodeModal'

export default function BarcodesPage() {
  const [searchInput, setSearchInput] = useState('')
  const [search,      setSearch]      = useState('')
  const [manageModal, setManageModal] = useState<Product | null>(null)

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['products', search],
    queryFn:  () => productApi.findAll({ search, limit: 200 }),
  })
  const products: Product[] = pageData?.items ?? []

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div>
        <h2 className="text-[15px] font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
          <Barcode size={16} className="text-[#D2691E]" />바코드 관리
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">상품을 선택하여 바코드를 추가·수정·삭제합니다</p>
      </div>

      {/* 검색 */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3 flex gap-2 shadow-sm">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setSearch(searchInput) }}
            placeholder="상품코드 / 상품명"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D4033]/25 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400"
          />
        </div>
        <button
          onClick={() => setSearch(searchInput)}
          className="px-3.5 py-2 text-sm bg-[#2D4033] hover:bg-[#253628] text-white rounded-xl transition-colors font-medium"
        >
          검색
        </button>
      </div>

      {/* 상품 목록 */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm divide-y divide-gray-100 dark:divide-gray-800">
        {isLoading && <p className="text-center py-10 text-gray-400 text-sm animate-pulse">불러오는 중...</p>}
        {!isLoading && products.length === 0 && (
          <div className="text-center py-16 text-gray-400 dark:text-gray-600">
            <Barcode size={36} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">{search ? '검색 결과 없음' : '상품코드 또는 상품명으로 검색하세요'}</p>
          </div>
        )}
        {products.map((p) => (
          <button
            key={p.id}
            onClick={() => setManageModal(p)}
            className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-amber-50/60 dark:hover:bg-amber-900/10 text-left transition-colors group/row"
          >
            <span className="font-mono text-xs text-[#2D4033] dark:text-emerald-400 w-28 shrink-0">{p.code}</span>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1">{p.name}</span>
            <span className="tabular-nums text-xs text-gray-400 mr-1">{formatNumber(p.stockQty ?? 0)}개 재고</span>
            <Pencil size={12} className="text-gray-300 group-hover/row:text-[#D2691E] transition-colors shrink-0" />
          </button>
        ))}
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
