'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ScanLine, Trash2, Camera,
  Barcode, Plus, Minus, Star, X,
  AlertTriangle, Clock, MapPin, Package, Save,
} from 'lucide-react'
import { useScanStore, ScanCartItem } from '@/stores/scan.store'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { productApi } from '@/api/product.api'
import { stockApi } from '@/api/stock.api'
import type { StockTransaction } from '@/types/api.types'
import { warehouseApi } from '@/api/warehouse.api'
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'
import { SCAN_MODE_LABEL, SCAN_MODES } from '@/constants/stock.constants'
import { QUERY_KEYS } from '@/constants/query-keys'
import { formatDecimal, formatNumber } from '@/utils/format'
import { cn } from '@/utils/cn'
import { CameraScanner } from '@/components/CameraScanner'
import { useMenuLabel } from '@/hooks/use-menu-label'
import type { Barcode as ProductBarcode, BarcodeResolveResult, Zone, BarcodeUnitType } from '@/types/api.types'

const UNIT_LABEL: Record<BarcodeUnitType, string> = {
  UNIT: '일반바코드', CXD: 'CXD낱개(INBOX)', CXD_BOX: 'CXD BOX',
}
const UNIT_CLS: Record<BarcodeUnitType, string> = {
  UNIT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  CXD:  'bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400',
  CXD_BOX: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
}
const displayBarcodeStock = (stockQty: number | undefined, type: BarcodeUnitType, unitQty: number, barcodes: ProductBarcode[]) => {
  const stock = Number(stockQty ?? 0)
  if (type === 'CXD') return `${formatDecimal(stock / Math.max(1, unitQty))}INBOX`
  if (type === 'CXD_BOX') {
    const inboxUnitQty = barcodes.find((barcode) => barcode.type === 'CXD' && barcode.isPrimary)?.unitQty
      ?? barcodes.find((barcode) => barcode.type === 'CXD')?.unitQty
      ?? 1
    return `${formatDecimal(stock / (Math.max(1, inboxUnitQty) * Math.max(1, unitQty)))}OUTBOX`
  }
  return `${formatNumber(stock)}EA`
}

interface PendingScan {
  barcode: string
  result: BarcodeResolveResult
  quantity: number
  locationId: string
  locationCode: string
  autoLocation: boolean
}

export default function ScanPage() {
  const pageTitle = useMenuLabel('스캔 조회/입출고')
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const qtyRef   = useRef<HTMLInputElement>(null)
  const warehouse = useWarehouseStore((s) => s.selectedWarehouse)
  const { mode, cart, lastResult, selectedLocation,
          setMode, setLastResult, setSelectedLocation,
          addToCart, removeFromCart, clearCart } = useScanStore()

  const [processing,      setProcessing]      = useState(false)
  const [cameraOpen,      setCameraOpen]      = useState(false)
  const [instantMode,     setInstantMode]     = useState(false)
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null)
  const [pendingScan,     setPendingScan]     = useState<PendingScan | null>(null)

  const { data: locations = [] } = useQuery({
    queryKey: QUERY_KEYS.locations(warehouse?.id ?? ''),
    queryFn: () => warehouseApi.findLocations(warehouse!.id),
    enabled: !!warehouse?.id,
  })
  const { data: zones = [] } = useQuery({
    queryKey: QUERY_KEYS.zones(warehouse?.id ?? ''),
    queryFn: () => warehouseApi.findZones(warehouse!.id),
    enabled: !!warehouse?.id,
  })

  // ── 조회 결과 쿼리 ──
  const inquiryProductId = lastResult?.product.id ?? ''
  const { data: inquiryBarcodes = [] } = useQuery({
    queryKey: ['product-barcodes-modal', inquiryProductId],
    queryFn: () => productApi.findBarcodes(inquiryProductId),
    enabled: !!inquiryProductId,
  })
  const { data: inquiryInventory = [] } = useQuery({
    queryKey: ['inquiry-inventory', inquiryProductId, warehouse?.id],
    queryFn: () => stockApi.getInventoryByProduct(inquiryProductId, warehouse?.id),
    enabled: !!inquiryProductId && !!warehouse?.id,
  })

  useEffect(() => { setSelectedLocation(null) }, [warehouse?.id, setSelectedLocation])

  // ── 스캔 이력 ──
  const today = new Date().toISOString().slice(0, 10)
  const { data: historyPage, refetch: refetchHistory } = useQuery({
    queryKey: ['scan-history', warehouse?.id, today],
    queryFn: () => stockApi.getTransactions({ warehouseId: warehouse!.id, from: today, limit: 50 }),
    enabled: !!warehouse?.id,
  })
  const historyItems: StockTransaction[] = (historyPage?.items ?? []).filter(
    (t) => t.txType === 'INBOUND' || t.txType === 'OUTBOUND',
  )

  // ── 스캔 후 확정 처리 ──
  const submitMutation = useMutation({
    mutationFn: async (items: ScanCartItem[]) => {
      for (const item of items) {
        if (mode === 'INBOUND') {
          await stockApi.inbound({ productId: item.productId, locationId: item.locationId, warehouseId: warehouse!.id, quantity: item.quantity, barcodeUsed: item.barcodeUsed })
        } else if (mode === 'OUTBOUND') {
          await stockApi.outbound({ productId: item.productId, locationId: item.locationId, warehouseId: warehouse!.id, quantity: item.quantity, barcodeUsed: item.barcodeUsed })
        }
      }
    },
    onSuccess: () => {
      toast.success(`${mode === 'INBOUND' ? '입고' : '출고'} 처리 완료`)
      clearCart()
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['product-attrs'] })
      refetchHistory()
    },
  })

  // ── 스캔 → pendingScan 설정 ──
  const handleScan = useCallback(async (barcode: string) => {
    if (processing || !warehouse) return
    if (pendingScan && mode !== 'INQUIRY') {
      toast('확인 대기 중인 스캔이 있습니다. 저장하거나 취소 후 다시 스캔하세요', { icon: '⚠️' })
      return
    }
    setProcessing(true)
    setNotFoundBarcode(null)
    try {
      const result: BarcodeResolveResult = await productApi.resolveBarcode(barcode)
      setLastResult(result)

      if (mode === 'INQUIRY') {
        setTimeout(() => inputRef.current?.focus(), 0)
        return
      }

      let locationId   = selectedLocation?.id   ?? ''
      let locationCode = selectedLocation?.code ?? ''
      let autoLocation = false

      if (mode === 'INBOUND') {
        try {
          const invList = await stockApi.getInventoryByProduct(result.product.id, warehouse.id)
          if (invList.length > 0) {
            const topInv = [...invList].sort((a: any, b: any) => b.quantity - a.quantity)[0] as any
            const loc = (locations as any[]).find((l: any) => l.id === topInv.locationId)
            if (loc) {
              locationId   = loc.id
              locationCode = loc.code
              autoLocation = true
              setSelectedLocation(loc)
            }
          }
        } catch { /* 재고 없으면 무시 */ }

        if (!locationId && !selectedLocation) {
          toast.error('입고 위치를 먼저 선택하세요')
          return
        }

        const boxQty = result.qtyPerScan
        setPendingScan({
          barcode,
          result,
          quantity: boxQty,
          locationId:   locationId   || selectedLocation!.id,
          locationCode: locationCode || selectedLocation!.code,
          autoLocation,
        })
        setTimeout(() => qtyRef.current?.focus(), 100)

      } else if (mode === 'OUTBOUND') {
        const invList = await stockApi.getInventoryByProduct(result.product.id, warehouse.id)
        const boxQty = result.qtyPerScan
        const firstInv = (invList as any[]).find((i: any) => i.quantity >= boxQty)
        if (!firstInv) { toast.error('출고 가능 재고 없음'); return }

        setPendingScan({
          barcode,
          result,
          quantity: boxQty,
          locationId:   firstInv.locationId,
          locationCode: firstInv.location?.code ?? '',
          autoLocation: true,
        })
        setTimeout(() => qtyRef.current?.focus(), 100)
      }
    } catch (err: any) {
      const code = err.response?.data?.code
      if (code === 'BARCODE_NOT_FOUND') setNotFoundBarcode(barcode)
      else toast.error('스캔 처리 중 오류가 발생했습니다')
    } finally { setProcessing(false) }
  }, [processing, warehouse, mode, selectedLocation, pendingScan, locations, setLastResult, setSelectedLocation])

  // ── pendingScan 저장 확정 ──
  const handleConfirmScan = useCallback(async () => {
    if (!pendingScan || !warehouse) return
    const { barcode, result, quantity, locationId, locationCode } = pendingScan
    if (!locationId) { toast.error('위치를 선택하세요'); return }
    if (quantity <= 0) { toast.error('수량은 1 이상이어야 합니다'); return }

    setProcessing(true)
    try {
      if (mode === 'INBOUND') {
        if (instantMode) {
          await stockApi.inbound({ productId: result.product.id, locationId, warehouseId: warehouse.id, quantity, barcodeUsed: barcode })
          qc.invalidateQueries({ queryKey: ['inventory'] })
          qc.invalidateQueries({ queryKey: ['products'] })
          qc.invalidateQueries({ queryKey: ['product-attrs'] })
          refetchHistory()
          toast.success(`✓ ${result.product.name} +${formatNumber(quantity)}개 입고 완료`)
        } else {
          addToCart({ productId: result.product.id, productCode: result.product.code, productName: result.product.name, locationId, locationCode, quantity, barcodeUsed: barcode, unitType: result.unitType, qtyPerScan: result.qtyPerScan })
          toast.success(`${result.product.name} — ${formatNumber(quantity)}개 카트에 추가`)
        }
      } else if (mode === 'OUTBOUND') {
        if (instantMode) {
          await stockApi.outbound({ productId: result.product.id, locationId, warehouseId: warehouse.id, quantity, barcodeUsed: barcode })
          qc.invalidateQueries({ queryKey: ['inventory'] })
          qc.invalidateQueries({ queryKey: ['products'] })
          qc.invalidateQueries({ queryKey: ['product-attrs'] })
          refetchHistory()
          toast.success(`✓ ${result.product.name} -${formatNumber(quantity)}개 출고 완료`)
        } else {
          addToCart({ productId: result.product.id, productCode: result.product.code, productName: result.product.name, locationId, locationCode, quantity, barcodeUsed: barcode, unitType: result.unitType, qtyPerScan: result.qtyPerScan })
          toast.success(`${result.product.name} — ${formatNumber(quantity)}개 카트에 추가`)
        }
      }
      setPendingScan(null)
      setTimeout(() => inputRef.current?.focus(), 0)
    } finally {
      setProcessing(false)
    }
  }, [pendingScan, warehouse, mode, instantMode, addToCart, qc, refetchHistory])

  const { handleKeyDown } = useBarcodeScanner({ inputRef, onScan: handleScan })

  if (!warehouse) {
    return <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">창고를 먼저 선택하세요</div>
  }

  return (
    <>
      {cameraOpen && <CameraScanner onScan={(barcode) => handleScan(barcode)} onClose={() => setCameraOpen(false)} />}

      <div className="space-y-3">
        <div>
          <h2 className="text-[15px] font-bold text-gray-900 dark:text-white">{pageTitle}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">스캔으로 입출고를 처리하고 상품 정보를 조회합니다</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
          {/* ── Left: 스캔 패널 ── */}
          <div className="space-y-3">
            {/* 모드 선택 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">스캔 모드</p>
                <div className="flex gap-2">
                  {SCAN_MODES.filter((m) => m === 'INBOUND' || m === 'OUTBOUND' || m === 'INQUIRY').map((m) => (
                    <button key={m} onClick={() => { setMode(m); setPendingScan(null) }}
                      className={cn('flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                        mode === m ? 'bg-[#2D4033] text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600')}>
                      {SCAN_MODE_LABEL[m]}
                    </button>
                  ))}
                </div>
              </div>

              {/* 즉시 처리 토글 — 조회 모드에선 숨김 */}
              {mode !== 'INQUIRY' && (
                <div className={cn(
                  'flex items-center justify-between rounded-lg px-3 py-2.5 border transition-colors',
                  instantMode
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700'
                    : 'bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-700',
                )}>
                  <div>
                    <p className={cn('text-sm font-medium', instantMode ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-300')}>
                      즉시 처리 모드
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {instantMode ? '저장 버튼 클릭 시 즉시 재고 반영' : '카트에 쌓고 일괄 처리'}
                    </p>
                  </div>
                  <button
                    onClick={() => setInstantMode((v) => !v)}
                    className={cn('relative w-11 h-6 rounded-full transition-colors shrink-0',
                      instantMode ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600')}
                  >
                    <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform',
                      instantMode ? 'translate-x-5' : 'translate-x-0')} />
                  </button>
                </div>
              )}
            </div>

            {/* 입고 위치 선택 */}
            {mode === 'INBOUND' && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">입고 위치</p>
                <select
                  value={selectedLocation?.id ?? ''}
                  onChange={(e) => {
                    const loc = (locations as any[]).find((l: any) => l.id === e.target.value)
                    setSelectedLocation(loc ?? null)
                    setTimeout(() => inputRef.current?.focus(), 0)
                  }}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D4033]/25 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">위치 선택 (스캔 시 자동 선택됩니다)</option>
                  {zones.length > 0
                    ? (zones as Zone[]).map((z) => {
                        const zoneLocs = (locations as any[]).filter((l: any) => l.zoneId === z.id)
                        if (zoneLocs.length === 0) return null
                        return (
                          <optgroup key={z.id} label={`[${z.code}] ${z.name}`}>
                            {zoneLocs.map((l: any) => <option key={l.id} value={l.id}>{l.code}</option>)}
                          </optgroup>
                        )
                      })
                    : (locations as any[]).map((l: any) => <option key={l.id} value={l.id}>{l.code}</option>)}
                </select>
                {selectedLocation && (
                  <p className="mt-1.5 text-xs text-[#2D4033] dark:text-emerald-400 flex items-center gap-1">
                    <MapPin size={11} />선택됨: {selectedLocation.code}
                  </p>
                )}
              </div>
            )}

            {/* 바코드 입력 */}
            <div className={cn(
              'bg-white dark:bg-gray-800 rounded-xl border-2 p-4 transition-colors',
              pendingScan ? 'border-gray-200 dark:border-gray-700' : 'border-[#2D4033]',
            )}>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <ScanLine size={20} className={pendingScan ? 'text-gray-400' : 'text-[#D2691E]'} />
                <span className="font-medium text-gray-900 dark:text-gray-100">바코드 스캔</span>
                {processing && <span className="text-xs text-gray-400 animate-pulse">처리 중...</span>}
                {pendingScan && <span className="text-xs text-amber-500 font-medium">↓ 아래에서 수량 확인 후 저장하세요</span>}
                <div className="flex-1" />
                <button
                  onClick={() => setCameraOpen(true)}
                  disabled={!!pendingScan}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2D4033] text-white text-xs rounded-lg hover:bg-[#253628] transition-colors disabled:opacity-40"
                >
                  <Camera size={14} />카메라
                </button>
              </div>
              <input
                ref={inputRef}
                type="text"
                onKeyDown={handleKeyDown}
                disabled={!!pendingScan}
                className={cn(
                  'w-full border rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 font-mono placeholder-gray-400 dark:placeholder-gray-500 transition-colors',
                  pendingScan
                    ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                    : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-[#2D4033]/25',
                )}
                placeholder={
                  mode === 'INQUIRY'
                    ? '바코드를 스캔하면 상품 정보가 오른쪽에 표시됩니다'
                    : pendingScan
                      ? '저장 또는 취소 후 다음 스캔 가능'
                      : '바코드를 스캔하거나 직접 입력 후 Enter'
                }
                autoFocus
              />

              {/* 미등록 바코드 알림 */}
              {notFoundBarcode && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-red-700 dark:text-red-400">미등록 바코드</p>
                      <p className="font-mono text-sm text-red-600 dark:text-red-500 mt-0.5 break-all">{notFoundBarcode}</p>
                      <p className="text-xs text-red-500 dark:text-red-400 mt-1.5 leading-relaxed">
                        <strong>바코드 관리</strong> 페이지에서 상품을 선택 후 등록해주세요.
                      </p>
                    </div>
                    <button onClick={() => setNotFoundBarcode(null)} className="text-red-300 hover:text-red-500 shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── 스캔 확인 패널 (수량 입력 + 저장) ── */}
            {pendingScan && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-[#D2691E] p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-[#D2691E] flex items-center justify-center shrink-0">
                    <Package size={14} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{pendingScan.result.product.name}</p>
                    <p className="text-[10px] font-mono text-gray-400 mt-0.5">{pendingScan.result.product.code} · {pendingScan.barcode}</p>
                  </div>
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0', UNIT_CLS[pendingScan.result.unitType as BarcodeUnitType])}>
                    {UNIT_LABEL[pendingScan.result.unitType as BarcodeUnitType]}
                  </span>
                </div>

                {/* 위치 */}
                <div className="flex items-center gap-2 mb-3 p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <MapPin size={13} className="text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    {mode === 'INBOUND' ? (
                      <select
                        value={pendingScan.locationId}
                        onChange={(e) => {
                          const loc = (locations as any[]).find((l: any) => l.id === e.target.value)
                          if (loc) setPendingScan((prev) => prev ? { ...prev, locationId: loc.id, locationCode: loc.code, autoLocation: false } : null)
                        }}
                        className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#D2691E]/40 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value="">위치 선택</option>
                        {zones.length > 0
                          ? (zones as Zone[]).map((z) => {
                              const zoneLocs = (locations as any[]).filter((l: any) => l.zoneId === z.id)
                              if (zoneLocs.length === 0) return null
                              return (
                                <optgroup key={z.id} label={`[${z.code}] ${z.name}`}>
                                  {zoneLocs.map((l: any) => <option key={l.id} value={l.id}>{l.code}</option>)}
                                </optgroup>
                              )
                            })
                          : (locations as any[]).map((l: any) => <option key={l.id} value={l.id}>{l.code}</option>)}
                      </select>
                    ) : (
                      <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{pendingScan.locationCode || '위치 없음'}</span>
                    )}
                  </div>
                  {pendingScan.autoLocation && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium shrink-0 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">자동</span>
                  )}
                </div>

                {/* 수량 입력 */}
                <div className="flex items-center gap-3 mb-3">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">박스 수량</label>
                  <div className="flex items-center gap-1 flex-1">
                    <button
                      onClick={() => setPendingScan((prev) => prev ? { ...prev, quantity: Math.max(1, prev.quantity - 1) } : null)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Minus size={13} />
                    </button>
                    <input
                      ref={qtyRef}
                      type="number"
                      min={1}
                      value={pendingScan.quantity}
                      onChange={(e) => setPendingScan((prev) => prev ? { ...prev, quantity: Math.max(1, Number(e.target.value) || 1) } : null)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmScan() }}
                      className="flex-1 text-center text-base font-bold border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#D2691E]/30 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 tabular-nums"
                    />
                    <button
                      onClick={() => setPendingScan((prev) => prev ? { ...prev, quantity: prev.quantity + 1 } : null)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Plus size={13} />
                    </button>
                    <span className="text-xs text-gray-400 ml-1">박스</span>
                  </div>
                  <span className="text-[10px] text-gray-400">1회 스캔={formatNumber(pendingScan.result.qtyPerScan)}개</span>
                </div>

                {/* 액션 버튼 */}
                <div className="flex gap-2">
                  <button
                    onClick={handleConfirmScan}
                    disabled={processing || !pendingScan.locationId}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#D2691E] hover:bg-[#b85c18] text-white rounded-lg text-sm font-semibold disabled:opacity-40 transition-colors shadow-sm"
                  >
                    <Save size={15} />
                    저장 {instantMode ? '(즉시반영)' : '(카트추가)'}
                  </button>
                  <button
                    onClick={() => { setPendingScan(null); setTimeout(() => inputRef.current?.focus(), 0) }}
                    className="px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg text-sm transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}

            {/* 처리 대기 목록 */}
            {!instantMode && cart.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-gray-100">처리 대기 ({formatNumber(cart.length)})</span>
                  <button onClick={clearCart} className="text-xs text-gray-400 hover:text-red-500 transition-colors">전체 삭제</button>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {cart.map((item, i) => (
                    <div key={i} className="flex items-center p-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">{item.productName}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{item.locationCode}</p>
                      </div>
                      <span className="font-bold text-gray-900 dark:text-gray-100 tabular-nums">{formatNumber(item.quantity)}개</span>
                      <button onClick={() => removeFromCart(i)} className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
                <div className="p-4">
                  <button
                    onClick={() => submitMutation.mutate(cart)}
                    disabled={submitMutation.isPending}
                    className="w-full py-3 bg-[#2D4033] text-white font-semibold rounded-lg hover:bg-[#253628] disabled:opacity-50 transition-colors"
                  >
                    {submitMutation.isPending ? '처리 중...' : `${SCAN_MODE_LABEL[mode as 'INBOUND' | 'OUTBOUND']} 완료 (${formatNumber(cart.length)}건)`}
                  </button>
                </div>
              </div>
            )}

            {/* 스캔 이력 */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-[#D2691E]" />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">오늘 스캔 이력</span>
                </div>
                <span className="text-xs text-gray-400">{historyItems.length}건</span>
              </div>
              {historyItems.length === 0 ? (
                <p className="py-6 text-center text-xs text-gray-400">오늘 처리된 스캔 이력이 없습니다</p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-60 overflow-y-auto">
                  {historyItems.map((tx) => (
                    <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5">
                      {tx.txType === 'INBOUND'
                        ? <Plus size={14} className="text-blue-500 shrink-0" />
                        : <Minus size={14} className="text-amber-500 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{tx.product?.name ?? tx.productId}</p>
                        {tx.barcodeScanned && <p className="text-[10px] font-mono text-gray-400 truncate">{tx.barcodeScanned}</p>}
                      </div>
                      <span className="text-xs tabular-nums shrink-0 text-gray-500 dark:text-gray-400">재고 {formatNumber(tx.qtyAfter)}</span>
                      <span className="text-[10px] text-gray-400 shrink-0 w-10 text-right">{tx.createdAt.slice(11, 16)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: 스캔 조회 결과 ── */}
          <div className="space-y-3">
            {!lastResult ? (
              <div className="text-center py-20 text-gray-400 dark:text-gray-600">
                <Barcode size={40} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">바코드를 스캔하면 상품 정보가 표시됩니다</p>
                <p className="text-xs mt-1 text-gray-300 dark:text-gray-700">입출고·조회 모드 모두 지원</p>
              </div>
            ) : (
              <>
                {/* 상품 헤더 */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#2D4033]/10 flex items-center justify-center shrink-0">
                      <Package size={18} className="text-[#2D4033] dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight">{lastResult.product.name}</p>
                      <p className="font-mono text-[11px] text-gray-400 mt-0.5">{lastResult.product.code}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {lastResult.product.category && (
                          <span className="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">{lastResult.product.category}</span>
                        )}
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold', UNIT_CLS[lastResult.unitType])}>
                          {UNIT_LABEL[lastResult.unitType]}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 bg-[#D2691E]/10 text-[#D2691E] rounded-full font-medium">{formatNumber(lastResult.qtyPerScan)}개/스캔</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{formatNumber(lastResult.product.stockQty ?? 0)}</p>
                      <p className="text-[10px] text-gray-400">총 재고</p>
                    </div>
                  </div>
                  {lastResult.product.spec && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-2">{lastResult.product.spec}</p>
                  )}
                </div>

                {/* 등록 바코드 */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                    <Barcode size={13} className="text-[#D2691E]" />
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">등록 바코드</span>
                    <span className="text-[10px] text-gray-400 ml-auto">{inquiryBarcodes.length}개</span>
                  </div>
                  {inquiryBarcodes.length === 0 ? (
                    <p className="text-center py-4 text-xs text-gray-400">등록된 바코드 없음</p>
                  ) : (
                    <div className="divide-y divide-gray-50 dark:divide-gray-800">
                      {inquiryBarcodes.map((bc) => (
                        <div key={bc.id} className="flex items-center gap-2.5 px-4 py-2.5">
                          <span className="font-mono text-sm text-gray-800 dark:text-gray-100 flex-1">{bc.barcode}</span>
                          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0', UNIT_CLS[bc.type])}>
                            {UNIT_LABEL[bc.type]}
                          </span>
                          <span className="text-xs text-gray-400 tabular-nums shrink-0">
                            {bc.type === 'UNIT' && `현재 재고 :  ${displayBarcodeStock(lastResult.product.stockQty, bc.type, bc.unitQty, inquiryBarcodes)}`}
                            {bc.type === 'CXD' && `현재 재고 :  ${displayBarcodeStock(lastResult.product.stockQty, bc.type, bc.unitQty, inquiryBarcodes)} · 낱개 구성 ${formatNumber(bc.unitQty)}개`}
                            {bc.type === 'CXD_BOX' && `현재 재고 :  ${displayBarcodeStock(lastResult.product.stockQty, bc.type, bc.unitQty, inquiryBarcodes)} · INBOX ${formatNumber(bc.unitQty)}개 포함`}
                          </span>
                          {bc.isPrimary && <Star size={11} className="text-amber-400 fill-amber-400 shrink-0" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 위치별 재고 */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                    <MapPin size={13} className="text-[#2D4033]" />
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">위치별 재고</span>
                  </div>
                  {inquiryInventory.length === 0 ? (
                    <p className="text-center py-4 text-xs text-gray-400">재고 없음</p>
                  ) : (
                    <div className="divide-y divide-gray-50 dark:divide-gray-800">
                      {(inquiryInventory as any[]).map((inv: any) => (
                        <div key={inv.id} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="text-xs font-mono text-gray-600 dark:text-gray-300 flex-1">{inv.location?.code ?? inv.locationId}</span>
                          <span className="font-bold text-sm tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(inv.quantity)}</span>
                          <span className="text-[10px] text-gray-400">개</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 가격 정보 */}
                {(lastResult.product.sellPrice != null || lastResult.product.retailPrice != null) && (
                  <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-3">가격 정보</p>
                    <div className="space-y-2">
                      {lastResult.product.sellPrice != null && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">판매가</span>
                          <span className="text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-100">₩{formatNumber(lastResult.product.sellPrice)}</span>
                        </div>
                      )}
                      {lastResult.product.retailPrice != null && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">소비자가</span>
                          <span className="text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-100">₩{formatNumber(lastResult.product.retailPrice)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
