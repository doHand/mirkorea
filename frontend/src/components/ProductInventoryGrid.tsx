'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { ClientSideRowModelModule, ModuleRegistry, type ColDef, type ColGroupDef } from 'ag-grid-community'
import { useQuery } from '@tanstack/react-query'
import { Menu, Minus, Plus, RefreshCw, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { productApi } from '@/api/product.api'
import { clientApi } from '@/api/client.api'
import { formatDecimal } from '@/utils/format'
import { getPackageUnitQty } from '@/utils/unit-spec'
import type { Location, Product, SaleStatus, UnitType } from '@/types/api.types'

ModuleRegistry.registerModules([ClientSideRowModelModule])

type DraftProduct = Product & { _new?: boolean; _deleted?: boolean; _dirty?: boolean; _stockDirty?: boolean }

const blankProduct = (): DraftProduct => ({
  id: `new-${crypto.randomUUID()}`,
  code: '', name: '', unit: 'EA', baseUnit: 'EA', boxQty: 1,
  safetyStock: 0, reorderPoint: 0, saleStatus: 'ACTIVE',
  isLotManaged: false, isExpiryManaged: false, createdAt: new Date().toISOString(),
  _new: true,
})

const totalEa = (row: DraftProduct) => Number(row.stockQty ?? 0)
const dividedStock = (row: DraftProduct, unit: 'P' | 'BOX' | 'PL') => {
  const factor = getPackageUnitQty(row, unit)
  return factor ? totalEa(row) / factor : null
}
const primaryBarcode = (row: DraftProduct) => {
  const barcodes = row.barcodes ?? []
  return (barcodes.find((barcode) => barcode.isPrimary && barcode.isActive)
    ?? barcodes.find((barcode) => barcode.isActive)
    ?? barcodes[0])?.barcode ?? '-'
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
  const [rows, setRows] = useState<DraftProduct[]>([])
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [clientPickerRowId, setClientPickerRowId] = useState<string | null>(null)
  const [clientSearch, setClientSearch] = useState('')
  const [locationPickerRowId, setLocationPickerRowId] = useState<string | null>(null)
  const [locationSearch, setLocationSearch] = useState('')

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-all'],
    queryFn: clientApi.findAllActive,
    staleTime: 60_000,
  })

  useEffect(() => setRows(products.map((product) => ({ ...product }))), [products])

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
        className="block w-full truncate text-left text-sm text-[#355b73] hover:underline"
        title="거래처 검색"
      >{p.data.client?.name ?? clients.find((client) => client.id === p.data!.clientId)?.name ?? '거래처 선택'}</button> : '-',
    },
    { headerName: '상품코드 *', field: 'code', editable: true, pinned: 'left', width: 125 },
    {
      headerName: '바코드',
      valueGetter: (p) => p.data ? primaryBarcode(p.data) : '-',
      pinned: 'left',
      width: 140,
      tooltipValueGetter: (p) => p.data ? primaryBarcode(p.data) : '-',
      cellRenderer: (params: { data?: DraftProduct }) => params.data ? (
        <button
          type="button"
          onClick={() => onBarcodeClick?.(params.data!)}
          className="max-w-full truncate text-left font-mono text-xs text-sky-800 underline-offset-2 hover:text-sky-950 hover:underline"
          title="바코드 관리 열기"
        >
          {primaryBarcode(params.data)}
        </button>
      ) : '-',
    },
    { headerName: '상품명 *', field: 'name', editable: true, pinned: 'left', width: 160 },
    { headerName: '기준단위', field: 'baseUnit', editable: true, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: ['EA', 'P', 'BOX', 'PL'] satisfies UnitType[] }, width: 120 },
    {
      headerName: '규격',
      marryChildren: true,
      children: [
        { headerName: '규격 *', field: 'spec', editable: true, width: 145, tooltipField: 'spec' },
      ],
    },
    {
      headerName: '재고수량 (규격기준)',
      marryChildren: true,
      children: [
    { headerName: 'EA', field: 'stockQty', editable: true, valueParser: (p) => Math.max(0, Number(p.newValue) || 0), valueFormatter: (p) => formatDecimal(p.value, 2), width: 110, type: 'numericColumn' },
    { headerName: 'P', valueGetter: (p) => dividedStock(p.data!, 'P'), valueFormatter: (p) => p.value == null ? '-' : formatDecimal(p.value, 2), width: 95, type: 'numericColumn' },
    { headerName: 'BOX', valueGetter: (p) => dividedStock(p.data!, 'BOX'), valueFormatter: (p) => p.value == null ? '-' : formatDecimal(p.value, 2), width: 100, type: 'numericColumn' },
    { headerName: 'PL', valueGetter: (p) => dividedStock(p.data!, 'PL'), valueFormatter: (p) => p.value == null ? '-' : formatDecimal(p.value, 2), width: 80, type: 'numericColumn' },
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
          cellRenderer: (p: { data?: DraftProduct }) => p.data ? <button type="button" onClick={() => { setLocationPickerRowId(p.data!.id); setLocationSearch('') }} className="block w-full truncate text-left text-sm text-[#355b73] hover:underline" title="위치 검색">{p.data.defaultLocation?.code ?? '위치 선택'}</button> : '-',
        },
      ],
    },
    {
      headerName: '금액',
      marryChildren: true,
      children: [
    { headerName: '매입가', field: 'costPrice', editable: true, valueFormatter: (p) => formatDecimal(p.value ?? 0), width: 100, type: 'numericColumn' },
    { headerName: '판매가', field: 'sellPrice', editable: true, valueFormatter: (p) => formatDecimal(p.value ?? 0), width: 100, type: 'numericColumn' },
    { headerName: '소매가', field: 'retailPrice', editable: true, valueFormatter: (p) => formatDecimal(p.value ?? 0), width: 100, type: 'numericColumn' },
    { headerName: '해피미르', field: 'priceA', editable: true, valueFormatter: (p) => formatDecimal(p.value ?? 0), width: 105, type: 'numericColumn' },
    { headerName: 'SSG', field: 'priceB', editable: true, valueFormatter: (p) => formatDecimal(p.value ?? 0), width: 90, type: 'numericColumn' },
    { headerName: 'NAVER', field: 'priceC', editable: true, valueFormatter: (p) => formatDecimal(p.value ?? 0), width: 95, type: 'numericColumn' },
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

  const addRow = () => setRows((current) => [blankProduct(), ...current])
  const deleteRows = () => {
    const selected = new Set(gridRef.current?.api.getSelectedRows().map((row) => row.id) ?? [])
    if (!selected.size) return toast.error('삭제할 행을 선택해주세요')
    // Keep the record visible until save; the server receives a logical deactivation then.
    setRows((current) => current.map((row) => selected.has(row.id) ? { ...row, _deleted: true, _dirty: true } : row))
  }
  const refreshRows = async () => {
    if (!onRefresh || refreshing) return
    setRefreshing(true)
    try {
      // The parent keeps the previous query result while refetching; this never clears rows first.
      await onRefresh()
    } catch {
      toast.error('새로고침에 실패했습니다. 현재 표시된 데이터는 유지됩니다.')
    } finally {
      setRefreshing(false)
    }
  }
  const saveRows = async () => {
    const invalid = rows.find((row) => !row._deleted && (!row.code.trim() || !row.name.trim() || !row.spec?.trim()))
    if (invalid) {
      const missing = [!invalid.code.trim() && '상품코드', !invalid.name.trim() && '상품명', !invalid.spec?.trim() && '규격'].filter(Boolean).join(', ')
      window.alert(`필수 입력 항목을 입력해주세요.\n누락: ${missing}`)
      const rowIndex = rows.findIndex((row) => row.id === invalid.id)
      requestAnimationFrame(() => {
        gridRef.current?.api.ensureIndexVisible(rowIndex, 'middle')
        gridRef.current?.api.setFocusedCell(rowIndex, !invalid.code.trim() ? 'code' : !invalid.name.trim() ? 'name' : 'spec')
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
          unit: row.unit || 'EA', baseUnit: row.baseUnit || 'EA', spec: row.spec || undefined,
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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-end gap-1.5 border-b border-sky-200 bg-sky-50 px-2 py-1.5 dark:border-gray-800 dark:bg-gray-900">
        {onRefresh && (
          <button
            type="button"
            onClick={refreshRows}
            disabled={refreshing || saving}
            title="목록 새로고침"
            aria-label="목록 새로고침"
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#5f8297] bg-white text-[#355b73] transition-colors hover:bg-sky-100 disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        )}
        <button
          onClick={addRow}
          title="행 추가"
          aria-label="행 추가"
          className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#5f8297] bg-white text-[#355b73] transition-colors hover:bg-sky-100"
        >
          <Plus size={15} strokeWidth={2.5} />
        </button>
        <button
          onClick={deleteRows}
          title="선택 행 삭제"
          aria-label="선택 행 삭제"
          className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#5f8297] bg-white text-[#355b73] transition-colors hover:bg-sky-100"
        >
          <Minus size={16} strokeWidth={2.5} />
        </button>
        
        <button onClick={saveRows} disabled={saving} className="inline-flex items-center gap-1 rounded bg-[#355b73] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#294b61] disabled:opacity-50"><Save size={14} /> {saving ? '저장 중' : '저장'}</button>
        {overflowActions && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              title="추가 작업"
              aria-label="추가 작업"
              aria-expanded={menuOpen}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#5f8297] bg-white text-[#355b73] transition-colors hover:bg-sky-100"
            >
              <Menu size={16} strokeWidth={2.2} />
            </button>
            {menuOpen && (
              <div className="product-grid-overflow absolute right-0 top-8 z-50 flex min-w-[132px] flex-col gap-1 rounded border border-sky-200 bg-white p-1.5 shadow-lg">
                {overflowActions}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="product-inventory-grid ag-theme-quartz min-w-0 w-full flex-1 [--ag-background-color:#f7fcff] [--ag-border-color:#c8e4f2] [--ag-cell-horizontal-border:solid_#c8e4f2] [--ag-header-background-color:#2d465a] [--ag-header-foreground-color:#f2f8fc] [--ag-odd-row-background-color:#edf8ff] [--ag-row-border-color:#d7eaf4] [--ag-row-hover-color:#d8f0ff] [--ag-selected-row-background-color:#ccecff]">
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
            'row-required-input': (params) => Boolean(params.data) && !params.data!._deleted && (!params.data!.code.trim() || !params.data!.name.trim() || !params.data!.spec?.trim()),
          }}
          onFirstDataRendered={(params) => {
            requestAnimationFrame(() => params.api.autoSizeAllColumns(false))
          }}
          animateRows={false}
          singleClickEdit
          undoRedoCellEditing
          undoRedoCellEditingLimit={50}
          enterNavigatesVerticallyAfterEdit
          stopEditingWhenCellsLoseFocus
          getRowId={(params) => params.data.id}
          onCellValueChanged={(params) => setRows((current) => current.map((row) => row.id === params.data.id ? {
            ...row,
            _dirty: true,
            _stockDirty: params.colDef.field === 'stockQty' || row._stockDirty,
          } : row))}
        />
      </div>
      {clientPickerRowId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={() => setClientPickerRowId(null)}>
          <div className="flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded bg-white shadow-2xl dark:bg-gray-900" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <div><h3 className="font-semibold text-gray-900 dark:text-white">거래처 선택</h3><p className="mt-0.5 text-xs text-gray-500">거래처명, 전화번호 또는 이메일로 검색합니다.</p></div>
              <button type="button" onClick={() => setClientPickerRowId(null)} className="px-2 py-1 text-sm text-gray-500 hover:text-gray-900">닫기</button>
            </div>
            <div className="border-b border-gray-100 p-3 dark:border-gray-800">
              <input autoFocus value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="거래처 검색" className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#355b73] dark:border-gray-700 dark:bg-gray-800" />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {filteredClients.length === 0 ? <p className="p-8 text-center text-sm text-gray-400">검색 결과가 없습니다.</p> : filteredClients.map((client) => (
                <button key={client.id} type="button" onClick={() => selectClient(client.id)} className="flex w-full items-center justify-between border-b border-gray-100 px-4 py-3 text-left hover:bg-sky-50 dark:border-gray-800 dark:hover:bg-gray-800">
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
            <div className="border-b border-gray-100 p-3 dark:border-gray-800"><input autoFocus value={locationSearch} onChange={(event) => setLocationSearch(event.target.value)} placeholder="위치 검색" className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#355b73] dark:border-gray-700 dark:bg-gray-800" /></div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {filteredLocations.length === 0 ? <p className="p-8 text-center text-sm text-gray-400">검색 결과가 없습니다.</p> : filteredLocations.map((location) => (
                <button key={location.id} type="button" onClick={() => selectLocation(location.id)} className="flex w-full items-center justify-between border-b border-gray-100 px-4 py-3 text-left hover:bg-sky-50 dark:border-gray-800 dark:hover:bg-gray-800">
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
