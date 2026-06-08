'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ruler, Plus, Pencil, Trash2, Check, X, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'
import { unitApi } from '@/api/product.api'
import { cn } from '@/utils/cn'
import { formatNumber } from '@/utils/format'
import type { ProductUnit } from '@/types/api.types'

type FormState = { code: string; label: string; description: string; sortOrder: number }
const emptyForm = (): FormState => ({ code: '', label: '', description: '', sortOrder: 0 })
const DEFAULT_UNITS = ['EA', 'BOX', 'PALLET']

export default function UnitsPage() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState>(emptyForm())

  const { data, isLoading } = useQuery({
    queryKey: ['product-units'],
    queryFn: () => unitApi.findAll(),
  })

  const createMutation = useMutation({
    mutationFn: () => unitApi.create({ ...form, code: form.code.toUpperCase() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-units'] })
      setForm(emptyForm()); setShowAdd(false)
      toast.success('단위가 추가되었습니다')
    },
    onError: () => toast.error('추가 실패 (코드 중복 또는 오류)'),
  })

  const updateMutation = useMutation({
    mutationFn: (id: string) => unitApi.update(id, { ...editForm, code: editForm.code.toUpperCase() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-units'] })
      setEditId(null); toast.success('수정되었습니다')
    },
    onError: () => toast.error('수정 실패'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => unitApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['product-units'] }); toast.success('삭제되었습니다') },
    onError: () => toast.error('삭제 실패'),
  })

  const startEdit = (u: ProductUnit) => {
    setEditId(u.id)
    setEditForm({ code: u.code, label: u.label, description: u.description ?? '', sortOrder: u.sortOrder })
  }

  const units: ProductUnit[] = data ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <Ruler size={18} className="text-indigo-500" />단위 관리
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">EA, BOX, PALLET 등 단위 마스터를 관리합니다.</p>
        </div>
        <button onClick={() => { setShowAdd(true); setForm(emptyForm()) }}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors shadow-sm shadow-indigo-500/20">
          <Plus size={14} /><span className="hidden sm:inline">단위 추가</span>
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="bg-[#2D4033] text-white">
              <th className="w-8" />
              <th className="text-center px-4 py-3 font-semibold w-24">코드</th>
              <th className="text-center px-4 py-3 font-semibold w-32">레이블</th>
              <th className="text-center px-4 py-3 font-semibold">설명</th>
              <th className="text-center px-4 py-3 font-semibold w-20">순서</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">불러오는 중...</td></tr>}
            {units.length === 0 && !isLoading && (
              <tr><td colSpan={6} className="text-center py-10 text-gray-300 text-sm">단위가 없습니다</td></tr>
            )}
            {units.map((u: ProductUnit) => (
              <tr key={u.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/30 dark:hover:bg-gray-800/10 transition-colors group/row">
                <td className="pl-3 pr-0 py-3 w-8">
                  <GripVertical size={14} className="text-gray-300 dark:text-gray-700" />
                </td>
                {editId === u.id ? (
                  <>
                    <td className="px-3 py-2">
                      <input value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                        className="w-20 px-2 py-1 text-sm border border-indigo-400 rounded-lg bg-white dark:bg-gray-800 font-mono outline-none uppercase" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={editForm.label} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                        className="w-28 px-2 py-1 text-sm border border-indigo-400 rounded-lg bg-white dark:bg-gray-800 outline-none" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-indigo-400 rounded-lg bg-white dark:bg-gray-800 outline-none" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={editForm.sortOrder} onChange={(e) => setEditForm({ ...editForm, sortOrder: Number(e.target.value) })}
                        className="w-16 px-2 py-1 text-sm border border-indigo-400 rounded-lg bg-white dark:bg-gray-800 text-center outline-none" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => updateMutation.mutate(u.id)} className="text-indigo-500 hover:text-indigo-600 p-1"><Check size={14} /></button>
                        <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600 p-1"><X size={14} /></button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-gray-800 dark:text-gray-200">{u.code}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{u.label}</td>
                    <td className="px-4 py-3 text-gray-400 dark:text-gray-500">{u.description ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">{formatNumber(u.sortOrder)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover/row:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(u)} className="text-gray-400 hover:text-indigo-500 p-1 transition-colors"><Pencil size={13} /></button>
                        <button
                          disabled={DEFAULT_UNITS.includes(u.code)}
                          onClick={() => { if (confirm(`"${u.label}" 단위를 삭제할까요?`)) deleteMutation.mutate(u.id) }}
                          className={cn('p-1 transition-colors', DEFAULT_UNITS.includes(u.code)
                            ? 'text-gray-200 dark:text-gray-800 cursor-not-allowed'
                            : 'text-gray-400 hover:text-rose-500')}
                          title={DEFAULT_UNITS.includes(u.code) ? '기본 단위는 삭제할 수 없습니다' : undefined}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}

            {showAdd && (
              <tr className="border-t border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/30 dark:bg-indigo-900/5">
                <td className="pl-3 pr-0 py-3 w-8" />
                <td className="px-3 py-2">
                  <input autoFocus placeholder="KG" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="w-20 px-2 py-1 text-sm border border-indigo-400 rounded-lg bg-white dark:bg-gray-800 font-mono outline-none uppercase" />
                </td>
                <td className="px-3 py-2">
                  <input placeholder="레이블" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                    className="w-28 px-2 py-1 text-sm border border-indigo-400 rounded-lg bg-white dark:bg-gray-800 outline-none" />
                </td>
                <td className="px-3 py-2">
                  <input placeholder="설명 (선택)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-indigo-400 rounded-lg bg-white dark:bg-gray-800 outline-none" />
                </td>
                <td className="px-3 py-2">
                  <input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                    className="w-16 px-2 py-1 text-sm border border-indigo-400 rounded-lg bg-white dark:bg-gray-800 text-center outline-none" />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => createMutation.mutate()}
                      disabled={!form.code.trim() || !form.label.trim() || createMutation.isPending}
                      className="text-indigo-500 hover:text-indigo-600 disabled:opacity-40 p-1">
                      <Check size={14} />
                    </button>
                    <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 p-1"><X size={14} /></button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-600">* EA, BOX, PALLET는 기본 단위로 삭제할 수 없습니다.</p>
    </div>
  )
}
