'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Package, Pencil, Trash2, Filter, X, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { productApi } from '@/api/product.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { SALE_STATUS_LABEL } from '@/constants/stock.constants'
import { formatNumber, formatDateTime } from '@/utils/format'
import { cn } from '@/utils/cn'
import { ExportButton } from '@/components/ExportButton'
import { ImportButton } from '@/components/ImportButton'
import type { Product, SaleStatus } from '@/types/api.types'

const EMPTY_PRODUCT_FORM = {
  code: '',
  name: '',
  category: '',
  brand: '',
  unit: 'EA',
  boxQty: 1,
  safetyStock: 0,
  reorderPoint: 0,
  sellPrice: 0,
  saleStatus: 'ACTIVE' as SaleStatus,
}

const STATUS_STYLE: Record<SaleStatus, string> = {
  ACTIVE:       'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800',
  INACTIVE:     'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-800',
  DISCONTINUED: 'bg-gray-100 text-gray-500 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700',
}

export default function ProductsPage() {
  const qc = useQueryClient()
  const router = useRouter()
  const [searchInput, setSearchInput]  = useState('')
  const [search, setSearch]           = useState('')
  const [status, setStatus]           = useState<SaleStatus | ''>('')
  const [page, setPage]               = useState(1)
  const [showModal, setShowModal]     = useState(false)
  const [editing, setEditing]         = useState<Product | null>(null)
  const [form, setForm]               = useState(EMPTY_PRODUCT_FORM)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.products({ search, status, page }),
    queryFn:  () => productApi.findAll({ search: search || undefined, status: status as SaleStatus || undefined, page }),
    placeholderData: (prev) => prev,
  })

  const createMutation = useMutation({
    mutationFn: () => productApi.create(form),
    onSuccess: () => {
      toast.success('상품이 등록되었습니다')
      qc.invalidateQueries({ queryKey: ['products'] })
      closeModal()
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => productApi.update(editing!.id, {
      name: form.name, category: form.category, brand: form.brand,
      unit: form.unit, boxQty: form.boxQty, safetyStock: form.safetyStock,
      reorderPoint: form.reorderPoint,
      sellPrice: form.sellPrice, saleStatus: form.saleStatus,
    }),
    onSuccess: () => {
      toast.success('상품이 수정되었습니다')
      qc.invalidateQueries({ queryKey: ['products'] })
      closeModal()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_PRODUCT_FORM)
    setShowModal(true)
  }

  const openEdit = (product: Product) => {
    setEditing(product)
    setForm({
      code:         product.code,
      name:         product.name,
      category:     product.category ?? '',
      brand:        product.brand ?? '',
      unit:         product.unit ?? 'EA',
      boxQty:       product.boxQty,
      safetyStock:  product.safetyStock,
      reorderPoint: product.reorderPoint,
      sellPrice:    Number(product.sellPrice ?? 0),
      saleStatus:   product.saleStatus,
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditing(null)
    setForm(EMPTY_PRODUCT_FORM)
  }

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    const ids = data?.items.map((p) => p.id) ?? []
    if (ids.length > 0 && ids.every((id) => selectedIds.has(id))) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(ids))
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`선택한 ${selectedIds.size}개 상품을 삭제하시겠습니까?`)) return
    const ids = [...selectedIds]
    for (const id of ids) {
      await deleteMutation.mutateAsync(id)
    }
    toast.success(`${ids.length}개 상품이 삭제되었습니다`)
    setSelectedIds(new Set())
  }

  const handleEditSelected = () => {
    const id = [...selectedIds][0]
    const product = data?.items.find((p) => p.id === id)
    if (product) openEdit(product)
  }

  const openStatementForProducts = (ids: string[]) => {
    if (ids.length === 0) return
    router.push(`/quotes?productIds=${encodeURIComponent(ids.join(','))}`)
  }

  const currentPageIds = data?.items.map((p) => p.id) ?? []
  const allChecked = currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.has(id))
  const someChecked = currentPageIds.some((id) => selectedIds.has(id))

  const inputCls = 'w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-shadow'

  return (
    <div className="space-y-4">
      {/* 타이틀 + 액션 */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">상품 관리</h2>
          {data && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              전체 {data.total ?? data.items.length}개 상품
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <ExportButton
            filename="상품목록"
            getData={async () => {
              const all = await productApi.findAll({ search: search || undefined, status: status as SaleStatus || undefined, limit: 9999 })
              return all.items.map((p: Product) => ({
                '상품코드': p.code, '상품명': p.name, '카테고리': p.category ?? '',
                '브랜드': p.brand ?? '', '박스입수': p.boxQty, '안전재고': p.safetyStock,
                '판매가': p.sellPrice ?? 0,
                '상태': SALE_STATUS_LABEL[p.saleStatus], '등록일': formatDateTime(p.createdAt),
              }))
            }}
          />
          <ImportButton
            onImported={() => qc.invalidateQueries({ queryKey: ['products'] })}
          />
          <button
            onClick={() => openStatementForProducts([...selectedIds])}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400 text-sm rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-40 disabled:hover:bg-transparent transition-colors font-medium"
          >
            <FileText size={15} />거래명세서
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm shadow-indigo-500/20"
          >
            <Plus size={15} />상품 등록
          </button>
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
              onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1) } }}
              placeholder="상품명, 코드 검색"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 transition-shadow"
            />
          </div>
          <button
            onClick={() => { setSearch(searchInput); setPage(1) }}
            className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium whitespace-nowrap"
          >
            검색
          </button>
        </div>
        <div className="relative flex items-center">
          <Filter size={13} className="absolute left-3 text-gray-400 pointer-events-none" />
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value as SaleStatus | ''); setPage(1) }}
            className="appearance-none pl-8 pr-8 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 transition-shadow cursor-pointer"
          >
            <option value="">전체</option>
            {Object.entries(SALE_STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 선택 액션 바 */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-indigo-600 text-white px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
          <span className="text-sm font-semibold flex-1">{selectedIds.size}개 선택됨</span>
          {selectedIds.size === 1 && (
            <button
              onClick={handleEditSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              <Pencil size={13} />수정
            </button>
          )}
          <button
            onClick={() => openStatementForProducts([...selectedIds])}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
          >
            <FileText size={13} />거래명세서
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={deleteMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Trash2 size={13} />삭제
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            title="선택 해제"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 테이블 */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="bg-gray-50/80 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked }}
                  onChange={toggleAll}
                  className="rounded accent-indigo-600 cursor-pointer"
                />
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">상품코드</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">상품명</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden sm:table-cell">단위</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">재고수량</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden lg:table-cell">카테고리</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">판매가</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">상태</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden xl:table-cell">등록일</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading && (
              <tr><td colSpan={12} className="text-center py-12 text-gray-400 dark:text-gray-500">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  로딩 중...
                </div>
              </td></tr>
            )}
            {!isLoading && data?.items.length === 0 && (
              <tr><td colSpan={12} className="text-center py-12 text-gray-400 dark:text-gray-500">
                <Package size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">상품이 없습니다</p>
              </td></tr>
            )}
            {data?.items.map((p: Product) => {
              const isSelected = selectedIds.has(p.id)
              return (
                <tr
                  key={p.id}
                  onClick={() => toggleRow(p.id)}
                  className={cn(
                    'group cursor-pointer transition-colors',
                    isSelected
                      ? 'bg-indigo-50/60 dark:bg-indigo-900/10'
                      : 'hover:bg-indigo-50/40 dark:hover:bg-indigo-900/5'
                  )}
                >
                  <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRow(p.id)}
                      className="rounded accent-indigo-600 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs text-gray-500 dark:text-gray-400">{p.code}</td>
                  <td className="px-4 py-3.5 font-semibold text-gray-900 dark:text-gray-100">{p.name}</td>
                  <td className="px-4 py-3.5 text-center text-gray-600 dark:text-gray-400 hidden sm:table-cell">{p.unit || 'EA'}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums hidden md:table-cell">
                    <span className={cn('font-semibold', (p.stockQty ?? 0) === 0 ? 'text-red-500' : 'text-gray-900 dark:text-gray-100')}>
                      {formatNumber(p.stockQty ?? 0)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-gray-500 dark:text-gray-400 hidden lg:table-cell">{p.category || '—'}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-medium text-gray-900 dark:text-gray-100">
                    {p.sellPrice ? `₩${formatNumber(p.sellPrice)}` : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', STATUS_STYLE[p.saleStatus])}>
                      {SALE_STATUS_LABEL[p.saleStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-400 dark:text-gray-500 hidden xl:table-cell">
                    {formatDateTime(p.createdAt)}
                  </td>
                  <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openStatementForProducts([p.id])}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-900/20 transition-colors"
                        title="거래명세서"
                      >
                        <FileText size={13} />
                      </button>
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/20 transition-colors"
                        title="수정"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMutation.mutate(p.id, { onSuccess: () => toast.success('삭제되었습니다') }) }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                        title="삭제"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* 페이지네이션 */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3.5 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors font-medium"
          >
            이전
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
            {page} / {data.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page === data.totalPages}
            className="px-3.5 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors font-medium"
          >
            다음
          </button>
        </div>
      )}

      {/* 상품 등록/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
            {/* 모달 헤더 */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <div className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                editing ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'
              )}>
                {editing
                  ? <Pencil size={16} className="text-indigo-600 dark:text-indigo-400" />
                  : <Package size={16} className="text-emerald-600 dark:text-emerald-400" />
                }
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {editing ? editing.name : '새 상품 등록'}
                </h3>
                {editing && <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5">{editing.code}</p>}
              </div>
            </div>

            <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">상품코드 *</label>
                    <input
                      type="text"
                      placeholder="PRD-001"
                      value={form.code}
                      disabled={editing !== null}
                      onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                      className={cn(inputCls, 'disabled:bg-gray-50 disabled:text-gray-400 dark:disabled:bg-gray-800 dark:disabled:text-gray-500')}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">상품명 *</label>
                    <input
                      type="text"
                      placeholder="상품명 입력"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">카테고리</label>
                    <input type="text" placeholder="카테고리" value={form.category}
                      onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">브랜드</label>
                    <input type="text" placeholder="브랜드" value={form.brand}
                      onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
                      className={inputCls} />
                  </div>
                </div>

                <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">수량 설정</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1.5">단위</label>
                      <input value={form.unit}
                        onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1.5">박스 입수</label>
                      <input type="number" min={1} value={form.boxQty}
                        onChange={(e) => setForm((p) => ({ ...p, boxQty: +e.target.value }))}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1.5">안전재고</label>
                      <input type="number" min={0} value={form.safetyStock}
                        onChange={(e) => setForm((p) => ({ ...p, safetyStock: +e.target.value }))}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1.5">재주문점</label>
                      <input type="number" min={0} value={form.reorderPoint}
                        onChange={(e) => setForm((p) => ({ ...p, reorderPoint: +e.target.value }))}
                        className={inputCls} />
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">가격 & 상태</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1.5">판매가 (₩)</label>
                      <input type="number" min={0} value={form.sellPrice}
                        onChange={(e) => setForm((p) => ({ ...p, sellPrice: +e.target.value }))}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1.5">판매 상태</label>
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

                <div className="flex gap-3 pt-2">
                  <button onClick={closeModal}
                    className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    취소
                  </button>
                  <button
                    onClick={() => editing ? updateMutation.mutate() : createMutation.mutate()}
                    disabled={!form.code || !form.name || createMutation.isPending || updateMutation.isPending}
                    className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm shadow-indigo-500/20"
                  >
                    {(createMutation.isPending || updateMutation.isPending) ? '처리 중...' : (editing ? '수정 완료' : '등록')}
                  </button>
                </div>
              </div>
          </div>
        </div>
      )}
    </div>
  )
}
