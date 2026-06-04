'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FlaskConical, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { productApi } from '@/api/product.api'
import { cn } from '@/utils/cn'
import { formatNumber } from '@/utils/format'
import type { Product } from '@/types/api.types'

export default function LotPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['products', search],
    queryFn: () => productApi.findAll({ search, limit: 200 }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, isLotManaged }: { id: string; isLotManaged: boolean }) =>
      productApi.update(id, { isLotManaged } as Partial<Product>),
    onSuccess: (_, { isLotManaged }) => {
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success(`LOT 관리 ${isLotManaged ? '활성화' : '비활성화'}`)
    },
    onError: () => toast.error('변경 실패'),
  })

  const products: Product[] = data?.items ?? []
  const lotCount = products.filter((p) => p.isLotManaged).length

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <FlaskConical size={18} className="text-indigo-500" />LOT 관리
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">LOT 추적이 필요한 상품을 활성화합니다. (유통기간 관리 없음)</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 hidden sm:block">LOT 활성: <strong className="text-indigo-600 tabular-nums">{formatNumber(lotCount)}</strong>개</span>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="코드 / 상품명"
              className="pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 outline-none focus:border-indigo-400 w-48" />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="bg-gray-50/80 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
              <th className="text-center px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">코드</th>
              <th className="text-center px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">상품명</th>
              <th className="text-center px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">카테고리</th>
              <th className="text-center px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">LOT 관리</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={4} className="text-center py-10 text-gray-400 text-sm">불러오는 중...</td></tr>}
            {!isLoading && products.length === 0 && <tr><td colSpan={4} className="text-center py-10 text-gray-300 text-sm">검색 결과 없음</td></tr>}
            {products.map((p: Product) => (
              <tr key={p.id} className={cn('border-t border-gray-100 dark:border-gray-800 transition-colors',
                p.isLotManaged ? 'bg-indigo-50/40 dark:bg-indigo-900/5' : 'hover:bg-gray-50/30 dark:hover:bg-gray-800/10')}>
                <td className="px-5 py-3">
                  <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">{p.code}</span>
                </td>
                <td className="px-4 py-3 text-gray-800 dark:text-gray-200 font-medium">{p.name}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{p.category ?? '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-center">
                    <button
                      disabled={updateMutation.isPending}
                      onClick={() => updateMutation.mutate({ id: p.id, isLotManaged: !p.isLotManaged })}
                      className={cn(
                        'relative rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-60',
                        'w-10 h-[22px]',
                        p.isLotManaged ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700',
                      )}
                      aria-label={p.isLotManaged ? 'LOT 관리 비활성화' : 'LOT 관리 활성화'}
                    >
                      <span className={cn(
                        'absolute top-0.5 left-0.5 bg-white rounded-full shadow transition-transform duration-200',
                        'w-[18px] h-[18px]',
                        p.isLotManaged ? 'translate-x-[18px]' : 'translate-x-0',
                      )} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
