'use client'
import { useEffect, useState, useMemo } from 'react'
import { FileText, ShoppingCart } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { productApi, unitApi } from '@/api/product.api'
import { clientApi } from '@/api/client.api'
import { warehouseApi } from '@/api/warehouse.api'
import { stockApi } from '@/api/stock.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { SALE_STATUS_LABEL } from '@/constants/stock.constants'
import { formatNumber, formatDecimal, formatDateTime } from '@/utils/format'
import { cn } from '@/utils/cn'
import { ExportButton } from '@/components/ExportButton'
import { useRouter } from 'next/router'
import { ImportButton } from '@/components/ImportButton'
import { useAuthStore } from '@/stores/auth.store'
import { useMenuPermissionStore } from '@/stores/menu-permission.store'
import { useSupplierInfoStore } from '@/stores/supplier-info.store'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { printQuoteDocument } from '@/utils/printDocument'
import type { Product, SaleStatus, Barcode, ProductUnit, Client, Location, BarcodeUnitType, Inventory, UnitType } from '@/types/api.types'
import { ProductBarcodeModal } from '@/components/ProductBarcodeModal'
import { CategorySelect } from '@/components/CategorySelect'
import { EMPTY_PRODUCT_FORM } from '@/components/ProductFormModal'
import { getPackageUnitQty } from '@/utils/unit-spec'
import { ProductInventoryGrid } from '@/components/ProductInventoryGrid'

const PAGE_SIZE = 10

type ClientOption = Pick<Client, 'id' | 'name' | 'phone' | 'email'>
type SortDirection = 'asc' | 'desc'
type ProductSortKey =
  | 'client' | 'code' | 'materialNo' | 'name' | 'location' | 'unit'
  | 'boxQty' | 'inboxStock' | 'outboxStock' | 'eaStock' | 'plStock' | 'category'
  | 'costPrice' | 'sellPrice' | 'retailPrice' | 'priceB' | 'priceA' | 'priceC'
  | 'barcode' | 'memo' | 'currentStock' | 'reserved' | 'available' | 'safetyStock'
  | 'saleStatus' | 'createdAt'
type ProductSortState = { key: ProductSortKey; direction: SortDirection } | null
type EditField =
  | 'code' | 'name' | 'category' | 'materialNo'
  | 'unit' | 'boxQty' | 'boxStock' | 'safetyStock' | 'reorderPoint'
  | 'costPrice' | 'sellPrice' | 'retailPrice'
  | 'priceB' | 'priceA' | 'priceC' | 'memo'
  | 'spec' | 'pUnitQty' | 'boxUnitQty' | 'plUnitQty' | 'eaStock' | 'inboxStock' | 'outboxStock'
type EditCell = { id: string; field: EditField; value: string }

const STATUS_STYLE: Record<SaleStatus, string> = {
  ACTIVE:       'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800',
  INACTIVE:     'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-800',
  DISCONTINUED: 'bg-gray-100 text-gray-500 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700',
}

const getTotalEA = (product: Product) => {
  // Inventory.quantity is the canonical EA quantity. Package stock is derived from it.
  return Number(product.stockQty ?? 0)
}

const roundToTwo = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

const getInboxStock = (product: Product) => {
  const ea = getTotalEA(product)
  const pQty = getPackageUnitQty(product, 'P') ?? 0
  return pQty > 0 ? roundToTwo(ea / pQty) : 0
}

const getOutboxStock = (product: Product) => {
  const ea = getTotalEA(product)
  const boxQty = getPackageUnitQty(product, 'BOX') ?? 0
  return boxQty > 0 ? roundToTwo(ea / boxQty) : 0
}

const getPlStock = (product: Product) => {
  const ea = getTotalEA(product)
  const plQty = getPackageUnitQty(product, 'PL') ?? 0
  return plQty > 0 ? roundToTwo(ea / plQty) : 0
}

const getPrimaryBarcode = (barcodes?: Barcode[]) => {
  if (!barcodes || barcodes.length === 0) return '-'
  const barcode = barcodes.find((b) => b.isPrimary && b.isActive) ?? barcodes.find((b) => b.isActive) ?? barcodes[0]
  return barcode.barcode
}

function buildInventorySummary(inventory: Inventory[]) {
  const map = new Map<string, { stockQty: number; items: Inventory[] }>()
  inventory.forEach((inv) => {
    const current = map.get(inv.productId) ?? { stockQty: 0, items: [] }
    current.stockQty += inv.quantity
    current.items.push(inv)
    map.set(inv.productId, current)
  })
  return map
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
      reason: '상품 그리드 박스 재고수량 수정',
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
      reason: '상품 그리드 박스 재고수량 수정',
    })
    remainingDecrease -= decrease
  }
}

/* 공통 셀 border 클래스 */
const TH = 'px-3 py-1.5 font-semibold border-r border-white/20 last:border-r-0 whitespace-nowrap bg-[#2D4033] text-white'
const TD_BASE = 'px-2 py-1 border-r border-gray-200 dark:border-gray-700 last:border-r-0 whitespace-nowrap leading-5'
const TD_TEXT = cn(TD_BASE, 'text-left text-gray-700 dark:text-gray-300')
const TD_NUM  = cn(TD_BASE, 'text-right tabular-nums text-gray-900 dark:text-gray-100')
const TD_CTR  = cn(TD_BASE, 'text-center text-gray-700 dark:text-gray-300')

const EDIT_NUMERIC_FIELDS: EditField[] = [
  'boxQty', 'boxStock', 'eaStock', 'outboxStock', 'safetyStock', 'reorderPoint',
  'costPrice', 'sellPrice', 'retailPrice',
  'priceB', 'priceA', 'priceC',
  'pUnitQty', 'boxUnitQty', 'plUnitQty',
]
const EDIT_OPTIONAL_FIELDS: EditField[] = [
  'category', 'materialNo', 'memo',
  'costPrice', 'sellPrice', 'retailPrice',
  'priceB', 'priceA', 'priceC',
  'spec', 'pUnitQty', 'boxUnitQty', 'plUnitQty',
]

const compareSortValue = (a: string | number | undefined | null, b: string | number | undefined | null, direction: SortDirection) => {
  const dir = direction === 'asc' ? 1 : -1
  const aEmpty = a === undefined || a === null || a === ''
  const bEmpty = b === undefined || b === null || b === ''
  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1
  if (bEmpty) return -1
  if (typeof a === 'number' || typeof b === 'number') {
    return (Number(a) - Number(b)) * dir
  }
  return String(a).localeCompare(String(b), 'ko', { numeric: true, sensitivity: 'base' }) * dir
}

const getProductSortValue = (product: Product, key: ProductSortKey) => {
  switch (key) {
    case 'client': return product.client?.name
    case 'code': return product.code
    case 'materialNo': return product.materialNo
    case 'name': return product.name
    case 'location': return product.defaultLocation?.code
    case 'unit': return product.unit
    case 'boxQty': return product.boxQty
    case 'inboxStock': return getInboxStock(product)
    case 'outboxStock': return getOutboxStock(product)
    case 'eaStock': return getTotalEA(product)
    case 'plStock': {
      const ea = getTotalEA(product)
      const eaPerPl = product.plUnitQty ?? 0
      return eaPerPl > 0 ? ea / eaPerPl : 0
    }
    case 'category': return product.category
    case 'costPrice': return product.costPrice
    case 'sellPrice': return product.sellPrice
    case 'retailPrice': return product.retailPrice
    case 'priceB': return product.priceB
    case 'priceA': return product.priceA
    case 'priceC': return product.priceC
    case 'barcode': return getPrimaryBarcode(product.barcodes)
    case 'memo': return product.memo
    case 'currentStock': return getTotalEA(product)
    case 'reserved': return 0
    case 'available': return getTotalEA(product)
    case 'safetyStock': return product.safetyStock
    case 'saleStatus': return SALE_STATUS_LABEL[product.saleStatus]
    case 'createdAt': return product.createdAt
    default: return ''
  }
}

export default function ProductsPage() {
  const qc = useQueryClient()
  const me = useAuthStore((s) => s.user)
  const warehouse = useWarehouseStore((s) => s.selectedWarehouse)
    const router = useRouter()
  const menus = useMenuPermissionStore((s) => s.menus)
  const supplierInfo = useSupplierInfoStore((s) => s.info)
  const [searchInput, setSearchInput]  = useState('')
  const [search, setSearch]           = useState('')
  const [sort, setSort]               = useState<ProductSortState>(null)
  const [showSafetyOnly, setShowSafetyOnly] = useState(false)
  const [editCell, setEditCell]       = useState<EditCell | null>(null)
  const [page, setPage]               = useState(1)
  const [showModal, setShowModal]     = useState(false)
  const [editing, setEditing]         = useState<Product | null>(null)
  const [form, setForm]               = useState(EMPTY_PRODUCT_FORM)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showClientPicker, setShowClientPicker] = useState(false)
  const [clientPickerSearch, setClientPickerSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null)
  const [clientTargetProduct, setClientTargetProduct] = useState<Product | null>(null)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [locationPickerSearch, setLocationPickerSearch] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)

  useEffect(() => {
    if (!router.isReady) return
    setShowSafetyOnly(router.query.safety === '1')
  }, [router.isReady, router.query.safety])
  const [locationTargetProduct, setLocationTargetProduct] = useState<Product | null>(null)
  const [newBcVal, setNewBcVal]       = useState('')
  const [newBcType, setNewBcType]     = useState<BarcodeUnitType>('UNIT')
  const [newBcQty, setNewBcQty]       = useState(1)
  const [newBcPrimary, setNewBcPrimary] = useState(false)
  const [showAddBc, setShowAddBc]     = useState(false)
  const [barcodeModal, setBarcodeModal] = useState<Product | null>(null)
  const [pendingBarcodes, setPendingBarcodes] = useState<Array<{ barcode: string; type: BarcodeUnitType; unitQty: number; isPrimary: boolean }>>([])

  const productLimit = showSafetyOnly ? 1000 : PAGE_SIZE
  const productPage = showSafetyOnly ? 1 : page
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.products({ search, page: productPage, limit: productLimit }),
    queryFn:  () => productApi.findAll({ search: search || undefined, page: productPage, limit: productLimit }),
    placeholderData: (prev) => prev,
  })

  const { data: units = [] } = useQuery<ProductUnit[]>({
    queryKey: ['product-units'],
    queryFn:  () => unitApi.findAll(),
    placeholderData: [],
  })

  const { data: barcodes = [], refetch: refetchBarcodes } = useQuery<Barcode[]>({
    queryKey: ['product-barcodes', editing?.id],
    queryFn:  () => productApi.findBarcodes(editing!.id),
    enabled:  !!editing?.id,
    placeholderData: [],
  })

  const addBarcodeMutation = useMutation({
    mutationFn: () => productApi.addBarcode(editing!.id, { barcode: newBcVal.trim(), type: newBcType, unitQty: newBcQty, isPrimary: newBcPrimary }),
    onSuccess: () => {
      refetchBarcodes()
      setNewBcVal(''); setNewBcType('UNIT'); setNewBcQty(1); setNewBcPrimary(false); setShowAddBc(false)
      toast.success('바코드가 등록되었습니다')
    },
    onError: () => toast.error('바코드 추가 실패 (중복 또는 오류)'),
  })

  const delBarcodeMutation = useMutation({
    mutationFn: (barcodeId: string) => productApi.deleteBarcode(editing!.id, barcodeId),
    onSuccess: () => { refetchBarcodes(); toast.success('바코드가 삭제되었습니다') },
  })

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients-all'],
    queryFn:  () => clientApi.findAllActive(),
    enabled:  showModal || showClientPicker,
    placeholderData: [],
  })

  const { data: allLocations = [], isLoading: locationsLoading } = useQuery<Location[]>({
    queryKey: ['locations-for-product-form', warehouse?.id],
    queryFn:  () => warehouseApi.findLocations(warehouse!.id),
    enabled:  !!warehouse?.id,
    placeholderData: [],
    staleTime: 60_000,
  })

  const { data: inventory = [] } = useQuery<Inventory[]>({
    queryKey: ['inventory', 'products-grid', warehouse?.id ?? ''],
    queryFn:  () => stockApi.getInventory(warehouse!.id),
    enabled:  !!warehouse?.id,
    placeholderData: [],
  })

  const filteredClients = useMemo(() => {
    const q = clientPickerSearch.trim().toLowerCase()
    if (!q) return clients.slice(0, 50)
    return clients.filter((c) =>
      [c.name, c.businessNo, c.phone, c.contactName, c.managerName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    )
  }, [clients, clientPickerSearch])

  const filteredLocations = useMemo(() => {
    const q = locationPickerSearch.trim().toLowerCase()
    if (!q) return allLocations.slice(0, 80)
    return allLocations.filter((l) =>
      [l.code, l.aisle, l.rack, l.shelf, l.bin, l.zone?.name, l.zone?.code]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    )
  }, [allLocations, locationPickerSearch])

  const selectedClientLabel = selectedClient?.name
    ?? clients.find((c) => c.id === form.clientId)?.name
    ?? (editing?.clientId === form.clientId ? editing?.client?.name : undefined)
    ?? ''

  const selectedLocationLabel = selectedLocation?.code
    ?? allLocations.find((l) => l.id === form.locationId)?.code
    ?? (editing?.locationId === form.locationId || editing?.defaultLocation?.id === form.locationId ? editing?.defaultLocation?.code : undefined)
    ?? ''

  const canAccessQuotes = Boolean(me?.role && menus.find((m) => m.menuId === 'quotes')?.roles.includes(me.role))
  const inventorySummary = useMemo(() => buildInventorySummary(inventory), [inventory])

  const toggleSort = (key: ProductSortKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' }
      if (prev.direction === 'asc') return { key, direction: 'desc' }
      return null
    })
  }

  const productRows = useMemo(() => {
    const rows = (data?.items ?? []).map((product) => ({
      ...product,
      stockQty: inventorySummary.get(product.id)?.stockQty ?? product.stockQty ?? 0,
    }))
    const filteredRows = showSafetyOnly ? rows.filter((p) => getTotalEA(p) < p.safetyStock) : rows
    if (!sort) return filteredRows
    return [...filteredRows].sort((a, b) => compareSortValue(getProductSortValue(a, sort.key), getProductSortValue(b, sort.key), sort.direction))
  }, [data?.items, inventorySummary, showSafetyOnly, sort])

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['products'] })
    qc.invalidateQueries({ queryKey: ['product'] })
    qc.invalidateQueries({ queryKey: ['product-barcodes'] })
    qc.invalidateQueries({ queryKey: ['inventory'] })
    qc.invalidateQueries({ queryKey: ['products'] })
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const product = await productApi.create({
        code: form.code, name: form.name, category: form.category || undefined,
        clientId:   form.clientId   || undefined,
        locationId: form.locationId || undefined,
        unit: form.unit, baseUnit: form.baseUnit, pUnitQty: form.pUnitQty || undefined,
        boxUnitQty: form.boxUnitQty || undefined, plUnitQty: form.plUnitQty || undefined,
        boxQty: form.boxQty, safetyStock: form.safetyStock, reorderPoint: form.reorderPoint,
        spec: form.spec || undefined, materialNo: form.materialNo || undefined,
        costPrice: form.costPrice || undefined, sellPrice: form.sellPrice || undefined,
        priceB: form.priceB || undefined, priceA: form.priceA || undefined,
        priceC: form.priceC || undefined, retailPrice: form.retailPrice || undefined,
        memo: form.memo || undefined,
      })
      for (const bc of pendingBarcodes) {
        await productApi.addBarcode(product.id, bc)
      }
      if (form.initialStockEA > 0) {
        await adjustBoxStockQty({
          product,
          targetQty: form.initialStockEA,
          warehouseId: warehouse?.id,
          inventoryItems: [],
        })
      }
      return product
    },
    onSuccess: () => {
      toast.success('상품이 등록되었습니다')
      invalidateAll()
      closeModal()
    },
    onError: () => toast.error('상품 등록에 실패했습니다'),
  })

  const updateMutation = useMutation({
    mutationFn: () => productApi.update(editing!.id, {
      name: form.name, category: form.category,
      clientId:     form.clientId   || undefined,
      clearClient:  !form.clientId,
      locationId:   form.locationId || undefined,
      clearLocation: !form.locationId,
      unit: form.unit, baseUnit: form.baseUnit, pUnitQty: form.pUnitQty || undefined,
      boxUnitQty: form.boxUnitQty || undefined, plUnitQty: form.plUnitQty || undefined,
      boxQty: form.boxQty, safetyStock: form.safetyStock,
      reorderPoint: form.reorderPoint, spec: form.spec, materialNo: form.materialNo,
      costPrice: form.costPrice || undefined, sellPrice: form.sellPrice || undefined,
      priceB: form.priceB || undefined, priceA: form.priceA || undefined,
      priceC: form.priceC || undefined, retailPrice: form.retailPrice || undefined,
      memo: form.memo, saleStatus: form.saleStatus,
    }),
    onSuccess: () => {
      toast.success('상품이 수정되었습니다')
      invalidateAll()
      closeModal()
    },
    onError: () => toast.error('상품 수정에 실패했습니다'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const gridUpdateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof productApi.update>[1] }) =>
      productApi.update(id, patch),
    onSuccess: () => {
      invalidateAll()
      toast.success('저장되었습니다')
    },
    onError: () => toast.error('저장 실패'),
  })

  const buildSpecFromQtys = (pQty: number, boxQty: number, plQty: number) => {
    const parts: string[] = []
    if (pQty > 0) parts.push(`${pQty}P`)
    if (boxQty > 0) parts.push(`${boxQty}BOX`)
    if (plQty > 0) parts.push(`${plQty}PL`)
    return parts.join('/')
  }

  const saveEdit = (cell: EditCell) => {
    const trimmed = cell.value.trim()
    if (!trimmed && !EDIT_OPTIONAL_FIELDS.includes(cell.field)) {
      setEditCell(null)
      return
    }

    // 규격 텍스트 → P/BOX/PL 파싱
    if (cell.field === 'spec') {
      const val = trimmed
      const pMatch = val.match(/(\d+)\s*P\b/i)
      const boxMatch = val.match(/(\d+)\s*BOX/i)
      const plMatch = val.match(/(\d+)\s*PL\b/i)
      const patch: Record<string, string | number> = { spec: val }
      if (pMatch) patch.pUnitQty = Number(pMatch[1])
      if (boxMatch) patch.boxUnitQty = Number(boxMatch[1])
      if (plMatch) patch.plUnitQty = Number(plMatch[1])
      gridUpdateMutation.mutate({ id: cell.id, patch })
      setEditCell(null)
      return
    }

    // P / BOX / PL 변경 → spec 자동 업데이트
    if (cell.field === 'pUnitQty' || cell.field === 'boxUnitQty' || cell.field === 'plUnitQty') {
      const product = productRows.find((p) => p.id === cell.id)
      if (!product) { setEditCell(null); return }
      const newQtys = {
        pUnitQty:   cell.field === 'pUnitQty'   ? Number(trimmed || 0) : (product.pUnitQty   ?? 0),
        boxUnitQty: cell.field === 'boxUnitQty' ? Number(trimmed || 0) : (product.boxUnitQty ?? 0),
        plUnitQty:  cell.field === 'plUnitQty'  ? Number(trimmed || 0) : (product.plUnitQty  ?? 0),
      }
      const newSpec = buildSpecFromQtys(newQtys.pUnitQty, newQtys.boxUnitQty, newQtys.plUnitQty)
      gridUpdateMutation.mutate({ id: cell.id, patch: { ...newQtys, spec: newSpec } })
      setEditCell(null)
      return
    }

    if (cell.field === 'inboxStock') {
      const product = productRows.find((p) => p.id === cell.id)
      if (!product) { setEditCell(null); return }
      const inputInbox = roundToTwo(Number(trimmed || 0))
      const eaPerInbox = getPackageUnitQty(product, 'P') ?? 0
      if (eaPerInbox <= 0) { toast.error('P 단위(pUnitQty)가 설정되지 않았습니다'); setEditCell(null); return }
      const totalEATarget = roundToTwo(inputInbox * eaPerInbox)
      adjustBoxStockQty({
        product,
        targetQty: Math.round(totalEATarget),
        warehouseId: warehouse?.id,
        inventoryItems: inventorySummary.get(cell.id)?.items ?? [],
      })
        .then(() => {
          qc.invalidateQueries({ queryKey: ['inventory'] })
          qc.invalidateQueries({ queryKey: ['products'] })
          toast.success('재고수량이 조정되었습니다')
        })
        .catch((err) => toast.error(err instanceof Error ? err.message : '재고 조정 실패'))
      setEditCell(null)
      return
    }

    if (cell.field === 'eaStock') {
      const product = productRows.find((p) => p.id === cell.id)
      if (!product) { setEditCell(null); return }
      const inputEA = roundToTwo(Number(trimmed || 0))
      adjustBoxStockQty({
        product,
        targetQty: Math.round(inputEA),
        warehouseId: warehouse?.id,
        inventoryItems: inventorySummary.get(cell.id)?.items ?? [],
      })
        .then(() => {
          qc.invalidateQueries({ queryKey: ['inventory'] })
          qc.invalidateQueries({ queryKey: ['products'] })
          toast.success('재고수량이 조정되었습니다')
        })
        .catch((err) => toast.error(err instanceof Error ? err.message : '재고 조정 실패'))
      setEditCell(null)
      return
    }

    if (cell.field === 'outboxStock') {
      const product = productRows.find((p) => p.id === cell.id)
      if (!product) { setEditCell(null); return }
      const inputOutbox = roundToTwo(Number(trimmed || 0))
      const eaPerOutbox = getPackageUnitQty(product, 'BOX') ?? 0
      if (eaPerOutbox <= 0) { toast.error('OUTBOX 단위(boxUnitQty)가 설정되지 않았습니다'); setEditCell(null); return }
      const totalEA = roundToTwo(inputOutbox * eaPerOutbox)
      adjustBoxStockQty({
        product,
        targetQty: Math.round(totalEA),
        warehouseId: warehouse?.id,
        inventoryItems: inventorySummary.get(cell.id)?.items ?? [],
      })
        .then(() => {
          qc.invalidateQueries({ queryKey: ['inventory'] })
          qc.invalidateQueries({ queryKey: ['products'] })
          toast.success('재고수량이 조정되었습니다')
        })
        .catch((err) => toast.error(err instanceof Error ? err.message : '재고 조정 실패'))
      setEditCell(null)
      return
    }

    if (cell.field === 'boxStock') {
      const product = productRows.find((p) => p.id === cell.id)
      if (!product) {
        setEditCell(null)
        return
      }
      adjustBoxStockQty({
        product,
        targetQty: Number(trimmed || 0),
        warehouseId: warehouse?.id,
        inventoryItems: inventorySummary.get(cell.id)?.items ?? [],
      })
        .then(() => {
          qc.invalidateQueries({ queryKey: ['inventory'] })
          qc.invalidateQueries({ queryKey: ['products'] })
          toast.success('재고수량이 조정되었습니다')
        })
        .catch((err) => toast.error(err instanceof Error ? err.message : '재고 조정 실패'))
      setEditCell(null)
      return
    }
    const value = EDIT_NUMERIC_FIELDS.includes(cell.field) ? Number(trimmed || 0) : trimmed
    gridUpdateMutation.mutate({ id: cell.id, patch: { [cell.field]: value } })
    setEditCell(null)
  }

  const saveStatus = (id: string, saleStatus: SaleStatus) => {
    gridUpdateMutation.mutate({ id, patch: { saleStatus } })
  }

  const openGridClientPicker = (product: Product) => {
    setClientTargetProduct(product)
    setClientPickerSearch('')
    setShowClientPicker(true)
  }

  const closeClientPicker = () => {
    setShowClientPicker(false)
    setClientTargetProduct(null)
  }

  const selectClient = (client: ClientOption) => {
    if (clientTargetProduct) {
      gridUpdateMutation.mutate({
        id: clientTargetProduct.id,
        patch: { clientId: client.id },
      })
      closeClientPicker()
      return
    }

    setSelectedClient(client)
    setForm((p) => ({ ...p, clientId: client.id }))
    setShowClientPicker(false)
  }

  const openGridLocationPicker = (product: Product) => {
    setLocationTargetProduct(product)
    setLocationPickerSearch('')
    setShowLocationPicker(true)
  }

  const closeLocationPicker = () => {
    setShowLocationPicker(false)
    setLocationTargetProduct(null)
  }

  const selectLocation = (loc: Location) => {
    if (locationTargetProduct) {
      gridUpdateMutation.mutate({
        id: locationTargetProduct.id,
        patch: { locationId: loc.id },
      })
      closeLocationPicker()
      return
    }

    setSelectedLocation(loc)
    setForm((p) => ({ ...p, locationId: loc.id }))
    setShowLocationPicker(false)
  }

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_PRODUCT_FORM)
    setSelectedClient(null)
    setSelectedLocation(null)
    setShowModal(true)
  }

  const openEdit = (product: Product) => {
    setEditing(product)
    setForm({
      code:         product.code,
      name:         product.name,
      category:     product.category ?? '',
      clientId:     product.clientId ?? product.client?.id ?? '',
      locationId:   product.locationId ?? product.defaultLocation?.id ?? '',
      unit:         product.unit ?? 'EA',
      baseUnit:     product.baseUnit ?? 'EA',
      pUnitQty:     product.pUnitQty ?? 0,
      boxUnitQty:   product.boxUnitQty ?? product.boxQty ?? 1,
      plUnitQty:    product.plUnitQty ?? 0,
      spec:         product.spec ?? '',
      materialNo:   product.materialNo ?? '',
      boxQty:       product.boxQty,
      safetyStock:  product.safetyStock,
      reorderPoint: product.reorderPoint,
      costPrice:    Number(product.costPrice ?? 0),
      sellPrice:    Number(product.sellPrice ?? 0),
      priceB:       Number(product.priceB ?? 0),
      priceA:       Number(product.priceA ?? 0),
      priceC:       Number(product.priceC ?? 0),
      retailPrice:  Number(product.retailPrice ?? 0),
      memo:         product.memo ?? '',
      saleStatus:   product.saleStatus,
      initialStockEA: 0,
    })
    setSelectedClient(product.client ?? null)
    setSelectedLocation(product.defaultLocation ?? null)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditing(null)
    setForm(EMPTY_PRODUCT_FORM)
    setSelectedClient(null)
    setSelectedLocation(null)
    setShowAddBc(false)
    setNewBcVal(''); setNewBcType('UNIT'); setNewBcQty(1); setNewBcPrimary(false)
    setPendingBarcodes([])
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
    const ids = productRows.map((p) => p.id)
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
    toast.success(`${formatNumber(ids.length)}개 상품이 삭제되었습니다`)
    setSelectedIds(new Set())
  }

  const handleEditSelected = () => {
    const id = [...selectedIds][0]
    const product = productRows.find((p) => p.id === id)
    if (product) openEdit(product)
  }

  const currentPageIds = productRows.map((p) => p.id)
  const selectedProductIds = useMemo(
    () => Array.from(new Set(productRows.filter((p) => selectedIds.has(p.id)).map((p) => p.id))),
    [productRows, selectedIds],
  )

  const handlePrintSelected = (docType: 'STATEMENT' | 'QUOTE') => {
    const selected = productRows.filter((p) => selectedProductIds.includes(p.id))
    if (selected.length === 0) {
      toast.error('출력할 상품을 먼저 선택해주세요')
      return
    }
    const today = new Date().toISOString().slice(0, 10)
    const items = selected.map((p, idx) => ({
      id: String(idx),
      productId: p.id,
      productCode: p.code,
      productName: p.name,
      unit: p.unit ?? '',
      qty: 1,
      unitPrice: Number(p.sellPrice ?? 0),
      amount: Number(p.sellPrice ?? 0),
      sortOrder: idx,
    }))
    const draftQuote = {
      id: '', docNo: '', docType,
      clientId: undefined, clientName: '',
      docDate: today, memo: '',
      totalAmount: items.reduce((s, it) => s + it.amount, 0),
      status: 'DRAFT' as const,
      createdBy: '', createdAt: today,
      items,
    }
    printQuoteDocument(draftQuote, null, null, supplierInfo, docType === 'QUOTE' ? '견적서' : undefined)
  }

  const allChecked = currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.has(id))
  const someChecked = currentPageIds.some((id) => selectedIds.has(id))


  const openQuoteScreen = () => {
    const ids = [...selectedIds]
    if (ids.length === 0) {
      toast.error('상품을 먼저 선택해주세요')
      return
    }
    router.push(`/quotes?productIds=${encodeURIComponent(ids.join(','))}`)
  }
  const openPurchaseOrder = () => router.push('/quotes?tab=PURCHASE')

  return (
    <div className="flex h-[calc(100vh-118px)] min-h-0 flex-col gap-2 overflow-hidden">
      {/* 타이틀 */}
      <div>
        <div className="min-w-[120px] flex-1">
          <h2 className="whitespace-nowrap text-base font-bold text-gray-900 dark:text-white tracking-tight">상품 관리</h2>
          {data && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              전체 {formatNumber(data.total ?? data.items.length)}개 상품
            </p>
          )}
        </div>
      </div>

      {/* 검색/필터 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded p-1.5">
        <div className="flex flex-col gap-1 md:flex-row">
          <div className="relative flex-1">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1) } }}
              placeholder="거래처, 상품코드, 자재번호, 상품명, 위치, 카테고리, 상태 검색"
              className="w-full pl-3 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-[#2D4033]/30 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 transition-colors"
            />
          </div>
          <button
            onClick={() => { setSearch(searchInput); setPage(1) }}
            className="px-3 py-1.5 text-sm bg-[#2D4033] text-white rounded hover:bg-[#253628] transition-colors font-medium whitespace-nowrap"
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
            ! 안전재고 경고만
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchInput('')
              setSearch('')
              setShowSafetyOnly(false)
              setPage(1)
            }}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium whitespace-nowrap"
          >
            초기화
          </button>
        </div>
      </div>

      {/* 선택 액션 바 */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-[#2D4033] text-white px-3 py-2 rounded">
          <span className="text-sm font-semibold flex-1">{formatNumber(selectedIds.size)}개 선택됨</span>
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/80 hover:bg-red-600 rounded-lg text-sm font-medium transition-colors"
          >
            삭제
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            title="선택 해제"
          >
            닫기
          </button>
        </div>
      )}

      {/* 테이블 */}
      <ProductInventoryGrid
        products={productRows}
        onBarcodeClick={setBarcodeModal}
        onRefresh={async () => {
          await Promise.all([
            qc.refetchQueries({ queryKey: ['products'] }),
            qc.refetchQueries({ queryKey: ['inventory'] }),
          ])
        }}
        onSaved={() => {
          invalidateAll()
          setSelectedIds(new Set())
        }}
        overflowActions={(
          <>
            <ExportButton
              filename="상품목록"
              getData={async () => {
                const all = await productApi.findAll({ search: search || undefined, limit: 9999 })
                return all.items.map((p: Product) => ({
                  '상품코드': p.code,
                  '자재번호': p.materialNo ?? '',
                  '상품명': p.name,
                  '위치': p.defaultLocation?.code ?? '-',
                  '기준단위': p.unit || 'EA',
                  'EA': getTotalEA(p),
                  'P': getInboxStock(p),
                  'BOX': getOutboxStock(p),
                  'PL': getPlStock(p),
                  '카테고리': p.category ?? '',
                  '거래처명': p.client?.name ?? '',
                  '매입가': p.costPrice ?? 0,
                  '판매가': p.sellPrice ?? 0,
                  '소매단가': p.retailPrice ?? 0,
                  'SSG 단가': p.priceB ?? 0,
                  '해피미르 단가': p.priceA ?? 0,
                  'C단가': p.priceC ?? 0,
                  '바코드': getPrimaryBarcode(p.barcodes),
                  '메모': p.memo ?? '',
                  '현재고': getTotalEA(p),
                  '예약': 0,
                  '가용': getTotalEA(p),
                  '안전재고': p.safetyStock,
                  '상태': SALE_STATUS_LABEL[p.saleStatus],
                  '등록일': formatDateTime(p.createdAt),
                }))
              }}
            />
            <ImportButton onImported={() => qc.invalidateQueries({ queryKey: ['products'] })} />
            {canAccessQuotes && (
              <button
                onClick={openQuoteScreen}
                disabled={selectedIds.size === 0}
                title="거래명세서/견적서"
                className="inline-flex h-7 items-center gap-1 rounded border border-emerald-200 bg-white px-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
              >
                <FileText size={14} /> 견적서
              </button>
            )}
            <button
              onClick={openPurchaseOrder}
              title="발주서 생성"
              className="inline-flex h-7 items-center gap-1 rounded border border-orange-200 bg-white px-2 text-xs font-medium text-orange-700 hover:bg-orange-50"
            >
              <ShoppingCart size={14} /> 발주서
            </button>
          </>
        )}
      />

      {/* 페이지네이션 */}
      {data && data.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors font-medium"
          >
            이전
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
            {formatNumber(page)} / {formatNumber(data.totalPages)}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            10개씩 보기
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page === data.totalPages}
            className="px-3 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors font-medium"
          >
            다음
          </button>
        </div>
      )}

      {/* 거래처 검색 팝업 */}
      {showClientPicker && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 flex flex-col max-h-[80vh]">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/30 shrink-0">
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">거래처 검색</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">선택하면 거래처명이 자동 입력됩니다</p>
              </div>
              <button
                onClick={closeClientPicker}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                닫기
              </button>
            </div>

            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <div className="relative">
                <input
                  autoFocus
                  type="text"
                  placeholder="거래처명 검색..."
                  value={clientPickerSearch}
                  onChange={(e) => setClientPickerSearch(e.target.value)}
                  className="w-full pl-3 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {filteredClients.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">
                  {clientPickerSearch ? '검색 결과 없음' : '등록된 거래처가 없습니다'}
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredClients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectClient(c)}
                      className="w-full px-5 py-3 text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{c.name}</p>
                      {(c.phone || c.businessNo) && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {[c.businessNo, c.phone].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 shrink-0">
              <button
                type="button"
                onClick={closeClientPicker}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {barcodeModal && (
        <ProductBarcodeModal
          product={barcodeModal}
          onClose={() => setBarcodeModal(null)}
        />
      )}

      {/* 보관위치 검색 팝업 */}
      {showLocationPicker && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 flex flex-col max-h-[80vh]">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30 shrink-0">
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">보관위치 선택</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">창고에 등록된 위치 중에서 선택하세요</p>
              </div>
              <button
                onClick={closeLocationPicker}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                닫기
              </button>
            </div>

            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <div className="relative">
                <input
                  autoFocus
                  type="text"
                  placeholder="위치 코드 검색 (예: A-01)"
                  value={locationPickerSearch}
                  onChange={(e) => setLocationPickerSearch(e.target.value)}
                  className="w-full pl-3 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {locationsLoading ? (
                <div className="py-12 text-center text-gray-400 text-sm">
                  <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-emerald-500" />
                  위치 목록 불러오는 중...
                </div>
              ) : filteredLocations.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">
                  {locationPickerSearch ? '검색 결과 없음' : '등록된 위치가 없습니다'}
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredLocations.map((loc) => (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => selectLocation(loc)}
                      className="w-full px-5 py-3 text-left hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                    >
                      <p className="text-sm font-mono font-medium text-gray-800 dark:text-gray-100">{loc.code}</p>
                      {(loc.aisle || loc.rack) && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {[loc.aisle && `통로 ${loc.aisle}`, loc.rack && `랙 ${loc.rack}`, loc.shelf && `선반 ${loc.shelf}`].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 shrink-0">
              <button
                type="button"
                onClick={closeLocationPicker}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
