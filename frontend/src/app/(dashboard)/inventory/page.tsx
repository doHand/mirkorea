'use client'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Search, Pencil, Trash2, X, Shield, Tags } from 'lucide-react'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { useAuthStore } from '@/stores/auth.store'
import { stockApi } from '@/api/stock.api'
import { productApi } from '@/api/product.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { formatNumber } from '@/utils/format'
import { cn } from '@/utils/cn'
import { ExportButton } from '@/components/ExportButton'
import { SALE_STATUS_LABEL } from '@/constants/stock.constants'
import { useMenuLabel } from '@/hooks/use-menu-label'
import toast from 'react-hot-toast'
import type { Inventory, ProductPricing } from '@/types/api.types'

type Tab = 'inventory' | 'pricing'
interface EditModalState { inv: Inventory; newQty: string; reason: string }

export default function InventoryPage() {
  const pageTitle = useMenuLabel('재고/가격 현황')
  const warehouse = useWarehouseStore((s) => s.selectedWarehouse)
  const me = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('inventory')

  // ── Inventory state ──
  const [invSearchInput, setInvSearchInput] = useState('')
  const [invSearch, setInvSearch] = useState('')
  const [belowOnly, setBelowOnly] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editModal, setEditModal] = useState<EditModalState | null>(null)

  // ── Pricing state ──
  const [priceSearchInput, setPriceSearchInput] = useState('')
  const [priceSearch, setPriceSearch] = useState('')
  const [priceEditing, setPriceEditing] = useState<ProductPricing | null>(null)
  const [priceForm, setPriceForm] = useState({ costPrice: 0, sellPrice: 0 })

  // ── Inventory queries ──
  const { data: inventory = [], isLoading: invLoading } = useQuery({
    queryKey: QUERY_KEYS.inventory({ warehouseId: warehouse?.id ?? '' }),
    queryFn: () => stockApi.getInventory(warehouse!.id),
    enabled: !!warehouse?.id,
    refetchInterval: 30_000,
  })
  const { data: summary } = useQuery({
    queryKey: QUERY_KEYS.invSummary(warehouse?.id ?? ''),
    queryFn: () => stockApi.getSummary(warehouse!.id),
    enabled: !!warehouse?.id,
  })

  // ── Pricing queries (admin only, lazy) ──
  const { data: priceItems = [], isLoading: priceLoading } = useQuery({
    queryKey: ['products', 'pricing'],
    queryFn: productApi.getPricing,
    enabled: tab === 'pricing' && me?.role === 'ADMIN',
  })

  // ── Mutations ──
  const adjustMutation = useMutation({
    mutationFn: stockApi.adjust,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  })
  const priceMutation = useMutation({
    mutationFn: () => productApi.updatePrice(priceEditing!.id, priceForm),
    onSuccess: () => {
      toast.success('가격이 수정되었습니다')
      qc.invalidateQueries({ queryKey: ['products', 'pricing'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      setPriceEditing(null)
    },
    onError: () => toast.error('수정 실패'),
  })

  // ── Derived ──
  const filtered = useMemo(() => {
    let list: Inventory[] = inventory
    if (belowOnly) list = list.filter((i) => i.quantity <= (i.product?.safetyStock ?? 0))
    if (invSearch) {
      const s = invSearch.toLowerCase()
      list = list.filter((i) => i.product?.name.toLowerCase().includes(s) || i.product?.code.toLowerCase().includes(s))
    }
    return list
  }, [inventory, belowOnly, invSearch])

  const filteredPrice = useMemo(() => {
    if (!priceSearch) return priceItems
    const s = priceSearch.toLowerCase()
    return priceItems.filter((p) =>
      p.code.toLowerCase().includes(s) || p.name.toLowerCase().includes(s) || (p.category ?? '').toLowerCase().includes(s)
    )
  }, [priceItems, priceSearch])

  const currentIds = filtered.map((i) => i.id)
  const allChecked = currentIds.length > 0 && currentIds.every((id) => selectedIds.has(id))
  const someChecked = currentIds.some((id) => selectedIds.has(id))

  const toggleRow = (id: string) =>
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const toggleAll = () => {
    if (allChecked) setSelectedIds(new Set())
    else setSelectedIds(new Set(currentIds))
  }

  const openEdit = (inv: Inventory) =>
    setEditModal({ inv, newQty: String(inv.quantity), reason: '' })

  const handleSaveEdit = async () => {
    if (!editModal) return
    const qty = parseInt(editModal.newQty)
    if (isNaN(qty) || qty < 0) { toast.error('수량은 0 이상의 숫자를 입력하세요'); return }
    if (!editModal.reason.trim()) { toast.error('조정 사유를 입력하세요'); return }
    try {
      await adjustMutation.mutateAsync({
        productId: editModal.inv.productId, locationId: editModal.inv.locationId,
        warehouseId: editModal.inv.warehouseId, adjustedQty: qty,
        reason: editModal.reason, lotNumber: editModal.inv.lotNumber,
      })
      toast.success('재고가 수정되었습니다')
      setEditModal(null)
      setSelectedIds(new Set())
    } catch { toast.error('재고 수정에 실패했습니다') }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`선택한 ${selectedIds.size}개 재고를 삭제(0으로 조정)하시겠습니까?`)) return
    const targets = filtered.filter((i) => selectedIds.has(i.id))
    try {
      for (const inv of targets) {
        await adjustMutation.mutateAsync({
          productId: inv.productId, locationId: inv.locationId,
          warehouseId: inv.warehouseId, adjustedQty: 0, reason: '재고 삭제', lotNumber: inv.lotNumber,
        })
      }
      toast.success(`${targets.length}개 재고가 삭제되었습니다`)
      setSelectedIds(new Set())
    } catch { toast.error('일부 재고 삭제에 실패했습니다') }
  }

  const handleSingleDelete = async (inv: Inventory) => {
    if (!confirm('이 재고를 삭제(0으로 조정)하시겠습니까?')) return
    try {
      await adjustMutation.mutateAsync({
        productId: inv.productId, locationId: inv.locationId,
        warehouseId: inv.warehouseId, adjustedQty: 0, reason: '재고 삭제', lotNumber: inv.lotNumber,
      })
      toast.success('재고가 삭제되었습니다')
    } catch { toast.error('재고 삭제에 실패했습니다') }
  }

  const totalStock = filteredPrice.reduce((sum, p) => sum + p.totalStock, 0)
  const totalSellAmount = filteredPrice.reduce((sum, p) => sum + Number(p.sellPrice ?? 0) * p.totalStock, 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{pageTitle}</h2>
          {tab === 'inventory'
            ? <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {formatNumber(summary?.totalSkus)} / 총 수량: {formatNumber(summary?.totalQty)}</p>
            : <p className="text-sm text-gray-500 dark:text-gray-400">전체 {priceItems.length}개 상품 · 재고 {formatNumber(totalStock)}개</p>}
        </div>
        <div className="flex items-center gap-2">
          {tab === 'inventory' && (
            <ExportButton
              filename="재고현황"
              getData={() => filtered.map((inv) => ({
                '상품코드': inv.product?.code ?? '', '상품명': inv.product?.name ?? '',
                '위치코드': inv.location?.code ?? '', '원가': inv.product?.costPrice ?? 0,
                '판매가': inv.product?.sellPrice ?? 0, '현재고': inv.quantity,
                '예약수량': inv.reservedQty, '가용수량': inv.quantity - inv.reservedQty,
                '안전재고': inv.product?.safetyStock ?? 0,
              }))}
            />
          )}
          {tab === 'pricing' && (
            <ExportButton
              filename="가격_재고현황"
              getData={() => filteredPrice.map((p) => ({
                상품코드: p.code, 상품명: p.name, 카테고리: p.category ?? '',
                단위: p.unit, 재고수량: p.totalStock, 원가: p.costPrice ?? 0,
                판매가: p.sellPrice ?? 0, 판매기준금액: Number(p.sellPrice ?? 0) * p.totalStock,
                상태: SALE_STATUS_LABEL[p.saleStatus],
              }))}
            />
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setTab('inventory')}
          className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
            tab === 'inventory' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300')}
        >재고 현황</button>
        {me?.role === 'ADMIN' && (
          <button
            onClick={() => setTab('pricing')}
            className={cn('flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === 'pricing' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300')}
          >
            <Tags size={13} />가격 관리
          </button>
        )}
      </div>

      {/* ─── 재고 현황 탭 ─── */}
      {tab === 'inventory' && (
        <>
          {!warehouse ? (
            <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500">창고를 먼저 선택하세요</div>
          ) : (
            <>
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-3 flex items-center gap-3 shadow-sm">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    value={invSearchInput}
                    onChange={(e) => setInvSearchInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setInvSearch(invSearchInput) }}
                    placeholder="상품명 또는 코드 검색"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                  />
                </div>
                <button onClick={() => setInvSearch(invSearchInput)} className="px-3.5 py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium">검색</button>
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer whitespace-nowrap">
                  <input type="checkbox" checked={belowOnly} onChange={(e) => setBelowOnly(e.target.checked)} />
                  안전재고 미달
                </label>
              </div>

              {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 bg-indigo-600 text-white px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
                  <span className="text-sm font-semibold flex-1">{selectedIds.size}개 선택됨</span>
                  {selectedIds.size === 1 && (
                    <button onClick={() => { const inv = filtered.find((i) => selectedIds.has(i.id)); if (inv) openEdit(inv) }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors">
                      <Pencil size={13} />수정
                    </button>
                  )}
                  <button onClick={handleBulkDelete} disabled={adjustMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                    <Trash2 size={13} />삭제
                  </button>
                  <button onClick={() => setSelectedIds(new Set())} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"><X size={14} /></button>
                </div>
              )}

              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] text-sm">
                    <thead>
                      <tr className="bg-gray-50/80 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                        <th className="px-4 py-3 w-8">
                          <input type="checkbox" checked={allChecked}
                            ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked }}
                            onChange={toggleAll} className="rounded accent-indigo-600 cursor-pointer" />
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">상품</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">위치</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">원가</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">판매가</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">현재고</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">예약</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">가용</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">안전재고</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">상태</th>
                        <th className="px-4 py-3 w-16" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {invLoading && <tr><td colSpan={11} className="text-center py-10 text-gray-400 dark:text-gray-500">로딩 중...</td></tr>}
                      {!invLoading && filtered.length === 0 && <tr><td colSpan={11} className="text-center py-10 text-gray-400 dark:text-gray-500">데이터가 없습니다</td></tr>}
                      {filtered.map((inv) => {
                        const isBelowSafety = inv.quantity <= (inv.product?.safetyStock ?? 0)
                        const available = inv.quantity - inv.reservedQty
                        const isSelected = selectedIds.has(inv.id)
                        return (
                          <tr key={inv.id} onClick={() => toggleRow(inv.id)}
                            className={cn('group cursor-pointer transition-colors',
                              isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20'
                                : isBelowSafety ? 'bg-red-50 dark:bg-red-900/10 hover:bg-red-100/60'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700/50')}>
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <input type="checkbox" checked={isSelected} onChange={() => toggleRow(inv.id)} className="rounded accent-indigo-600 cursor-pointer" />
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900 dark:text-gray-100">{inv.product?.name}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">{inv.product?.code}</p>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{inv.location?.code}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-400">{formatNumber(inv.product?.costPrice)}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-gray-600 dark:text-gray-400">{formatNumber(inv.product?.sellPrice)}</td>
                            <td className="px-4 py-3 text-right font-bold tabular-nums text-gray-900 dark:text-gray-100">
                              {formatNumber(inv.quantity)}
                              {inv.lotNumber && <span className="ml-2 text-xs font-normal text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">LOT {inv.lotNumber}</span>}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 tabular-nums">{formatNumber(inv.reservedQty)}</td>
                            <td className={cn('px-4 py-3 text-right tabular-nums font-medium', available <= 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100')}>{formatNumber(available)}</td>
                            <td className="px-4 py-3 text-right text-gray-400 dark:text-gray-500 tabular-nums">{formatNumber(inv.product?.safetyStock)}</td>
                            <td className="px-4 py-3 text-center">
                              {isBelowSafety
                                ? <span className="inline-flex items-center gap-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full"><AlertTriangle size={11} />미달</span>
                                : <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">정상</span>}
                            </td>
                            <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openEdit(inv)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors" title="수정"><Pencil size={13} /></button>
                                <button onClick={() => handleSingleDelete(inv)} disabled={adjustMutation.isPending} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50" title="삭제"><Trash2 size={13} /></button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ─── 가격 관리 탭 ─── */}
      {tab === 'pricing' && (
        me?.role !== 'ADMIN' ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400 dark:text-gray-500">
            <Shield size={40} className="opacity-40" />
            <p>관리자만 접근할 수 있습니다</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '상품 수', value: formatNumber(filteredPrice.length), cls: 'text-gray-900 dark:text-white' },
                { label: '재고 수량', value: formatNumber(totalStock), cls: 'text-indigo-600 dark:text-indigo-400' },
                { label: '판매기준 금액', value: formatNumber(totalSellAmount), cls: 'text-emerald-600 dark:text-emerald-400' },
              ].map(({ label, value, cls }) => (
                <div key={label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
                  <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
                  <p className={cn('text-lg font-bold tabular-nums mt-1', cls)}>{value}</p>
                </div>
              ))}
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-3 flex items-center gap-3 shadow-sm">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  value={priceSearchInput}
                  onChange={(e) => setPriceSearchInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setPriceSearch(priceSearchInput) }}
                  placeholder="상품코드, 상품명, 카테고리 검색"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                />
              </div>
              <button onClick={() => setPriceSearch(priceSearchInput)} className="px-3.5 py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium">검색</button>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="bg-gray-50/80 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">코드</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">상품명</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-24">카테고리</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-20">단위</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-28">재고 수량</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-28">원가</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-28">판매가</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-32">판매기준 금액</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-24">상태</th>
                      <th className="px-4 py-3 w-16" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {priceLoading && <tr><td colSpan={10} className="text-center py-10 text-gray-400 dark:text-gray-500">로딩 중...</td></tr>}
                    {!priceLoading && filteredPrice.length === 0 && <tr><td colSpan={10} className="text-center py-10 text-gray-400 dark:text-gray-500">상품이 없습니다</td></tr>}
                    {filteredPrice.map((p) => {
                      const sellAmount = Number(p.sellPrice ?? 0) * p.totalStock
                      const belowSafety = p.totalStock <= p.safetyStock && p.safetyStock > 0
                      return (
                        <tr key={p.id} className={cn('hover:bg-gray-50 dark:hover:bg-gray-700/50', belowSafety && 'bg-red-50/50 dark:bg-red-900/5')}>
                          <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{p.code}</td>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{p.name}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{p.category || '-'}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.unit}</td>
                          <td className={cn('px-4 py-3 text-right tabular-nums font-bold', belowSafety ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100')}>{formatNumber(p.totalStock)}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{p.costPrice != null ? formatNumber(Number(p.costPrice)) : '-'}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-gray-100 font-medium">{p.sellPrice != null ? formatNumber(Number(p.sellPrice)) : '-'}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{formatNumber(sellAmount)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn('text-xs px-2 py-0.5 rounded-full',
                              p.saleStatus === 'ACTIVE' && 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
                              p.saleStatus === 'INACTIVE' && 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
                              p.saleStatus === 'DISCONTINUED' && 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400')}>
                              {SALE_STATUS_LABEL[p.saleStatus]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => { setPriceEditing(p); setPriceForm({ costPrice: Number(p.costPrice ?? 0), sellPrice: Number(p.sellPrice ?? 0) }) }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors" title="가격 수정">
                              <Pencil size={13} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      )}

      {/* 재고 수정 모달 */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">재고 수량 수정</h3>
              <button onClick={() => setEditModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition-colors"><X size={16} /></button>
            </div>
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{editModal.inv.product?.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{editModal.inv.product?.code} · {editModal.inv.location?.code}</p>
                <p className="text-xs text-gray-500 mt-1">현재 재고: <span className="font-bold text-gray-900 dark:text-gray-100">{formatNumber(editModal.inv.quantity)}</span></p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">조정 수량 (목표 재고)</label>
                <input type="number" min={0} value={editModal.newQty}
                  onChange={(e) => setEditModal((p) => p ? { ...p, newQty: e.target.value } : p)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  placeholder="새 수량 입력" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">조정 사유 <span className="text-red-500">*</span></label>
                <input type="text" value={editModal.reason}
                  onChange={(e) => setEditModal((p) => p ? { ...p, reason: e.target.value } : p)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit() }}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  placeholder="예: 실사 후 재고 조정, 파손 처리 등" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setEditModal(null)} className="flex-1 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">취소</button>
              <button onClick={handleSaveEdit} disabled={adjustMutation.isPending} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors">
                {adjustMutation.isPending ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 가격 수정 모달 */}
      {priceEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-bold mb-1 text-gray-900 dark:text-white">{priceEditing.name}</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-5 font-mono">{priceEditing.code}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">원가</label>
                <input type="number" min={0} value={priceForm.costPrice}
                  onChange={(e) => setPriceForm((p) => ({ ...p, costPrice: +e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">판매가</label>
                <input type="number" min={0} value={priceForm.sellPrice}
                  onChange={(e) => setPriceForm((p) => ({ ...p, sellPrice: +e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setPriceEditing(null)} className="flex-1 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">취소</button>
              <button onClick={() => priceMutation.mutate()} disabled={priceMutation.isPending} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {priceMutation.isPending ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
