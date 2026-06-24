'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { ClientSideRowModelModule, ModuleRegistry, type ColDef, type ColGroupDef } from 'ag-grid-community'
import { useQuery } from '@tanstack/react-query'
import { GripHorizontal, Menu, Minus, Plus, RefreshCw, Save, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { productApi } from '@/api/product.api'
import { clientApi } from '@/api/client.api'
import { formatDecimal } from '@/utils/format'
import { getPackageUnitQty } from '@/utils/unit-spec'
import type { Barcode, BarcodeUnitType, Location, Product, SaleStatus, UnitType } from '@/types/api.types'

ModuleRegistry.registerModules([ClientSideRowModelModule])

type DraftProduct = Product & { _new?: boolean; _deleted?: boolean; _dirty?: boolean; _stockDirty?: boolean }
type DraftBarcode = Barcode & { _new?: boolean; _deleted?: boolean; _dirty?: boolean }

const blankProduct = (): DraftProduct => ({
  id: `new-${crypto.randomUUID()}`,
  code: '', name: '', unit: 'EA', baseUnit: 'EA', boxQty: 1,
  safetyStock: 0, reorderPoint: 0, saleStatus: 'ACTIVE',
  isLotManaged: false, isExpiryManaged: false, createdAt: new Date().toISOString(),
  _new: true,
})

const totalEa = (row: DraftProduct) => Number(row.stockQty ?? 0)
const dividedStock = (row: DraftProduct, unit: 'P' | 'BOX') => {
  const factor = getPackageUnitQty(row, unit)
  return factor ? totalEa(row) / factor : null
}
const baseUnitLabel = (unit?: UnitType) => unit === 'P' ? 'IN' : unit === 'BOX' ? 'OUT' : unit === 'PL' ? '-' : unit ?? '-'
const unitQty = (row: DraftProduct, unit: 'P' | 'BOX') => getPackageUnitQty(row, unit) ?? undefined
const buildSpec = (row: DraftProduct) => {
  const inputQty = unitQty(row, 'P')
  const outputQty = unitQty(row, 'BOX')
  return inputQty && outputQty ? `${inputQty}IN/${outputQty}OUT` : ''
}
const hasValidSpec = (row: DraftProduct) => Boolean(unitQty(row, 'P') && unitQty(row, 'BOX'))
const blankBarcode = (productId: string, productCode: string): DraftBarcode => ({
  id: `new-barcode-${crypto.randomUUID()}`,
  productId,
  productCode,
  barcode: '',
  type: 'UNIT',
  unitQty: 1,
  isPrimary: false,
  isActive: true,
  _new: true,
  _dirty: true,
})

function SpecInlineEditor({ row, onChange }: { row: DraftProduct; onChange: (unit: 'P' | 'BOX', value: string) => void }) {
  return <div className="flex h-full items-center gap-1 text-xs">
    <label className="flex min-w-0 items-center gap-1"><span className="wms-detail-label font-semibold">IN</span><input aria-label="IN 규격" type="number" min={1} value={unitQty(row, 'P') ?? ''} onClick={(event) => event.stopPropagation()} onChange={(event) => onChange('P', event.target.value)} className="wms-inline-input h-6 w-12 rounded border px-1 text-right outline-none" /></label>
    <span className="text-gray-300">/</span>
    <label className="flex min-w-0 items-center gap-1"><span className="wms-detail-label font-semibold">OUT</span><input aria-label="OUT 규격" type="number" min={1} value={unitQty(row, 'BOX') ?? ''} onClick={(event) => event.stopPropagation()} onChange={(event) => onChange('BOX', event.target.value)} className="wms-inline-input h-6 w-12 rounded border px-1 text-right outline-none" /></label>
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
}: {
  products: Product[]
  onSaved: () => void
  onRefresh?: () => void | Promise<void>
  locations?: Location[]
  onStockQtySave?: (product: Product, targetQty: number) => Promise<void>
  overflowActions?: ReactNode
  onBarcodeClick?: (product: Product) => void
}) {
  const gridRef = useRef<AgGridReact<DraftProduct>>(null)
  const barcodeGridRef = useRef<AgGridReact<DraftBarcode>>(null)
  const barcodeImportRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<DraftProduct[]>([])
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [clientPickerRowId, setClientPickerRowId] = useState<string | null>(null)
  const [clientSearch, setClientSearch] = useState('')
  const [locationPickerRowId, setLocationPickerRowId] = useState<string | null>(null)
  const [locationSearch, setLocationSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<DraftProduct | null>(null)
  const [barcodeRows, setBarcodeRows] = useState<DraftBarcode[]>([])
  const [selectedBarcodeCount, setSelectedBarcodeCount] = useState(0)
  const [barcodeSaving, setBarcodeSaving] = useState(false)
  const [barcodePanelHeight, setBarcodePanelHeight] = useState(240)

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
      : barcodes.map((barcode) => ({ ...barcode })))
  }, [barcodes])

  const categoryOptions = useMemo(
    () => [...new Set(products.map((product) => product.category?.trim()).filter((category): category is string => Boolean(category)))].sort(),
    [products],
  )
  const filteredClients = useMemo(() => {
    const keyword = clientSearch.trim().toLowerCase()
    if (!keyword) return clients
    return clients.filter((client) => [client.name, client.phone, client.email]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword)))
  }, [clientSearch, clients])
  const filteredLocations = useMemo(() => {
    const keyword = locationSearch.trim().toLowerCase()
    if (!keyword) return locations
    return locations.filter((location) => [location.code, location.aisle, location.rack, location.shelf, location.bin]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword)))
  }, [locationSearch, locations])
  const selectClient = (clientId?: string) => {
    const client = clients.find((item) => item.id === clientId)
    setRows((current) => current.map((row) => row.id === clientPickerRowId ? {
      ...row,
      clientId: client?.id,
      client: client ? { id: client.id, name: client.name, phone: client.phone, email: client.email } : undefined,
      _dirty: true,
    } : row))
    setClientPickerRowId(null)
    setClientSearch('')
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
    setLocationSearch('')
  }

  const columns = useMemo<Array<ColDef<DraftProduct> | ColGroupDef<DraftProduct>>>(() => [
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
        onClick={() => { setClientPickerRowId(p.data!.id); setClientSearch('') }}
        className="wms-inline-link block w-full truncate text-left text-sm hover:underline"
        title="거래처 검색"
      >{p.data.client?.name ?? clients.find((client) => client.id === p.data!.clientId)?.name ?? '거래처 선택'}</button> : '-',
    },
    { headerName: '상품코드 *', field: 'code', editable: true, pinned: 'left', width: 125 },
    { headerName: '상품명 *', field: 'name', editable: true, pinned: 'left', width: 160 },
    { headerName: '기준단위', field: 'baseUnit', editable: true, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: ['EA', 'P', 'BOX'] satisfies UnitType[] }, valueFormatter: (p) => baseUnitLabel(p.value), width: 120 },

    {
      headerName: '규격 *',
      colId: 'specInput',
      width: 190,
      sortable: false,
      filter: false,
      cellRenderer: (p: { data?: DraftProduct }) => p.data ? <SpecInlineEditor row={p.data} onChange={(unit, value) => {
        setRows((current) => current.map((row) => {
          if (row.id !== p.data!.id) return row
          const next = { ...row, [unit === 'P' ? 'pUnitQty' : 'boxUnitQty']: Number(value) || undefined, _dirty: true }
          return { ...next, spec: buildSpec(next) }
        }))
      }} /> : '-',
    },


    {
      headerName: '재고수량 (규격기준)',
      marryChildren: true,
      children: [
    { headerName: 'EA', field: 'stockQty', editable: true, valueParser: (p) => Math.max(0, Number(p.newValue) || 0), valueFormatter: (p) => formatDecimal(p.value, 2), width: 110, type: 'numericColumn' },
    { headerName: 'IN', valueGetter: (p) => dividedStock(p.data!, 'P'), valueFormatter: (p) => p.value == null ? '-' : formatDecimal(p.value, 2), width: 95, type: 'numericColumn' },
    { headerName: 'OUT', valueGetter: (p) => dividedStock(p.data!, 'BOX'), valueFormatter: (p) => p.value == null ? '-' : formatDecimal(p.value, 2), width: 100, type: 'numericColumn' },
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
          cellRenderer: (p: { data?: DraftProduct }) => p.data ? <button type="button" onClick={() => { setLocationPickerRowId(p.data!.id); setLocationSearch('') }} className="wms-inline-link block w-full truncate text-left text-sm hover:underline" title="위치 검색">{p.data.defaultLocation?.code ?? '위치 선택'}</button> : '-',
        },
      ],
    },
    {
      headerName: '매입가',
      marryChildren: true,
      children: [{ headerName: '', field: 'costPrice', editable: true, valueFormatter: (p) => formatDecimal(p.value ?? 0), width: 100, type: 'numericColumn' }],
    },
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
        { headerName: '현재고', valueGetter: (p) => totalEa(p.data!), valueFormatter: (p) => formatDecimal(p.value, 2), width: 90, type: 'numericColumn' },
        { headerName: '예약', valueGetter: () => 0, width: 80, type: 'numericColumn' },
        { headerName: '가용', valueGetter: (p) => totalEa(p.data!), valueFormatter: (p) => formatDecimal(p.value, 2), width: 80, type: 'numericColumn' },
        { headerName: '안전재고', field: 'safetyStock', editable: true, width: 95, type: 'numericColumn' },
      ],
    },
    {
      headerName: '관리정보',
      marryChildren: true,
      children: [
        { headerName: '자재번호', field: 'materialNo', editable: true, width: 120 },
        { headerName: '메모', field: 'memo', editable: true, flex: 1, minWidth: 140 },
        { headerName: '상태', field: 'saleStatus', editable: true, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: ['ACTIVE', 'INACTIVE', 'DISCONTINUED'] satisfies SaleStatus[] }, width: 100 },
        { headerName: '등록일', field: 'createdAt', valueFormatter: (p) => p.value ? new Date(p.value).toLocaleDateString('ko-KR') : '-', width: 110 },
      ],
    },
  ], [categoryOptions, clients, onBarcodeClick])


  const barcodeColDefs = useMemo<ColDef<DraftBarcode>[]>(() => [
    { headerName: '', width: 44, minWidth: 44, maxWidth: 44, checkboxSelection: true, headerCheckboxSelection: true, sortable: false, filter: false, resizable: false },
    {
      headerName: '유형', field: 'type', width: 95, editable: true,
      cellEditor: 'agSelectCellEditor', cellEditorParams: { values: ['UNIT', 'CXD', 'CXD_BOX'] },
      valueFormatter: (p) => p.value === 'CXD_BOX' ? 'CXD BOX' : (p.value ?? ''),
      onCellValueChanged: (p) => setBarcodeRows((curr) => curr.map((r) => r.id === p.data.id ? { ...r, type: p.newValue as BarcodeUnitType, _dirty: true } : r)),
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
          <input type="radio" name="barcode-primary" checked={!!p.data.isPrimary}
            onChange={() => setBarcodeRows((curr) => curr.map((r) => ({ ...r, isPrimary: r.id === p.data!.id, _dirty: true })))}
            className="wms-checkbox cursor-pointer"
          />
        </div>
      ) : null,
    },
  ], [])

  const defaultBarcodeRows = (product: DraftProduct): DraftBarcode[] => [
    { ...blankBarcode(product.id, product.code), type: 'UNIT', unitQty: 1, isPrimary: true },
    { ...blankBarcode(product.id, product.code), type: 'CXD', unitQty: getPackageUnitQty(product, 'P') ?? 1 },
    { ...blankBarcode(product.id, product.code), type: 'CXD_BOX', unitQty: getPackageUnitQty(product, 'BOX') ?? Number(product.boxQty) ?? 1 },
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
    if (!selectedProduct || selectedProduct._new) return toast.error('상품을 먼저 저장해주세요.')
    setBarcodeSaving(true)
    try {
      for (const row of barcodeRows) {
        if (row._deleted) {
          if (!row._new) await productApi.deleteBarcode(selectedProduct.id, row.id)
        } else if (row._new) {
          if (!row.barcode.trim()) continue
          await productApi.addBarcode(selectedProduct.id, { barcode: row.barcode.trim(), type: row.type, unitQty: Number(row.unitQty), isPrimary: row.isPrimary })
        } else if (row._dirty) {
          await productApi.updateBarcode(selectedProduct.id, row.id, { barcode: row.barcode.trim(), type: row.type, unitQty: Number(row.unitQty), isPrimary: row.isPrimary })
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
    setBarcodeRows((curr) => [...curr, blankBarcode(selectedProduct.id, selectedProduct.code)])
  }

  const deleteBarcodeRow = (id: string) => {
    setBarcodeRows((curr) => curr.map((r) => r.id === id ? { ...r, _deleted: true, _dirty: true } : r))
  }

  const importBarcodesFromFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedProduct) return
    e.target.value = ''
    try {
      const { read, utils } = await import('xlsx')
      const ab = await file.arrayBuffer()
      const wb = read(ab)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][]
      const newRows: DraftBarcode[] = []
      for (const row of raw) {
        if (!Array.isArray(row)) continue
        const rawType = String(row[0] ?? '').trim().toUpperCase().replace(/\s+/g, '_')
        const barcode  = String(row[1] ?? '').trim()
        const unitQty  = Math.max(1, Number(row[2]) || 1)
        const isPrimary = /^(y|1|true|대표)$/i.test(String(row[3] ?? '').trim())
        if (!barcode) continue
        const type: BarcodeUnitType = (['UNIT', 'CXD', 'CXD_BOX'] as BarcodeUnitType[]).includes(rawType as BarcodeUnitType)
          ? (rawType as BarcodeUnitType)
          : 'UNIT'
        newRows.push({ ...blankBarcode(selectedProduct.id, selectedProduct.code), type, barcode, unitQty, isPrimary })
      }
      if (!newRows.length) { toast.error('가져올 바코드가 없습니다 (헤더 행 제외 확인)'); return }
      setBarcodeRows((curr) => {
        const hasPrimary = newRows.some((r) => r.isPrimary)
        const base = hasPrimary ? curr.map((r) => ({ ...r, isPrimary: false, _dirty: true })) : curr
        return [...base, ...newRows]
      })
      toast.success(`바코드 ${newRows.length}개를 가져왔습니다`)
    } catch {
      toast.error('파일을 읽는데 실패했습니다')
    }
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
          pUnitQty: getPackageUnitQty(row, 'P') ?? undefined,
          boxUnitQty: getPackageUnitQty(row, 'BOX') ?? undefined,
          plUnitQty: getPackageUnitQty(row, 'PL') ?? undefined,
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
              <div className="product-grid-overflow absolute right-0 top-8 z-50 flex min-w-[132px] flex-col gap-1 rounded border border-gray-200 bg-white p-1.5 shadow-lg">
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
            'row-below-safety': (params) => Boolean(params.data) && !params.data!._deleted && totalEa(params.data!) < Number(params.data!.safetyStock ?? 0),
            'row-pending-delete': (params) => Boolean(params.data?._deleted),
            'row-new': (params) => Boolean(params.data?._new) && !params.data?._deleted,
            'row-modified': (params) => Boolean(params.data?._dirty) && !params.data?._new && !params.data?._deleted,
            'row-required-input': (params) => Boolean(params.data) && !params.data!._deleted && (!params.data!.code.trim() || !params.data!.name.trim() || !hasValidSpec(params.data!)),
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
          animateRows={false}
          singleClickEdit
          undoRedoCellEditing
          undoRedoCellEditingLimit={50}
          enterNavigatesVerticallyAfterEdit
          stopEditingWhenCellsLoseFocus
          getRowId={(params) => params.data.id}
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
          onCellValueChanged={(params) => setRows((current) => current.map((row) => row.id === params.data.id ? {
            ...row,
            _dirty: true,
            _stockDirty: params.colDef.field === 'stockQty' || row._stockDirty,
          } : row))}
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
                <input ref={barcodeImportRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importBarcodesFromFile} />
                <button type="button" title="엑셀 임포트 (유형·바코드·수량·대표 순)" onClick={() => barcodeImportRef.current?.click()} className="wms-icon-button inline-flex h-7 w-7 items-center justify-center rounded"><Upload size={13} /></button>
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
              columnDefs={barcodeColDefs}
              defaultColDef={{ sortable: false, resizable: true, filter: false, suppressHeaderMenuButton: true }}
              headerHeight={32}
              rowHeight={30}
              rowSelection="multiple"
              getRowId={(p) => p.data.id}
              rowClassRules={{ 'wms-ag-grid-row-new': (p) => Boolean(p.data?._new) }}
              onSelectionChanged={() => setSelectedBarcodeCount(barcodeGridRef.current?.api.getSelectedRows().length ?? 0)}
              singleClickEdit
              stopEditingWhenCellsLoseFocus
            />
          </div>}
      </section>
      </div>
      {clientPickerRowId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={() => setClientPickerRowId(null)}>
          <div className="flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded bg-white shadow-2xl dark:bg-gray-900" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <div><h3 className="font-semibold text-gray-900 dark:text-white">거래처 선택</h3><p className="mt-0.5 text-xs text-gray-500">거래처명, 전화번호 또는 이메일로 검색합니다.</p></div>
              <button type="button" onClick={() => setClientPickerRowId(null)} className="px-2 py-1 text-sm text-gray-500 hover:text-gray-900">닫기</button>
            </div>
            <div className="border-b border-gray-100 p-3 dark:border-gray-800">
              <input autoFocus value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="거래처 검색" className="wms-inline-input w-full rounded border px-3 py-2 text-sm outline-none dark:border-gray-700 dark:bg-gray-800" />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {filteredClients.length === 0 ? <p className="p-8 text-center text-sm text-gray-400">검색 결과가 없습니다.</p> : filteredClients.map((client) => (
                <button key={client.id} type="button" onClick={() => selectClient(client.id)} className="wms-list-option flex w-full items-center justify-between border-b border-gray-100 px-4 py-3 text-left dark:border-gray-800 dark:hover:bg-gray-800">
                  <span className="font-medium text-gray-900 dark:text-white">{client.name}</span>
                  <span className="text-xs text-gray-500">{client.phone || client.email || '-'}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end border-t border-gray-200 p-3 dark:border-gray-700"><button type="button" onClick={() => selectClient()} className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">거래처 해제</button></div>
          </div>
        </div>
      )}
      {locationPickerRowId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={() => setLocationPickerRowId(null)}>
          <div className="flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded bg-white shadow-2xl dark:bg-gray-900" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <div><h3 className="font-semibold text-gray-900 dark:text-white">위치 선택</h3><p className="mt-0.5 text-xs text-gray-500">위치코드 또는 랙 정보로 검색합니다.</p></div>
              <button type="button" onClick={() => setLocationPickerRowId(null)} className="px-2 py-1 text-sm text-gray-500 hover:text-gray-900">닫기</button>
            </div>
            <div className="border-b border-gray-100 p-3 dark:border-gray-800"><input autoFocus value={locationSearch} onChange={(event) => setLocationSearch(event.target.value)} placeholder="위치 검색" className="wms-inline-input w-full rounded border px-3 py-2 text-sm outline-none dark:border-gray-700 dark:bg-gray-800" /></div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {filteredLocations.length === 0 ? <p className="p-8 text-center text-sm text-gray-400">검색 결과가 없습니다.</p> : filteredLocations.map((location) => (
                <button key={location.id} type="button" onClick={() => selectLocation(location.id)} className="wms-list-option flex w-full items-center justify-between border-b border-gray-100 px-4 py-3 text-left dark:border-gray-800 dark:hover:bg-gray-800">
                  <span className="font-medium text-gray-900 dark:text-white">{location.code}</span>
                  <span className="text-xs text-gray-500">{[location.aisle, location.rack, location.shelf, location.bin].filter(Boolean).join('-') || '-'}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end border-t border-gray-200 p-3 dark:border-gray-700"><button type="button" onClick={() => selectLocation()} className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">위치 해제</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
