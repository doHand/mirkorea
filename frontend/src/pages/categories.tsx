'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tag, Plus, Pencil, Trash2, Check, X, GripVertical, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import { categoryApi } from '@/api/product.api'
import { cn } from '@/utils/cn'
import * as ui from '@/styles/ui'
import { formatNumber } from '@/utils/format'
import type { ProductCategory } from '@/types/api.types'

type FormState = { name: string; description: string; sortOrder: number }
const emptyForm = (): FormState => ({ name: '', description: '', sortOrder: 0 })

export default function CategoriesPage() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState>(emptyForm())

  const { data, isLoading } = useQuery({
    queryKey: ['product-categories'],
    queryFn: () => categoryApi.findAll(),
  })

  const createMutation = useMutation({
    mutationFn: () => categoryApi.create({ ...form, name: form.name.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-categories'] })
      setForm(emptyForm()); setShowAdd(false)
      toast.success('카테고리가 추가되었습니다')
    },
    onError: (e: unknown) => {
      const msg = (e as { message?: string })?.message
      toast.error(msg?.includes('중복') ? '이미 존재하는 카테고리명입니다' : '추가 실패')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (id: string) => categoryApi.update(id, { ...editForm, name: editForm.name.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-categories'] })
      setEditId(null); toast.success('수정되었습니다')
    },
    onError: (e: unknown) => {
      const msg = (e as { message?: string })?.message
      toast.error(msg?.includes('중복') ? '이미 존재하는 카테고리명입니다' : '수정 실패')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoryApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['product-categories'] }); toast.success('삭제되었습니다') },
    onError: () => toast.error('해당 카테고리를 사용 중인 상품이 있어 삭제할 수 없습니다'),
  })

  const startEdit = (c: ProductCategory) => {
    setEditId(c.id)
    setEditForm({ name: c.name, description: c.description ?? '', sortOrder: c.sortOrder })
  }

  const categories: ProductCategory[] = data ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <Tag size={18} className="text-indigo-500" />카테고리 관리
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">상품 분류 카테고리를 관리합니다.</p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setForm(emptyForm()) }}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors shadow-sm shadow-indigo-500/20"
        >
          <Plus size={14} /><span className="hidden sm:inline">카테고리 추가</span>
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className={ui.thead}>
                <th className="w-8" />
                <th className={cn(ui.th, 'text-left')}>카테고리명</th>
                <th className={cn(ui.th, 'text-left')}>설명</th>
                <th className={cn(ui.th, 'w-20')}>순서</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400 text-sm">불러오는 중...</td></tr>
              )}
              {!isLoading && categories.length === 0 && !showAdd && (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <Package size={32} className="mx-auto mb-2 text-gray-200 dark:text-gray-700" />
                    <p className="text-sm text-gray-300 dark:text-gray-600">카테고리가 없습니다</p>
                    <button
                      onClick={() => { setShowAdd(true); setForm(emptyForm()) }}
                      className="mt-3 text-xs text-indigo-500 hover:text-indigo-600"
                    >
                      + 첫 번째 카테고리 추가
                    </button>
                  </td>
                </tr>
              )}

              {categories.map((c: ProductCategory) => (
                <tr
                  key={c.id}
                  onDoubleClick={() => startEdit(c)}
                  className={cn(
                    'border-t border-gray-100 dark:border-gray-800 group/row cursor-pointer',
                    ui.tr,
                    !c.isActive && 'opacity-50',
                  )}
                >
                  <td className="pl-3 pr-0 py-3 w-8">
                    <GripVertical size={14} className="text-gray-300 dark:text-gray-700" />
                  </td>

                  {editId === c.id ? (
                    <>
                      <td className="px-3 py-2">
                        <input
                          autoFocus
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') updateMutation.mutate(c.id)
                            if (e.key === 'Escape') setEditId(null)
                          }}
                          className="w-full max-w-[200px] px-2 py-1 text-sm border border-indigo-400 rounded-lg bg-white dark:bg-gray-800 outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={editForm.description}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') updateMutation.mutate(c.id)
                            if (e.key === 'Escape') setEditId(null)
                          }}
                          className="w-full px-2 py-1 text-sm border border-indigo-400 rounded-lg bg-white dark:bg-gray-800 outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={editForm.sortOrder}
                          onChange={(e) => setEditForm({ ...editForm, sortOrder: Number(e.target.value) })}
                          className="w-16 px-2 py-1 text-sm border border-indigo-400 rounded-lg bg-white dark:bg-gray-800 text-center outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => updateMutation.mutate(c.id)}
                            disabled={!editForm.name.trim() || updateMutation.isPending}
                            className="text-indigo-500 hover:text-indigo-600 disabled:opacity-40 p-1"
                          >
                            <Check size={14} />
                          </button>
                          <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600 p-1">
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                            {c.name}
                          </span>
                          {!c.isActive && (
                            <span className="text-xs text-gray-400">(비활성)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 dark:text-gray-500 text-sm">{c.description ?? '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-500">{formatNumber(c.sortOrder)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEdit(c)}
                            className="text-gray-400 hover:text-indigo-500 p-1 transition-colors"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`"${c.name}" 카테고리를 삭제할까요?\n해당 카테고리를 사용 중인 상품이 있으면 삭제되지 않습니다.`))
                                deleteMutation.mutate(c.id)
                            }}
                            className="text-gray-400 hover:text-rose-500 p-1 transition-colors"
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
                    <input
                      autoFocus
                      placeholder="카테고리명"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && form.name.trim()) createMutation.mutate()
                        if (e.key === 'Escape') setShowAdd(false)
                      }}
                      className="w-full max-w-[200px] px-2 py-1 text-sm border border-indigo-400 rounded-lg bg-white dark:bg-gray-800 outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      placeholder="설명 (선택)"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && form.name.trim()) createMutation.mutate()
                        if (e.key === 'Escape') setShowAdd(false)
                      }}
                      className="w-full px-2 py-1 text-sm border border-indigo-400 rounded-lg bg-white dark:bg-gray-800 outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={form.sortOrder}
                      onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                      className="w-16 px-2 py-1 text-sm border border-indigo-400 rounded-lg bg-white dark:bg-gray-800 text-center outline-none"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => createMutation.mutate()}
                        disabled={!form.name.trim() || createMutation.isPending}
                        className="text-indigo-500 hover:text-indigo-600 disabled:opacity-40 p-1"
                      >
                        <Check size={14} />
                      </button>
                      <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 p-1">
                        <X size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-600">
        * 카테고리 이름을 변경하면 해당 카테고리를 사용 중인 모든 상품에 자동으로 반영됩니다.<br />
        * 상품이 등록된 카테고리는 삭제할 수 없습니다.
      </p>
    </div>
  )
}
