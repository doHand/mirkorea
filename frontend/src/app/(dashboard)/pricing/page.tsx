'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Pencil, Shield, TrendingUp, Package, DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'
import { productApi } from '@/api/product.api'
import { useAuthStore } from '@/stores/auth.store'
import { formatNumber } from '@/utils/format'
import { cn } from '@/utils/cn'
import { ExportButton } from '@/components/ExportButton'
import { SALE_STATUS_LABEL } from '@/constants/stock.constants'
import type { ProductPricing, SaleStatus } from '@/types/api.types'

export default function PricingPage() {
  const qc      = useQueryClient()
  const me      = useAuthStore((s) => s.user)
  const [search, setSearch]   = useState('')
  const [editing, setEditing] = useState<ProductPricing | null>(null)
  const [form,    setForm]    = useState({ costPrice: 0, sellPrice: 0 })

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['products', 'pricing'],
    queryFn:  productApi.getPricing,
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

  const openEdit = (p: ProductPricing) => {
    setEditing(p)
    setForm({ costPrice: Number(p.costPrice ?? 0), sellPrice: Number(p.sellPrice ?? 0) })
  }

  const filtered = items.filter((p) => {
    if (!search) return true
    const s = search.toLowerCase()
    return p.name.toLowerCase().includes(s) || p.code.toLowerCase().includes(s) || (p.category ?? '').toLowerCase().includes(s)
  })

  const totalStock  = items.reduce((s, p) => s + p.totalStock, 0)
  const totalCost   = items.reduce((s, p) => s + (Number(p.costPrice ?? 0) * p.totalStock), 0)
  const totalRevenue = items.reduce((s, p) => s + (Number(p.sellPrice ?? 0) * p.totalStock), 0)

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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">상품별 가격/재고</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">전체 {items.length}개 상품 · 관리자 전용</p>
        </div>
        <ExportButton
          filename="상품가격재고"
          getData={() => filtered.map((p) => ({
            '상품코드': p.code,
            '상품명':   p.name,
            '카테고리': p.category ?? '',
            '단위':     p.unit,
            '원가':     p.costPrice ?? 0,
            '판매가':   p.sellPrice ?? 0,
            '총재고':   p.totalStock,
            '재고금액(원가)': Number(p.costPrice ?? 0) * p.totalStock,
            '재고금액(판매가)': Number(p.sellPrice ?? 0) * p.totalStock,
            '상태': SALE_STATUS_LABEL[p.saleStatus],
          }))}
        />
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Package,    label: '총 재고 수량', value: formatNumber(totalStock) + '개', cls: 'text-brand-600 dark:text-brand-400' },
          { icon: DollarSign, label: '재고 원가 합계', value: '₩' + formatNumber(Math.round(totalCost)), cls: 'text-amber-600 dark:text-amber-400' },
          { icon: TrendingUp, label: '재고 판매가 합계', value: '₩' + formatNumber(Math.round(totalRevenue)), cls: 'text-emerald-600 dark:text-emerald-400' },
        ].map(({ icon: Icon, label, value, cls }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon size={14} className={cls} />
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            </div>
            <p className={cn('text-lg font-bold tabular-nums', cls)}>{value}</p>
          </div>
        ))}
      </div>

      {/* 검색 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="상품명, 코드, 카테고리 검색"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">상품</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-24">카테고리</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-28">원가</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-28">판매가</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-28">박스당 셋트 개수</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-20">총 박스 재고</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-32">재고 금액</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-20">상태</th>
              <th className="px-4 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading && (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400 dark:text-gray-500">로딩 중...</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400 dark:text-gray-500">상품이 없습니다</td></tr>
            )}
            {filtered.map((p) => {
              const stockValue = Number(p.sellPrice ?? 0) * p.totalStock
              const belowSafety = p.totalStock <= p.safetyStock && p.safetyStock > 0
              return (
                <tr key={p.id} className={cn('hover:bg-gray-50 dark:hover:bg-gray-700/50', belowSafety && 'bg-red-50/50 dark:bg-red-900/5')}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{p.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{p.code}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{p.category || '-'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {p.costPrice != null ? '₩' + formatNumber(Number(p.costPrice)) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-gray-100 font-medium">
                    {p.sellPrice != null ? '₩' + formatNumber(Number(p.sellPrice)) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-500 dark:text-gray-400">
                    {p.boxQty > 0 ? formatNumber(p.boxQty) : '-'}
                  </td>
                  <td className={cn('px-4 py-3 text-right tabular-nums font-bold', belowSafety ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100')}>
                    {formatNumber(p.totalStock)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                    ₩{formatNumber(Math.round(stockValue))}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full',
                      p.saleStatus === 'ACTIVE'       && 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
                      p.saleStatus === 'INACTIVE'     && 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
                      p.saleStatus === 'DISCONTINUED' && 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
                    )}>
                      {SALE_STATUS_LABEL[p.saleStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEdit(p)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                      title="가격 수정"
                    >
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

      {/* 가격 수정 모달 */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold mb-1 text-gray-900 dark:text-white">{editing.name}</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-5 font-mono">{editing.code}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">원가 (₩)</label>
                <input
                  type="number"
                  min={0}
                  value={form.costPrice}
                  onChange={(e) => setForm((p) => ({ ...p, costPrice: +e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">판매가 (₩)</label>
                <input
                  type="number"
                  min={0}
                  value={form.sellPrice}
                  onChange={(e) => setForm((p) => ({ ...p, sellPrice: +e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              {form.sellPrice > 0 && form.costPrice > 0 && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-xs text-gray-500 dark:text-gray-400">
                  마진율: {((form.sellPrice - form.costPrice) / form.sellPrice * 100).toFixed(1)}%
                  &nbsp;·&nbsp;
                  마진액: ₩{formatNumber(form.sellPrice - form.costPrice)}
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                취소
              </button>
              <button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="flex-1 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
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
