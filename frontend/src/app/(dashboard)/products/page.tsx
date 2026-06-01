'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import { productApi } from '@/api/product.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { SALE_STATUS_LABEL } from '@/constants/stock.constants'
import { formatNumber, formatDateTime } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { Product, SaleStatus } from '@/types/api.types'

export default function ProductsPage() {
  const qc = useQueryClient()
  const [search, setSearch]         = useState('')
  const [status, setStatus]         = useState<SaleStatus | ''>('')
  const [page, setPage]             = useState(1)
  const [showModal, setShowModal]   = useState(false)
  const [form, setForm]             = useState({ code: '', name: '', category: '', boxQty: 1, safetyStock: 0 })

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
      setShowModal(false)
      setForm({ code: '', name: '', category: '', boxQty: 1, safetyStock: 0 })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productApi.delete(id),
    onSuccess: () => {
      toast.success('상품이 삭제되었습니다')
      qc.invalidateQueries({ queryKey: ['products'] })
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">상품 관리</h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors"
        >
          <Plus size={15} /> 상품 등록
        </button>
      </div>

      {/* 검색/필터 */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="상품명, 코드 검색"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value as SaleStatus | ''); setPage(1) }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none"
        >
          <option value="">전체 상태</option>
          {Object.entries(SALE_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">상품코드</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">상품명</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">카테고리</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">박스입수</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">안전재고</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">상태</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">등록일</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && <tr><td colSpan={8} className="text-center py-10 text-gray-400">로딩 중...</td></tr>}
            {data?.items.map((p: Product) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.code}</td>
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3 text-gray-500">{p.category || '-'}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatNumber(p.boxQty)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatNumber(p.safetyStock)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full',
                    p.saleStatus === 'ACTIVE'       && 'bg-green-100 text-green-700',
                    p.saleStatus === 'INACTIVE'     && 'bg-yellow-100 text-yellow-700',
                    p.saleStatus === 'DISCONTINUED' && 'bg-gray-100 text-gray-500',
                  )}>
                    {SALE_STATUS_LABEL[p.saleStatus]}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">{formatDateTime(p.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMutation.mutate(p.id) }}
                    className="text-xs text-red-400 hover:text-red-600"
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
            className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50">이전</button>
          <span className="text-sm text-gray-600">{page} / {data.totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}
            className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50">다음</button>
        </div>
      )}

      {/* 상품 등록 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package size={18} /> 상품 등록
            </h3>
            <div className="space-y-3">
              {[
                { label: '상품코드 *', key: 'code',  type: 'text', placeholder: 'PRD-001' },
                { label: '상품명 *',   key: 'name',  type: 'text', placeholder: '상품명 입력' },
                { label: '카테고리',   key: 'category', type: 'text', placeholder: '카테고리' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type={type}
                    placeholder={placeholder}
                    value={(form as any)[key]}
                    onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">박스 입수</label>
                  <input type="number" min={1} value={form.boxQty}
                    onChange={(e) => setForm((p) => ({ ...p, boxQty: +e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">안전재고</label>
                  <input type="number" min={0} value={form.safetyStock}
                    onChange={(e) => setForm((p) => ({ ...p, safetyStock: +e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                취소
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!form.code || !form.name || createMutation.isPending}
                className="flex-1 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
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
