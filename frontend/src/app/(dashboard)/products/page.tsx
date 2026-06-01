'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Package, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { productApi } from '@/api/product.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { SALE_STATUS_LABEL } from '@/constants/stock.constants'
import { formatNumber, formatDateTime } from '@/utils/format'
import { cn } from '@/utils/cn'
import { ExportButton } from '@/components/ExportButton'
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
  costPrice: 0,
  sellPrice: 0,
  saleStatus: 'ACTIVE' as SaleStatus,
}

export default function ProductsPage() {
  const qc = useQueryClient()
  const [search, setSearch]         = useState('')
  const [status, setStatus]         = useState<SaleStatus | ''>('')
  const [page, setPage]             = useState(1)
  const [showModal, setShowModal]   = useState(false)
  const [editing, setEditing]       = useState<Product | null>(null)
  const [form, setForm]             = useState(EMPTY_PRODUCT_FORM)

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
      name: form.name,
      category: form.category,
      brand: form.brand,
      unit: form.unit,
      boxQty: form.boxQty,
      safetyStock: form.safetyStock,
      reorderPoint: form.reorderPoint,
      costPrice: form.costPrice,
      sellPrice: form.sellPrice,
      saleStatus: form.saleStatus,
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
      toast.success('상품이 삭제되었습니다')
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
      code: product.code,
      name: product.name,
      category: product.category ?? '',
      brand: product.brand ?? '',
      unit: product.unit ?? 'EA',
      boxQty: product.boxQty,
      safetyStock: product.safetyStock,
      reorderPoint: product.reorderPoint,
      costPrice: Number(product.costPrice ?? 0),
      sellPrice: Number(product.sellPrice ?? 0),
      saleStatus: product.saleStatus,
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditing(null)
    setForm(EMPTY_PRODUCT_FORM)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">상품 관리</h2>
        <div className="flex items-center gap-2">
          <ExportButton
            filename="상품목록"
            getData={async () => {
              const all = await productApi.findAll({ search: search || undefined, status: status as SaleStatus || undefined, limit: 9999 })
              return all.items.map((p: Product) => ({
                '상품코드':  p.code,
                '상품명':    p.name,
                '카테고리':  p.category ?? '',
                '브랜드':    p.brand ?? '',
                '박스입수':  p.boxQty,
                '안전재고':  p.safetyStock,
                '원가':      p.costPrice ?? 0,
                '판매가':    p.sellPrice ?? 0,
                '상태':      SALE_STATUS_LABEL[p.saleStatus],
                '등록일':    formatDateTime(p.createdAt),
              }))
            }}
          />
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors"
          >
            <Plus size={15} /> 상품 등록
          </button>
        </div>
      </div>

      {/* 검색/필터 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="상품명, 코드 검색"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value as SaleStatus | ''); setPage(1) }}
          className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          <option value="">전체 상태</option>
          {Object.entries(SALE_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* 테이블 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">상품코드</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">상품명</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">카테고리</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">박스입수</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">안전재고</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">판매가</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">상태</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">등록일</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading && <tr><td colSpan={9} className="text-center py-10 text-gray-400 dark:text-gray-500">로딩 중...</td></tr>}
            {data?.items.map((p: Product) => (
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{p.code}</td>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{p.name}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{p.category || '-'}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(p.boxQty)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(p.safetyStock)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(p.sellPrice)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full',
                    p.saleStatus === 'ACTIVE'       && 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
                    p.saleStatus === 'INACTIVE'     && 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
                    p.saleStatus === 'DISCONTINUED' && 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
                  )}>
                    {SALE_STATUS_LABEL[p.saleStatus]}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500">{formatDateTime(p.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => openEdit(p)}
                    className="inline-flex items-center justify-center p-1.5 mr-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-700"
                    title="수정"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMutation.mutate(p.id) }}
                    className="text-xs text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400"
                  >삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">이전</button>
          <span className="text-sm text-gray-600 dark:text-gray-400">{page} / {data.totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}
            className="px-3 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">다음</button>
        </div>
      )}

      {/* 상품 등록/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
              {editing ? <><Pencil size={18} /> 상품 수정</> : <><Package size={18} /> 상품 등록</>}
            </h3>
            <div className="space-y-3">
              {[
                { label: '상품코드 *', key: 'code',  type: 'text', placeholder: 'PRD-001' },
                { label: '상품명 *',   key: 'name',  type: 'text', placeholder: '상품명 입력' },
                { label: '카테고리',   key: 'category', type: 'text', placeholder: '카테고리' },
                { label: '브랜드',     key: 'brand', type: 'text', placeholder: '브랜드' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
                  <input
                    type={type}
                    placeholder={placeholder}
                    value={(form as any)[key]}
                    disabled={editing !== null && key === 'code'}
                    onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:bg-gray-700/60"
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">단위</label>
                  <input value={form.unit}
                    onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">박스 입수</label>
                  <input type="number" min={1} value={form.boxQty}
                    onChange={(e) => setForm((p) => ({ ...p, boxQty: +e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">안전재고</label>
                  <input type="number" min={0} value={form.safetyStock}
                    onChange={(e) => setForm((p) => ({ ...p, safetyStock: +e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">재주문점</label>
                  <input type="number" min={0} value={form.reorderPoint}
                    onChange={(e) => setForm((p) => ({ ...p, reorderPoint: +e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">원가</label>
                  <input type="number" min={0} value={form.costPrice}
                    onChange={(e) => setForm((p) => ({ ...p, costPrice: +e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">판매가</label>
                  <input type="number" min={0} value={form.sellPrice}
                    onChange={(e) => setForm((p) => ({ ...p, sellPrice: +e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">상태</label>
                  <select
                    value={form.saleStatus}
                    onChange={(e) => setForm((p) => ({ ...p, saleStatus: e.target.value as SaleStatus }))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    {Object.entries(SALE_STATUS_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={closeModal}
                className="flex-1 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
                취소
              </button>
              <button
                onClick={() => editing ? updateMutation.mutate() : createMutation.mutate()}
                disabled={!form.code || !form.name || createMutation.isPending || updateMutation.isPending}
                className="flex-1 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                {(createMutation.isPending || updateMutation.isPending) ? '처리 중...' : (editing ? '수정' : '등록')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
