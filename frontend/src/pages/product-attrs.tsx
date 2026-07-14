'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { productApi } from '@/api/product.api'
import { warehouseApi } from '@/api/warehouse.api'
import { stockApi } from '@/api/stock.api'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { useAuthStore } from '@/stores/auth.store'
import { SALE_STATUS_LABEL } from '@/constants/stock.constants'
import { cn } from '@/utils/cn'
import { formatNumber } from '@/utils/format'
import { canAdjustStock, canManageMasterData } from '@/utils/permissions'
import { ExportButton } from '@/components/ExportButton'
import { ImportButton } from '@/components/ImportButton'
import { productImportConfig } from '@/config/product-import-config'
import type { Barcode, BarcodeUnitType, Inventory, Location, Product } from '@/types/api.types'
import { ProductBarcodeModal } from '@/components/ProductBarcodeModal'
import { CategorySelect } from '@/components/CategorySelect'
import { ProductInventoryGrid } from '@/components/ProductInventoryGrid'

/* ─── Constants ──────────────────────────────────────────────────────────── */
const BARCODE_TYPE_LABEL: Record<BarcodeUnitType, string> = {
  UNIT: '낱개',
  CXD:  'CXD 낱개',
  CXD_OUT: 'CXD OUT',
}


const toNumber = (value?: number) => Number(value ?? 0)
const getBoxStockQty = (product: Product) => toNumber(product.stockQty)
const getBoxCostPrice = (product: Product) => toNumber(product.costPrice) * (product.boxQty > 0 ? product.boxQty : 1)
const getBoxSellPrice = (product: Product) => toNumber(product.sellPrice) * (product.boxQty > 0 ? product.boxQty : 1)
const getTotalAmount = (product: Product) => getBoxCostPrice(product) * getBoxStockQty(product)

function buildInventorySummary(inventory: Inventory[]) {
  const map = new Map<string, { stockQty: number; reservedQty: number; availableQty: number; locations: string[] }>()
  inventory.forEach((inv) => {
    const current = map.get(inv.productId) ?? { stockQty: 0, reservedQty: 0, availableQty: 0, locations: [] }
    current.stockQty += inv.quantity
    current.reservedQty += inv.reservedQty ?? 0
    current.availableQty += inv.availableQty ?? inv.quantity
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

async function adjustBoxStockQty({
  product,
  targetQty,
  warehouseId,
  inventoryItems,
}: {
  product: Product
  targetQty: number
  warehouseId?: string
  inventoryItems: Inventory[]
}) {
  if (!warehouseId) throw new Error('창고를 먼저 선택해주세요')
  if (targetQty < 0) throw new Error('재고수량은 0 이상이어야 합니다')

  const currentQty = inventoryItems.reduce((sum, inv) => sum + inv.quantity, 0)
  const delta = targetQty - currentQty
  if (delta === 0) return

  const defaultLocationId = product.defaultLocation?.id ?? product.locationId
  const sortedInventory = [...inventoryItems].sort((a, b) => {
    if (a.locationId === defaultLocationId) return -1
    if (b.locationId === defaultLocationId) return 1
    return b.quantity - a.quantity
  })

  if (delta > 0) {
    const targetInventory = sortedInventory[0]
    const locationId = defaultLocationId ?? targetInventory?.locationId
    if (!locationId) throw new Error('재고를 조정할 기본 위치가 없습니다')
    await stockApi.adjust({
      productId: product.id,
      locationId,
      warehouseId,
      adjustedQty: (targetInventory?.locationId === locationId ? targetInventory.quantity : 0) + delta,
      reason: '상품 그리드 OUT 재고수량 수정',
    })
    return
  }

  let remainingDecrease = Math.abs(delta)
  for (const inv of sortedInventory.filter((item) => item.quantity > 0)) {
    if (remainingDecrease <= 0) break
    const decrease = Math.min(inv.quantity, remainingDecrease)
    await stockApi.adjust({
      productId: product.id,
      locationId: inv.locationId,
      warehouseId,
      adjustedQty: inv.quantity - decrease,
      reason: '상품 그리드 OUT 재고수량 수정',
    })
    remainingDecrease -= decrease
  }
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function ProductMasterPage() {
  const qc = useQueryClient()
  const router = useRouter()
  const warehouse = useWarehouseStore((s) => s.selectedWarehouse)
  const me = useAuthStore((s) => s.user)
  const [searchInput, setSearchInput]  = useState('')
  const [search, setSearch]           = useState('')
  const [showSafetyOnly, setShowSafetyOnly] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [barcodeModal, setBarcodeModal] = useState<Product | null>(null)

  const { data, isLoading, refetch: refetchProducts } = useQuery({
    queryKey: ['products', search],
    queryFn:  () => productApi.findAll({ search, limit: 200 }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const { data: allLocations = [] } = useQuery<Location[]>({
    queryKey: ['locations-for-product-master-form', warehouse?.id],
    queryFn:  () => warehouseApi.findLocations(warehouse!.id),
    enabled:  !!warehouse?.id,
    placeholderData: [],
    staleTime: 60_000,
  })

  const { data: inventory = [], refetch: refetchInventory } = useQuery({
    queryKey: ['inventory', 'product-master', warehouse?.id ?? ''],
    queryFn:  () => stockApi.getInventory(warehouse!.id),
    enabled:  !!warehouse?.id,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  })

  const products: Product[]        = useMemo(() => data?.items ?? [], [data?.items])
  const inventorySummary = useMemo(() => buildInventorySummary(inventory), [inventory])
  const productsWithInventoryBase = useMemo(
    () => products.map((product) => ({
      ...product,
      stockQty: inventorySummary.get(product.id)?.stockQty ?? product.stockQty ?? 0,
      reservedQty: inventorySummary.get(product.id)?.reservedQty ?? 0,
      availableQty: inventorySummary.get(product.id)?.availableQty ?? inventorySummary.get(product.id)?.stockQty ?? product.stockQty ?? 0,
    })),
    [inventorySummary, products],
  )
  const productsWithInventory = useMemo(() => {
    const rows = showSafetyOnly
      ? productsWithInventoryBase.filter((p) => getBoxStockQty(p) < p.safetyStock)
      : productsWithInventoryBase
    return rows
  }, [productsWithInventoryBase, showSafetyOnly])
  const canManageProducts = canManageMasterData(me?.role)
  const canAdjustProductStock = canAdjustStock(me?.role)

  const openQuoteScreen = () => {
    const ids = [...selectedIds]
    if (ids.length === 0) {
      toast.error('상품을 먼저 선택해주세요')
      return
    }
    router.push(`/quotes?productIds=${encodeURIComponent(ids.join(','))}`)
  }
  const openPurchaseOrder = () => router.push('/quotes?tab=PURCHASE')

  const inputCls = 'wms-input w-full dark:border-gray-700 dark:bg-gray-800'

  return (
    <div className="flex h-[calc(100vh-150px)] min-h-0 flex-col gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            상품 마스터
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            코드·상품명·옵션·규격·단위·OUT입수·LOT을 통합 관리합니다. 셀을 클릭하면 편집됩니다.
          </p>
        </div>
      </div>

      {/* 검색/필터 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2">
        <div className="flex flex-col gap-1.5 md:flex-row">
          <div className="relative flex-1">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setSearch(searchInput) }}
              placeholder="거래처, 상품코드, 자재번호, 상품명, 위치, 카테고리, 상태 검색"
              className="wms-input w-full py-1.5 dark:border-gray-700 dark:bg-gray-800 transition-colors"
            />
          </div>
          <button
            onClick={() => setSearch(searchInput)}
            className="wms-primary-button px-3 py-1.5 text-sm rounded transition-colors font-medium"
          >
            검색
          </button>
          <button
            type="button"
            onClick={() => setShowSafetyOnly((prev) => !prev)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border transition-colors font-medium whitespace-nowrap',
              showSafetyOnly
                ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800',
            )}
          >
            안전재고 경고만
          </button>
        </div>
      </div>

      <ProductInventoryGrid
        products={productsWithInventory}
        loading={isLoading}
        canEditMasterData={canManageProducts}
        canAdjustStock={canAdjustProductStock}
        canManageBarcodes={canManageProducts}
        locations={allLocations}
        showMasterColumns
        onSelectionChange={(selected) => setSelectedIds(new Set(selected.map((product) => product.id)))}
        onBarcodeClick={setBarcodeModal}
        onStockQtySave={(product, targetQty) => adjustBoxStockQty({
          product,
          targetQty,
          warehouseId: warehouse?.id,
          inventoryItems: inventory.filter((inv) => inv.productId === product.id),
        })}
        onSaved={(changes) => {
          qc.invalidateQueries({ queryKey: ['products'] })
          if (changes?.stockChanged) qc.invalidateQueries({ queryKey: ['inventory'] })
          if (changes?.barcodesChanged) qc.invalidateQueries({ queryKey: ['product-barcodes'] })
          setSelectedIds(new Set())
        }}
        onRefresh={async () => {
          const [productsResult, inventoryResult] = await Promise.all([
            refetchProducts(),
            warehouse?.id ? refetchInventory() : Promise.resolve(undefined),
          ])
          if (productsResult?.error || inventoryResult?.error) {
            throw productsResult?.error ?? inventoryResult?.error
          }
        }}
        overflowActions={(
          <>
            <ExportButton
              filename="상품마스터"
              disabled={selectedIds.size === 0}
              getData={async () => {
                const all = await productApi.findAll({ search: search || undefined, limit: 9999 })
                const items = all.items.filter((p: Product) => selectedIds.has(p.id))
                const barcodeEntries = await Promise.all(
                  items.map(async (p: Product) => [p.id, await productApi.findBarcodes(p.id)] as const),
                )
                const exportBarcodeMap = new Map<string, Barcode[]>(barcodeEntries)
                return items.map((p: Product) => {
                  const barcode = pickBarcode(exportBarcodeMap.get(p.id))
                  return {
                    '상품 코드': p.code,
                    '자재번호': p.materialNo ?? '',
                    '상품명': p.name,
                    '카테고리': p.category ?? '',
                    '옵션': p.optionName ?? '',
                    '규격': p.spec ?? '',
                    '거래처': p.client?.name ?? '',
                    '기본 위치': p.defaultLocation?.code ?? '',
                    '원가': p.costPrice ?? 0,
                    '도매가': p.sellPrice ?? 0,
                    '소매가': p.retailPrice ?? 0,
                    '해피미르 단가': p.priceA ?? 0,
                    '네이버 단가': p.priceB ?? 0,
                    'SSG 단가': p.priceC ?? 0,
                    '단위': p.unit,
                    '낱개 갯수(OUT당)': p.boxQty,
                    '재고': p.stockQty ?? 0,
                    'OUT 원가': getBoxCostPrice(p),
                    'OUT 판매가': getBoxSellPrice(p),
                    '총금액': getTotalAmount({ ...p, stockQty: inventorySummary.get(p.id)?.stockQty ?? p.stockQty ?? 0 }),
                    '바코드 종류': barcode ? BARCODE_TYPE_LABEL[barcode.type] : '',
                    '바코드': barcode?.barcode ?? '',
                    '상태': SALE_STATUS_LABEL[p.saleStatus],
                    '위치': inventorySummary.get(p.id)?.locations.join(', ') ?? '',
                    '메모': p.memo ?? '',
                  }
                })
              }}
            />
            {canManageProducts && <ImportButton config={productImportConfig} onImported={() => qc.invalidateQueries({ queryKey: ['products'] })} />}
            <button
              onClick={openQuoteScreen}
              disabled={selectedIds.size === 0}
              title="거래명세서/견적서"
              className="inline-flex h-7 items-center gap-1 rounded border border-emerald-200 bg-white px-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
            >
              견적서
            </button>
            <button
              onClick={openPurchaseOrder}
              title="발주서 생성"
              className="inline-flex h-7 items-center gap-1 rounded border border-orange-200 bg-white px-2 text-xs font-medium text-orange-700 hover:bg-orange-50"
            >
              발주서
            </button>
          </>
        )}
      />

      {barcodeModal && (
        <ProductBarcodeModal
          product={barcodeModal}
          onClose={() => setBarcodeModal(null)}
        />
      )}

    </div>
  )
}
