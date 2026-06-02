'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Hash, Search, Pencil, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { productApi } from '@/api/product.api'
import { cn } from '@/utils/cn'
import type { Product, SaleStatus } from '@/types/api.types'

const STATUS_LABEL: Record<SaleStatus, string> = { ACTIVE: '판매중', INACTIVE: '비활성', DISCONTINUED: '단종' }
const STATUS_CLS: Record<SaleStatus, string> = {
  ACTIVE:       'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  INACTIVE:     'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
  DISCONTINUED: 'bg-rose-100 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400',
}

export default function ProductCodesPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['products', search],
    queryFn: () => productApi.findAll({ search, limit: 200 }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, code }: { id: string; code: string }) =>
      productApi.update(id, { code }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success('상품코드가 변경되었습니다') },
    onError: () => toast.error('코드 변경 실패 (중복 또는 오류)'),
  })

  const startEdit = (p: Product) => { setEditId(p.id); setEditValue(p.code) }

  const saveEdit = () => {
    if (!editId) return
    const trimmed = editValue.trim()
    if (!trimmed) { toast.error('코드를 입력하세요'); return }
    updateMutation.mutate({ id: editId, code: trimmed })
    setEditId(null)
  }

  const products = data?.items ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <Hash size={18} className="text-indigo-500" />상품코드 관리
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">코드 셀을 클릭하면 인라인 편집됩니다.</p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="코드 / 상품명 검색"
            className="pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 outline-none focus:border-indigo-400 w-52" />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="bg-gray-50/80 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-44">상품코드</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">상품명</th>
              <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">카테고리</th>
              <th className="text-center px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">상태</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={4} className="text-center py-10 text-gray-400 text-sm">불러오는 중...</td></tr>}
            {!isLoading && products.length === 0 && <tr><td colSpan={4} className="text-center py-10 text-gray-300 text-sm">검색 결과가 없습니다</td></tr>}
            {products.map((p: Product) => (
              <tr key={p.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                <td className="px-3 py-3">
                  {editId === p.id ? (
                    <div className="flex items-center gap-1.5">
                      <input autoFocus value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditId(null) }}
                        className="w-32 px-2 py-1 text-sm border border-indigo-400 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none font-mono"
                      />
                      <button onClick={saveEdit} className="text-indigo-500 hover:text-indigo-600 p-0.5"><Check size={14} /></button>
                      <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600 p-0.5"><X size={14} /></button>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(p)}
                      className="flex items-center gap-1.5 group/code px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                      <span className="font-mono text-sm text-gray-800 dark:text-gray-200">{p.code}</span>
                      <Pencil size={11} className="text-gray-300 opacity-0 group-hover/code:opacity-100 transition-opacity" />
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-800 dark:text-gray-200 font-medium">{p.name}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{p.category ?? '—'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', STATUS_CLS[p.saleStatus])}>
                    {STATUS_LABEL[p.saleStatus]}
                  </span>
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
