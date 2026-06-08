'use client'
import { useState, useCallback, useMemo } from 'react'
import { useColumnResize } from '@/hooks/useColumnResize'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query'
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Building2, FileText, MapPin, Package, Search, Plus, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { productApi, unitApi } from '@/api/product.api'
import { clientApi } from '@/api/client.api'
import { warehouseApi } from '@/api/warehouse.api'
import { stockApi } from '@/api/stock.api'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { SALE_STATUS_LABEL } from '@/constants/stock.constants'
import { cn } from '@/utils/cn'
import { formatNumber } from '@/utils/format'
import { ExportButton } from '@/components/ExportButton'
import { ImportButton } from '@/components/ImportButton'
import type { Barcode, BarcodeUnitType, Client, Inventory, Location, Product, SaleStatus, ProductUnit } from '@/types/api.types'
import { ProductBarcodeModal } from '@/components/ProductBarcodeModal'
import { CategorySelect } from '@/components/CategorySelect'

/* ─── EditableCell (top-level to prevent remount on parent re-render) ───── */
type EditField =
  | 'code' | 'name' | 'category' | 'optionName' | 'spec' | 'materialNo'
  | 'unit' | 'boxQty' | 'boxStock' | 'costPrice' | 'sellPrice' | 'retailPrice'
  | 'priceA' | 'priceB' | 'priceC' | 'memo'
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
  const isNumeric = ['boxQty', 'boxStock', 'costPrice', 'sellPrice', 'retailPrice', 'priceA', 'priceB', 'priceC'].includes(field)

  if (isEditing) {
    if (field === 'unit' && unitOptions) {
      return (
        <select
          autoFocus
          value={editCell.value}
          onChange={(e) => setEditCell({ ...editCell, value: e.target.value })}
          onBlur={() => onSave(editCell)}
          className="h-8 w-24 rounded-lg border border-indigo-400 bg-white px-2 text-center text-sm outline-none dark:bg-gray-800"
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
          'h-8 w-full min-w-[80px] rounded-lg border border-indigo-400 bg-white px-2 text-sm outline-none dark:bg-gray-800',
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
        'block h-8 w-full min-w-0 rounded-lg px-2 leading-8 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors',
        align === 'center' ? 'text-center' : align === 'right' ? 'text-right tabular-nums' : 'text-left',
      )}
    >
      <span className={cn(
        'block truncate text-sm',
        display ? 'text-gray-800 dark:text-gray-200' : 'text-gray-300 dark:text-gray-700 italic text-xs',
      )}>
        {displayValue ?? '—'}
      </span>
    </button>
  )
}

/* ─── Constants ──────────────────────────────────────────────────────────── */
const EMPTY_FORM = {
  code: '', name: '', category: '',
  clientId: '', locationId: '',
  unit: 'EA', boxQty: 1, safetyStock: 0, reorderPoint: 0,
  costPrice: 0, sellPrice: 0, retailPrice: 0,
  priceA: 0, priceB: 0, priceC: 0,
  spec: '', materialNo: '', memo: '',
  saleStatus: 'ACTIVE' as SaleStatus,
}

type ClientOption = Pick<Client, 'id' | 'name' | 'phone' | 'email'>
type SortDirection = 'asc' | 'desc'
type MasterSortKey =
  | 'client' | 'code' | 'materialNo' | 'name' | 'category' | 'optionName' | 'spec' | 'location'
  | 'costPrice' | 'sellPrice' | 'retailPrice' | 'priceA' | 'priceB' | 'priceC' | 'unit'
  | 'boxQty' | 'boxStock' | 'boxCost' | 'boxSell' | 'totalAmount'
  | 'barcodeType' | 'barcode' | 'saleStatus' | 'inventoryLocations' | 'memo'
type MasterSortState = { key: MasterSortKey; direction: SortDirection } | null

const STATUS_CLS: Record<SaleStatus, string> = {
  ACTIVE:       'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  INACTIVE:     'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
  DISCONTINUED: 'bg-rose-100 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400',
}

const BARCODE_TYPE_LABEL: Record<BarcodeUnitType, string> = {
  UNIT: '낱개',
  CXD:  'CXD 낱개',
  CXD_BOX: 'CXD BOX',
}

const BARCODE_TYPE_CLS: Record<BarcodeUnitType, string> = {
  UNIT: 'bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900/60',
  CXD:  'bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900/60',
  CXD_BOX: 'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/60',
}

const toNumber = (value?: number) => Number(value ?? 0)
const getBoxStockQty = (product: Product) => toNumber(product.stockQty)
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

const getMasterSortValue = (
  product: Product,
  key: MasterSortKey,
  barcodes: Barcode[] | undefined,
  locations: string,
) => {
  const barcode = pickBarcode(barcodes)
  switch (key) {
    case 'client': return product.client?.name
    case 'code': return product.code
    case 'materialNo': return product.materialNo
    case 'name': return product.name
    case 'category': return product.category
    case 'optionName': return product.optionName
    case 'spec': return product.spec
    case 'location': return product.defaultLocation?.code
    case 'costPrice': return product.costPrice
    case 'sellPrice': return product.sellPrice
    case 'retailPrice': return product.retailPrice
    case 'priceA': return product.priceA
    case 'priceB': return product.priceB
    case 'priceC': return product.priceC
    case 'unit': return product.unit
    case 'boxQty': return product.boxQty
    case 'boxStock': return getBoxStockQty(product)
    case 'boxCost': return getBoxCostPrice(product)
    case 'boxSell': return getBoxSellPrice(product)
    case 'totalAmount': return getTotalAmount(product)
    case 'barcodeType': return barcode ? BARCODE_TYPE_LABEL[barcode.type] : ''
    case 'barcode': return barcode?.barcode
    case 'saleStatus': return SALE_STATUS_LABEL[product.saleStatus]
    case 'inventoryLocations': return locations
    case 'memo': return product.memo
    default: return ''
  }
}

const MASTER_TH = 'text-center px-2 py-3 font-semibold bg-[#2D4033] text-white'

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
  style,
  onResizeStart,
}: {
  label: string
  sortKey: MasterSortKey
  sort: MasterSortState
  onSort: (key: MasterSortKey) => void
  className?: string
  style?: React.CSSProperties
  onResizeStart?: (e: React.MouseEvent) => void
}) {
  const active = sort?.key === sortKey
  const Icon = active ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <th className={cn(MASTER_TH, 'wms-resizable-th', className)} style={style}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'mx-auto flex w-full items-center justify-center gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-indigo-100/70 dark:hover:bg-indigo-900/50',
          active && 'text-indigo-700 dark:text-indigo-300',
        )}
        title={`${label} 정렬`}
      >
        <span>{label}</span>
        <Icon size={12} className={active ? 'opacity-100' : 'opacity-45'} />
      </button>
      {onResizeStart && (
        <div className="wms-column-resizer" onMouseDown={onResizeStart} />
      )}
    </th>
  )
}

function StatusEditableCell({
  product,
  onSave,
}: {
  product: Product
  onSave: (id: string, saleStatus: SaleStatus) => void
}) {
  return (
    <select
      value={product.saleStatus}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onSave(product.id, e.target.value as SaleStatus)}
      className={cn('h-7 rounded-full border-0 px-2 text-[10px] font-semibold outline-none', STATUS_CLS[product.saleStatus])}
      title="상태 수정"
    >
      {Object.entries(SALE_STATUS_LABEL).map(([value, label]) => (
        <option key={value} value={value}>{label}</option>
      ))}
    </select>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function ProductMasterPage() {
  const qc = useQueryClient()
  const router = useRouter()
  const warehouse = useWarehouseStore((s) => s.selectedWarehouse)
  const [searchInput, setSearchInput]  = useState('')
  const [search, setSearch]           = useState('')
  const [sort, setSort]               = useState<MasterSortState>(null)
  const [showSafetyOnly, setShowSafetyOnly] = useState(false)
  const [editCell, setEditCell]       = useState<EditCell | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showAdd, setShowAdd]         = useState(false)
  const [form, setForm]               = useState(EMPTY_FORM)
  const [showClientPicker, setShowClientPicker] = useState(false)
  const [clientPickerSearch, setClientPickerSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null)
  const [clientTargetProduct, setClientTargetProduct] = useState<Product | null>(null)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [locationPickerSearch, setLocationPickerSearch] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [locationTargetProduct, setLocationTargetProduct] = useState<Product | null>(null)
  const [barcodeModal, setBarcodeModal] = useState<Product | null>(null)
  const [pendingBarcodes, setPendingBarcodes] = useState<Array<{ barcode: string; type: BarcodeUnitType; unitQty: number; isPrimary: boolean }>>([])
  const [showAddBc, setShowAddBc] = useState(false)
  const [newBcVal, setNewBcVal] = useState('')
  const [newBcType, setNewBcType] = useState<BarcodeUnitType>('UNIT')
  const [newBcQty, setNewBcQty] = useState(1)
  const [newBcPrimary, setNewBcPrimary] = useState(false)

  const MASTER_COLS = useMemo(() => ({
    chk:              { width: 40,  minWidth: 40,  sticky: true },
    seq:              { width: 48,  minWidth: 40,  sticky: true },
    client:           { width: 144, minWidth: 40,  sticky: true },
    code:             { width: 144, minWidth: 40,  sticky: true },
    materialNo:       { width: 144, minWidth: 40,  sticky: true },
    barcode:          { width: 144, minWidth: 40,  sticky: true },
    name:             { width: 192, minWidth: 48,  sticky: true },
    category:         { width: 110, minWidth: 60,  sticky: true },
    optionName:       { width: 110, minWidth: 60,  sticky: false },
    spec:             { width: 110, minWidth: 60,  sticky: false },
    location:         { width: 110, minWidth: 60,  sticky: false },
    costPrice:        { width: 90,  minWidth: 60,  sticky: false },
    sellPrice:        { width: 90,  minWidth: 60,  sticky: false },
    retailPrice:      { width: 90,  minWidth: 60,  sticky: false },
    priceA:           { width: 90,  minWidth: 60,  sticky: false },
    priceB:           { width: 90,  minWidth: 60,  sticky: false },
    priceC:           { width: 90,  minWidth: 60,  sticky: false },
    unit:             { width: 80,  minWidth: 50,  sticky: false },
    boxQty:           { width: 110, minWidth: 60,  sticky: false },
    boxStock:         { width: 110, minWidth: 60,  sticky: false },
    boxCost:          { width: 110, minWidth: 60,  sticky: false },
    boxSell:          { width: 110, minWidth: 60,  sticky: false },
    totalAmount:      { width: 110, minWidth: 60,  sticky: false },
    barcodeType:      { width: 90,  minWidth: 60,  sticky: false },
    saleStatus:       { width: 80,  minWidth: 60,  sticky: false },
    inventoryLocs:    { width: 120, minWidth: 60,  sticky: false },
    memo:             { width: 180, minWidth: 60,  sticky: false },
    actions:          { width: 40,  minWidth: 40,  sticky: false },
  }), [])

  const { widths: cw, startResize, stickyLeftOf, totalWidth, resetWidths } = useColumnResize('product-attrs', MASTER_COLS)

  const { data, isLoading } = useQuery({
    queryKey: ['products', search],
    queryFn:  () => productApi.findAll({ search, limit: 200 }),
  })

  const { data: units } = useQuery({
    queryKey: ['product-units'],
    queryFn:  () => unitApi.findAll(),
  })

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients-all'],
    queryFn:  () => clientApi.findAllActive(),
    enabled:  showAdd || showClientPicker,
    placeholderData: [],
  })

  const { data: allLocations = [], isLoading: locationsLoading } = useQuery<Location[]>({
    queryKey: ['locations-for-product-master-form', warehouse?.id],
    queryFn:  () => warehouseApi.findLocations(warehouse!.id),
    enabled:  !!warehouse?.id,
    placeholderData: [],
    staleTime: 60_000,
  })

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory', 'product-master', warehouse?.id ?? ''],
    queryFn:  () => stockApi.getInventory(warehouse!.id),
    enabled:  !!warehouse?.id,
  })

  const filteredClients = clients.filter((c) => {
    const q = clientPickerSearch.trim().toLowerCase()
    if (!q) return true
    return [c.name, c.businessNo, c.phone, c.contactName, c.managerName]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q))
  }).slice(0, 50)

  const filteredLocations = allLocations.filter((l) => {
    const q = locationPickerSearch.trim().toLowerCase()
    if (!q) return true
    return [l.code, l.aisle, l.rack, l.shelf, l.bin]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q))
  }).slice(0, 80)

  const selectedClientLabel = selectedClient?.name
    ?? clients.find((c) => c.id === form.clientId)?.name
    ?? ''

  const selectedLocationLabel = selectedLocation?.code
    ?? allLocations.find((l) => l.id === form.locationId)?.code
    ?? ''

  const createMutation = useMutation({
    mutationFn: async () => {
      const product = await productApi.create(form)
      for (const bc of pendingBarcodes) {
        await productApi.addBarcode(product.id, bc)
      }
      return product
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      setShowAdd(false)
      setForm(EMPTY_FORM)
      setSelectedClient(null)
      setSelectedLocation(null)
      setPendingBarcodes([])
      setShowAddBc(false)
      setNewBcVal(''); setNewBcType('UNIT'); setNewBcQty(1); setNewBcPrimary(false)
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
    const optionalFields: EditField[] = ['category', 'optionName', 'spec', 'materialNo', 'memo']
    const numericFields: EditField[] = ['boxQty', 'boxStock', 'costPrice', 'sellPrice', 'retailPrice', 'priceA', 'priceB', 'priceC']
    if (!trimmed && !optionalFields.includes(cell.field) && !numericFields.includes(cell.field)) {
      setEditCell(null)
      return
    }
    if (cell.field === 'boxStock') {
      const product = (data?.items ?? []).find((p) => p.id === cell.id)
      if (!product) {
        setEditCell(null)
        return
      }
      adjustBoxStockQty({
        product,
        targetQty: Number(trimmed || 0),
        warehouseId: warehouse?.id,
        inventoryItems: inventory.filter((inv) => inv.productId === cell.id),
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
    const patch: Partial<Product> = {
      [cell.field]: numericFields.includes(cell.field) ? Number(trimmed || 0) : trimmed,
    }
    updateMutation.mutate({ id: cell.id, patch })
    setEditCell(null)
  }, [data?.items, inventory, qc, updateMutation, warehouse?.id])

  const saveStatus = useCallback((id: string, saleStatus: SaleStatus) => {
    updateMutation.mutate({ id, patch: { saleStatus } })
  }, [updateMutation])

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
      updateMutation.mutate({
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

  const selectLocation = (location: Location) => {
    if (locationTargetProduct) {
      updateMutation.mutate({
        id: locationTargetProduct.id,
        patch: { locationId: location.id },
      })
      closeLocationPicker()
      return
    }

    setSelectedLocation(location)
    setForm((p) => ({ ...p, locationId: location.id }))
    setShowLocationPicker(false)
  }

  const handleBulkDelete = async () => {
    if (!confirm(`선택한 ${selectedIds.size}개 상품을 삭제하시겠습니까?`)) return
    for (const id of [...selectedIds]) {
      await deleteMutation.mutateAsync(id)
    }
    toast.success(`${selectedIds.size}개 상품이 삭제되었습니다`)
    setSelectedIds(new Set())
  }

  const toggleSort = (key: MasterSortKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' }
      if (prev.direction === 'asc') return { key, direction: 'desc' }
      return null
    })
  }

  const products: Product[]        = useMemo(() => data?.items ?? [], [data?.items])
  const unitOptions: ProductUnit[] = units ?? []
  const inventorySummary = useMemo(() => buildInventorySummary(inventory), [inventory])
  const productsWithInventoryBase = useMemo(
    () => products.map((product) => ({
      ...product,
      stockQty: inventorySummary.get(product.id)?.stockQty ?? product.stockQty ?? 0,
    })),
    [inventorySummary, products],
  )
  const barcodeResults = useQueries({
    queries: products.map((product) => ({
      queryKey: ['barcodes', product.id],
      queryFn:  () => productApi.findBarcodes(product.id),
      staleTime: 60_000,
    })),
  })
  const barcodeMap = useMemo(
    () => new Map<string, Barcode[]>(products.map((product, index) => [product.id, barcodeResults[index]?.data ?? []])),
    [barcodeResults, products],
  )
  const productsWithInventory = useMemo(() => {
    const rows = showSafetyOnly
      ? productsWithInventoryBase.filter((p) => getBoxStockQty(p) < p.safetyStock)
      : productsWithInventoryBase
    if (!sort) return rows
    return [...rows].sort((a, b) => {
      const aLocations = inventorySummary.get(a.id)?.locations.join(', ') ?? ''
      const bLocations = inventorySummary.get(b.id)?.locations.join(', ') ?? ''
      return compareSortValue(
        getMasterSortValue(a, sort.key, barcodeMap.get(a.id), aLocations),
        getMasterSortValue(b, sort.key, barcodeMap.get(b.id), bLocations),
        sort.direction,
      )
    })
  }, [barcodeMap, inventorySummary, productsWithInventoryBase, showSafetyOnly, sort])
  const allChecked  = productsWithInventory.length > 0 && productsWithInventory.every((p) => selectedIds.has(p.id))
  const someChecked = productsWithInventory.some((p) => selectedIds.has(p.id))

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
                  '자재번호': p.materialNo ?? '',
                  '상품명': p.name,
                  '카테고리': p.category ?? '',
                  '옵션': p.optionName ?? '',
                  '규격': p.spec ?? '',
                  '거래처': p.client?.name ?? '',
                  '기본 위치': p.defaultLocation?.code ?? '',
                  '원가': p.costPrice ?? 0,
                  '판매가': p.sellPrice ?? 0,
                  '소매단가': p.retailPrice ?? 0,
                  '해피미르 단가': p.priceA ?? 0,
                  '네이버 단가': p.priceB ?? 0,
                  'SSG 단가': p.priceC ?? 0,
                  '단위': p.unit,
                  '낱개 갯수(박스당)': p.boxQty,
                  '재고수량(박스)': getBoxStockQty({ ...p, stockQty: inventorySummary.get(p.id)?.stockQty ?? p.stockQty ?? 0 }),
                  '원가(박스)': getBoxCostPrice(p),
                  '판매가(박스)': getBoxSellPrice(p),
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
          <ImportButton
            onImported={() => qc.invalidateQueries({ queryKey: ['products'] })}
          />
          <button
            onClick={() => {
              setShowAdd(true)
              setForm(EMPTY_FORM)
              setSelectedClient(null)
              setSelectedLocation(null)
            }}
            title="상품 추가"
            aria-label="상품 추가"
            className="responsive-icon-action bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-500/20"
          >
            <Plus size={14} /><span className="responsive-action-label">상품 추가</span>
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
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-3 shadow-sm">
        <div className="flex flex-col gap-2.5 md:flex-row">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setSearch(searchInput) }}
              placeholder="거래처, 상품코드, 자재번호, 상품명, 위치, 카테고리, 상태 검색"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 transition-shadow"
            />
          </div>
          <button
            onClick={() => setSearch(searchInput)}
            className="px-3.5 py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
          >
            검색
          </button>
          <button
            type="button"
            onClick={() => setShowSafetyOnly((prev) => !prev)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border transition-colors font-medium whitespace-nowrap',
              showSafetyOnly
                ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800',
            )}
          >
            <AlertTriangle size={14} />
            안전재고 경고만
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchInput('')
              setSearch('')
              setShowSafetyOnly(false)
            }}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium whitespace-nowrap"
          >
            초기화
          </button>
          <button
            type="button"
            onClick={resetWidths}
            className="hidden sm:block px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium whitespace-nowrap"
            title="컬럼 너비를 기본값으로 초기화"
          >
            컬럼 초기화
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
          <table
            className="mobile-unpin-grid wms-no-resize wms-resizable-table text-sm border-separate border-spacing-0 [&_td]:border-r [&_td]:border-gray-100 [&_th]:border-r [&_th]:border-gray-200 dark:[&_td]:border-gray-800 dark:[&_th]:border-gray-700"
            style={{ width: totalWidth, minWidth: totalWidth, maxWidth: totalWidth }}
          >
            <colgroup>
              {Object.keys(MASTER_COLS).map((key) => (
                <col key={key} style={{ width: cw[key] }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-40">
              <tr className="bg-[#2D4033]">
                <th className="sticky-col sticky z-30 px-4 py-3 bg-[#2D4033] wms-resizable-th overflow-hidden"
                    style={{ width: cw.chk, minWidth: cw.chk, maxWidth: cw.chk, left: stickyLeftOf('chk') }}>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked }}
                    onChange={() => {
                      if (allChecked) setSelectedIds(new Set())
                      else setSelectedIds(new Set(productsWithInventory.map((p) => p.id)))
                    }}
                    className="rounded accent-indigo-600 cursor-pointer"
                  />
                  <div className="wms-column-resizer" onMouseDown={(e) => startResize('chk', e)} />
                </th>
                <th className={cn(MASTER_TH, 'sticky-col sticky z-30 wms-resizable-th overflow-hidden')} style={{ width: cw.seq, minWidth: cw.seq, maxWidth: cw.seq, left: stickyLeftOf('seq') }}>
                  #
                  <div className="wms-column-resizer" onMouseDown={(e) => startResize('seq', e)} />
                </th>
                <SortHeader label="거래처" sortKey="client" sort={sort} onSort={toggleSort} className="sticky-col sticky z-30" style={{ width: cw.client, minWidth: cw.client, maxWidth: cw.client, left: stickyLeftOf('client') }} onResizeStart={(e) => startResize('client', e)} />
                <SortHeader label="상품 코드" sortKey="code" sort={sort} onSort={toggleSort} className="sticky-col sticky z-30" style={{ width: cw.code, minWidth: cw.code, maxWidth: cw.code, left: stickyLeftOf('code') }} onResizeStart={(e) => startResize('code', e)} />
                <SortHeader label="자재번호" sortKey="materialNo" sort={sort} onSort={toggleSort} className="sticky-col sticky z-30" style={{ width: cw.materialNo, minWidth: cw.materialNo, maxWidth: cw.materialNo, left: stickyLeftOf('materialNo') }} onResizeStart={(e) => startResize('materialNo', e)} />
                <SortHeader label="바코드" sortKey="barcode" sort={sort} onSort={toggleSort} className="sticky-col sticky z-30" style={{ width: cw.barcode, minWidth: cw.barcode, maxWidth: cw.barcode, left: stickyLeftOf('barcode') }} onResizeStart={(e) => startResize('barcode', e)} />
                <SortHeader label="상품명" sortKey="name" sort={sort} onSort={toggleSort} className="sticky-col sticky z-30" style={{ width: cw.name, minWidth: cw.name, maxWidth: cw.name, left: stickyLeftOf('name') }} onResizeStart={(e) => startResize('name', e)} />
                <SortHeader label="카테고리" sortKey="category" sort={sort} onSort={toggleSort} className="sticky-col sticky z-30 shadow-[3px_0_5px_-3px_rgba(0,0,0,0.35)]" style={{ width: cw.category, minWidth: cw.category, maxWidth: cw.category, left: stickyLeftOf('category') }} onResizeStart={(e) => startResize('category', e)} />
                <SortHeader label="옵션" sortKey="optionName" sort={sort} onSort={toggleSort} style={{ width: cw.optionName }} onResizeStart={(e) => startResize('optionName', e)} />
                <SortHeader label="규격" sortKey="spec" sort={sort} onSort={toggleSort} style={{ width: cw.spec }} onResizeStart={(e) => startResize('spec', e)} />
                <SortHeader label="기본 위치" sortKey="location" sort={sort} onSort={toggleSort} style={{ width: cw.location }} onResizeStart={(e) => startResize('location', e)} />
                <SortHeader label="원가" sortKey="costPrice" sort={sort} onSort={toggleSort} className="text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/30" style={{ width: cw.costPrice }} onResizeStart={(e) => startResize('costPrice', e)} />
                <SortHeader label="판매가" sortKey="sellPrice" sort={sort} onSort={toggleSort} style={{ width: cw.sellPrice }} onResizeStart={(e) => startResize('sellPrice', e)} />
                <SortHeader label="소매단가" sortKey="retailPrice" sort={sort} onSort={toggleSort} style={{ width: cw.retailPrice }} onResizeStart={(e) => startResize('retailPrice', e)} />
                <SortHeader label="해피미르 단가" sortKey="priceA" sort={sort} onSort={toggleSort} style={{ width: cw.priceA }} onResizeStart={(e) => startResize('priceA', e)} />
                <SortHeader label="네이버 단가" sortKey="priceB" sort={sort} onSort={toggleSort} style={{ width: cw.priceB }} onResizeStart={(e) => startResize('priceB', e)} />
                <SortHeader label="SSG 단가" sortKey="priceC" sort={sort} onSort={toggleSort} style={{ width: cw.priceC }} onResizeStart={(e) => startResize('priceC', e)} />
                <SortHeader label="단위" sortKey="unit" sort={sort} onSort={toggleSort} style={{ width: cw.unit }} onResizeStart={(e) => startResize('unit', e)} />
                <SortHeader label="낱개 갯수(박스당)" sortKey="boxQty" sort={sort} onSort={toggleSort} className="text-sky-700 dark:text-sky-300 bg-sky-50/80 dark:bg-sky-950/30" style={{ width: cw.boxQty }} onResizeStart={(e) => startResize('boxQty', e)} />
                <SortHeader label="박스 재고수량" sortKey="boxStock" sort={sort} onSort={toggleSort} style={{ width: cw.boxStock }} onResizeStart={(e) => startResize('boxStock', e)} />
                <SortHeader label="원가(박스)" sortKey="boxCost" sort={sort} onSort={toggleSort} style={{ width: cw.boxCost }} onResizeStart={(e) => startResize('boxCost', e)} />
                <SortHeader label="판매가(박스)" sortKey="boxSell" sort={sort} onSort={toggleSort} style={{ width: cw.boxSell }} onResizeStart={(e) => startResize('boxSell', e)} />
                <SortHeader label="총금액" sortKey="totalAmount" sort={sort} onSort={toggleSort} className="text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/30" style={{ width: cw.totalAmount }} onResizeStart={(e) => startResize('totalAmount', e)} />
                <SortHeader label="바코드 종류" sortKey="barcodeType" sort={sort} onSort={toggleSort} style={{ width: cw.barcodeType }} onResizeStart={(e) => startResize('barcodeType', e)} />
                <SortHeader label="상태" sortKey="saleStatus" sort={sort} onSort={toggleSort} style={{ width: cw.saleStatus }} onResizeStart={(e) => startResize('saleStatus', e)} />
                <SortHeader label="위치" sortKey="inventoryLocations" sort={sort} onSort={toggleSort} style={{ width: cw.inventoryLocs }} onResizeStart={(e) => startResize('inventoryLocs', e)} />
                <SortHeader label="메모" sortKey="memo" sort={sort} onSort={toggleSort} style={{ width: cw.memo }} onResizeStart={(e) => startResize('memo', e)} />
                <th className="bg-[#2D4033]" style={{ width: cw.actions }} />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={27} className="text-center py-10 text-gray-400 text-sm">불러오는 중...</td></tr>
              )}
              {!isLoading && productsWithInventory.length === 0 && (
                <tr><td colSpan={27} className="text-center py-10 text-gray-300 text-sm">
                  {showSafetyOnly ? '안전재고 경고 상품이 없습니다' : '표시할 상품이 없습니다'}
                </td></tr>
              )}
              {productsWithInventory.map((p, idx) => {
                const locations = inventorySummary.get(p.id)?.locations.join(', ') || '-'
                const barcode = pickBarcode(barcodeMap.get(p.id))
                const isSelected = selectedIds.has(p.id)
                const isBelowSafety = getBoxStockQty(p) < p.safetyStock
                const fixedBg = isSelected
                  ? 'bg-indigo-100 group-hover:bg-indigo-200 dark:bg-indigo-900 dark:group-hover:bg-indigo-800'
                  : isBelowSafety
                    ? 'bg-red-100 group-hover:bg-red-100 dark:bg-red-900 dark:group-hover:bg-red-900'
                    : 'bg-slate-50 group-hover:bg-gray-50 dark:bg-slate-800 dark:group-hover:bg-gray-800'
                return (
                  <tr
                    key={p.id}
                    className={cn(
                      'border-t border-gray-100 dark:border-gray-800 transition-colors',
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950'
                        : isBelowSafety
                          ? 'bg-red-50 hover:bg-red-100 dark:bg-red-950 dark:hover:bg-red-900'
                          : 'hover:bg-gray-50/30 dark:hover:bg-gray-800/10',
                      isBelowSafety && '[&>td]:!bg-red-100 [&>td]:hover:!bg-red-100 dark:[&>td]:!bg-red-900 dark:[&>td]:hover:!bg-red-900',
                    )}
                  >
                    <td className={cn('sticky-col sticky z-20 px-3 py-1.5 overflow-hidden', fixedBg)} style={{ width: cw.chk, minWidth: cw.chk, maxWidth: cw.chk, left: stickyLeftOf('chk') }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleRow(p.id)}
                        className="rounded accent-indigo-600 cursor-pointer"
                      />
                    </td>
                    <td className={cn('sticky-col sticky z-20 px-2 py-1.5 text-center text-xs text-gray-400 tabular-nums whitespace-nowrap dark:text-gray-500 overflow-hidden', fixedBg)} style={{ width: cw.seq, minWidth: cw.seq, maxWidth: cw.seq, left: stickyLeftOf('seq') }}>
                      {idx + 1}
                    </td>
                    <td
                      className={cn('sticky-col sticky z-20 cursor-pointer px-2 py-1.5 text-sm text-gray-700 whitespace-nowrap hover:!bg-indigo-50 dark:text-gray-300 dark:hover:!bg-indigo-900/30 overflow-hidden', fixedBg)}
                      style={{ width: cw.client, minWidth: cw.client, maxWidth: cw.client, left: stickyLeftOf('client') }}
                      onClick={(e) => { e.stopPropagation(); openGridClientPicker(p) }}
                      title="거래처 변경"
                    >
                      <span className="block truncate" title={p.client?.name ?? ''}>{p.client?.name ?? '-'}</span>
                    </td>
                    <td className={cn('sticky-col sticky z-20 py-1.5 pr-1 overflow-hidden', fixedBg)} style={{ width: cw.code, minWidth: cw.code, maxWidth: cw.code, left: stickyLeftOf('code') }}>
                      <EditableCell id={p.id} field="code" value={p.code}
                        editCell={editCell} setEditCell={setEditCell} onSave={saveEdit} />
                    </td>
                    <td className={cn('sticky-col sticky z-20 py-1.5 pr-1 overflow-hidden', fixedBg)} style={{ width: cw.materialNo, minWidth: cw.materialNo, maxWidth: cw.materialNo, left: stickyLeftOf('materialNo') }}>
                      <EditableCell id={p.id} field="materialNo" value={p.materialNo ?? ''}
                        editCell={editCell} setEditCell={setEditCell} onSave={saveEdit} />
                    </td>
                    <td
                      className={cn('sticky-col sticky z-20 cursor-pointer px-2 py-1.5 text-center font-mono text-xs text-gray-600 whitespace-nowrap transition-colors hover:bg-amber-50 dark:text-gray-400 dark:hover:bg-amber-900/10 overflow-hidden', fixedBg)}
                      style={{ width: cw.barcode, minWidth: cw.barcode, maxWidth: cw.barcode, left: stickyLeftOf('barcode') }}
                      onClick={() => setBarcodeModal(p)}
                      title="바코드 관리"
                    >
                      {barcode?.barcode ?? '-'}
                    </td>
                    <td className={cn('sticky-col sticky z-20 py-1.5 pr-1 overflow-hidden', fixedBg)} style={{ width: cw.name, minWidth: cw.name, maxWidth: cw.name, left: stickyLeftOf('name') }}>
                      <EditableCell id={p.id} field="name" value={p.name}
                        editCell={editCell} setEditCell={setEditCell} onSave={saveEdit} />
                    </td>
                    <td
                      className={cn('sticky-col sticky z-20 py-1.5 pr-1 shadow-[3px_0_5px_-3px_rgba(0,0,0,0.25)] overflow-hidden', fixedBg)}
                      style={{ width: cw.category, minWidth: cw.category, maxWidth: cw.category, left: stickyLeftOf('category') }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <CategorySelect
                        value={p.category ?? ''}
                        onChange={(val) => updateMutation.mutate({ id: p.id, patch: { category: val || undefined } })}
                        variant="cell"
                      />
                    </td>
                    <td className="py-1.5 pr-1">
                      <EditableCell id={p.id} field="optionName" value={p.optionName ?? ''}
                        editCell={editCell} setEditCell={setEditCell} onSave={saveEdit} />
                    </td>
                    <td className="py-1.5 pr-1">
                      <EditableCell id={p.id} field="spec" value={p.spec ?? ''}
                        editCell={editCell} setEditCell={setEditCell} onSave={saveEdit} />
                    </td>
                    <td className="py-1.5 px-2 text-center font-mono text-xs text-gray-600 dark:text-gray-400">
                      <div className="flex items-center justify-center gap-1">
                        <div className="min-w-0">
                          <span className="block truncate" title={p.defaultLocation?.code ?? ''}>{p.defaultLocation?.code ?? '-'}</span>
                          {p.defaultLocation && (p.defaultLocation.aisle || p.defaultLocation.rack || p.defaultLocation.shelf) && (
                            <span className="block truncate text-[10px] text-gray-400 dark:text-gray-500">
                              {[p.defaultLocation.aisle, p.defaultLocation.rack, p.defaultLocation.shelf].filter(Boolean).join('/')}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            openGridLocationPicker(p)
                          }}
                          className="shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-300"
                          title="위치 수정"
                        >
                          <Search size={12} />
                        </button>
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums font-semibold bg-amber-50/70 text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                      <EditableCell id={p.id} field="costPrice" value={p.costPrice ?? 0}
                        editCell={editCell} setEditCell={setEditCell} onSave={saveEdit} align="right" />
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                      <EditableCell id={p.id} field="sellPrice" value={p.sellPrice ?? 0}
                        editCell={editCell} setEditCell={setEditCell} onSave={saveEdit} align="right" />
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      <EditableCell id={p.id} field="retailPrice" value={p.retailPrice ?? 0}
                        editCell={editCell} setEditCell={setEditCell} onSave={saveEdit} align="right" />
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      <EditableCell id={p.id} field="priceA" value={p.priceA ?? 0}
                        editCell={editCell} setEditCell={setEditCell} onSave={saveEdit} align="right" />
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      <EditableCell id={p.id} field="priceB" value={p.priceB ?? 0}
                        editCell={editCell} setEditCell={setEditCell} onSave={saveEdit} align="right" />
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      <EditableCell id={p.id} field="priceC" value={p.priceC ?? 0}
                        editCell={editCell} setEditCell={setEditCell} onSave={saveEdit} align="right" />
                    </td>
                    <td className="py-1.5 pr-1 text-center">
                      <EditableCell id={p.id} field="unit" value={p.unit}
                        editCell={editCell} setEditCell={setEditCell} onSave={saveEdit}
                        unitOptions={unitOptions} align="center" />
                    </td>
                    <td className="py-1.5 pr-1 text-center bg-sky-50/70 dark:bg-sky-950/20">
                      <EditableCell id={p.id} field="boxQty" value={p.boxQty}
                        editCell={editCell} setEditCell={setEditCell} onSave={saveEdit} align="center" />
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      <EditableCell id={p.id} field="boxStock" value={getBoxStockQty(p)}
                        editCell={editCell} setEditCell={setEditCell} onSave={saveEdit} align="right" />
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {formatNumber(getBoxCostPrice(p))}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {formatNumber(getBoxSellPrice(p))}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums font-bold bg-emerald-50/80 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 whitespace-nowrap">
                      {formatNumber(getTotalAmount(p))}
                    </td>
                    <td
                      className="py-1.5 px-2 text-center whitespace-nowrap cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors"
                      onClick={() => setBarcodeModal(p)}
                      title="바코드 관리"
                    >
                      {barcode ? (
                        <span className={cn('inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', BARCODE_TYPE_CLS[barcode.type])}>
                          {BARCODE_TYPE_LABEL[barcode.type]}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300 dark:text-gray-700">-</span>
                      )}
                    </td>
                    <td className="py-1.5 text-center whitespace-nowrap">
                      <StatusEditableCell product={p} onSave={saveStatus} />
                    </td>
                    <td className="py-1.5 px-2 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      <span className="block truncate" title={locations}>{locations}</span>
                    </td>
                    <td className="py-1.5 pr-1">
                      <EditableCell id={p.id} field="memo" value={p.memo ?? ''}
                        editCell={editCell} setEditCell={setEditCell} onSave={saveEdit} />
                    </td>
                    <td className="pr-3 py-1.5">
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
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <Package size={16} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white flex-1">상품 등록</h3>
              <button
                onClick={() => {
                  setShowAdd(false)
                  setSelectedClient(null)
                  setSelectedLocation(null)
                }}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <section>
                <p className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wide mb-3">기본 정보</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">상품코드 *</label>
                    <input autoFocus placeholder="PRD-001" value={form.code}
                      onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">상품명 *</label>
                    <input placeholder="상품명" value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">규격</label>
                    <input placeholder="규격" value={form.spec}
                      onChange={(e) => setForm((p) => ({ ...p, spec: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">자재번호</label>
                    <input placeholder="자재번호" value={form.materialNo}
                      onChange={(e) => setForm((p) => ({ ...p, materialNo: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">카테고리</label>
                    <CategorySelect
                      value={form.category}
                      onChange={(val) => setForm((p) => ({ ...p, category: val }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">거래처</label>
                    <button
                      type="button"
                      onClick={() => { setClientPickerSearch(''); setShowClientPicker(true) }}
                      className={cn(inputCls, 'w-full flex items-center justify-between gap-2 text-left cursor-pointer', form.clientId ? '' : 'text-gray-400 dark:text-gray-500')}
                    >
                      <span className="truncate">{form.clientId ? (selectedClientLabel || '거래처 선택...') : '거래처 선택...'}</span>
                      <Search size={13} className="shrink-0 text-gray-400" />
                    </button>
                    {form.clientId && (
                      <button
                        type="button"
                        onClick={() => { setSelectedClient(null); setForm((p) => ({ ...p, clientId: '' })) }}
                        className="mt-1 flex items-center gap-1 text-xs text-gray-400 hover:text-rose-500 transition-colors"
                      >
                        <X size={11} /> 선택 해제
                      </button>
                    )}
                  </div>
                </div>
              </section>

              {/* ── 바코드 ── */}
              <section className="border-t border-gray-100 dark:border-gray-700 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wide">바코드</p>
                  <button
                    type="button"
                    onClick={() => setShowAddBc((v) => !v)}
                    className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                  >
                    <Plus size={12} /> 바코드 추가
                  </button>
                </div>
                {pendingBarcodes.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {pendingBarcodes.map((bc, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 group">
                        <span className="font-mono text-sm text-gray-800 dark:text-gray-200 flex-1 truncate">{bc.barcode}</span>
                        <span className={cn(
                          'text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0',
                          bc.type === 'CXD_BOX' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                            : bc.type === 'CXD' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
                        )}>
                          {bc.type === 'CXD_BOX' ? 'CXD BOX' : bc.type === 'CXD' ? 'CXD 낱개' : '낱개'}
                        </span>
                        <span className="text-xs text-gray-400 tabular-nums shrink-0">×{bc.unitQty}</span>
                        <button
                          type="button"
                          onClick={() => setPendingBarcodes((prev) => prev.filter((_, i) => i !== idx))}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-rose-500 transition-all shrink-0"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {pendingBarcodes.length === 0 && !showAddBc && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 py-2">바코드를 미리 추가할 수 있습니다 (선택사항)</p>
                )}
                {showAddBc && (
                  <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-900/10">
                    <input
                      autoFocus type="text" placeholder="바코드 값"
                      value={newBcVal} onChange={(e) => setNewBcVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter' || !newBcVal.trim()) return
                        setPendingBarcodes((prev) => [...prev, { barcode: newBcVal.trim(), type: newBcType, unitQty: newBcQty, isPrimary: newBcPrimary }])
                        setNewBcVal(''); setNewBcType('UNIT'); setNewBcQty(1); setNewBcPrimary(false); setShowAddBc(false)
                      }}
                      className="font-mono text-sm px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 flex-1 min-w-32"
                    />
                    <select value={newBcType} onChange={(e) => setNewBcType(e.target.value as BarcodeUnitType)}
                      className="text-xs px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none">
                      <option value="UNIT">낱개</option>
                      <option value="CXD">CXD 낱개</option>
                      <option value="CXD_BOX">CXD BOX</option>
                    </select>
                    <input type="number" min={1} value={newBcQty} onChange={(e) => setNewBcQty(Number(e.target.value))}
                      className="w-14 text-xs px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-right tabular-nums focus:outline-none" />
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                      <input type="checkbox" checked={newBcPrimary} onChange={(e) => setNewBcPrimary(e.target.checked)} className="rounded accent-indigo-600" />기본
                    </label>
                    <button type="button" onClick={() => {
                      if (!newBcVal.trim()) return
                      setPendingBarcodes((prev) => [...prev, { barcode: newBcVal.trim(), type: newBcType, unitQty: newBcQty, isPrimary: newBcPrimary }])
                      setNewBcVal(''); setNewBcType('UNIT'); setNewBcQty(1); setNewBcPrimary(false); setShowAddBc(false)
                    }} disabled={!newBcVal.trim()}
                      className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                      저장
                    </button>
                    <button type="button" onClick={() => setShowAddBc(false)}
                      className="px-2.5 py-1.5 text-xs text-gray-500 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      취소
                    </button>
                  </div>
                )}
              </section>

              <section className="border-t border-gray-100 dark:border-gray-700 pt-4">
                <p className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wide mb-3">수량 / 위치</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">단위</label>
                    <select value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} className={inputCls}>
                      {unitOptions.length > 0
                        ? unitOptions.map((u) => <option key={u.id} value={u.code}>{u.code}{u.label ? ` (${u.label})` : ''}</option>)
                        : ['EA', 'BOX', 'PALLET'].map((u) => <option key={u} value={u}>{u}</option>)
                      }
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">박스당 낱개 수량</label>
                    <input type="number" min={1} value={form.boxQty}
                      onChange={(e) => setForm((p) => ({ ...p, boxQty: +e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">안전재고</label>
                    <input type="number" min={0} value={form.safetyStock}
                      onChange={(e) => setForm((p) => ({ ...p, safetyStock: +e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">재주문점</label>
                    <input type="number" min={0} value={form.reorderPoint}
                      onChange={(e) => setForm((p) => ({ ...p, reorderPoint: +e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">보관위치</label>
                    <button
                      type="button"
                      onClick={() => { setLocationPickerSearch(''); setShowLocationPicker(true) }}
                      className={cn(inputCls, 'w-full flex items-center justify-between gap-2 text-left cursor-pointer', form.locationId ? '' : 'text-gray-400 dark:text-gray-500')}
                    >
                      <span className="truncate">{form.locationId ? (selectedLocationLabel || '위치 선택...') : '위치 선택...'}</span>
                      <MapPin size={13} className="shrink-0 text-gray-400" />
                    </button>
                    {form.locationId && (
                      <button
                        type="button"
                        onClick={() => { setSelectedLocation(null); setForm((p) => ({ ...p, locationId: '' })) }}
                        className="mt-1 flex items-center gap-1 text-xs text-gray-400 hover:text-rose-500 transition-colors"
                      >
                        <X size={11} /> 선택 해제
                      </button>
                    )}
                  </div>
                </div>
              </section>

              <section className="border-t border-gray-100 dark:border-gray-700 pt-4">
                <p className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wide mb-3">가격 정보</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">원가</label>
                    <input type="number" min={0} value={form.costPrice}
                      onChange={(e) => setForm((p) => ({ ...p, costPrice: +e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">판매가</label>
                    <input type="number" min={0} value={form.sellPrice}
                      onChange={(e) => setForm((p) => ({ ...p, sellPrice: +e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">소매단가</label>
                    <input type="number" min={0} value={form.retailPrice}
                      onChange={(e) => setForm((p) => ({ ...p, retailPrice: +e.target.value }))}
                      className={inputCls} />
                  </div>
                  {(['priceA', 'priceB', 'priceC'] as const).map((key) => (
                    <div key={key}>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                        {key === 'priceA' ? '해피미르 단가' : key === 'priceB' ? '네이버 단가' : 'SSG 단가'}
                      </label>
                      <input type="number" min={0} value={form[key]}
                        onChange={(e) => setForm((p) => ({ ...p, [key]: +e.target.value }))}
                        className={inputCls} />
                    </div>
                  ))}
                </div>
              </section>

              <section className="border-t border-gray-100 dark:border-gray-700 pt-4">
                <p className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wide mb-3">상태 & 메모</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">판매 상태</label>
                    <select value={form.saleStatus} onChange={(e) => setForm((p) => ({ ...p, saleStatus: e.target.value as SaleStatus }))} className={inputCls}>
                      {Object.entries(SALE_STATUS_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">메모</label>
                    <textarea rows={3} placeholder="메모 입력..." value={form.memo}
                      onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
                      className={cn(inputCls, 'resize-none')} />
                  </div>
                </div>
              </section>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => {
                  setShowAdd(false)
                  setSelectedClient(null)
                  setSelectedLocation(null)
                }}
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

      {barcodeModal && (
        <ProductBarcodeModal
          product={barcodeModal}
          onClose={() => setBarcodeModal(null)}
        />
      )}

      {showClientPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                <Building2 size={16} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">거래처 선택</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">{filteredClients.length}개 표시</p>
              </div>
              <button
                type="button"
                onClick={closeClientPicker}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4">
              <div className="relative mb-3">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  value={clientPickerSearch}
                  onChange={(e) => setClientPickerSearch(e.target.value)}
                  placeholder="거래처명, 담당자, 전화번호 검색"
                  className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:ring-indigo-900/40"
                />
              </div>
              <div className="max-h-72 overflow-y-auto space-y-1">
                {filteredClients.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">검색 결과가 없습니다.</div>
                ) : filteredClients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => selectClient(client)}
                    className="w-full rounded-xl px-3 py-2.5 text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                  >
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">{client.name}</div>
                    <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{client.phone || client.email || '-'}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showLocationPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300">
                <MapPin size={16} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">보관위치 선택</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">{filteredLocations.length}개 표시</p>
              </div>
              <button
                type="button"
                onClick={closeLocationPicker}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4">
              <div className="relative mb-3">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  value={locationPickerSearch}
                  onChange={(e) => setLocationPickerSearch(e.target.value)}
                  placeholder="위치코드, Aisle, Rack, Shelf 검색"
                  className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:ring-indigo-900/40"
                />
              </div>
              <div className="max-h-72 overflow-y-auto space-y-1">
                {locationsLoading ? (
                  <div className="py-8 text-center text-sm text-gray-400">
                    <div className="mx-auto mb-2 h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-emerald-500" />
                    위치 목록 불러오는 중...
                  </div>
                ) : filteredLocations.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">등록된 위치가 없습니다.</div>
                ) : filteredLocations.map((location) => (
                  <button
                    key={location.id}
                    type="button"
                    onClick={() => selectLocation(location)}
                    className="w-full rounded-xl px-3 py-2.5 text-left hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                  >
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">{location.code}</div>
                    <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {[location.aisle, location.rack, location.shelf, location.bin].filter(Boolean).join(' / ') || '-'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
