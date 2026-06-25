'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AgGridReact } from 'ag-grid-react'
import { ClientSideRowModelModule, ModuleRegistry } from 'ag-grid-community'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import { Minus, MoreHorizontal, Plus, RefreshCw, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { productApi } from '@/api/product.api'
import { ExportButton } from '@/components/ExportButton'
import { ImportButton } from '@/components/ImportButton'
import type { ImportConfig } from '@/components/ImportButton'
import type { BarcodeUnitType } from '@/types/api.types'

ModuleRegistry.registerModules([ClientSideRowModelModule])

const TYPE_LABEL: Record<BarcodeUnitType, string> = {
  UNIT: '일반(UNIT)',
  CXD: 'CXD IN',
  CXD_OUT: 'CXD OUT',
}
const TYPE_VALUES: BarcodeUnitType[] = ['UNIT', 'CXD', 'CXD_OUT']
const TYPE_MAP: Record<string, BarcodeUnitType> = {
  UNIT: 'UNIT', '일반': 'UNIT', '일반(UNIT)': 'UNIT',
  CXD: 'CXD', 'CXD IN': 'CXD',
  CXD_OUT: 'CXD_OUT', 'CXD OUT': 'CXD_OUT',
}

type BarcodeRow = {
  id: string
  productId: string
  productCode: string
  productName: string
  barcode: string
  type: BarcodeUnitType
  unitQty: number
  isPrimary: boolean
  isActive: boolean
  _new?: boolean
  _dirty?: boolean
  _deleted?: boolean
}

const blankRow = (): BarcodeRow => ({
  id: `new-${crypto.randomUUID()}`,
  productId: '', productCode: '', productName: '',
  barcode: '', type: 'UNIT', unitQty: 1, isPrimary: false, isActive: true,
  _new: true,
})

function makeBarcodeImportConfig(refetchRows: () => Promise<void>): ImportConfig {
  return {
    templateFilename: '바코드_가져오기_템플릿.xlsx',
    sheetName: '바코드',
    templateRows: [
      { 상품코드: 'IN-001', 바코드번호: '8801043011082', 유형: '일반(UNIT)', 구성수량: 1, 대표여부: 'Y' },
      { 상품코드: 'IN-001', 바코드번호: '2901001000027', 유형: 'CXD IN',  구성수량: 10, 대표여부: 'N' },
      { 상품코드: 'IN-001', 바코드번호: '8801043011099', 유형: 'CXD OUT', 구성수량: 12, 대표여부: 'N' },
    ],
    parse: (raw) =>
      raw.map((row) => {
        const str = (...keys: string[]) => keys.map(k => row[k]).find(v => v !== undefined && v !== '') as string | undefined
        const productCode = str('상품코드', 'productCode') ?? ''
        const barcode     = str('바코드번호', 'barcode') ?? ''
        const typeRaw     = (str('유형', 'type') ?? 'UNIT').toString().trim()
        const type        = TYPE_MAP[typeRaw] ?? TYPE_MAP[typeRaw.toUpperCase()] ?? 'UNIT'
        const unitQty     = Number(str('구성수량', 'unitQty') ?? 1) || 1
        const primaryRaw  = (str('대표여부', 'isPrimary') ?? '').toString().toUpperCase()
        const isPrimary   = primaryRaw === 'Y' || primaryRaw === 'TRUE' || primaryRaw === '대표'
        return {
          productCode, barcode, type, unitQty, isPrimary,
          _error: !productCode || !barcode ? '상품코드/바코드 필수' : undefined,
        }
      }),
    previewColumns: [
      { key: 'productCode', label: '상품코드', mono: true },
      { key: 'barcode',     label: '바코드번호', mono: true },
      { key: 'type',        label: '유형', format: (v) => TYPE_LABEL[v as BarcodeUnitType] ?? String(v) },
      { key: 'unitQty',     label: '구성수량', align: 'right' },
      { key: 'isPrimary',   label: '대표', align: 'center', format: (v) => v ? 'Y' : '' },
    ],
    save: async (validRows, setProgress) => {
      const allProducts = (await productApi.findAll({ limit: 9999 })).items
      let ok = 0, fail = 0
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i]
        const product = allProducts.find(p => p.code === row.productCode)
        if (!product) { fail++; setProgress(Math.round(((i + 1) / validRows.length) * 100)); continue }
        try {
          await productApi.addBarcode(product.id, {
            barcode: row.barcode as string,
            type: row.type as BarcodeUnitType,
            unitQty: Number(row.unitQty),
            isPrimary: Boolean(row.isPrimary),
          })
          ok++
        } catch { fail++ }
        setProgress(Math.round(((i + 1) / validRows.length) * 100))
      }
      await refetchRows()
      return { ok, fail }
    },
  }
}

/* ── Page ─────────────────────────────────────────────────────── */
export default function BarcodesPage() {
  const qc = useQueryClient()
  const gridRef = useRef<AgGridReact<BarcodeRow>>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [rows, setRows] = useState<BarcodeRow[]>([])
  const [saving, setSaving] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const refetchRows = useCallback(async () => {
    const data = await productApi.findAllBarcodes()
    setRows(data)
    qc.invalidateQueries({ queryKey: ['product-barcodes'] })
  }, [qc])

  const { isLoading } = useQuery({
    queryKey: ['all-barcodes'],
    queryFn: async () => {
      const data = await productApi.findAllBarcodes()
      setRows(data)
      return data
    },
  })

  const barcodeImportConfig = useMemo(() => makeBarcodeImportConfig(refetchRows), [refetchRows])

  const visibleRows = useMemo(() => rows.filter(r => !r._deleted), [rows])
  const hasChanges  = rows.some(r => r._new || r._dirty || r._deleted)

  const productColorMap = useMemo(() => {
    const map = new Map<string, 0 | 1 | 2>()
    const codes = [...new Set(visibleRows.map(r => r.productCode).filter(Boolean))].sort()
    codes.forEach((code, i) => map.set(code, (i % 3) as 0 | 1 | 2))
    return map
  }, [visibleRows])

  const updateRow = useCallback((id: string, patch: Partial<BarcodeRow>) => {
    setRows(prev => prev.map(r =>
      r.id === id ? { ...r, ...patch, _dirty: r._new ? r._dirty : true } : r,
    ))
  }, [])

  const deleteRow = useCallback((row: BarcodeRow) => {
    if (row._new) {
      setRows(prev => prev.filter(r => r.id !== row.id))
    } else {
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, _deleted: true } : r))
    }
  }, [])

  const addRow = useCallback(() => {
    setRows(prev => [blankRow(), ...prev])
  }, [])

  const discardChanges = useCallback(async () => {
    const data = await productApi.findAllBarcodes()
    setRows(data)
  }, [])

  const saveChanges = async () => {
    setSaving(true)
    let ok = 0, fail = 0
    try {
      for (const row of rows.filter(r => r._deleted)) {
        try { await productApi.deleteBarcode(row.productId, row.id); ok++ } catch { fail++ }
      }
      for (const row of rows.filter(r => r._dirty && !r._deleted && !r._new)) {
        try {
          await productApi.updateBarcode(row.productId, row.id, {
            barcode: row.barcode, type: row.type, unitQty: row.unitQty, isPrimary: row.isPrimary,
          })
          ok++
        } catch { fail++ }
      }
      const newRows = rows.filter(r => r._new && r.productCode && r.barcode)
      if (newRows.length > 0) {
        const allProducts = (await productApi.findAll({ limit: 9999 })).items
        for (const row of newRows) {
          const product = allProducts.find(p => p.code === row.productCode)
          if (!product) { fail++; continue }
          try {
            await productApi.addBarcode(product.id, {
              barcode: row.barcode, type: row.type, unitQty: row.unitQty, isPrimary: row.isPrimary,
            })
            ok++
          } catch { fail++ }
        }
      }
      if (ok > 0) toast.success(`${ok}건 저장 완료`)
      if (fail > 0) toast.error(`${fail}건 실패`)
      await refetchRows()
    } finally {
      setSaving(false)
    }
  }

  /* ── Column defs ────────────────────────────────────────────── */
  const colDefs: ColDef<BarcodeRow>[] = useMemo(() => [
    {
      headerName: '',
      checkboxSelection: true,
      headerCheckboxSelection: true,
      width: 44,
      minWidth: 44,
      suppressMovable: true,
      resizable: false,
    },
    {
      headerName: '상품코드', field: 'productCode', width: 120, sort: 'asc', sortIndex: 0,
      editable: p => !!p.data?._new,
      onCellValueChanged: p => updateRow(p.data.id, { productCode: p.newValue }),
    },
    {
      headerName: '상품명', field: 'productName', flex: 1, minWidth: 140,
      editable: false,
    },
    {
      headerName: '바코드번호', field: 'barcode', flex: 1, minWidth: 160,
      editable: true,
      onCellValueChanged: p => updateRow(p.data.id, { barcode: p.newValue }),
    },
    {
      headerName: '유형', field: 'type', width: 120,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: TYPE_VALUES },
      valueFormatter: p => p.value ? TYPE_LABEL[p.value as BarcodeUnitType] : '',
      onCellValueChanged: p => {
        const type = p.newValue as BarcodeUnitType
        updateRow(p.data.id, { type, unitQty: type === 'UNIT' ? 1 : p.data.unitQty })
      },
    },
    {
      headerName: '구성수량', field: 'unitQty', width: 90,
      type: 'numericColumn',
      editable: p => p.data?.type !== 'UNIT',
      cellEditor: 'agNumberCellEditor',
      onCellValueChanged: p => updateRow(p.data.id, { unitQty: Number(p.newValue) || 1 }),
    },
    {
      headerName: '대표', field: 'isPrimary', width: 64,
      cellRenderer: (p: ICellRendererParams<BarcodeRow>) => (
        <div className="flex h-full items-center justify-center">
          <input
            type="checkbox"
            checked={!!p.value}
            onChange={e => {
              const checked = e.target.checked
              const rowId = p.data!.id
              const code = p.data!.productCode
              setRows(prev => prev.map(r => {
                if (r.id === rowId) return { ...r, isPrimary: checked, _dirty: r._new ? r._dirty : true }
                if (checked && r.productCode === code) return { ...r, isPrimary: false, _dirty: r._new ? r._dirty : true }
                return r
              }))
            }}
            className="wms-checkbox"
          />
        </div>
      ),
    },
  ], [updateRow])

  return (
    <div className="flex h-[calc(100vh-118px)] min-h-0 flex-col gap-2 overflow-hidden">
      {/* 헤더 */}
      <div>
        <h2 className="whitespace-nowrap text-base font-bold text-gray-900 dark:text-white tracking-tight">바코드 관리</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">상품코드 기준 오름차순. 셀을 클릭하면 편집됩니다.</p>
      </div>

      {/* 그리드 + 툴바 */}
      <div className="app-surface flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden dark:border-gray-800 dark:bg-gray-900">
        {/* 툴바 */}
        <div className="wms-grid-toolbar flex items-center justify-end gap-1.5 border-b px-2 py-1.5">
          <button
            onClick={addRow}
            title="행 추가"
            aria-label="행 추가"
            className="wms-toolbar-action inline-flex h-7 w-7 items-center justify-center rounded transition-colors"
          >
            <Plus size={15} strokeWidth={2.5} />
          </button>
          <button
            onClick={() => {
              const api = gridRef.current?.api
              const selected = api?.getSelectedRows() ?? []
              if (!selected.length) { toast.error('삭제할 행을 선택해주세요'); return }
              selected.forEach(r => deleteRow(r))
            }}
            title="선택 행 삭제"
            aria-label="선택 행 삭제"
            className="wms-toolbar-action inline-flex h-7 w-7 items-center justify-center rounded transition-colors"
          >
            <Minus size={16} strokeWidth={2.5} />
          </button>
          <button
            onClick={discardChanges}
            disabled={saving}
            title="변경사항을 버리고 기존 데이터로 초기화"
            className="wms-toolbar-action inline-flex h-7 items-center gap-1 rounded px-2 text-xs transition-colors disabled:opacity-40"
          >
            <RefreshCw size={13} /> 
          </button>
          <button
            onClick={saveChanges}
            disabled={saving || !hasChanges}
            className="wms-toolbar-action inline-flex items-center gap-1 rounded px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40"
          >
            <Save size={14} /> {saving ? '저장 중' : '저장'}
          </button>
   
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              title="더보기"
              className="wms-toolbar-action inline-flex h-7 w-7 items-center justify-center rounded transition-colors"
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen && (
              <div className="product-grid-overflow absolute right-0 top-full z-20 mt-1 flex w-32 flex-col gap-0.5 rounded border border-gray-200 bg-white p-1 shadow-md dark:border-gray-700 dark:bg-gray-900">
                <ExportButton
                  filename="바코드목록"
                  getData={() =>
                    visibleRows.map(r => ({
                      '상품코드': r.productCode,
                      '상품명':   r.productName,
                      '바코드번호': r.barcode,
                      '유형':     TYPE_LABEL[r.type],
                      '구성수량': r.unitQty,
                      '대표여부': r.isPrimary ? 'Y' : 'N',
                    }))
                  }
                />
                <ImportButton config={barcodeImportConfig} onImported={refetchRows} />
              </div>
            )}
          </div>
        </div>

        {/* 그리드 */}
        <div className="ag-theme-quartz ag-theme-wms wms-ag-grid min-w-0 w-full flex-1">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-400 animate-pulse">불러오는 중...</div>
          ) : (
            <AgGridReact<BarcodeRow>
              ref={gridRef}
              rowData={visibleRows}
              columnDefs={colDefs}
              defaultColDef={{ resizable: true, suppressHeaderMenuButton: true }}
              rowSelection="multiple"
              rowClassRules={{
                'barcode-group-0': p => !p.data?._new && productColorMap.get(p.data?.productCode ?? '') === 0,
                'barcode-group-1': p => !p.data?._new && productColorMap.get(p.data?.productCode ?? '') === 1,
                'barcode-group-2': p => !p.data?._new && productColorMap.get(p.data?.productCode ?? '') === 2,
                'row-new':      p => !!p.data?._new,
                'row-modified': p => !!p.data?._dirty && !p.data?._new,
              }}
              headerHeight={36}
              animateRows
              stopEditingWhenCellsLoseFocus
              singleClickEdit
            />
          )}
        </div>
      </div>
    </div>
  )
}
