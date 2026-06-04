'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Barcode, Search, ChevronDown, ChevronRight, Plus, Trash2, Star, Pencil, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { productApi } from '@/api/product.api'
import { cn } from '@/utils/cn'
import type { Product, BarcodeUnitType } from '@/types/api.types'

const UNIT_TYPES: BarcodeUnitType[] = ['UNIT', 'BOX', 'CXD']
const UNIT_LABEL: Record<BarcodeUnitType, string> = { UNIT: '일반낱개', BOX: '박스', CXD: 'CXD낱개' }
const UNIT_CLS: Record<BarcodeUnitType, string> = {
  UNIT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  BOX:  'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  CXD:  'bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400',
}

type AddForm  = { barcode: string; type: BarcodeUnitType; unitQty: number; isPrimary: boolean }
type EditForm = { type: BarcodeUnitType; unitQty: number; isPrimary: boolean }

const defaultAddForm  = (): AddForm  => ({ barcode: '', type: 'UNIT', unitQty: 1, isPrimary: false })
const defaultEditForm = (type: BarcodeUnitType, unitQty: number, isPrimary: boolean): EditForm =>
  ({ type, unitQty, isPrimary })

export default function BarcodesPage() {
  const qc = useQueryClient()

  // 검색: 입력 중인 값(searchInput)과 실제 쿼리에 쓰이는 값(search) 분리
  const [searchInput, setSearchInput] = useState('')
  const [search,      setSearch]      = useState('')

  const [expanded,  setExpanded]  = useState<Set<string>>(new Set())
  const [addForms,  setAddForms]  = useState<Record<string, AddForm>>({})
  const [editForms, setEditForms] = useState<Record<string, EditForm>>({})   // key: barcodeId

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['products', search],
    queryFn: () => productApi.findAll({ search, limit: 200 }),
  })

  const products: Product[] = pageData?.items ?? []

  const { data: barcodeMap } = useQuery({
    queryKey: ['all-barcodes', products.map((p) => p.id).join(',')],
    queryFn: async () => {
      const results = await Promise.all(products.map((p) => productApi.findBarcodes(p.id)))
      return Object.fromEntries(products.map((p, i) => [p.id, results[i] ?? []]))
    },
    enabled: products.length > 0,
  })

  const addMutation = useMutation({
    mutationFn: ({ productId, form }: { productId: string; form: AddForm }) =>
      productApi.addBarcode(productId, form),
    onSuccess: (_, { productId }) => {
      qc.invalidateQueries({ queryKey: ['all-barcodes'] })
      setAddForms((prev) => { const n = { ...prev }; delete n[productId]; return n })
      toast.success('바코드가 추가되었습니다')
    },
    onError: () => toast.error('바코드 추가 실패 (중복 또는 오류)'),
  })

  const editMutation = useMutation({
    mutationFn: ({ productId, barcodeId, form }: { productId: string; barcodeId: string; form: EditForm }) =>
      productApi.updateBarcode(productId, barcodeId, form),
    onSuccess: (_, { barcodeId }) => {
      qc.invalidateQueries({ queryKey: ['all-barcodes'] })
      setEditForms((prev) => { const n = { ...prev }; delete n[barcodeId]; return n })
      toast.success('바코드가 수정되었습니다')
    },
    onError: () => toast.error('수정 실패'),
  })

  const deleteMutation = useMutation({
    mutationFn: ({ productId, barcodeId }: { productId: string; barcodeId: string }) =>
      productApi.deleteBarcode(productId, barcodeId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['all-barcodes'] }); toast.success('삭제되었습니다') },
    onError: () => toast.error('삭제 실패'),
  })

  const toggle = (id: string) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const patchAddForm = (id: string, patch: Partial<AddForm>) =>
    setAddForms((prev) => ({ ...prev, [id]: { ...(prev[id] ?? defaultAddForm()), ...patch } }))

  const patchEditForm = (barcodeId: string, patch: Partial<EditForm>) =>
    setEditForms((prev) => ({ ...prev, [barcodeId]: { ...(prev[barcodeId] ?? { type: 'UNIT', unitQty: 1, isPrimary: false }), ...patch } }))

  const commitSearch = () => { setSearch(searchInput) }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <Barcode size={18} className="text-indigo-500" />바코드 관리
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">상품 행을 펼쳐 바코드를 추가·수정·삭제합니다.</p>
        </div>
      </div>

      {/* 검색/필터 */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-3 flex gap-2.5 shadow-sm">
        <div className="relative flex-1 flex gap-1.5">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitSearch() }}
              placeholder="상품코드 / 상품명"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 transition-shadow"
            />
          </div>
          <button
            onClick={commitSearch}
            className="px-3.5 py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
          >
            검색
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm divide-y divide-gray-100 dark:divide-gray-800">
        {isLoading && <p className="text-center py-10 text-gray-400 text-sm">불러오는 중...</p>}
        {!isLoading && products.length === 0 && <p className="text-center py-10 text-gray-300 text-sm">검색 결과 없음</p>}
        {products.map((p: Product) => {
          const isOpen   = expanded.has(p.id)
          const barcodes = barcodeMap?.[p.id] ?? []
          const addForm  = addForms[p.id]

          return (
            <div key={p.id}>
              <button onClick={() => toggle(p.id)}
                className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/50 dark:hover:bg-gray-800/20 text-left transition-colors">
                {isOpen ? <ChevronDown size={14} className="text-indigo-500 shrink-0" /> : <ChevronRight size={14} className="text-gray-400 shrink-0" />}
                <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400 w-28 shrink-0">{p.code}</span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1">{p.name}</span>
                <span className="text-xs text-gray-400">{barcodes.length}개</span>
              </button>

              {isOpen && (
                <div className="bg-gray-50/40 dark:bg-gray-800/10 border-t border-gray-100 dark:border-gray-800 px-12 py-3 space-y-1.5">
                  {barcodes.map((bc) => {
                    const ef = editForms[bc.id]
                    return (
                      <div key={bc.id}>
                        {/* 일반 표시 행 */}
                        {!ef && (
                          <div className="flex items-center gap-3 py-1.5 group/bc">
                            <span className="font-mono text-sm text-gray-800 dark:text-gray-200 flex-1">{bc.barcode}</span>
                            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', UNIT_CLS[bc.type])}>
                              {UNIT_LABEL[bc.type]}
                            </span>
                            <span className="text-xs text-gray-400 w-14">×{bc.unitQty}</span>
                            {bc.isPrimary && <Star size={12} className="text-amber-400 fill-amber-400 shrink-0" />}
                            {/* 수정 버튼 */}
                            <button
                              onClick={() => setEditForms((prev) => ({
                                ...prev,
                                [bc.id]: defaultEditForm(bc.type, bc.unitQty, bc.isPrimary),
                              }))}
                              className="text-gray-300 hover:text-indigo-500 opacity-0 group-hover/bc:opacity-100 transition-all p-0.5"
                              title="바코드 수정"
                            >
                              <Pencil size={13} />
                            </button>
                            {/* 삭제 버튼 */}
                            <button
                              onClick={() => { if (confirm('바코드를 삭제할까요?')) deleteMutation.mutate({ productId: p.id, barcodeId: bc.id }) }}
                              className="text-gray-300 hover:text-rose-500 opacity-0 group-hover/bc:opacity-100 transition-all p-0.5"
                              title="바코드 삭제"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}

                        {/* 인라인 수정 폼 */}
                        {ef && (
                          <div className="flex items-center gap-2 py-1.5 flex-wrap bg-indigo-50/50 dark:bg-indigo-900/10 rounded-lg px-2">
                            <span className="font-mono text-sm text-gray-500 dark:text-gray-400 flex-1">{bc.barcode}</span>
                            <select
                              value={ef.type}
                              onChange={(e) => patchEditForm(bc.id, { type: e.target.value as BarcodeUnitType })}
                              className="px-2 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 outline-none"
                            >
                              {UNIT_TYPES.map((t) => <option key={t} value={t}>{UNIT_LABEL[t]}</option>)}
                            </select>
                            <input
                              type="number"
                              min={1}
                              value={ef.unitQty}
                              onChange={(e) => patchEditForm(bc.id, { unitQty: Number(e.target.value) })}
                              onKeyDown={(e) => { if (e.key === 'Enter') editMutation.mutate({ productId: p.id, barcodeId: bc.id, form: ef }) }}
                              className="px-2 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none w-16 text-right"
                            />
                            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={ef.isPrimary}
                                onChange={(e) => patchEditForm(bc.id, { isPrimary: e.target.checked })}
                                className="rounded"
                              />
                              기본
                            </label>
                            <button
                              onClick={() => editMutation.mutate({ productId: p.id, barcodeId: bc.id, form: ef })}
                              disabled={editMutation.isPending}
                              className="p-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
                              title="저장 (Enter)"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              onClick={() => setEditForms((prev) => { const n = { ...prev }; delete n[bc.id]; return n })}
                              className="p-1 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-700"
                              title="취소 (Esc)"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* 바코드 추가 폼 */}
                  {addForm ? (
                    <div className="flex items-center gap-2 pt-2 flex-wrap">
                      <input
                        placeholder="바코드 값"
                        value={addForm.barcode}
                        onChange={(e) => patchAddForm(p.id, { barcode: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter' && addForm.barcode.trim()) addMutation.mutate({ productId: p.id, form: addForm }) }}
                        className="px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:border-indigo-400 font-mono w-48"
                        autoFocus
                      />
                      <select
                        value={addForm.type}
                        onChange={(e) => patchAddForm(p.id, { type: e.target.value as BarcodeUnitType })}
                        className="px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 outline-none"
                      >
                        {UNIT_TYPES.map((t) => <option key={t} value={t}>{UNIT_LABEL[t]}</option>)}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={addForm.unitQty}
                        onChange={(e) => patchAddForm(p.id, { unitQty: Number(e.target.value) })}
                        className="px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none w-16 text-right"
                      />
                      <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={addForm.isPrimary}
                          onChange={(e) => patchAddForm(p.id, { isPrimary: e.target.checked })}
                          className="rounded"
                        />
                        기본
                      </label>
                      <button
                        onClick={() => addMutation.mutate({ productId: p.id, form: addForm })}
                        disabled={!addForm.barcode.trim() || addMutation.isPending}
                        className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setAddForms((prev) => { const n = { ...prev }; delete n[p.id]; return n })}
                        className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => patchAddForm(p.id, defaultAddForm())}
                      className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-600 mt-1 py-1"
                    >
                      <Plus size={13} />바코드 추가
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
