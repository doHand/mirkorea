'use client'

import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { ClientSideRowModelModule, ModuleRegistry, type ColDef } from 'ag-grid-community'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileDown, Plus, Printer, RefreshCw, RotateCcw, Search, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { outboundOrderApi } from '@/api/outbound-order.api'
import { clientApi } from '@/api/client.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { useSupplierInfoStore } from '@/stores/supplier-info.store'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { printExternalPickingList } from '@/utils/printPickingList'
import { formatNumber } from '@/utils/format'
import { formatUnitSpec } from '@/utils/unit-spec'
import { cn } from '@/utils/cn'
import * as ui from '@/styles/ui'
import { CollectOrderModal } from '@/components/CollectOrderModal'
import { StatusBadge } from '@/components/StatusBadge'
import type { OutboundOrder, OutboundOrderItem, OutboundOrderStatus } from '@/types/api.types'

ModuleRegistry.registerModules([ClientSideRowModelModule])

type DerivedStatus = OutboundOrderStatus | 'PICKING'
type TabId = 'ALL' | 'COLLECTED' | 'INSTRUCTED' | 'PICKING' | 'PICKED' | 'SHIPPED' | 'HOLD_CANCEL'

interface OutboundLineRow {
  id: string
  rowNo: number
  order: OutboundOrder
  item: OutboundOrderItem
  derived: DerivedStatus
  date: string
  orderNo: string
  customer: string
  productName: string
  productCode: string
  spec: string
  outQty: number
  unit: string
  eaQty: number
  pickedQty: number
  remainingQty: number
}

const STATUS_LABEL: Record<DerivedStatus, string> = {
  COLLECTED: '출고대기',
  INSTRUCTED: '피킹대기',
  PICKING: '피킹중',
  PICKED: '피킹완료',
  SHIPPED: '출고완료',
  ON_HOLD: '보류',
  CANCELLED: '취소',
}

const STATUS_VARIANT: Record<DerivedStatus, 'blue' | 'amber' | 'orange' | 'emerald' | 'purple' | 'indigo' | 'gray'> = {
  COLLECTED: 'blue',
  INSTRUCTED: 'amber',
  PICKING: 'orange',
  PICKED: 'emerald',
  SHIPPED: 'purple',
  ON_HOLD: 'indigo',
  CANCELLED: 'gray',
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'ALL', label: '전체' },
  { id: 'COLLECTED', label: '출고대기' },
  { id: 'INSTRUCTED', label: '피킹대기' },
  { id: 'PICKING', label: '피킹중' },
  { id: 'PICKED', label: '피킹완료' },
  { id: 'SHIPPED', label: '출고완료' },
  { id: 'HOLD_CANCEL', label: '보류/취소' },
]

function getDerivedStatus(order: OutboundOrder): DerivedStatus {
  if (order.status === 'INSTRUCTED' && order.items.some((item) => item.pickedBoxCount > 0)) {
    return 'PICKING'
  }
  return order.status
}

function matchesTab(order: OutboundOrder, tab: TabId): boolean {
  if (tab === 'ALL') return true
  if (tab === 'HOLD_CANCEL') return order.status === 'ON_HOLD' || order.status === 'CANCELLED'
  const derived = getDerivedStatus(order)
  if (tab === 'PICKING') return derived === 'PICKING'
  if (tab === 'INSTRUCTED') return derived === 'INSTRUCTED'
  return order.status === tab
}

export default function OutboundPage() {
  const warehouse = useWarehouseStore((state) => state.selectedWarehouse)
  const supplierInfo = useSupplierInfoStore((state) => state.info)
  const qc = useQueryClient()
  const gridRef = useRef<AgGridReact<OutboundLineRow>>(null)

  const [activeTab, setActiveTab] = useState<TabId>('ALL')
  const [search, setSearch] = useState('')
  const [pendingSearch, setPendingSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editOrder, setEditOrder] = useState<OutboundOrder | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<OutboundOrder | null>(null)
  const [pickQtys, setPickQtys] = useState<Record<string, number>>({})

  const { data, isLoading, isFetching } = useQuery({
    queryKey: QUERY_KEYS.outboundOrders({ warehouseId: warehouse?.id, search }),
    queryFn: () => outboundOrderApi.findAll({ warehouseId: warehouse!.id, search: search || undefined, limit: 200 }),
    enabled: !!warehouse?.id,
  })

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', 'active'],
    queryFn: clientApi.findAllActive,
  })

  const orders = data?.items ?? []

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['outbound-orders'] })
  }

  const instruct = useMutation({
    mutationFn: outboundOrderApi.instruct,
    onSuccess: (order) => {
      toast.success('출고지시를 확정했습니다')
      setSelectedOrder(order)
      refresh()
    },
    onError: () => toast.error('출고지시 확정에 실패했습니다'),
  })

  const completePicking = useMutation({
    mutationFn: outboundOrderApi.completePicking,
    onSuccess: (updated) => {
      toast.success('피킹 완료 처리했습니다')
      setSelectedOrder(updated[0] ?? null)
      refresh()
    },
    onError: () => toast.error('피킹 완료 처리에 실패했습니다'),
  })

  const ship = useMutation({
    mutationFn: outboundOrderApi.ship,
    onSuccess: (order) => {
      toast.success('출고를 확정했습니다')
      setSelectedOrder(order)
      refresh()
    },
    onError: () => toast.error('출고 확정에 실패했습니다'),
  })

  const hold = useMutation({
    mutationFn: outboundOrderApi.hold,
    onSuccess: (order) => {
      toast.success('보류 처리했습니다')
      setSelectedOrder(order)
      refresh()
    },
    onError: () => toast.error('보류 처리에 실패했습니다'),
  })

  const unhold = useMutation({
    mutationFn: outboundOrderApi.unhold,
    onSuccess: (order) => {
      toast.success('보류를 해제했습니다')
      setSelectedOrder(order)
      refresh()
    },
    onError: () => toast.error('보류 해제에 실패했습니다'),
  })

  const cancelOrder = useMutation({
    mutationFn: outboundOrderApi.cancel,
    onSuccess: () => {
      toast.success('취소했습니다')
      setSelectedOrder(null)
      refresh()
    },
    onError: () => toast.error('취소에 실패했습니다'),
  })

  const deleteOrder = useMutation({
    mutationFn: outboundOrderApi.delete,
    onSuccess: () => {
      toast.success('전표를 삭제했습니다')
      setSelectedOrder(null)
      refresh()
    },
    onError: () => toast.error('수집완료 상태의 전표만 삭제할 수 있습니다'),
  })

  const summary = useMemo(() => ({
    collected: orders.filter((order) => order.status === 'COLLECTED').length,
    instructed: orders.filter((order) => getDerivedStatus(order) === 'INSTRUCTED').length,
    picking: orders.filter((order) => getDerivedStatus(order) === 'PICKING').length,
    picked: orders.filter((order) => order.status === 'PICKED').length,
    shipped: orders.filter((order) => order.status === 'SHIPPED').length,
  }), [orders])

  const filteredLines = useMemo(() => {
    return orders
      .filter((order) => {
        if (!matchesTab(order, activeTab)) return false
        const date = order.requestedShipDate || order.orderDate || ''
        if (dateFrom && date < dateFrom) return false
        if (dateTo && date > dateTo) return false
        if (customerSearch && !order.customer.toLowerCase().includes(customerSearch.toLowerCase())) return false
        return true
      })
      .flatMap((order) => order.items.map((item, index) => ({ order, item, index })))
  }, [orders, activeTab, dateFrom, dateTo, customerSearch])

  const gridRows = useMemo<OutboundLineRow[]>(() => {
    return filteredLines.map(({ order, item }, rowIndex) => {
      const derived = getDerivedStatus(order)
      return {
        id: item.id || `${order.id}-${item.productId}-${rowIndex}`,
        rowNo: rowIndex + 1,
        order,
        item,
        derived,
        date: order.requestedShipDate || order.orderDate || '',
        orderNo: order.orderNo,
        customer: order.customer,
        productName: item.product?.name || '-',
        productCode: item.product?.code || '',
        spec: formatUnitSpec(item.product),
        outQty: item.boxCount,
        unit: item.product?.unit || 'OUT',
        eaQty: item.convertedEaQty,
        pickedQty: item.pickedBoxCount,
        remainingQty: item.boxCount - item.pickedBoxCount,
      }
    })
  }, [filteredLines])

  const handleSelectOrder = (order: OutboundOrder) => {
    setSelectedOrder(order)
    const qtys: Record<string, number> = {}
    order.items.forEach((item) => {
      qtys[item.productId] = Math.max(0, item.boxCount - item.pickedBoxCount)
    })
    setPickQtys(qtys)
  }

  const columns = useMemo<ColDef<OutboundLineRow>[]>(() => [
    {
      headerName: '',
      width: 48,
      minWidth: 48,
      maxWidth: 48,
      checkboxSelection: true,
      headerCheckboxSelection: true,
      pinned: 'left',
      sortable: false,
      filter: false,
      resizable: false,
    },
    { headerName: 'No', field: 'rowNo', width: 68, pinned: 'left', type: 'numericColumn' },
    { headerName: '출고일', field: 'date', width: 112 },
    { headerName: '전표번호', field: 'orderNo', width: 148, pinned: 'left', cellClass: 'wms-code font-mono font-semibold' },
    { headerName: '거래처', field: 'customer', width: 150 },
    { headerName: '상품명', field: 'productName', minWidth: 190, flex: 1, tooltipField: 'productName' },
    { headerName: '상품코드', field: 'productCode', width: 126, cellClass: 'font-mono text-xs text-gray-500' },
    { headerName: '규격', field: 'spec', width: 128 },
    {
      headerName: '출고수량',
      field: 'outQty',
      width: 104,
      type: 'numericColumn',
      valueFormatter: (params) => formatNumber(Number(params.value ?? 0)),
    },
    { headerName: '단위', field: 'unit', width: 74, cellClass: 'text-center' },
    {
      headerName: 'EA환산',
      field: 'eaQty',
      width: 98,
      type: 'numericColumn',
      valueFormatter: (params) => formatNumber(Number(params.value ?? 0)),
    },
    {
      headerName: '피킹',
      field: 'pickedQty',
      width: 88,
      type: 'numericColumn',
      cellClass: (params) => Number(params.value ?? 0) > 0 ? 'font-semibold text-emerald-600' : 'text-gray-400',
      valueFormatter: (params) => Number(params.value ?? 0) > 0 ? formatNumber(Number(params.value)) : '-',
    },
    {
      headerName: '미피킹',
      field: 'remainingQty',
      width: 92,
      type: 'numericColumn',
      cellClass: (params) => Number(params.value ?? 0) > 0 ? 'font-semibold text-orange-500' : 'text-gray-400',
      valueFormatter: (params) => Number(params.value ?? 0) > 0 ? formatNumber(Number(params.value)) : '-',
    },
    {
      headerName: '상태',
      field: 'derived',
      width: 104,
      cellRenderer: (params: { data?: OutboundLineRow }) => params.data
        ? <StatusBadge label={STATUS_LABEL[params.data.derived]} variant={STATUS_VARIANT[params.data.derived]} />
        : null,
      cellClass: 'flex items-center justify-center',
    },
  ], [])

  const handlePickingComplete = () => {
    if (!selectedOrder) return
    const items = selectedOrder.items
      .filter((item) => (pickQtys[item.productId] ?? 0) > 0)
      .map((item) => ({ productId: item.productId, boxCount: pickQtys[item.productId] }))

    if (items.length === 0) {
      toast.error('피킹 수량을 입력하세요')
      return
    }

    completePicking.mutate({ orderIds: [selectedOrder.id], items })
  }

  const handleExcelDownload = async () => {
    if (!gridRows.length) {
      toast.error('내보낼 데이터가 없습니다')
      return
    }

    try {
      const rows = gridRows.map((row) => ({
        출고일: row.date,
        전표번호: row.orderNo,
        거래처: row.customer,
        상품코드: row.productCode,
        상품명: row.productName,
        규격: row.spec,
        출고수량: row.outQty,
        단위: row.unit,
        EA환산: row.eaQty,
        피킹수량: row.pickedQty,
        미피킹: row.remainingQty,
        상태: STATUS_LABEL[row.derived],
      }))
      const XLSX = await import('xlsx')
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '출고내역')
      XLSX.writeFile(wb, `출고내역_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch {
      toast.error('엑셀 다운로드에 실패했습니다')
    }
  }

  const resetFilters = () => {
    setPendingSearch('')
    setSearch('')
    setDateFrom('')
    setDateTo('')
    setCustomerSearch('')
  }

  const canEdit = (order: OutboundOrder) =>
    (order.status === 'COLLECTED' || order.status === 'INSTRUCTED') &&
    order.items.every((item) => item.pickedBoxCount === 0)

  if (!warehouse) {
    return <div className="flex h-64 items-center justify-center text-gray-400">창고를 먼저 선택하세요</div>
  }

  return (
    <div className="flex h-[calc(100vh-150px)] min-h-0 flex-col gap-3 overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={ui.h2Cls}>출고관리</h2>
          <p className="text-xs text-gray-500">출고 등록, 피킹, 출고 확정을 한 화면에서 처리합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="wms-primary-button inline-flex items-center gap-1.5 rounded px-3 py-2 text-sm font-semibold shadow-sm transition-colors"
        >
          <Plus size={15} />
          출고 전표 등록
        </button>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {[
          { label: '출고대기', count: summary.collected, tab: 'COLLECTED' as TabId, color: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400' },
          { label: '피킹대기', count: summary.instructed, tab: 'INSTRUCTED' as TabId, color: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400' },
          { label: '피킹중', count: summary.picking, tab: 'PICKING' as TabId, color: 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-400' },
          { label: '피킹완료', count: summary.picked, tab: 'PICKED' as TabId, color: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400' },
          { label: '출고완료', count: summary.shipped, tab: 'SHIPPED' as TabId, color: 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-400' },
        ].map(({ label, count, tab, color }) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'rounded border p-3 text-left transition-all hover:shadow-sm',
              color,
              activeTab === tab && 'ring-2 ring-current ring-offset-1',
            )}
          >
            <p className="text-xs font-medium opacity-70">{label}</p>
            <p className="mt-0.5 text-2xl font-bold">{formatNumber(count)}</p>
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
        <div
          className={cn(
            'app-surface flex min-h-0 flex-col overflow-hidden border border-gray-300 bg-white dark:border-gray-800 dark:bg-gray-900',
            selectedOrder ? 'flex-1' : 'w-full',
          )}
        >
          <div className="flex items-center gap-1 border-b border-gray-200 px-3 pt-2 dark:border-gray-800">
            {TABS.map(({ id, label }) => {
              const count = id === 'ALL'
                ? orders.length
                : id === 'HOLD_CANCEL'
                  ? orders.filter((order) => order.status === 'ON_HOLD' || order.status === 'CANCELLED').length
                  : orders.filter((order) => matchesTab(order, id)).length

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    'flex items-center gap-1 whitespace-nowrap rounded-t px-3 py-2 text-xs font-medium transition-colors',
                    activeTab === id
                      ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400',
                  )}
                >
                  {label}
                  <span className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                    activeTab === id ? 'wms-tab-active' : 'bg-gray-100 text-gray-500 dark:bg-gray-800',
                  )}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="wms-grid-toolbar flex flex-wrap items-center justify-between gap-2 border-b px-2 py-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="h-7 rounded border border-gray-200 px-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <span className="text-xs text-gray-400">~</span>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="h-7 rounded border border-gray-200 px-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <input
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
                placeholder="거래처"
                className="h-7 w-28 rounded border border-gray-200 px-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <input
                value={pendingSearch}
                onChange={(event) => setPendingSearch(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && setSearch(pendingSearch)}
                placeholder="전표번호/품목"
                className="h-7 w-36 rounded border border-gray-200 px-2 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <button
                type="button"
                onClick={() => setSearch(pendingSearch)}
                className="wms-toolbar-action inline-flex h-7 items-center gap-1 rounded px-2.5 text-xs font-semibold transition-colors"
              >
                <Search size={13} />
                검색
              </button>
              <button
                type="button"
                onClick={resetFilters}
                className="wms-toolbar-action inline-flex h-7 items-center gap-1 rounded px-2.5 text-xs font-semibold transition-colors"
              >
                <RotateCcw size={13} />
                초기화
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                title="새로고침"
                onClick={refresh}
                className="wms-toolbar-action inline-flex h-7 w-7 items-center justify-center rounded transition-colors"
              >
                <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
              </button>
              <button
                type="button"
                onClick={handleExcelDownload}
                className="wms-toolbar-action inline-flex h-7 items-center gap-1 rounded px-2.5 text-xs font-semibold transition-colors"
              >
                <FileDown size={13} />
                엑셀
              </button>
            </div>
          </div>

          <div className="ag-theme-quartz ag-theme-wms wms-ag-grid min-h-0 w-full flex-1">
            <AgGridReact<OutboundLineRow>
              ref={gridRef}
              rowData={gridRows}
              columnDefs={columns}
              defaultColDef={{
                sortable: true,
                resizable: true,
                filter: true,
                suppressHeaderMenuButton: true,
                minWidth: 70,
              }}
              rowSelection="multiple"
              suppressRowClickSelection
              headerHeight={34}
              rowHeight={34}
              animateRows={false}
              loading={isLoading}
              overlayLoadingTemplate="<span class='ag-overlay-loading-center'>불러오는 중...</span>"
              overlayNoRowsTemplate="<span class='ag-overlay-no-rows-center'>조회된 출고 품목이 없습니다.</span>"
              getRowId={(params) => params.data.id}
              onRowClicked={(params) => params.data && handleSelectOrder(params.data.order)}
              rowClassRules={{
                'bg-orange-50 dark:bg-orange-950/20': (params) => params.data?.order.id === selectedOrder?.id,
              }}
            />
          </div>

          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2 text-xs text-gray-400 dark:border-gray-800">
            <span>품목 {formatNumber(gridRows.length)}건 · 전표 {formatNumber(new Set(gridRows.map((row) => row.order.id)).size)}건</span>
            <span>전체 {formatNumber(orders.length)}건 중 표시</span>
          </div>
        </div>

        {selectedOrder && (
          <DetailPanel
            order={selectedOrder}
            pickQtys={pickQtys}
            setPickQtys={setPickQtys}
            canEdit={canEdit(selectedOrder)}
            isBusy={
              instruct.isPending || completePicking.isPending || ship.isPending ||
              hold.isPending || unhold.isPending || cancelOrder.isPending
            }
            onClose={() => setSelectedOrder(null)}
            onInstruct={() => instruct.mutate(selectedOrder.id)}
            onPickingComplete={handlePickingComplete}
            onShip={() => {
              if (window.confirm(`${selectedOrder.orderNo} 출고를 확정할까요?`)) ship.mutate(selectedOrder.id)
            }}
            onHold={() => {
              if (window.confirm(`${selectedOrder.orderNo} 전표를 보류 처리할까요?`)) hold.mutate(selectedOrder.id)
            }}
            onUnhold={() => unhold.mutate(selectedOrder.id)}
            onCancel={() => {
              if (window.confirm(`${selectedOrder.orderNo} 전표를 취소할까요?`)) cancelOrder.mutate(selectedOrder.id)
            }}
            onEdit={() => setEditOrder(selectedOrder)}
            onDelete={() => {
              if (window.confirm(`${selectedOrder.orderNo} 전표를 삭제할까요?`)) deleteOrder.mutate(selectedOrder.id)
            }}
            onPrint={() => printExternalPickingList(
              selectedOrder.requestedShipDate || selectedOrder.orderDate,
              [selectedOrder],
              clients,
              supplierInfo,
            )}
          />
        )}
      </div>

      {createOpen && (
        <CollectOrderModal
          warehouseId={warehouse.id}
          onClose={() => setCreateOpen(false)}
          onSaved={() => { setCreateOpen(false); refresh() }}
        />
      )}
      {editOrder && (
        <CollectOrderModal
          warehouseId={warehouse.id}
          order={editOrder}
          onClose={() => setEditOrder(null)}
          onSaved={() => { setEditOrder(null); refresh() }}
        />
      )}
    </div>
  )
}

interface DetailPanelProps {
  order: OutboundOrder
  pickQtys: Record<string, number>
  setPickQtys: Dispatch<SetStateAction<Record<string, number>>>
  canEdit: boolean
  isBusy: boolean
  onClose(): void
  onInstruct(): void
  onPickingComplete(): void
  onShip(): void
  onHold(): void
  onUnhold(): void
  onCancel(): void
  onEdit(): void
  onDelete(): void
  onPrint(): void
}

function DetailPanel({
  order,
  pickQtys,
  setPickQtys,
  canEdit,
  isBusy,
  onClose,
  onInstruct,
  onPickingComplete,
  onShip,
  onHold,
  onUnhold,
  onCancel,
  onEdit,
  onDelete,
  onPrint,
}: DetailPanelProps) {
  const derived = getDerivedStatus(order)
  const isInstructed = order.status === 'INSTRUCTED'
  const canPrint = !['COLLECTED', 'ON_HOLD', 'CANCELLED'].includes(order.status)
  const totalOuts = order.items.reduce((sum, item) => sum + item.boxCount, 0)
  const totalPicked = order.items.reduce((sum, item) => sum + item.pickedBoxCount, 0)
  const pickProgress = totalOuts > 0 ? Math.round((totalPicked / totalOuts) * 100) : 0

  const setQty = (productId: string, value: number) => {
    setPickQtys((prev) => ({ ...prev, [productId]: value }))
  }

  return (
    <div className="wms-detail-panel-enter flex min-h-0 w-80 shrink-0 flex-col overflow-hidden border border-gray-300 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex min-w-0 items-center gap-2">
          <StatusBadge label={STATUS_LABEL[derived]} variant={STATUS_VARIANT[derived]} />
          <span className="wms-code truncate font-mono text-xs font-bold">{order.orderNo}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="wms-toolbar-action ml-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-b border-gray-100 p-3 dark:border-gray-800">
        <PanelField label="거래처" value={order.customer} />
        <PanelField label="출고일" value={order.requestedShipDate || order.orderDate || '-'} />
        <PanelField label="수령자" value={order.recipient || '-'} />
        <PanelField label="채널" value={order.channel || '-'} />
        {order.memo && <PanelField label="비고" value={order.memo} className="col-span-2" />}
      </div>

      <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
        <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
          <span>피킹 진행률</span>
          <span className="font-semibold text-gray-700 dark:text-gray-300">{totalPicked} / {totalOuts} OUT</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className={cn('h-full rounded-full transition-all', pickProgress === 100 ? 'bg-emerald-500' : 'bg-orange-400')}
            style={{ width: `${pickProgress}%` }}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="px-3 py-2 text-left font-medium text-gray-500">상품</th>
              <th className="w-10 px-2 py-2 text-right font-medium text-gray-500">출고</th>
              <th className="w-10 px-2 py-2 text-right font-medium text-gray-500">피킹</th>
              {isInstructed && <th className="w-16 px-2 py-2 text-center font-medium text-gray-500">수량</th>}
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => {
              const remaining = item.boxCount - item.pickedBoxCount
              return (
                <tr key={item.id} className="border-b border-gray-50 dark:border-gray-800/50">
                  <td className="px-3 py-2">
                    <p className="max-w-[120px] truncate font-medium text-gray-900 dark:text-white">{item.product?.name || '-'}</p>
                    <p className="font-mono text-gray-400">{item.product?.code || ''}</p>
                  </td>
                  <td className="px-2 py-2 text-right font-semibold">{formatNumber(item.boxCount)}</td>
                  <td className={cn('px-2 py-2 text-right font-semibold', item.pickedBoxCount > 0 ? 'text-emerald-600' : 'text-gray-300')}>
                    {item.pickedBoxCount ? formatNumber(item.pickedBoxCount) : '-'}
                  </td>
                  {isInstructed && (
                    <td className="px-2 py-2 text-center">
                      <input
                        type="number"
                        min={0}
                        max={remaining}
                        value={pickQtys[item.productId] ?? remaining}
                        onChange={(event) => setQty(item.productId, Math.max(0, Math.min(remaining, Number(event.target.value))))}
                        className="w-14 rounded border border-gray-200 px-1 py-0.5 text-center text-xs dark:border-gray-700 dark:bg-gray-800"
                      />
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 border-t border-gray-200 p-3 dark:border-gray-800">
        {order.status === 'COLLECTED' && (
          <button
            type="button"
            onClick={onInstruct}
            disabled={isBusy}
            className="w-full rounded bg-amber-500 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
          >
            출고지시 확정
          </button>
        )}
        {isInstructed && (
          <button
            type="button"
            onClick={onPickingComplete}
            disabled={isBusy}
            className="w-full rounded bg-orange-500 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            피킹 완료
          </button>
        )}
        {order.status === 'PICKED' && (
          <button
            type="button"
            onClick={onShip}
            disabled={isBusy}
            className="w-full rounded bg-purple-600 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
          >
            출고 확정
          </button>
        )}

        <div className="flex gap-2">
          {order.orderType === 'EXTERNAL' && (
            <button
              type="button"
              onClick={onPrint}
              disabled={!canPrint}
              className="wms-toolbar-action inline-flex flex-1 items-center justify-center gap-1 rounded py-1.5 text-xs font-medium disabled:opacity-40"
            >
              <Printer size={13} />
              피킹리스트
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="wms-toolbar-action flex-1 rounded py-1.5 text-xs font-medium"
            >
              수정
            </button>
          )}
          {(order.status === 'COLLECTED' || order.status === 'INSTRUCTED') && (
            <button
              type="button"
              onClick={onHold}
              className="wms-toolbar-action flex-1 rounded py-1.5 text-xs font-medium"
            >
              보류
            </button>
          )}
          {order.status === 'ON_HOLD' && (
            <button
              type="button"
              onClick={onUnhold}
              className="wms-toolbar-action flex-1 rounded py-1.5 text-xs font-medium"
            >
              보류해제
            </button>
          )}
        </div>

        <div className="flex gap-2">
          {order.status !== 'SHIPPED' && order.status !== 'CANCELLED' && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded border border-red-200 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/20"
            >
              취소
            </button>
          )}
          {order.status === 'COLLECTED' && (
            <button
              type="button"
              onClick={onDelete}
              className="flex-1 rounded border border-gray-200 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              삭제
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function PanelField({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[10px] font-medium uppercase text-gray-400">{label}</p>
      <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-200">{value}</p>
    </div>
  )
}
