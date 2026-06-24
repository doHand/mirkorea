'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { ClientSideRowModelModule, ModuleRegistry, type ColDef, type ColGroupDef } from 'ag-grid-community'
import { Menu, Minus, Plus, RefreshCw, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { productApi } from '@/api/product.api'
import { formatDecimal } from '@/utils/format'
import { getPackageUnitQty } from '@/utils/unit-spec'
import type { Product, SaleStatus } from '@/types/api.types'

ModuleRegistry.registerModules([ClientSideRowModelModule])

type DraftProduct = Product & { _new?: boolean }

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
  overflowActions,
  onBarcodeClick,
}: {
  products: Product[]
  onSaved: () => void
  onRefresh?: () => void | Promise<void>
  overflowActions?: ReactNode
  onBarcodeClick?: (product: Product) => void
}) {
  const gridRef = useRef<AgGridReact<DraftProduct>>(null)
  const [rows, setRows] = useState<DraftProduct[]>([])
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => setRows(products.map((product) => ({ ...product }))), [products])

  const categoryOptions = useMemo(
    () => [...new Set(products.map((product) => product.category?.trim()).filter((category): category is string => Boolean(category)))].sort(),
    [products],
  )

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
    { headerName: '거래처명', valueGetter: (p) => p.data?.client?.name ?? '-', pinned: 'left', width: 120, tooltipValueGetter: (p) => p.data?.client?.name ?? '-' },
    { headerName: '상품코드', field: 'code', editable: true, pinned: 'left', width: 125 },
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
    { headerName: '상품명', field: 'name', editable: true, pinned: 'left', width: 160 },
    { headerName: '기준단위', field: 'unit', editable: true, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: ['EA'] }, width: 120 },
    {
      headerName: '규격',
      marryChildren: true,
      children: [
        { headerName: '규격', field: 'spec', editable: true, width: 145, tooltipField: 'spec' },
      ],
    },
    {
      headerName: '재고수량 (규격기준)',
      marryChildren: true,
      children: [
    { headerName: 'EA', valueGetter: (p) => totalEa(p.data!), valueFormatter: (p) => formatDecimal(p.value, 2), width: 110, type: 'numericColumn' },
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
        { headerName: '위치', valueGetter: (p) => p.data?.defaultLocation?.code ?? '-', width: 120, tooltipValueGetter: (p) => p.data?.defaultLocation?.code ?? '-' },
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
  ], [categoryOptions, onBarcodeClick])

  const addRow = () => setRows((current) => [blankProduct(), ...current])
  const deleteRows = () => {
    const selected = new Set(gridRef.current?.api.getSelectedRows().map((row) => row.id) ?? [])
    if (!selected.size) return toast.error('삭제할 행을 선택해주세요')
    setRows((current) => current.filter((row) => !selected.has(row.id)))
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
    const invalid = rows.find((row) => !row.code.trim() || !row.name.trim())
    if (invalid) return toast.error('상품코드와 상품명은 필수입니다')
    setSaving(true)
    try {
      for (const row of rows) {
        const data = {
          code: row.code.trim(), name: row.name.trim(), category: row.category || undefined,
          unit: 'EA', baseUnit: 'EA' as const, spec: row.spec || undefined,
          pUnitQty: getPackageUnitQty(row, 'P') ?? undefined,
          boxUnitQty: getPackageUnitQty(row, 'BOX') ?? undefined,
          plUnitQty: getPackageUnitQty(row, 'PL') ?? undefined,
          boxQty: Number(row.boxQty || 1), safetyStock: Number(row.safetyStock || 0),
          materialNo: row.materialNo || undefined, memo: row.memo || undefined,
          costPrice: Number(row.costPrice || 0), sellPrice: Number(row.sellPrice || 0), retailPrice: Number(row.retailPrice || 0),
          priceA: Number(row.priceA || 0), priceB: Number(row.priceB || 0), priceC: Number(row.priceC || 0),
          saleStatus: row.saleStatus,
        }
        if (row._new) await productApi.create(data)
        else await productApi.update(row.id, data)
      }
      toast.success('변경사항을 저장했습니다')
      onSaved()
    } catch {
      toast.error('저장 중 오류가 발생했습니다')
    } finally {
      setSaving(false)
    }
  }

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
          rowClassRules={{ 'row-below-safety': (params) => Boolean(params.data) && totalEa(params.data!) < Number(params.data!.safetyStock ?? 0) }}
          onFirstDataRendered={(params) => {
            requestAnimationFrame(() => params.api.autoSizeAllColumns(false))
          }}
          animateRows={false}
          stopEditingWhenCellsLoseFocus
          getRowId={(params) => params.data.id}
          onCellValueChanged={() => setRows((current) => [...current])}
        />
      </div>
    </div>
  )
}
