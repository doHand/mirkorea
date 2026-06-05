'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BoxSelect, Search, Pencil, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { productApi, unitApi } from '@/api/product.api'
import { formatNumber } from '@/utils/format'
import type { Product, ProductUnit } from '@/types/api.types'

type EditCell = { id: string; field: 'unit' | 'boxQty'; value: string }

export default function BoxQtyPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [editCell, setEditCell] = useState<EditCell | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['products', search],
    queryFn: () => productApi.findAll({ search, limit: 200 }),
  })

  const { data: units } = useQuery({
    queryKey: ['product-units'],
    queryFn: () => unitApi.findAll(),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, field, value }: { id: string; field: string; value: string | number }) =>
      productApi.update(id, { [field]: value }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success('저장되었습니다') },
    onError: () => toast.error('저장 실패'),
  })

  const startEdit = (id: string, field: 'unit' | 'boxQty', value: string) =>
    setEditCell({ id, field, value })

  const saveEdit = (cell: EditCell) => {
    const value = cell.field === 'boxQty' ? Number(cell.value) : cell.value
    updateMutation.mutate({ id: cell.id, field: cell.field, value })
    setEditCell(null)
  }

  const unitOptions: ProductUnit[] = units ?? []
  const products: Product[] = data?.items ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <BoxSelect size={18} className="text-indigo-500" />박스입수량
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">단위와 박스당 낱개 수량을 클릭해 편집합니다.</p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="코드 / 상품명"
            className="pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 outline-none focus:border-indigo-400 w-48" />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="bg-gray-50/80 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
              <th className="text-center px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">코드</th>
              <th className="text-center px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">상품명</th>
              <th className="text-center px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">단위</th>
              <th className="text-center px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">박스 입수</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={4} className="text-center py-10 text-gray-400 text-sm">불러오는 중...</td></tr>}
            {products.map((p: Product) => (
              <tr key={p.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/30 dark:hover:bg-gray-800/10 transition-colors">
                <td className="px-5 py-3">
                  <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">{p.code}</span>
                </td>
                <td className="px-4 py-3 text-gray-800 dark:text-gray-200 font-medium">{p.name}</td>

                {/* 단위 */}
                <td className="px-3 py-2 text-center">
                  {editCell?.id === p.id && editCell.field === 'unit' ? (
                    <div className="flex items-center justify-center gap-1.5">
                      <select autoFocus value={editCell.value}
                        onChange={(e) => setEditCell({ ...editCell, value: e.target.value })}
                        onBlur={() => saveEdit(editCell)}
                        className="px-2 py-1 text-sm border border-indigo-400 rounded-lg bg-white dark:bg-gray-800 outline-none">
                        {unitOptions.length > 0
                          ? unitOptions.map((u) => <option key={u.id} value={u.code}>{u.code} — {u.label}</option>)
                          : ['EA', 'BOX', 'PALLET'].map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <button onMouseDown={(e) => { e.preventDefault(); saveEdit(editCell) }} className="text-indigo-500 p-0.5"><Check size={13} /></button>
                      <button onMouseDown={(e) => { e.preventDefault(); setEditCell(null) }} className="text-gray-400 p-0.5"><X size={13} /></button>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(p.id, 'unit', p.unit)}
                      className="mx-auto flex items-center justify-center gap-1.5 group/u px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                      <span className="text-sm font-mono font-medium text-gray-800 dark:text-gray-200">{p.unit}</span>
                      <Pencil size={10} className="text-gray-300 opacity-0 group-hover/u:opacity-100 transition-opacity" />
                    </button>
                  )}
                </td>

                {/* 박스 입수 */}
                <td className="px-3 py-2 text-right">
                  {editCell?.id === p.id && editCell.field === 'boxQty' ? (
                    <div className="flex items-center justify-end gap-1">
                      <input autoFocus type="number" min={1} value={editCell.value}
                        onChange={(e) => setEditCell({ ...editCell, value: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(editCell); if (e.key === 'Escape') setEditCell(null) }}
                        onBlur={() => saveEdit(editCell)}
                        className="w-16 px-2 py-1 text-sm border border-indigo-400 rounded-lg bg-white dark:bg-gray-800 text-right tabular-nums outline-none" />
                      <button onMouseDown={(e) => { e.preventDefault(); saveEdit(editCell) }} className="text-indigo-500 p-0.5"><Check size={13} /></button>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(p.id, 'boxQty', String(p.boxQty))}
                      className="ml-auto flex items-center justify-end gap-1.5 group/b px-3 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                      <span className="text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-200">{formatNumber(p.boxQty)}</span>
                      <Pencil size={10} className="text-gray-300 opacity-0 group-hover/b:opacity-100 transition-opacity" />
                    </button>
                  )}
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
