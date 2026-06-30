'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GetRowIdParams } from 'ag-grid-community'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Minus, Plus, RefreshCw, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { categoryApi } from '@/api/product.api'
import type { ProductCategory } from '@/types/api.types'

type DraftCategory = ProductCategory & { _new?: boolean; _deleted?: boolean; _dirty?: boolean }

const blankCategory = (): DraftCategory => ({
  id: `new-${crypto.randomUUID()}`,
  name: '',
  description: '',
  sortOrder: 0,
  isActive: true,
  createdAt: new Date().toISOString(),
  _new: true,
})

export default function CategoriesPage() {
  const qc = useQueryClient()
  const gridRef = useRef<AgGridReact<DraftCategory>>(null)
  const [rows, setRows] = useState<DraftCategory[]>([])
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['product-categories'],
    queryFn: () => categoryApi.findAll(),
  })

  useEffect(() => {
    if (data) setRows(data.map((c) => ({ ...c })))
  }, [data])

  const addRow = () => {
    const newCat = blankCategory()
    setRows((curr) => [newCat, ...curr])
    requestAnimationFrame(() => {
      gridRef.current?.api.ensureIndexVisible(0, 'top')
      gridRef.current?.api.startEditingCell({ rowIndex: 0, colKey: 'name' })
    })
  }

  const deleteRows = () => {
    const selected = new Set(gridRef.current?.api.getSelectedRows().map((r) => r.id) ?? [])
    if (!selected.size) return toast.error('삭제할 행을 선택해주세요')
    setRows((curr) => curr.map((r) => selected.has(r.id) ? { ...r, _deleted: true, _dirty: true } : r))
  }

  const refreshRows = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      const fresh = await refetch()
      if (fresh.data) setRows(fresh.data.map((c) => ({ ...c })))
    } catch {
      toast.error('새로고침에 실패했습니다')
    } finally {
      setRefreshing(false)
    }
  }

  const saveRows = async () => {
    const invalid = rows.find((r) => !r._deleted && !r.name.trim())
    if (invalid) {
      toast.error('카테고리명을 입력해주세요')
      return
    }
    setSaving(true)
    let hasError = false
    try {
      for (const row of rows) {
        if (row._deleted) {
          if (!row._new) {
            try {
              await categoryApi.delete(row.id)
            } catch {
              toast.error(`"${row.name}" 카테고리를 사용 중인 상품이 있어 삭제할 수 없습니다`)
              hasError = true
            }
          }
          continue
        }
        if (row._new) {
          await categoryApi.create({ name: row.name.trim(), description: row.description ?? '', sortOrder: row.sortOrder })
        } else if (row._dirty) {
          await categoryApi.update(row.id, { name: row.name.trim(), description: row.description ?? '', sortOrder: row.sortOrder })
        }
      }
      if (!hasError) toast.success('저장되었습니다')
      qc.invalidateQueries({ queryKey: ['product-categories'] })
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message
      toast.error(msg?.includes('중복') ? '이미 존재하는 카테고리명입니다' : '저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  const columns = useMemo<ColDef<DraftCategory>[]>(() => [
    {
      headerName: '',
      width: 44,
      minWidth: 44,
      maxWidth: 44,
      checkboxSelection: true,
      headerCheckboxSelection: true,
      sortable: false,
      filter: false,
      resizable: false,
    },
    {
      headerName: '카테고리명',
      field: 'name',
      editable: true,
      flex: 1,
      minWidth: 160,
      cellRenderer: (p: { data?: DraftCategory }) => {
        if (!p.data) return null
        if (!p.data.name) return <span className="text-gray-300 dark:text-gray-600 text-xs italic">카테고리명 입력</span>
        return p.data.isActive
          ? <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">{p.data.name}</span>
          : <span className="text-gray-400 text-sm">{p.data.name} <span className="text-xs">(비활성)</span></span>
      },
    },
    {
      headerName: '설명',
      field: 'description',
      editable: true,
      flex: 2,
      minWidth: 200,
      cellRenderer: (p: { data?: DraftCategory }) => (
        <span className="text-gray-400 dark:text-gray-500 text-sm">{p.data?.description || '—'}</span>
      ),
    },
    {
      headerName: '순서',
      field: 'sortOrder',
      editable: true,
      width: 90,
      type: 'numericColumn',
      sort: 'asc',
      valueParser: (p) => Number(p.newValue) || 0,
    },
  ], [])

  return (
    <div className="flex flex-col gap-3" style={{ height: 'calc(100vh - 120px)' }}>
      <div className="app-surface flex flex-col min-h-0 flex-1 overflow-hidden">
        <div className="wms-detail-header flex shrink-0 items-center justify-between border-b px-3 py-2">
          <div className="min-w-0">
            <span className="wms-detail-label text-xs font-semibold">카테고리 관리</span>
            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">상품 분류 카테고리를 관리합니다.</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={refreshRows}
              disabled={refreshing || saving}
              title="새로고침"
              className="wms-icon-button inline-flex h-7 w-7 items-center justify-center rounded transition-colors disabled:opacity-40"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={addRow}
              title="행 추가"
              className="wms-icon-button inline-flex h-7 w-7 items-center justify-center rounded transition-colors"
            >
              <Plus size={15} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={deleteRows}
              title="선택 행 삭제"
              className="wms-icon-button inline-flex h-7 w-7 items-center justify-center rounded transition-colors"
            >
              <Minus size={16} strokeWidth={2.5} />
            </button>
            <button
              onClick={saveRows}
              disabled={saving}
              className="wms-primary-button inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
            >
              <Save size={13} /> {saving ? '저장 중' : '저장'}
            </button>
          </div>
        </div>
        <div className="ag-theme-quartz ag-theme-wms wms-ag-grid flex-1 min-h-0 w-full">
          <AgGridReact<DraftCategory>
            ref={gridRef}
            rowData={rows}
            columnDefs={columns}
            defaultColDef={{ sortable: true, resizable: true, filter: true, suppressHeaderMenuButton: true, minWidth: 90 }}
            getRowId={(params: GetRowIdParams<DraftCategory>) => params.data.id}
            loading={isLoading}
            rowSelection="multiple"
            singleClickEdit
            stopEditingWhenCellsLoseFocus
            undoRedoCellEditing
            undoRedoCellEditingLimit={30}
            enterNavigatesVerticallyAfterEdit
            animateRows
            headerHeight={36}
            rowClassRules={{
              'row-pending-delete': (params) => Boolean(params.data?._deleted),
              'row-new': (params) => Boolean(params.data?._new) && !params.data?._deleted,
              'row-modified': (params) => Boolean(params.data?._dirty) && !params.data?._new && !params.data?._deleted,
            }}
            onCellValueChanged={(params) =>
              setRows((curr) => curr.map((r) => r.id === params.data.id ? { ...r, _dirty: true } : r))
            }
            overlayLoadingTemplate={'<span class="ag-overlay-loading-center">불러오는 중…</span>'}
            overlayNoRowsTemplate={'<span class="ag-overlay-no-rows-center">카테고리가 없습니다. + 버튼으로 추가하세요.</span>'}
          />
        </div>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-600 shrink-0">
        * 카테고리 이름을 변경하면 해당 카테고리를 사용 중인 모든 상품에 자동으로 반영됩니다.<br />
        * 상품이 등록된 카테고리는 삭제할 수 없습니다.
      </p>
    </div>
  )
}
