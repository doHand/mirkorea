'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { productApi } from '@/api/product.api'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { formatNumber } from '@/utils/format'
import { cn } from '@/utils/cn'
import * as ui from '@/styles/ui'
import type { Product } from '@/types/api.types'

interface Props {
  products?: Product[]
  existingIds?: string[]
  multiSelect?: boolean
  title?: string
  onClose: () => void
  onConfirm: (products: Product[]) => void
}

export function ProductPickerModal({
  products: propProducts,
  existingIds = [],
  multiSelect = false,
  title,
  onClose,
  onConfirm,
}: Props) {
  useEscapeKey(onClose)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const { data: fetchedData, isLoading } = useQuery({
    queryKey: ['products', 'picker', search],
    queryFn: () => productApi.findAll({ search: search || undefined, limit: 100 }),
    enabled: !propProducts,
  })

  const allProducts = propProducts ?? fetchedData?.items ?? []
  const existingSet = new Set(existingIds)
  const q = search.toLowerCase()
  const filtered =
    propProducts && q
      ? allProducts.filter((p) =>
          [p.name, p.code, p.spec, p.client?.name]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)),
        )
      : allProducts

  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const allFilteredSelected =
    filtered.length > 0 && filtered.filter((p) => !existingSet.has(p.id)).every((p) => selectedIds.has(p.id))

  const toggleAll = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const selectable = filtered.filter((p) => !existingSet.has(p.id))
      if (allFilteredSelected) selectable.forEach((p) => next.delete(p.id))
      else selectable.forEach((p) => next.add(p.id))
      return next
    })

  const selectedProducts = allProducts.filter((p) => selectedIds.has(p.id))
  const colSpan = multiSelect ? 7 : 6
  const heading = title ?? (multiSelect ? '상품 추가' : '상품 선택')

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-3xl max-h-[80vh] flex flex-col border border-gray-200 dark:border-gray-700 shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{heading}</h3>
          <button type="button" onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">닫기</button>
        </div>
        <div className="px-4 py-1.5 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="상품명, 상품코드, 규격, 거래처 검색"
            className="w-full border border-gray-200 dark:border-gray-700 pl-3 pr-3 py-2 text-sm outline-none focus:border-[var(--color-primary)] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className={ui.thead}>
                {multiSelect && (
                  <th className="px-3 py-1.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleAll}
                      className="w-3.5 h-3.5 accent-white cursor-pointer"
                    />
                  </th>
                )}
                <th className="px-4 py-1.5 text-left font-semibold">코드</th>
                <th className="px-4 py-1.5 text-left font-semibold">상품명</th>
                <th className="px-4 py-1.5 text-left font-semibold">거래처</th>
                <th className="px-4 py-1.5 text-left font-semibold">규격</th>
                <th className="px-4 py-1.5 text-center font-semibold">단위</th>
                <th className="px-4 py-1.5 text-right font-semibold">판매단가</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading && (
                <tr><td colSpan={colSpan} className="text-center py-8 text-gray-400">상품을 불러오는 중...</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={colSpan} className="text-center py-8 text-gray-400">검색 결과가 없습니다</td></tr>
              )}
              {filtered.map((product) => {
                const alreadyAdded = existingSet.has(product.id)
                const checked = selectedIds.has(product.id)
                return (
                  <tr
                    key={product.id}
                    onClick={() => {
                      if (alreadyAdded) return
                      if (!multiSelect) { onConfirm([product]); return }
                      toggle(product.id)
                    }}
                    className={cn(
                      'transition-colors',
                      alreadyAdded
                        ? 'bg-gray-50 dark:bg-gray-800/20 text-gray-400 cursor-default'
                        : checked
                          ? 'bg-[#edf0ec] dark:bg-[var(--color-primary)]/20 cursor-pointer'
                          : 'hover:bg-[#f7f8f5] dark:hover:bg-gray-800/40 cursor-pointer',
                    )}
                  >
                    {multiSelect && (
                      <td className="px-3 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={alreadyAdded}
                          onChange={() => !alreadyAdded && toggle(product.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-3.5 h-3.5 accent-[#2D4033] cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="px-4 py-1.5 font-mono text-xs text-[var(--color-primary)]">{product.code}</td>
                    <td className="px-4 py-1.5 font-medium text-gray-900 dark:text-gray-100">
                      {product.name}
                      {alreadyAdded && <span className="ml-2 text-xs text-[var(--color-primary)]">추가됨</span>}
                    </td>
                    <td className="px-4 py-1.5 text-gray-500 dark:text-gray-400 text-xs">{product.client?.name ?? '-'}</td>
                    <td className="px-4 py-1.5 text-gray-500 dark:text-gray-400 text-xs">{product.spec ?? '-'}</td>
                    <td className="px-4 py-1.5 text-center text-gray-600 dark:text-gray-400">{product.unit}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums text-gray-900 dark:text-gray-100">
                      ￦{formatNumber(product.sellPrice ?? 0)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
          <span className="text-xs text-gray-400">
            {multiSelect && selectedIds.size > 0 ? (
              <span className="text-[var(--color-primary)] font-medium">{selectedIds.size}개 선택됨</span>
            ) : (
              `전체 ${allProducts.length}개 · 검색 ${filtered.length}개`
            )}
          </span>
          {multiSelect && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => selectedIds.size > 0 && onConfirm(selectedProducts)}
                disabled={selectedIds.size === 0}
                className="px-4 py-1.5 text-sm bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-40 font-medium min-w-[80px]"
              >
                추가 {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
