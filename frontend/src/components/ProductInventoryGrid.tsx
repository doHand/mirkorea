'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { ClientSideRowModelModule, ModuleRegistry, type ColDef, type ColGroupDef } from 'ag-grid-community'
import { useQuery } from '@tanstack/react-query'
import { GripHorizontal, Menu, Minus, Plus, RefreshCw, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { productApi } from '@/api/product.api'
import { clientApi } from '@/api/client.api'
import { createStatusCreatedAtColumns } from '@/components/ag-grid/commonColumns'
import { ClientPickerModal } from '@/components/ClientPickerModal'
import { LocationPickerModal } from '@/components/LocationPickerModal'
import { formatDecimal } from '@/utils/format'
import { getPackageUnitQty } from '@/utils/unit-spec'
import type { Barcode, BarcodeUnitType, Location, Product, UnitType } from '@/types/api.types'

ModuleRegistry.registerModules([ClientSideRowModelModule])

type DraftProduct = Product & {
  reservedQty?: number
  availableQty?: number
  _new?: boolean
  _deleted?: boolean
  _dirty?: boolean
  _stockDirty?: boolean
}
type DraftBarcode = Barcode & { _new?: boolean; _deleted?: boolean; _dirty?: boolean }

const blankProduct = (): DraftProduct => ({
  id: `new-${crypto.randomUUID()}`,
  code: '', name: '', unit: 'EA', baseUnit: 'EA', boxQty: 1,
  safetyStock: 0, reorderPoint: 0, saleStatus: 'ACTIVE',
  isLotManaged: false, isExpiryManaged: false, createdAt: new Date().toISOString(),
  _new: true,
})

const totalEa = (row: DraftProduct) => Number(row.stockQty ?? 0)
const isBelowSafety = (row?: DraftProduct) => Boolean(row && !row._deleted && totalEa(row) < Number(row.safetyStock ?? 0))
const dividedStock = (row: DraftProduct, unit: 'IN' | 'OUT') => {
  const factor = getPackageUnitQty(row, unit)
  return factor ? totalEa(row) / factor : null
}
const baseUnitLabel = (unit?: UnitType) => unit ?? '-'
const unitQty = (row: DraftProduct, unit: 'IN' | 'OUT') => getPackageUnitQty(row, unit) ?? undefined
const buildSpec = (row: DraftProduct) => {
  const inputQty = unitQty(row, 'IN')
  const outputQty = unitQty(row, 'OUT')
  if (!inputQty || !outputQty) return ''
  return `${inputQty}IN / ${outputQty}OUT`
}
const hasValidSpec = (row: DraftProduct) => Boolean(unitQty(row, 'IN') && unitQty(row, 'OUT'))
const TYPE_ORDER: Record<string, number> = { UNIT: 0, CXD: 1, CXD_OUT: 2 }
const sortBarcodes = <T extends { type: string }>(arr: T[]) =>
  [...arr].sort((a, b) => (TYPE_ORDER[a.type] ?? 3) - (TYPE_ORDER[b.type] ?? 3))
const barcodeUnitQtyForType = (product: DraftProduct | null | undefined, type: BarcodeUnitType) => {
  if (type === 'UNIT') return 1
  if (type === 'CXD') return getPackageUnitQty(product ?? {}, 'IN') ?? 1
  return getPackageUnitQty(product ?? {}, 'OUT') ?? (Number(product?.boxQty) || 1)
}
const nextBarcodeType = (rows: DraftBarcode[]): BarcodeUnitType => {
  const activeTypes = new Set(rows.filter((row) => !row._deleted).map((row) => row.type))
  return (['UNIT', 'CXD', 'CXD_OUT'] as BarcodeUnitType[]).find((type) => !activeTypes.has(type)) ?? 'UNIT'
}

const blankBarcode = (productId: string, productCode: string, type: BarcodeUnitType = 'UNIT', unitQty = 1): DraftBarcode => ({
  id: `new-barcode-${crypto.randomUUID()}`,
  productId,
  productCode,
  barcode: '',
  type,
  unitQty,
  isPrimary: false,
  isActive: true,
  _new: true,
  _dirty: true,
})

function SpecInlineEditor({ row, onChange }: { row: DraftProduct; onChange: (unit: 'IN' | 'OUT', value: string) => void }) {
  return <div className="flex h-full items-center gap-1 text-xs">
    <label className="flex min-w-0 items-center gap-1"><span className="wms-detail-label font-semibold">IN</span><input aria-label="IN 규격" type="number" min={1} value={unitQty(row, 'IN') ?? ''} onClick={(event) => event.stopPropagation()} onChange={(event) => onChange('IN', event.target.value)} className="wms-inline-input h-6 w-12 rounded border px-1 text-right outline-none" /></label>
    <span className="text-gray-300">/</span>
    <label className="flex min-w-0 items-center gap-1"><span className="wms-detail-label font-semibold">OUT</span><input aria-label="OUT 규격" type="number" min={1} value={unitQty(row, 'OUT') ?? ''} onClick={(event) => event.stopPropagation()} onChange={(event) => onChange('OUT', event.target.value)} className="wms-inline-input h-6 w-12 rounded border px-1 text-right outline-none" /></label>
  </div>
}

export function ProductInventoryGrid({
  products,
  onSaved,
  onRefresh,
  locations = [],
  onStockQtySave,
  overflowActions,
  onBarcodeClick,
  showMasterColumns = false,
  onSelectionChange,
}: {
  products: Product[]
  onSaved: () => void
  onRefresh?: () => void | Promise<void>
  locations?: Location[]
  onStockQtySave?: (product: Product, targetQty: number) => Promise<void>
  overflowActions?: ReactNode
  onBarcodeClick?: (product: Product) => void
  showMasterColumns?: boolean
  onSelectionChange?: (products: Product[]) => void
}) {
  const gridRef = useRef<AgGridReact<DraftProduct>>(null)
  const barcodeGridRef = useRef<AgGridReact<DraftBarcode>>(null)
  const [rows, setRows] = useState<DraftProduct[]>([])
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [clientPickerRowId, setClientPickerRowId] = useState<string | null>(null)
  const [locationPickerRowId, setLocationPickerRowId] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<DraftProduct | null>(null)
  const [barcodeRows, setBarcodeRows] = useState<DraftBarcode[]>([])
  const [selectedBarcodeCount, setSelectedBarcodeCount] = useState(0)
  const [barcodeSaving, setBarcodeSaving] = useState(false)
  const [barcodePanelHeight, setBarcodePanelHeight] = useState(240)
  const [menuOpen, setMenuOpen] = useState(false)
  const barcodeRowsRef = useRef<DraftBarcode[]>([])
  const selectedProductRef = useRef<DraftProduct | null>(null)
  selectedProductRef.current = selectedProduct
  barcodeRowsRef.current = barcodeRows

  const onDragHandleMouseDown = (e: React.MouseEvent) => {
    const startY = e.clientY
    const startHeight = barcodePanelHeight
    const onMove = (ev: MouseEvent) => setBarcodePanelHeight(Math.max(80, Math.min(600, startHeight + startY - ev.clientY)))
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-all'],
    queryFn: clientApi.findAllActive,
    staleTime: 60_000,
  })
  const { data: barcodes, refetch: refetchBarcodes, isFetching: isBarcodeRefreshing } = useQuery<Barcode[]>({
    queryKey: ['product-barcodes', 'grid-detail', selectedProduct?.id],
    queryFn: () => productApi.findBarcodes(selectedProduct!.id),
    enabled: Boolean(selectedProduct && !selectedProduct._new && !selectedProduct._deleted),
  })

  useEffect(() => setRows(products.map((product) => ({ ...product }))), [products])
  useEffect(() => {
    if (!barcodes) return
    setBarcodeRows((current) => current.some((row) => row._dirty || row._new || row._deleted)
      ? current
      : sortBarcodes(barcodes.map((barcode) => ({ ...barcode }))))
  }, [barcodes])

  const categoryOptions = useMemo(
    () => [...new Set(products.map((product) => product.category?.trim()).filter((category): category is string => Boolean(category)))].sort(),
    [products],
  )
  const selectClient = (clientId?: string) => {
    const client = clients.find((item) => item.id === clientId)
    setRows((current) => current.map((row) => row.id === clientPickerRowId ? {
      ...row,
      clientId: client?.id,
      client: client ? { id: client.id, name: client.name, phone: client.phone, email: client.email } : undefined,
      _dirty: true,
    } : row))
    setClientPickerRowId(null)
  }
  const selectLocation = (locationId?: string) => {
    const location = locations.find((item) => item.id === locationId)
    setRows((current) => current.map((row) => row.id === locationPickerRowId ? {
      ...row,
      locationId: location?.id,
      defaultLocation: location,
      _dirty: true,
    } : row))
    setLocationPickerRowId(null)
  }

  const columns = useMemo<Array<ColDef<DraftProduct> | ColGroupDef<DraftProduct>>>(() => {
    const masterCostColumn: ColGroupDef<DraftProduct> = {
      headerName: '매입가',
      headerClass: 'wms-master-cost-header',
      marryChildren: true,
      children: [{ headerName: '', field: 'costPrice', editable: true, valueFormatter: (p) => formatDecimal(p.value ?? 0), width: 100, type: 'numericColumn', cellClass: 'wms-master-cost-cell' }],
    }

    const baseColumns: Array<ColDef<DraftProduct> | ColGroupDef<DraftProduct>> = [
    {
      headerName: '',
      width: 52,
      minWidth: 52,
      maxWidth: 52,
      pinned: 'left',
      sortable: false,
      filter: false,
      resizable: false,
      checkboxSelection: true,
      headerCheckboxSelection: true,
    },
    {
      headerName: '거래처명',
      field: 'clientId',
      editable: false,
      pinned: 'left',
      width: 150,
      cellRenderer: (p: { data?: DraftProduct }) => p.data ? <button
        type="button"
        onClick={() => setClientPickerRowId(p.data!.id)}
        className="wms-inline-link block w-full truncate text-left text-sm hover:underline"
        title="거래처 검색"
      >{p.data.client?.name ?? clients.find((client) => client.id === p.data!.clientId)?.name ?? '거래처 선택'}</button> : '-',
    },
    {
      headerName: '상품코드 *',
      field: 'code',
      editable: true,
      pinned: 'left',
      width: 125,
      cellClassRules: { 'cell-required-input': (p) => Boolean(p.data) && !p.data!._deleted && !p.data!.code.trim() },
    },
    {
      headerName: '상품명 *',
      field: 'name',
      editable: true,
      pinned: 'left',
      width: 160,
      cellClassRules: { 'cell-required-input': (p) => Boolean(p.data) && !p.data!._deleted && !p.data!.name.trim() },
    },
    { headerName: '기준단위', field: 'baseUnit', editable: true, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: ['EA'] satisfies UnitType[] }, valueFormatter: (p) => baseUnitLabel(p.value), width: 120 },

    {
      headerName: '규격 *',
      colId: 'specInput',
      width: 190,
      sortable: false,
      filter: false,
      cellClassRules: { 'cell-required-input': (p) => Boolean(p.data) && !p.data!._deleted && !hasValidSpec(p.data!) },
      cellRenderer: (p: { data?: DraftProduct }) => p.data ? <SpecInlineEditor row={p.data} onChange={(unit, value) => {
        setRows((current) => current.map((row) => {
          if (row.id !== p.data!.id) return row
          const next = { ...row, [unit === 'IN' ? 'inUnitQty' : 'outUnitQty']: Number(value) || undefined, _dirty: true }
          return { ...next, spec: buildSpec(next) }
        }))
      }} /> : '-',
    },


    {
      headerName: '재고수량 (규격기준)',
      marryChildren: true,
      children: [
    { headerName: 'EA', field: 'stockQty', editable: true, valueParser: (p) => Math.max(0, Number(p.newValue) || 0), valueFormatter: (p) => formatDecimal(p.value, 2), width: 110, type: 'numericColumn' },
    {
      headerName: 'IN', colId: 'stockInQty',
      editable: (p) => Boolean(p.data && getPackageUnitQty(p.data, 'IN')),
      valueGetter: (p) => dividedStock(p.data!, 'IN'),
      valueSetter: (p) => {
        const factor = getPackageUnitQty(p.data, 'IN')
        if (!factor) return false
        p.data.stockQty = Math.round(Math.max(0, Number(p.newValue) || 0) * factor)
        p.data._stockDirty = true
        return true
      },
      valueParser: (p) => Math.max(0, Number(p.newValue) || 0),
      valueFormatter: (p) => p.value == null ? '-' : formatDecimal(p.value, 2),
      width: 95, type: 'numericColumn',
    },
    {
      headerName: 'OUT', colId: 'stockOutQty',
      editable: (p) => Boolean(p.data && getPackageUnitQty(p.data, 'OUT')),
      valueGetter: (p) => dividedStock(p.data!, 'OUT'),
      valueSetter: (p) => {
        const factor = getPackageUnitQty(p.data, 'OUT')
        if (!factor) return false
        p.data.stockQty = Math.round(Math.max(0, Number(p.newValue) || 0) * factor)
        p.data._stockDirty = true
        return true
      },
      valueParser: (p) => Math.max(0, Number(p.newValue) || 0),
      valueFormatter: (p) => p.value == null ? '-' : formatDecimal(p.value, 2),
      width: 100, type: 'numericColumn',
    },
      ],
    },
    {
      headerName: '상품정보',
      marryChildren: true,
      children: [
        {
          headerName: '카테고리',
          field: 'category',
          editable: true,
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: { values: categoryOptions },
          width: 115,
        },
        {
          headerName: '위치',
          field: 'locationId',
          editable: false,
          width: 120,
          cellRenderer: (p: { data?: DraftProduct }) => p.data ? <button type="button" onClick={() => setLocationPickerRowId(p.data!.id)} className="wms-inline-link block w-full truncate text-left text-sm hover:underline" title="위치 검색">{p.data.defaultLocation?.code ?? '위치 선택'}</button> : '-',
        },
      ],
    },
    ...(showMasterColumns ? [masterCostColumn] : []),
    {
      headerName: '판매가',
      marryChildren: true,
      children: [{ headerName: '', field: 'sellPrice', editable: true, valueFormatter: (p) => formatDecimal(p.value ?? 0), width: 100, type: 'numericColumn' }],
    },
    {
      headerName: '소매가',
      marryChildren: true,
      children: [{ headerName: '', field: 'retailPrice', editable: true, valueFormatter: (p) => formatDecimal(p.value ?? 0), width: 100, type: 'numericColumn' }],
    },
    {
      headerName: '도매가',
      marryChildren: true,
      children: [
        { headerName: 'A', field: 'priceA', editable: true, valueFormatter: (p) => formatDecimal(p.value ?? 0), width: 105, type: 'numericColumn' },
        { headerName: 'B', field: 'priceB', editable: true, valueFormatter: (p) => formatDecimal(p.value ?? 0), width: 105, type: 'numericColumn' },
        { headerName: 'C', field: 'priceC', editable: true, valueFormatter: (p) => formatDecimal(p.value ?? 0), width: 105, type: 'numericColumn' },
      ],
    },
    {
      headerName: '재고현황',
      marryChildren: true,
      children: [
        {
          headerName: '현재고',
          field: 'stockQty',
          editable: true,
          valueParser: (p) => Math.max(0, Number(p.newValue) || 0),
          valueFormatter: (p) => formatDecimal(p.value ?? 0, 2),
          cellClassRules: { 'cell-below-safety': (p) => isBelowSafety(p.data) },
          width: 90,
          type: 'numericColumn',
        },
        {
          headerName: '예약',
          field: 'reservedQty',
          editable: true,
          valueParser: (p) => Math.max(0, Number(p.newValue) || 0),
          valueFormatter: (p) => formatDecimal(p.value ?? 0, 2),
          width: 80,
          type: 'numericColumn',
        },
        {
          headerName: '가용',
          field: 'availableQty',
          editable: true,
          valueParser: (p) => Math.max(0, Number(p.newValue) || 0),
          valueFormatter: (p) => formatDecimal(p.value ?? 0, 2),
          width: 80,
          type: 'numericColumn',
        },
        {
          headerName: '안전재고',
          field: 'safetyStock',
          editable: true,
          valueParser: (p) => Math.max(0, Number(p.newValue) || 0),
          cellClassRules: { 'cell-below-safety': (p) => isBelowSafety(p.data) },
          width: 95,
          type: 'numericColumn',
        },
      ],
    },
    {
      headerName: '관리정보',
      marryChildren: true,
      children: [
        { headerName: '자재번호', field: 'materialNo', editable: true, width: 120 },
        { headerName: '메모', field: 'memo', editable: true, flex: 1, minWidth: 250 },
        ...createStatusCreatedAtColumns<DraftProduct>(),
      ],
    },
    ]

    if (!showMasterColumns) return baseColumns

    const masterColumns: ColGroupDef<DraftProduct> = {
      headerName: 'OUT 계산',
      headerClass: 'wms-master-box-header',
      marryChildren: true,
      children: [   
         {
          headerName: '총금액(원가)',
          headerClass: 'wms-master-box-header',
          cellClass: 'wms-master-box-total-cell',
          valueGetter: (p) => (dividedStock(p.data!, 'OUT') ?? 0) * Number(p.data?.costPrice ?? 0) * (getPackageUnitQty(p.data!, 'OUT') ?? 1),
          valueFormatter: (p) => formatDecimal(p.value ?? 0),
          width: 130,
          type: 'numericColumn',
        },
      ],
    }
        const CalBoxCostColumns: ColGroupDef<DraftProduct> = {
      headerName: 'OUT 당 계산',
      headerClass: 'wms-master-box-header',
      marryChildren: true,
      children: [
        
        {
          headerName: '원가',
          headerClass: 'wms-master-box-header',
          cellClass: 'wms-master-box-cost-cell',
          valueGetter: (p) => Number(p.data?.costPrice ?? 0) * (getPackageUnitQty(p.data!, 'OUT') ?? 1),
          valueFormatter: (p) => formatDecimal(p.value ?? 0),
          width: 130,
          type: 'numericColumn',
        },
        {
          headerName: '판매가',
          headerClass: 'wms-master-box-header',
          cellClass: 'wms-master-box-cell',
          valueGetter: (p) => Number(p.data?.sellPrice ?? 0) * (getPackageUnitQty(p.data!, 'OUT') ?? 1),
          valueFormatter: (p) => formatDecimal(p.value ?? 0),
          width: 130,
          type: 'numericColumn',
        },
      ],
      
    }


    const insertMasterIndex = Math.max(0, baseColumns.length - 1)
    return [
      ...baseColumns.slice(0, insertMasterIndex),
      CalBoxCostColumns,
      masterColumns,
      ...baseColumns.slice(insertMasterIndex),
    ]
  }, [categoryOptions, clients, onBarcodeClick, showMasterColumns])


  const togglePrimary = useCallback((id: string) => {
    setBarcodeRows(curr => curr.map(r => ({ ...r, isPrimary: r.id === id, _dirty: true })))
    requestAnimationFrame(() => {
      barcodeGridRef.current?.api.refreshCells({ columns: ['isPrimary'], force: true })
    })
  }, [])

  const subProductBarcodeGrid = useMemo<ColDef<DraftBarcode>[]>(() => [
    { headerName: '', width: 44, minWidth: 44, maxWidth: 44, checkboxSelection: true, headerCheckboxSelection: true, sortable: false, filter: false, resizable: false },
    {
      headerName: '유형', field: 'type', width: 95, editable: true,
      cellEditor: 'agSelectCellEditor', cellEditorParams: { values: ['UNIT', 'CXD', 'CXD_OUT'] },
      valueFormatter: (p) => p.value === 'CXD_OUT' ? 'CXD OUT' : p.value === 'CXD' ? 'CXD IN' : (p.value ?? ''),
      onCellValueChanged: (p) => setBarcodeRows((curr) => {
        const type = p.newValue as BarcodeUnitType
        return sortBarcodes(curr.map((r) => r.id === p.data.id
          ? { ...r, type, unitQty: barcodeUnitQtyForType(selectedProductRef.current, type), _dirty: true }
          : r))
      }),
    },
    {
      headerName: '바코드', field: 'barcode', flex: 1, minWidth: 180, editable: true,
      onCellValueChanged: (p) => setBarcodeRows((curr) => curr.map((r) => r.id === p.data.id ? { ...r, barcode: String(p.newValue ?? ''), _dirty: true } : r)),
    },
    {
      headerName: '구성수량', field: 'unitQty', width: 85, type: 'numericColumn', editable: true,
      valueParser: (p) => Math.max(1, Number(p.newValue) || 1),
      onCellValueChanged: (p) => setBarcodeRows((curr) => curr.map((r) => r.id === p.data.id ? { ...r, unitQty: Number(p.newValue), _dirty: true } : r)),
    },
    {
      headerName: '대표', field: 'isPrimary', width: 58, sortable: false, editable: false,
      cellRenderer: (p: { data?: DraftBarcode }) => p.data ? (
        <div className="flex h-full items-center justify-center">
          <input type="radio" name={`barcode-primary-${p.data.productId}`} checked={!!p.data.isPrimary}
            onChange={() => togglePrimary(p.data!.id)}
            className="wms-checkbox cursor-pointer"
          />
        </div>
      ) : null,
    },
  ], [togglePrimary])

  const defaultBarcodeRows = (product: DraftProduct): DraftBarcode[] => [
    { ...blankBarcode(product.id, product.code, 'UNIT', 1), isPrimary: true },
    blankBarcode(product.id, product.code, 'CXD', barcodeUnitQtyForType(product, 'CXD')),
    blankBarcode(product.id, product.code, 'CXD_OUT', barcodeUnitQtyForType(product, 'CXD_OUT')),
  ]

  const addRow = () => {
    const newProduct = blankProduct()
    setRows((current) => [newProduct, ...current])
    setSelectedProduct(newProduct)
    setBarcodeRows(defaultBarcodeRows(newProduct))
  }
  const deleteRows = () => {
    const selected = new Set(gridRef.current?.api.getSelectedRows().map((row) => row.id) ?? [])
    if (!selected.size) return toast.error('삭제할 행을 선택해주세요')
    // Keep the record visible until save; the server receives a logical deactivation then.
    setRows((current) => current.map((row) => selected.has(row.id) ? { ...row, _deleted: true, _dirty: true } : row))
  }
  const saveBarcodes = async () => {
    barcodeGridRef.current?.api.stopEditing()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const product = selectedProductRef.current
    const currentBarcodeRows = barcodeRowsRef.current
    if (!product || product._new) return toast.error('상품을 먼저 저장해주세요.')
    setBarcodeSaving(true)
    try {
      for (const row of currentBarcodeRows) {
        if (row._deleted) {
          if (!row._new) await productApi.deleteBarcode(product.id, row.id)
        } else if (row._new) {
          if (!row.barcode.trim()) continue
          await productApi.addBarcode(product.id, { barcode: row.barcode.trim(), type: row.type, unitQty: Number(row.unitQty), isPrimary: row.isPrimary })
        } else if (row._dirty) {
          await productApi.updateBarcode(product.id, row.id, { barcode: row.barcode.trim(), type: row.type, unitQty: Number(row.unitQty), isPrimary: row.isPrimary })
        }
      }
      setBarcodeRows([])
      await refetchBarcodes()
      toast.success('바코드 변경사항을 저장했습니다.')
    } catch {
      toast.error('바코드 저장에 실패했습니다. 입력 내용은 유지됩니다.')
    } finally {
      setBarcodeSaving(false)
    }
  }
  const addBarcodeRow = () => {
    if (!selectedProduct) return
    setBarcodeRows((curr) => {
      const type = nextBarcodeType(curr)
      return sortBarcodes([...curr, blankBarcode(selectedProduct.id, selectedProduct.code, type, barcodeUnitQtyForType(selectedProduct, type))])
    })
  }

  const deleteBarcodeRow = (id: string) => {
    setBarcodeRows((curr) => curr.map((r) => r.id === id ? { ...r, _deleted: true, _dirty: true } : r))
  }

  const refreshRows = async () => {
    if (refreshing) return
    setRefreshing(true)
    setRows(products.map((p) => ({ ...p })))
    setSelectedProduct(null)
    setBarcodeRows([])
    try {
      await onRefresh?.()
    } catch {
      toast.error('새로고침에 실패했습니다.')
    } finally {
      setRefreshing(false)
    }
  }
  const saveRows = async () => {
    const invalid = rows.find((row) => !row._deleted && (!row.code.trim() || !row.name.trim() || !hasValidSpec(row)))
    if (invalid) {
      const missing = [!invalid.code.trim() && '상품코드', !invalid.name.trim() && '상품명', !hasValidSpec(invalid) && '규격(IN/OUT)'].filter(Boolean).join(', ')
      window.alert(`필수 입력 항목을 입력해주세요.\n누락: ${missing}`)
      const rowIndex = rows.findIndex((row) => row.id === invalid.id)
      requestAnimationFrame(() => {
        gridRef.current?.api.ensureIndexVisible(rowIndex, 'middle')
        gridRef.current?.api.setFocusedCell(rowIndex, !invalid.code.trim() ? 'code' : !invalid.name.trim() ? 'name' : 'specInput')
      })
      return
    }
    setSaving(true)
    try {
      for (const row of rows) {
        if (row._deleted) {
          // Existing products are kept for stock/order history and deactivated only on save.
          if (!row._new) await productApi.update(row.id, { saleStatus: 'INACTIVE' })
          continue
        }
        const data = {
          code: row.code.trim(), name: row.name.trim(), category: row.category || undefined,
          unit: row.unit || 'EA', baseUnit: row.baseUnit || 'EA', spec: buildSpec(row),
          clientId: row.clientId || undefined,
          locationId: row.locationId || undefined,
          inUnitQty: getPackageUnitQty(row, 'IN') ?? undefined,
          outUnitQty: getPackageUnitQty(row, 'OUT') ?? undefined,
          boxQty: Number(row.boxQty || 1), safetyStock: Number(row.safetyStock || 0),
          materialNo: row.materialNo || undefined, memo: row.memo || undefined,
          costPrice: Number(row.costPrice || 0), sellPrice: Number(row.sellPrice || 0), retailPrice: Number(row.retailPrice || 0),
          priceA: Number(row.priceA || 0), priceB: Number(row.priceB || 0), priceC: Number(row.priceC || 0),
          saleStatus: row.saleStatus,
        }
        const savedProduct = row._new
          ? await productApi.create(data)
          : await productApi.update(row.id, {
            ...data,
            clientId: row.clientId || null,
            clearClient: !row.clientId,
            locationId: row.locationId || null,
            clearLocation: !row.locationId,
          })
        if (row._new) {
          const pendingBarcodes = barcodeRows.filter(b => b.productId === row.id && !b._deleted && b.barcode.trim())
          for (const b of pendingBarcodes) {
            await productApi.addBarcode(savedProduct.id, { barcode: b.barcode.trim(), type: b.type, unitQty: Number(b.unitQty), isPrimary: b.isPrimary })
          }
        }
        if (row._stockDirty && onStockQtySave) {
          await onStockQtySave(savedProduct, Number(row.stockQty ?? 0))
        }
      }
      toast.success('변경사항을 저장했습니다')
      onSaved()
    } catch {
      toast.error('저장 중 오류가 발생했습니다')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (clientPickerRowId || locationPickerRowId) return
      const api = gridRef.current?.api
      const focusedCell = api?.getFocusedCell()
      const modifier = event.ctrlKey || event.metaKey
      if (!focusedCell) return

      if (modifier && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (!saving) void saveRows()
        return
      }

      const target = event.target as HTMLElement | null
      const editingText = target?.matches('input, textarea, select, [contenteditable="true"]')
      if (editingText) return

      if (modifier && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        addRow()
      } else if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) api?.redoCellEditing()
        else api?.undoCellEditing()
      } else if (modifier && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        api?.redoCellEditing()
      } else if (event.key === 'Delete') {
        event.preventDefault()
        deleteRows()
      } else if (event.key === 'F2') {
        event.preventDefault()
        api?.startEditingCell({ rowIndex: focusedCell.rowIndex, colKey: focusedCell.column.getColId() })
      } else if (event.key === 'Escape') {
        api?.stopEditing(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [clientPickerRowId, locationPickerRowId, saving, rows])

  return (
    <div className="app-surface flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden dark:border-gray-800 dark:bg-gray-900">
      <div className="wms-grid-toolbar flex items-center justify-end gap-1.5 border-b px-2 py-1.5">
        {onRefresh && (
          <button
            type="button"
            onClick={refreshRows}
            disabled={refreshing || saving}
            title="목록 새로고침"
            aria-label="목록 새로고침"
            className="wms-toolbar-action inline-flex h-7 w-7 items-center justify-center rounded transition-colors disabled:opacity-40"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        )}
        <button
          onClick={addRow}
          title="행 추가"
          aria-label="행 추가"
          className="wms-toolbar-action inline-flex h-7 w-7 items-center justify-center rounded transition-colors"
        >
          <Plus size={15} strokeWidth={2.5} />
        </button>
        <button
          onClick={deleteRows}
          title="선택 행 삭제"
          aria-label="선택 행 삭제"
          className="wms-toolbar-action inline-flex h-7 w-7 items-center justify-center rounded transition-colors"
        >
          <Minus size={16} strokeWidth={2.5} />
        </button>

        <button onClick={saveRows} disabled={saving} className="wms-toolbar-action inline-flex items-center gap-1 rounded px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40"><Save size={14} /> {saving ? '저장 중' : '저장'}</button>
        {overflowActions && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              title="추가 작업"
              aria-label="추가 작업"
              aria-expanded={menuOpen}
              className="wms-toolbar-action inline-flex h-7 w-7 items-center justify-center rounded transition-colors"
            >
              <Menu size={16} strokeWidth={2.2} />
            </button>
            {menuOpen && (
              <div className="product-grid-overflow absolute right-0 top-8 z-50 flex min-w-[132px] flex-col gap-1 rounded border border-gray-200 bg-white p-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                {overflowActions}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
      <div className="product-inventory-grid ag-theme-quartz ag-theme-wms wms-ag-grid min-w-0 w-full flex-1">
        <AgGridReact<DraftProduct>
          ref={gridRef}
          rowData={rows}
          columnDefs={columns}
          defaultColDef={{ sortable: true, resizable: true, filter: true, suppressHeaderMenuButton: true, suppressSpanHeaderHeight: true, minWidth: 100 }}
          headerHeight={36}
          groupHeaderHeight={28}
          rowSelection="multiple"
          rowClassRules={{
            'row-pending-delete': (params) => Boolean(params.data?._deleted),
            'row-new': (params) => Boolean(params.data?._new) && !params.data?._deleted,
            'row-modified': (params) => Boolean(params.data?._dirty) && !params.data?._new && !params.data?._deleted,
            'row-below-safety': (params) => isBelowSafety(params.data),
            'row-status-active': (params) => !params.data?._deleted && params.data?.saleStatus === 'ACTIVE',
            'row-status-inactive': (params) => !params.data?._deleted && params.data?.saleStatus !== 'ACTIVE',
          }}
          onFirstDataRendered={(params) => {
            requestAnimationFrame(() => {
              params.api.autoSizeAllColumns(false)
              const firstRow = params.api.getDisplayedRowAtIndex(0)
              if (firstRow?.data) {
                firstRow.setSelected(true)
                setSelectedProduct(firstRow.data)
                setBarcodeRows([])
              }
            })
          }}
          animateRows
          singleClickEdit
          undoRedoCellEditing
          undoRedoCellEditingLimit={50}
          enterNavigatesVerticallyAfterEdit
          stopEditingWhenCellsLoseFocus
          getRowId={(params) => params.data.id}
          onSelectionChanged={() => {
            onSelectionChange?.(gridRef.current?.api.getSelectedRows() ?? [])
          }}
          onRowClicked={(params) => {
            if (!params.data) return
            if (selectedProduct?.id !== params.data.id && barcodeRows.some((row) => row._dirty || row._new || row._deleted)) {
              toast.error('바코드 변경사항을 저장하거나 처리한 뒤 다른 상품을 선택해주세요.')
              return
            }
            setSelectedProduct(params.data)
            setBarcodeRows([])
            setSelectedBarcodeCount(0)
          }}
          onCellValueChanged={(params) => setRows((current) => current.map((row) => {
            if (row.id !== params.data.id) return row
            const field = params.colDef.field
            const colId = params.colDef.colId
            const next: DraftProduct = { ...row, ...params.data, _dirty: true }
            const stockChanged = field === 'stockQty' || colId === 'stockInQty' || colId === 'stockOutQty'
            if (stockChanged || field === 'reservedQty') {
              next.availableQty = Math.max(0, Number(next.stockQty ?? 0) - Number(next.reservedQty ?? 0))
            }
            if (field === 'availableQty') {
              next.stockQty = Math.max(0, Number(next.availableQty ?? 0) + Number(next.reservedQty ?? 0))
            }
            next._stockDirty = stockChanged || field === 'availableQty' || row._stockDirty
            return next
          }))}
        />
      </div>
      <div onMouseDown={onDragHandleMouseDown} className="wms-splitter h-5 shrink-0 cursor-row-resize flex items-center justify-center gap-1 border-y transition-colors select-none">
        <GripHorizontal size={16} className="pointer-events-none text-slate-400" />
        <span className="pointer-events-none text-[10px] text-slate-400 leading-none">높이 조절</span>
      </div>
      <section className="app-surface flex shrink-0 flex-col rounded-none border-x-0 border-b-0" style={{ height: barcodePanelHeight }}>
        <div className="wms-detail-header flex shrink-0 items-center justify-between border-b px-3 py-2">
          <div className="min-w-0"><span className="wms-detail-label text-xs font-semibold">바코드 목록</span>{selectedProduct && <span className="ml-2 text-xs text-gray-500">{selectedProduct.name} · {selectedProduct.code}</span>}</div>
          {selectedProduct && !selectedProduct._deleted && <div className="flex items-center gap-1">
            {!selectedProduct._new && (
              <>
                <button type="button" title="바코드 초기화" onClick={() => { setBarcodeRows([]); void refetchBarcodes() }} disabled={isBarcodeRefreshing || barcodeSaving} className="wms-icon-button inline-flex h-7 w-7 items-center justify-center rounded disabled:opacity-50"><RefreshCw size={14} className={isBarcodeRefreshing ? 'animate-spin' : ''} /></button>
              </>
            )}
            <button type="button" title="바코드 행 추가" onClick={addBarcodeRow} className="wms-icon-button inline-flex h-7 w-7 items-center justify-center rounded"><Plus size={14} strokeWidth={2.5} /></button>
            <button type="button" title="선택 행 삭제" onClick={() => {
              const selected = barcodeGridRef.current?.api.getSelectedRows() ?? []
              selected.forEach((r) => deleteBarcodeRow(r.id))
            }} disabled={selectedBarcodeCount === 0} className="wms-icon-button inline-flex h-7 w-7 items-center justify-center rounded hover:text-red-500 disabled:opacity-40 transition-colors"><Minus size={14} strokeWidth={2.5} /></button>
            {!selectedProduct._new && <button type="button" onClick={() => void saveBarcodes()} disabled={barcodeSaving} className="wms-primary-button inline-flex items-center gap-1 rounded px-3 py-1.5 text-xs font-semibold disabled:opacity-50"><Save size={14} /> {barcodeSaving ? '저장 중' : '저장'}</button>}
          </div>}
        </div>
        {!selectedProduct ? <div className="grid min-h-0 flex-1 place-items-center text-xs text-gray-400">상품 행을 클릭하면 바코드 목록이 표시됩니다.</div>
          : <div className="ag-theme-quartz ag-theme-wms wms-ag-grid min-h-0 flex-1">
            <AgGridReact<DraftBarcode>
              ref={barcodeGridRef}
              rowData={barcodeRows.filter((r) => !r._deleted)}
              columnDefs={subProductBarcodeGrid}
              defaultColDef={{ sortable: false, resizable: true, filter: false, suppressHeaderMenuButton: true }}
              headerHeight={32}
              rowHeight={30}
              rowSelection="multiple"
              getRowId={(p) => p.data.id}
              rowClassRules={{ 'wms-ag-grid-row-new': (p) => Boolean(p.data?._new) }}
              onSelectionChanged={() => setSelectedBarcodeCount(barcodeGridRef.current?.api.getSelectedRows().length ?? 0)}
              animateRows
              singleClickEdit
              stopEditingWhenCellsLoseFocus
            />
          </div>}
      </section>
      </div>
      {clientPickerRowId && (
        <ClientPickerModal
          clients={clients}
          onSelect={(client) => selectClient(client?.id)}
          onClose={() => setClientPickerRowId(null)}
          allowClear
        />
      )}
      {locationPickerRowId && (
        <LocationPickerModal
          locations={locations}
          onSelect={(location) => selectLocation(location?.id)}
          onClose={() => setLocationPickerRowId(null)}
          allowClear
        />
      )}
    </div>
  )
}
