'use client'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import { Minus, Plus, RefreshCw, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { unitApi } from '@/api/product.api'
import type { ProductUnit } from '@/types/api.types'

const DEFAULT_UNITS = ['EA', 'OUT', 'PALLET']

type UnitRow = {
  id: string
  code: string
  label: string
  description: string
  sortOrder: number
  _new?: boolean
  _dirty?: boolean
  _deleted?: boolean
}

const blankRow = (): UnitRow => ({
  id: `new-${crypto.randomUUID()}`,
  code: '', label: '', description: '', sortOrder: 0,
  _new: true,
})

function toRow(u: ProductUnit): UnitRow {
  return { id: u.id, code: u.code, label: u.label, description: u.description ?? '', sortOrder: u.sortOrder }
}

export default function UnitsPage() {
  const qc = useQueryClient()
  const gridRef = useRef<AgGridReact<UnitRow>>(null)
  const [rows, setRows] = useState<UnitRow[]>([])
  const [saving, setSaving] = useState(false)

  const { isLoading } = useQuery({
    queryKey: ['product-units'],
    queryFn: async () => {
      const data = await unitApi.findAll()
      setRows(data.map(toRow))
      return data
    },
  })

  const refetchRows = useCallback(async () => {
    const data = await unitApi.findAll()
    setRows(data.map(toRow))
    qc.invalidateQueries({ queryKey: ['product-units'] })
  }, [qc])

  const updateRow = useCallback((id: string, patch: Partial<UnitRow>) => {
    setRows(prev => prev.map(r =>
      r.id === id ? { ...r, ...patch, _dirty: r._new ? r._dirty : true } : r,
    ))
  }, [])

  const visibleRows = useMemo(() => rows.filter(r => !r._deleted), [rows])
  const hasChanges  = rows.some(r => r._new || r._dirty || r._deleted)

  const addRow = useCallback(() => {
    setRows(prev => [blankRow(), ...prev])
  }, [])

  const deleteSelected = useCallback(() => {
    const api = gridRef.current?.api
    const selected = api?.getSelectedRows() ?? []
    if (!selected.length) { toast.error('???????깆뱽 ?醫뤾문??곻폒?紐꾩뒄'); return }
    const protected_ = selected.filter(r => DEFAULT_UNITS.includes(r.code))
    if (protected_.length > 0) {
      toast.error(`${protected_.map(r => r.code).join(', ')}??疫꿸퀡????μ맄嚥??????????곷뮸??덈뼄`)
    }
    const toDelete = selected.filter(r => !DEFAULT_UNITS.includes(r.code))
    toDelete.forEach(r => {
      if (r._new) {
        setRows(prev => prev.filter(row => row.id !== r.id))
      } else {
        setRows(prev => prev.map(row => row.id === r.id ? { ...row, _deleted: true } : row))
      }
    })
  }, [])

  const discardChanges = useCallback(async () => {
    await refetchRows()
  }, [refetchRows])

  const saveChanges = async () => {
    setSaving(true)
    let ok = 0, fail = 0
    try {
      for (const row of rows.filter(r => r._deleted && !r._new)) {
        try { await unitApi.delete(row.id); ok++ } catch { fail++ }
      }
      for (const row of rows.filter(r => r._dirty && !r._deleted && !r._new)) {
        try {
          await unitApi.update(row.id, {
            code: row.code.toUpperCase(),
            label: row.label,
            description: row.description,
            sortOrder: row.sortOrder,
          })
          ok++
        } catch { fail++ }
      }
      for (const row of rows.filter(r => r._new && r.code && r.label)) {
        try {
          await unitApi.create({
            code: row.code.toUpperCase(),
            label: row.label,
            description: row.description,
            sortOrder: row.sortOrder,
          })
          ok++
        } catch { fail++ }
      }
      if (ok > 0) toast.success(`${ok}椰??????袁⑥┷`)
      if (fail > 0) toast.error(`${fail}椰???쎈솭`)
      await refetchRows()
    } finally {
      setSaving(false)
    }
  }

  const colDefs: ColDef<UnitRow>[] = useMemo(() => [
    {
      headerName: '',
      checkboxSelection: true,
      headerCheckboxSelection: true,
      width: 52,
      minWidth: 52,
      maxWidth: 52,
      suppressMovable: true,
      resizable: false,
    },
    {
      headerName: '코드', field: 'code', width: 100,
      sort: 'asc', sortIndex: 1,
      editable: true,
      valueParser: p => (p.newValue as string).toUpperCase(),
      onCellValueChanged: p => updateRow(p.data.id, { code: (p.newValue as string).toUpperCase() }),
    },
    {
      headerName: '라벨', field: 'label', width: 130,
      editable: true,
      onCellValueChanged: p => updateRow(p.data.id, { label: p.newValue }),
    },
    {
      headerName: '설명', field: 'description', flex: 1, minWidth: 160,
      editable: true,
      onCellValueChanged: p => updateRow(p.data.id, { description: p.newValue ?? '' }),
    },
    {
      headerName: '순번', field: 'sortOrder', width: 110, minWidth: 100,
      sort: 'asc', sortIndex: 0,
      type: 'numericColumn',
      editable: true,
      cellEditor: 'agNumberCellEditor',
      onCellValueChanged: p => updateRow(p.data.id, { sortOrder: Number(p.newValue) || 0 }),
    },
  ], [updateRow])

  return (
    <div className="flex h-[calc(100vh-118px)] min-h-0 flex-col gap-2 overflow-hidden">
      <div>
        <h2 className="whitespace-nowrap text-base font-bold text-gray-900 dark:text-white tracking-tight">단위 관리</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">EA, OUT, PALLET 등 단위 마스터를 관리합니다. 셀을 클릭하면 편집됩니다.</p>
      </div>

      <div className="app-surface flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden dark:border-gray-800 dark:bg-gray-900">
        {/* ??而?*/}
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
            onClick={deleteSelected}
            title="선택 행 삭제"
            aria-label="선택 행 삭제"
            className="wms-toolbar-action inline-flex h-7 w-7 items-center justify-center rounded transition-colors"
          >
            <Minus size={16} strokeWidth={2.5} />
          </button>
          <button
            onClick={discardChanges}
            disabled={saving}
            title="변경사항을 버리고 서버 데이터로 새로고침"
            className="wms-toolbar-action inline-flex h-7 items-center gap-1 rounded px-2 text-xs transition-colors disabled:opacity-40"
          >
            <RefreshCw size={13} /> 새로고침
          </button>
          <button
            onClick={saveChanges}
            disabled={saving || !hasChanges}
            className="wms-toolbar-action inline-flex items-center gap-1 rounded px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40"
          >
            <Save size={14} /> {saving ? '저장 중' : '저장'}
          </button>
        </div>

        {/* 域밸챶???*/}
        <div className="ag-theme-quartz ag-theme-wms wms-ag-grid min-w-0 w-full flex-1">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-400 animate-pulse">불러오는 중...</div>
          ) : (
            <AgGridReact<UnitRow>
              ref={gridRef}
              rowData={visibleRows}
              columnDefs={colDefs}
              defaultColDef={{ resizable: true, suppressHeaderMenuButton: true }}
              rowSelection="multiple"
              rowClassRules={{
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
      <p className="text-xs text-gray-400 dark:text-gray-600">* EA, OUT, PALLET은 기본 단위로 삭제할 수 없습니다.</p>
    </div>
  )
}
