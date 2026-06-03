'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Package, Search, Plus, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { productApi, unitApi } from '@/api/product.api'
import { SALE_STATUS_LABEL } from '@/constants/stock.constants'
import { cn } from '@/utils/cn'
import { formatNumber } from '@/utils/format'
import type { Product, SaleStatus, ProductUnit } from '@/types/api.types'

/* ─── EditableCell (top-level to prevent remount on parent re-render) ───── */
type EditField = 'code' | 'name' | 'optionName' | 'spec' | 'unit' | 'boxQty' | 'sellPrice'
type EditCell  = { id: string; field: EditField; value: string }

function EditableCell({
  id, field, value, editCell, setEditCell, onSave, unitOptions,
}: {
  id: string
  field: EditField
  value?: string | number
  editCell: EditCell | null
  setEditCell: (c: EditCell | null) => void
  onSave: (c: EditCell) => void
  unitOptions?: ProductUnit[]
}) {
  const isEditing = editCell?.id === id && editCell.field === field

  if (isEditing) {
    if (field === 'unit' && unitOptions) {
      return (
        <select
          autoFocus
          value={editCell.value}
          onChange={(e) => setEditCell({ ...editCell, value: e.target.value })}
          onBlur={() => onSave(editCell)}
          className="px-2 py-1 text-sm border border-indigo-400 rounded-lg bg-white dark:bg-gray-800 outline-none w-24"
        >
          {unitOptions.map((u) => (
            <option key={u.id} value={u.code}>{u.code}</option>
          ))}
        </select>
      )
    }
    return (
      <input
        autoFocus
        type={field === 'boxQty' || field === 'sellPrice' ? 'number' : 'text'}
        value={editCell.value}
        onChange={(e) => setEditCell({ ...editCell, value: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(editCell)
          if (e.key === 'Escape') setEditCell(null)
        }}
        onBlur={() => onSave(editCell)}
        className="px-2 py-1 text-sm border border-indigo-400 rounded-lg bg-white dark:bg-gray-800 outline-none w-full min-w-[80px]"
      />
    )
  }

  const display = value !== undefined && value !== '' && value !== null ? String(value) : null

  return (
    <button
      onClick={() => setEditCell({ id, field, value: String(value ?? '') })}
      className="text-left w-full px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
    >
      <span className={cn(
        'text-sm',
        display ? 'text-gray-800 dark:text-gray-200' : 'text-gray-300 dark:text-gray-700 italic text-xs',
      )}>
        {display ?? '—'}
      </span>
    </button>
  )
}

/* ─── Constants ──────────────────────────────────────────────────────────── */
const EMPTY_FORM = {
  code: '', name: '', category: '', brand: '',
  unit: 'EA', boxQty: 1, safetyStock: 0, reorderPoint: 0,
  costPrice: 0, sellPrice: 0, saleStatus: 'ACTIVE' as SaleStatus,
}

const STATUS_CLS: Record<SaleStatus, string> = {
  ACTIVE:       'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  INACTIVE:     'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
  DISCONTINUED: 'bg-rose-100 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400',
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function ProductMasterPage() {
  const qc = useQueryClient()
  const router = useRouter()
  const [search, setSearch]           = useState('')
  const [editCell, setEditCell]       = useState<EditCell | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showAdd, setShowAdd]         = useState(false)
  const [form, setForm]               = useState(EMPTY_FORM)

  const { data, isLoading } = useQuery({
    queryKey: ['products', search],
    queryFn:  () => productApi.findAll({ search, limit: 200 }),
  })

  const { data: units } = useQuery({
    queryKey: ['product-units'],
    queryFn:  () => unitApi.findAll(),
  })

  const createMutation = useMutation({
    mutationFn: () => productApi.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      setShowAdd(false)
      setForm(EMPTY_FORM)
      toast.success('상품이 등록되었습니다')
    },
    onError: () => toast.error('등록 실패 (코드 중복 또는 오류)'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Product> }) =>
      productApi.update(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success('저장되었습니다')
    },
    onError: () => toast.error('저장 실패'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })

  const saveEdit = useCallback((cell: EditCell) => {
    const trimmed = cell.value.trim()
    if (!trimmed && cell.field !== 'optionName' && cell.field !== 'spec') {
      setEditCell(null)
      return
    }
    const patch: Partial<Product> = {
      [cell.field]: cell.field === 'boxQty' || cell.field === 'sellPrice' ? Number(trimmed) : trimmed,
    }
    updateMutation.mutate({ id: cell.id, patch })
    setEditCell(null)
  }, [updateMutation])

  const handleBulkDelete = async () => {
    if (!confirm(`선택한 ${selectedIds.size}개 상품을 삭제하시겠습니까?`)) return
    for (const id of [...selectedIds]) {
      await deleteMutation.mutateAsync(id)
    }
    toast.success(`${selectedIds.size}개 상품이 삭제되었습니다`)
    setSelectedIds(new Set())
  }

  const products: Product[]        = data?.items ?? []
  const unitOptions: ProductUnit[] = units ?? []
  const allChecked  = products.length > 0 && products.every((p) => selectedIds.has(p.id))
  const someChecked = products.some((p) => selectedIds.has(p.id))

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const openQuoteScreen = () => {
    const ids = [...selectedIds]
    if (ids.length === 0) {
      toast.error('상품을 먼저 선택해주세요')
      return
    }
    router.push(`/quotes?productIds=${encodeURIComponent(ids.join(','))}`)
  }

  const inputCls = 'w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <Package size={18} className="text-indigo-500" />상품 마스터
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            코드·상품명·옵션·규격·단위·박스입수·LOT을 통합 관리합니다. 셀을 클릭하면 편집됩니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="코드 / 상품명"
              className="pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 outline-none focus:border-indigo-400 w-48"
            />
          </div>
          <button
            onClick={() => { setShowAdd(true); setForm(EMPTY_FORM) }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors shadow-sm shadow-indigo-500/20"
          >
            <Plus size={14} /><span className="hidden sm:inline">상품 추가</span>
          </button>
          <button
            onClick={openQuoteScreen}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-40 disabled:hover:bg-transparent transition-colors font-medium"
          >
            <FileText size={14} />
            <span className="hidden sm:inline">거래명세서/견적서</span>
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-indigo-600 text-white px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
          <span className="text-sm font-semibold flex-1">{selectedIds.size}개 선택됨</span>
          <button
            onClick={handleBulkDelete}
            disabled={deleteMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            <Trash2 size={13} />삭제
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="p-1.5 hover:bg-white/20 rounded-lg">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="overflow-auto max-h-[calc(100vh-260px)]">
          <table className="w-full min-w-[1080px] text-sm border-separate border-spacing-0 [&_td]:border-r [&_td]:border-gray-100 [&_th]:border-r [&_th]:border-gray-200 dark:[&_td]:border-gray-800 dark:[&_th]:border-gray-700">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50/80 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3.5 w-8">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked }}
                    onChange={() => {
                      if (allChecked) setSelectedIds(new Set())
                      else setSelectedIds(new Set(products.map((p) => p.id)))
                    }}
                    className="rounded accent-indigo-600 cursor-pointer"
                  />
                </th>
                <th className="text-center px-2 py-3.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide w-12">#</th>
                <th className="text-left px-2 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-36">코드</th>
                <th className="text-left px-2 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide min-w-[140px]">상품명</th>
                <th className="text-left px-2 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-28">옵션명</th>
                <th className="text-left px-2 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-24">규격</th>
                <th className="text-left px-2 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-24">단위</th>
                <th className="text-right px-2 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-24">재고 수량</th>
                <th className="text-right px-2 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-24">판매가</th>
                <th className="text-center px-2 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-20">박스입수</th>
                <th className="text-center px-2 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-16">LOT</th>
                <th className="text-center px-2 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-20">상태</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={13} className="text-center py-10 text-gray-400 text-sm">불러오는 중...</td></tr>
              )}
              {!isLoading && products.length === 0 && (
                <tr><td colSpan={13} className="text-center py-10 text-gray-300 text-sm">상품이 없습니다</td></tr>
              )}
              {products.map((p, idx) => (
                <tr
                  key={p.id}
                  className={cn(
                    'border-t border-gray-100 dark:border-gray-800 transition-colors',
                    selectedIds.has(p.id)
                      ? 'bg-indigo-50/60 dark:bg-indigo-900/10'
                      : 'hover:bg-gray-50/30 dark:hover:bg-gray-800/10',
                  )}
                >
                  <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleRow(p.id)}
                      className="rounded accent-indigo-600 cursor-pointer"
                    />
                  </td>
                  <td className="py-2 px-2 text-center text-xs text-gray-400 dark:text-gray-500 bg-gray-50/70 dark:bg-gray-800/40 tabular-nums">
                    {idx + 1}
                  </td>
                  <td className="py-1.5 pr-1">
                    <EditableCell id={p.id} field="code" value={p.code}
                      editCell={editCell} setEditCell={setEditCell} onSave={saveEdit} />
                  </td>
                  <td className="py-1.5 pr-1">
                    <EditableCell id={p.id} field="name" value={p.name}
                      editCell={editCell} setEditCell={setEditCell} onSave={saveEdit} />
                  </td>
                  <td className="py-1.5 pr-1">
                    <EditableCell id={p.id} field="optionName" value={p.optionName}
                      editCell={editCell} setEditCell={setEditCell} onSave={saveEdit} />
                  </td>
                  <td className="py-1.5 pr-1">
                    <EditableCell id={p.id} field="spec" value={p.spec}
                      editCell={editCell} setEditCell={setEditCell} onSave={saveEdit} />
                  </td>
                  <td className="py-1.5 pr-1">
                    <EditableCell id={p.id} field="unit" value={p.unit}
                      editCell={editCell} setEditCell={setEditCell} onSave={saveEdit}
                      unitOptions={unitOptions} />
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                    {formatNumber(p.stockQty ?? 0)}
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                    <EditableCell id={p.id} field="sellPrice" value={p.sellPrice ?? 0}
                      editCell={editCell} setEditCell={setEditCell} onSave={saveEdit} />
                  </td>
                  <td className="py-1.5 pr-1 text-center">
                    <EditableCell id={p.id} field="boxQty" value={p.boxQty}
                      editCell={editCell} setEditCell={setEditCell} onSave={saveEdit} />
                  </td>
                  <td className="py-2 text-center">
                    <button
                      onClick={() => updateMutation.mutate({ id: p.id, patch: { isLotManaged: !p.isLotManaged } })}
                      className={cn(
                        'relative rounded-full transition-colors duration-200 focus:outline-none',
                        'w-9 h-[20px]',
                        p.isLotManaged ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700',
                      )}
                    >
                      <span className={cn(
                        'absolute top-0.5 left-0.5 bg-white rounded-full shadow transition-transform duration-200',
                        'w-[16px] h-[16px]',
                        p.isLotManaged ? 'translate-x-[17px]' : 'translate-x-0',
                      )} />
                    </button>
                  </td>
                  <td className="py-2 text-center">
                    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', STATUS_CLS[p.saleStatus])}>
                      {SALE_STATUS_LABEL[p.saleStatus]}
                    </span>
                  </td>
                  <td className="pr-3 py-2">
                    <button
                      onClick={() => {
                        if (confirm('삭제하시겠습니까?'))
                          deleteMutation.mutate(p.id, { onSuccess: () => toast.success('삭제되었습니다') })
                      }}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <Package size={16} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white flex-1">새 상품 등록</h3>
              <button
                onClick={() => setShowAdd(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">상품코드 *</label>
                  <input
                    autoFocus
                    placeholder="PRD-001"
                    value={form.code}
                    onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">상품명 *</label>
                  <input
                    placeholder="상품명"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">카테고리</label>
                  <input
                    placeholder="카테고리"
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">단위</label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                    className={inputCls}
                  >
                    {unitOptions.length > 0
                      ? unitOptions.map((u) => <option key={u.id} value={u.code}>{u.code} — {u.label}</option>)
                      : ['EA', 'BOX', 'PALLET'].map((u) => <option key={u} value={u}>{u}</option>)
                    }
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">박스 입수</label>
                  <input
                    type="number"
                    min={1}
                    value={form.boxQty}
                    onChange={(e) => setForm((p) => ({ ...p, boxQty: +e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">판매가</label>
                  <input
                    type="number"
                    min={0}
                    value={form.sellPrice}
                    onChange={(e) => setForm((p) => ({ ...p, sellPrice: +e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">판매 상태</label>
                  <select
                    value={form.saleStatus}
                    onChange={(e) => setForm((p) => ({ ...p, saleStatus: e.target.value as SaleStatus }))}
                    className={inputCls}
                  >
                    {Object.entries(SALE_STATUS_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                취소
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!form.code.trim() || !form.name.trim() || createMutation.isPending}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                {createMutation.isPending ? '등록 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
