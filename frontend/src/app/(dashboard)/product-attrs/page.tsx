'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query'
import { FileText, Package, Search, Plus, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { productApi, unitApi } from '@/api/product.api'
import { stockApi } from '@/api/stock.api'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { SALE_STATUS_LABEL } from '@/constants/stock.constants'
import { cn } from '@/utils/cn'
import { formatNumber } from '@/utils/format'
import { ExportButton } from '@/components/ExportButton'
import { ImportButton } from '@/components/ImportButton'
import type { Barcode, BarcodeUnitType, Inventory, Product, SaleStatus, ProductUnit } from '@/types/api.types'

/* ─── EditableCell (top-level to prevent remount on parent re-render) ───── */
type EditField = 'code' | 'name' | 'optionName' | 'spec' | 'unit' | 'boxQty' | 'costPrice' | 'sellPrice'
type EditCell  = { id: string; field: EditField; value: string }

function EditableCell({
  id, field, value, editCell, setEditCell, onSave, unitOptions, align = 'left',
}: {
  id: string
  field: EditField
  value?: string | number
  editCell: EditCell | null
  setEditCell: (c: EditCell | null) => void
  onSave: (c: EditCell) => void
  unitOptions?: ProductUnit[]
  align?: 'left' | 'center' | 'right'
}) {
  const isEditing = editCell?.id === id && editCell.field === field
  const isNumeric = field === 'boxQty' || field === 'costPrice' || field === 'sellPrice'

  if (isEditing) {
    if (field === 'unit' && unitOptions) {
      return (
        <select
          autoFocus
          value={editCell.value}
          onChange={(e) => setEditCell({ ...editCell, value: e.target.value })}
          onBlur={() => onSave(editCell)}
          className="px-2 py-1 text-sm text-center border border-indigo-400 rounded-lg bg-white dark:bg-gray-800 outline-none w-24"
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
        type={isNumeric ? 'number' : 'text'}
        value={editCell.value}
        onChange={(e) => setEditCell({ ...editCell, value: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(editCell)
          if (e.key === 'Escape') setEditCell(null)
        }}
        onBlur={() => onSave(editCell)}
        className={cn(
          'px-2 py-1 text-sm border border-indigo-400 rounded-lg bg-white dark:bg-gray-800 outline-none w-full min-w-[80px]',
          align === 'center' && 'text-center',
          align === 'right' && 'text-right tabular-nums',
        )}
      />
    )
  }

  const display = value !== undefined && value !== '' && value !== null ? String(value) : null
  const displayValue = isNumeric && display ? formatNumber(value) : display

  return (
    <button
      onClick={() => setEditCell({ id, field, value: String(value ?? '') })}
      className={cn(
        'w-full px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors',
        align === 'center' ? 'text-center' : align === 'right' ? 'text-right tabular-nums' : 'text-left',
      )}
    >
      <span className={cn(
        'text-sm',
        display ? 'text-gray-800 dark:text-gray-200' : 'text-gray-300 dark:text-gray-700 italic text-xs',
      )}>
        {displayValue ?? '—'}
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

const BARCODE_TYPE_LABEL: Record<BarcodeUnitType, string> = {
  UNIT: '일반낱개',
  BOX:  '박스',
  CXD:  'CXD낱개',
}

const BARCODE_TYPE_CLS: Record<BarcodeUnitType, string> = {
  UNIT: 'bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900/60',
  BOX:  'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60',
  CXD:  'bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900/60',
}

const toNumber = (value?: number) => Number(value ?? 0)
const getBoxStockQty = (product: Product) => {
  const boxQty = product.boxQty > 0 ? product.boxQty : 1
  return Math.floor(toNumber(product.stockQty) / boxQty)
}
const getBoxCostPrice = (product: Product) => toNumber(product.costPrice) * (product.boxQty > 0 ? product.boxQty : 1)
const getBoxSellPrice = (product: Product) => toNumber(product.sellPrice) * (product.boxQty > 0 ? product.boxQty : 1)
const getTotalAmount = (product: Product) => getBoxCostPrice(product) * getBoxStockQty(product)

function buildInventorySummary(inventory: Inventory[]) {
  const map = new Map<string, { stockQty: number; locations: string[] }>()
  inventory.forEach((inv) => {
    const current = map.get(inv.productId) ?? { stockQty: 0, locations: [] }
    current.stockQty += inv.quantity
    const locationCode = inv.location?.code
    if (locationCode && !current.locations.includes(locationCode)) {
      current.locations.push(locationCode)
    }
    map.set(inv.productId, current)
  })
  return map
}

function pickBarcode(barcodes?: Barcode[]) {
  if (!barcodes || barcodes.length === 0) return undefined
  return barcodes.find((b) => b.isPrimary && b.isActive) ?? barcodes.find((b) => b.isActive) ?? barcodes[0]
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function ProductMasterPage() {
  const qc = useQueryClient()
  const router = useRouter()
  const warehouse = useWarehouseStore((s) => s.selectedWarehouse)
  const [searchInput, setSearchInput]  = useState('')
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

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory', 'product-master', warehouse?.id ?? ''],
    queryFn:  () => stockApi.getInventory(warehouse!.id),
    enabled:  !!warehouse?.id,
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

  const lotMutation = useMutation({
    mutationFn: ({ id, isLotManaged }: { id: string; isLotManaged: boolean }) =>
      productApi.update(id, { isLotManaged } as Partial<Product>),
    onSuccess: (_, { isLotManaged }) => {
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success(`LOT 관리 ${isLotManaged ? '활성화' : '비활성화'}`)
    },
    onError: () => toast.error('LOT 변경 실패'),
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
      [cell.field]: cell.field === 'boxQty' || cell.field === 'costPrice' || cell.field === 'sellPrice' ? Number(trimmed) : trimmed,
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
  const inventorySummary = buildInventorySummary(inventory)
  const productsWithInventory = products.map((product) => ({
    ...product,
    stockQty: inventorySummary.get(product.id)?.stockQty ?? product.stockQty ?? 0,
  }))
  const barcodeResults = useQueries({
    queries: products.map((product) => ({
      queryKey: ['barcodes', product.id],
      queryFn:  () => productApi.findBarcodes(product.id),
      staleTime: 60_000,
    })),
  })
  const barcodeMap = new Map<string, Barcode[]>(
    products.map((product, index) => [product.id, barcodeResults[index]?.data ?? []]),
  )
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
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <ExportButton
            filename="상품마스터"
            getData={async () => {
              const all = await productApi.findAll({ search: search || undefined, limit: 9999 })
              const barcodeEntries = await Promise.all(
                all.items.map(async (p: Product) => [p.id, await productApi.findBarcodes(p.id)] as const),
              )
              const exportBarcodeMap = new Map<string, Barcode[]>(barcodeEntries)
              return all.items.map((p: Product) => {
                const barcode = pickBarcode(exportBarcodeMap.get(p.id))
                return {
                  '상품 코드': p.code,
                  '상품명': p.name,
                  '원가': p.costPrice ?? 0,
                  '판매가': p.sellPrice ?? 0,
                  '단위': p.unit,
                  '박스당 낱개 갯수': p.boxQty,
                  '박스 재고수량': getBoxStockQty({ ...p, stockQty: inventorySummary.get(p.id)?.stockQty ?? p.stockQty ?? 0 }),
                  '박스당 원가': getBoxCostPrice(p),
                  '박스당 판매가': getBoxSellPrice(p),
                  '총금액': getTotalAmount({ ...p, stockQty: inventorySummary.get(p.id)?.stockQty ?? p.stockQty ?? 0 }),
                  '바코드 종류': barcode ? BARCODE_TYPE_LABEL[barcode.type] : '',
                  '바코드': barcode?.barcode ?? '',
                  '상태': SALE_STATUS_LABEL[p.saleStatus],
                  '위치': inventorySummary.get(p.id)?.locations.join(', ') ?? '',
                }
              })
            }}
          />
          <ImportButton
            onImported={() => qc.invalidateQueries({ queryKey: ['products'] })}
          />
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

      {/* 검색/필터 */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-3 flex gap-2.5 shadow-sm">
        <div className="relative flex-1 flex gap-1.5">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setSearch(searchInput) }}
              placeholder="상품코드 / 상품명"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 transition-shadow"
            />
          </div>
          <button
            onClick={() => setSearch(searchInput)}
            className="px-3.5 py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
          >
            검색
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-indigo-600 text-white px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
          <span className="text-sm font-semibold flex-1">{formatNumber(selectedIds.size)}개 선택됨</span>
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
          <table className="w-full min-w-[1680px] text-sm border-separate border-spacing-0 [&_td]:border-r [&_td]:border-gray-100 [&_th]:border-r [&_th]:border-gray-200 dark:[&_td]:border-gray-800 dark:[&_th]:border-gray-700">
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
                <th className="text-center px-2 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-36">상품 코드</th>
                <th className="text-center px-2 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide min-w-[160px]">상품명</th>
                <th className="text-center px-2 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-24">원가</th>
                <th className="text-center px-2 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-24">판매가</th>
                <th className="text-center px-2 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-20">단위</th>
                <th className="text-center px-2 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-28">박스당 낱개 갯수</th>
                <th className="text-center px-2 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-28">박스 재고수량</th>
                <th className="text-center px-2 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-28">박스당 원가</th>
                <th className="text-center px-2 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-28">박스당 판매가</th>
                <th className="text-center px-2 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-28">총금액</th>
                <th className="text-center px-2 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-24">바코드 종류</th>
                <th className="text-center px-2 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-36">바코드</th>
                <th className="text-center px-2 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-20">상태</th>
                <th className="text-center px-2 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide w-32">위치</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={17} className="text-center py-10 text-gray-400 text-sm">불러오는 중...</td></tr>
              )}
              {!isLoading && products.length === 0 && (
                <tr><td colSpan={17} className="text-center py-10 text-gray-300 text-sm">상품이 없습니다</td></tr>
              )}
              {productsWithInventory.map((p, idx) => {
                const locations = inventorySummary.get(p.id)?.locations.join(', ') || '-'
                const barcode = pickBarcode(barcodeMap.get(p.id))
                return (
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
                    <td className="py-1.5 px-2 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                      <EditableCell id={p.id} field="costPrice" value={p.costPrice ?? 0}
                        editCell={editCell} setEditCell={setEditCell} onSave={saveEdit} align="right" />
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                      <EditableCell id={p.id} field="sellPrice" value={p.sellPrice ?? 0}
                        editCell={editCell} setEditCell={setEditCell} onSave={saveEdit} align="right" />
                    </td>
                    <td className="py-1.5 pr-1 text-center">
                      <EditableCell id={p.id} field="unit" value={p.unit}
                        editCell={editCell} setEditCell={setEditCell} onSave={saveEdit}
                        unitOptions={unitOptions} align="center" />
                    </td>
                    <td className="py-1.5 pr-1 text-center">
                      <EditableCell id={p.id} field="boxQty" value={p.boxQty}
                        editCell={editCell} setEditCell={setEditCell} onSave={saveEdit} align="center" />
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                      {formatNumber(getBoxStockQty(p))}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {formatNumber(getBoxCostPrice(p))}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {formatNumber(getBoxSellPrice(p))}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                      {formatNumber(getTotalAmount(p))}
                    </td>
                    <td className="py-2 px-2 text-center">
                      {barcode ? (
                        <span className={cn('inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', BARCODE_TYPE_CLS[barcode.type])}>
                          {BARCODE_TYPE_LABEL[barcode.type]}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300 dark:text-gray-700">-</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center font-mono text-xs text-gray-600 dark:text-gray-400">
                      {barcode?.barcode ?? '-'}
                    </td>
                    <td className="py-2 text-center">
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', STATUS_CLS[p.saleStatus])}>
                        {SALE_STATUS_LABEL[p.saleStatus]}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-xs text-gray-600 dark:text-gray-400">
                      {locations}
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
                )
              })}
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
