'use client'

import { AgGridReact } from 'ag-grid-react'
import { ClientSideRowModelModule, ModuleRegistry, type ColDef, type GetRowIdParams, type RowClickedEvent } from 'ag-grid-community'

ModuleRegistry.registerModules([ClientSideRowModelModule])

/** Shared read/write grid shell for operational lists. It never clears row data during loading. */
export function AppAgGrid<T extends { id: string }>({
  rows,
  columns,
  loading = false,
  onRowClicked,
  onRowDoubleClicked,
  className = '',
  rowHeight,
  headerHeight,
}: {
  rows: T[]
  columns: ColDef<T>[]
  loading?: boolean
  onRowClicked?: (row: T) => void
  onRowDoubleClicked?: (row: T) => void
  className?: string
  rowHeight?: number
  headerHeight?: number
}) {
  return (
    <div className={`ag-theme-quartz ag-theme-wms wms-ag-grid h-full min-h-0 w-full ${className}`}>
      <AgGridReact<T>
        rowData={rows}
        columnDefs={columns}
        getRowId={(params: GetRowIdParams<T>) => params.data.id}
        defaultColDef={{ sortable: true, resizable: true, filter: true, minWidth: 90, suppressHeaderMenuButton: true }}
        overlayLoadingTemplate={'<span class="ag-overlay-loading-center">불러오는 중…</span>'}
        overlayNoRowsTemplate={'<span class="ag-overlay-no-rows-center">표시할 데이터가 없습니다.</span>'}
        loading={loading}
        rowHeight={rowHeight}
        headerHeight={headerHeight}
        animateRows
        onRowClicked={(event: RowClickedEvent<T>) => event.data && onRowClicked?.(event.data)}
        onRowDoubleClicked={(event) => event.data && onRowDoubleClicked?.(event.data)}
      />
    </div>
  )
}
