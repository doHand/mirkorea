'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Search, Shield } from 'lucide-react'
import toast from 'react-hot-toast'
import { productApi } from '@/api/product.api'
import { ExportButton } from '@/components/ExportButton'
import { useAuthStore } from '@/stores/auth.store'
import { formatNumber } from '@/utils/format'
import { cn } from '@/utils/cn'
import { SALE_STATUS_LABEL } from '@/constants/stock.constants'
import * as ui from '@/styles/ui'
import type { ProductPricing } from '@/types/api.types'

export default function PricingPage() {
  const qc = useQueryClient()
  const me = useAuthStore((s) => s.user)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<ProductPricing | null>(null)
  const [form, setForm] = useState({ costPrice: 0, sellPrice: 0 })

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['products', 'pricing'],
    queryFn: productApi.getPricing,
  })

  const updateMutation = useMutation({
    mutationFn: () => productApi.updatePrice(editing!.id, {
      costPrice: form.costPrice,
      sellPrice: form.sellPrice,
    }),
    onSuccess: () => {
      toast.success('가격이 수정되었습니다')
      qc.invalidateQueries({ queryKey: ['products', 'pricing'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      setEditing(null)
    },
    onError: () => toast.error('수정 실패'),
  })

  const filtered = useMemo(() => {
    if (!search) return items
    const s = search.toLowerCase()
    return items.filter((p) =>
      p.code.toLowerCase().includes(s) ||
      p.name.toLowerCase().includes(s) ||
      (p.category ?? '').toLowerCase().includes(s)
    )
  }, [items, search])

  const totalStock = filtered.reduce((sum, p) => sum + p.totalStock, 0)
  const totalSellAmount = filtered.reduce(
    (sum, p) => sum + Number(p.sellPrice ?? 0) * p.totalStock,
    0
  )

  const openEdit = (p: ProductPricing) => {
    setEditing(p)
    setForm({ costPrice: Number(p.costPrice ?? 0), sellPrice: Number(p.sellPrice ?? 0) })
  }

  if (me?.role !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400 dark:text-gray-500">
        <Shield size={40} className="opacity-40" />
        <p>관리자만 접근할 수 있습니다</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={ui.h2Cls}>가격 재고현황</h2>
          <p className={ui.subText}>전체 {formatNumber(items.length)}개 상품 · 재고 {formatNumber(totalStock)}개</p>
        </div>
        <ExportButton
          filename="가격_재고현황"
          getData={() => filtered.map((p) => ({
            상품코드: p.code,
            상품명: p.name,
            카테고리: p.category ?? '',
            단위: p.unit,
            재고수량: p.totalStock,
            원가: p.costPrice ?? 0,
            판매가: p.sellPrice ?? 0,
            판매기준금액: Number(p.sellPrice ?? 0) * p.totalStock,
            상태: SALE_STATUS_LABEL[p.saleStatus],
          }))}
        />
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <div className={cn(ui.cardFlat, 'p-4')}>
          <p className={ui.subText}>상품 수</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums mt-1">{formatNumber(filtered.length)}</p>
        </div>
        <div className={cn(ui.cardFlat, 'p-4')}>
          <p className={ui.subText}>재고 수량</p>
          <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 tabular-nums mt-1">{formatNumber(totalStock)}</p>
        </div>
        <div className={cn(ui.cardFlat, 'p-4')}>
          <p className={ui.subText}>판매기준 금액</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">{formatNumber(totalSellAmount)}</p>
        </div>
      </div>

      {/* 검색 */}
      <div className={ui.filterCard}>
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setSearch(searchInput) }}
            placeholder="상품코드, 상품명, 카테고리 검색"
            className={ui.searchInput}
          />
        </div>
        <button onClick={() => setSearch(searchInput)} className={ui.btnPrimary}>검색</button>
      </div>

      {/* 테이블 */}
      <div className={ui.tableWrap}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className={ui.thead}>
                <th className={ui.th}>코드</th>
                <th className={ui.th}>상품명</th>
                <th className={cn(ui.th, 'w-24')}>카테고리</th>
                <th className={cn(ui.thC, 'w-20')}>단위</th>
                <th className={cn(ui.thR, 'w-28')}>재고 수량</th>
                <th className={cn(ui.thR, 'w-28')}>원가</th>
                <th className={cn(ui.thR, 'w-28')}>판매가</th>
                <th className={cn(ui.thR, 'w-32')}>판매기준 금액</th>
                <th className={cn(ui.thC, 'w-24')}>상태</th>
                <th className="px-4 py-3 w-16" />
              </tr>
            </thead>
            <tbody className={ui.tbody}>
              {isLoading && (
                <tr><td colSpan={10} className="text-center py-10 text-gray-400 dark:text-gray-500">로딩 중...</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={10} className="text-center py-10 text-gray-400 dark:text-gray-500">상품이 없습니다</td></tr>
              )}
              {filtered.map((p) => {
                const sellAmount = Number(p.sellPrice ?? 0) * p.totalStock
                const belowSafety = p.totalStock <= p.safetyStock && p.safetyStock > 0
                return (
                  <tr key={p.id} className={cn(ui.tr, belowSafety && 'bg-red-50/50 dark:bg-red-900/5')}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{p.code}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{p.category || '-'}</td>
                    <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{p.unit}</td>
                    <td className={cn('px-4 py-3 text-right tabular-nums font-bold', belowSafety ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100')}>
                      {formatNumber(p.totalStock)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {p.costPrice != null ? formatNumber(Number(p.costPrice)) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-gray-100 font-medium">
                      {p.sellPrice != null ? formatNumber(Number(p.sellPrice)) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatNumber(sellAmount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full',
                        p.saleStatus === 'ACTIVE' && 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
                        p.saleStatus === 'INACTIVE' && 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
                        p.saleStatus === 'DISCONTINUED' && 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
                      )}>
                        {SALE_STATUS_LABEL[p.saleStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(p)} className={ui.btnIcon} title="가격 수정">
                        <Pencil size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 수정 모달 */}
      {editing && (
        <div className={ui.modalOverlay}>
          <div className={ui.modalBox}>
            <h3 className="text-base font-bold mb-1 text-gray-900 dark:text-white">{editing.name}</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-5 font-mono">{editing.code}</p>
            <div className="space-y-3">
              <div>
                <label className={ui.label}>원가</label>
                <input
                  type="number"
                  min={0}
                  value={form.costPrice}
                  onChange={(e) => setForm((p) => ({ ...p, costPrice: +e.target.value }))}
                  className={ui.formInput}
                />
              </div>
              <div>
                <label className={ui.label}>판매가</label>
                <input
                  type="number"
                  min={0}
                  value={form.sellPrice}
                  onChange={(e) => setForm((p) => ({ ...p, sellPrice: +e.target.value }))}
                  className={ui.formInput}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditing(null)} className={cn(ui.btnSecondary, 'flex-1')}>취소</button>
              <button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className={cn(ui.btnPrimary, 'flex-1 disabled:opacity-50')}
              >
                {updateMutation.isPending ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
