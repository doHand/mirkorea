'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Barcode, Search, ChevronDown, ChevronRight, Plus, Trash2, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import { productApi } from '@/api/product.api'
import { cn } from '@/utils/cn'
import type { Product, BarcodeUnitType } from '@/types/api.types'

const UNIT_TYPES: BarcodeUnitType[] = ['UNIT', 'BOX', 'INNER', 'PALLET']
const UNIT_LABEL: Record<BarcodeUnitType, string> = { UNIT: '낱개', BOX: '박스', INNER: '이너박스', PALLET: '파레트' }
const UNIT_CLS: Record<BarcodeUnitType, string> = {
  UNIT:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  BOX:    'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  INNER:  'bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400',
  PALLET: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
}

type AddForm = { barcode: string; type: BarcodeUnitType; unitQty: number; isPrimary: boolean }
const defaultForm = (): AddForm => ({ barcode: '', type: 'UNIT', unitQty: 1, isPrimary: false })

export default function BarcodesPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [addForms, setAddForms] = useState<Record<string, AddForm>>({})

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

  const deleteMutation = useMutation({
    mutationFn: ({ productId, barcodeId }: { productId: string; barcodeId: string }) =>
      productApi.deleteBarcode(productId, barcodeId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['all-barcodes'] }); toast.success('삭제되었습니다') },
    onError: () => toast.error('삭제 실패'),
  })

  const toggle = (id: string) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const patchForm = (id: string, patch: Partial<AddForm>) =>
    setAddForms((prev) => ({ ...prev, [id]: { ...(prev[id] ?? defaultForm()), ...patch } }))

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <Barcode size={18} className="text-indigo-500" />바코드 관리
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">상품 행을 펼쳐 바코드를 추가·삭제합니다.</p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="코드 / 상품명"
            className="pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 outline-none focus:border-indigo-400 w-48" />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm divide-y divide-gray-100 dark:divide-gray-800">
        {isLoading && <p className="text-center py-10 text-gray-400 text-sm">불러오는 중...</p>}
        {!isLoading && products.length === 0 && <p className="text-center py-10 text-gray-300 text-sm">검색 결과 없음</p>}
        {products.map((p: Product) => {
          const isOpen   = expanded.has(p.id)
          const barcodes = barcodeMap?.[p.id] ?? []
          const form     = addForms[p.id]

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
                  {barcodes.map((bc) => (
                    <div key={bc.id} className="flex items-center gap-3 py-1.5 group/bc">
                      <span className="font-mono text-sm text-gray-800 dark:text-gray-200 flex-1">{bc.barcode}</span>
                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', UNIT_CLS[bc.type])}>
                        {UNIT_LABEL[bc.type]}
                      </span>
                      <span className="text-xs text-gray-400 w-14">×{bc.unitQty}</span>
                      {bc.isPrimary && <Star size={12} className="text-amber-400 fill-amber-400 shrink-0" />}
                      <button onClick={() => { if (confirm('바코드를 삭제할까요?')) deleteMutation.mutate({ productId: p.id, barcodeId: bc.id }) }}
                        className="text-gray-300 hover:text-rose-500 opacity-0 group-hover/bc:opacity-100 transition-all p-0.5">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}

                  {form ? (
                    <div className="flex items-center gap-2 pt-2 flex-wrap">
                      <input placeholder="바코드 값" value={form.barcode}
                        onChange={(e) => patchForm(p.id, { barcode: e.target.value })}
                        className="px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:border-indigo-400 font-mono w-48" />
                      <select value={form.type} onChange={(e) => patchForm(p.id, { type: e.target.value as BarcodeUnitType })}
                        className="px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 outline-none">
                        {UNIT_TYPES.map((t) => <option key={t} value={t}>{UNIT_LABEL[t]}</option>)}
                      </select>
                      <input type="number" min={1} value={form.unitQty}
                        onChange={(e) => patchForm(p.id, { unitQty: Number(e.target.value) })}
                        className="px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none w-16 text-right" />
                      <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                        <input type="checkbox" checked={form.isPrimary} onChange={(e) => patchForm(p.id, { isPrimary: e.target.checked })} className="rounded" />
                        기본
                      </label>
                      <button onClick={() => addMutation.mutate({ productId: p.id, form })}
                        disabled={!form.barcode.trim() || addMutation.isPending}
                        className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                        저장
                      </button>
                      <button onClick={() => setAddForms((prev) => { const n = { ...prev }; delete n[p.id]; return n })}
                        className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors">
                        취소
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => patchForm(p.id, defaultForm())}
                      className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-600 mt-1 py-1">
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
