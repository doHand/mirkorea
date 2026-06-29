'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
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
  UNIT: '일반바코드', CXD: 'CXD낱개(IN)', CXD_OUT: 'CXD OUT',
}
const UNIT_CLS: Record<BarcodeUnitType, string> = {
  UNIT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  CXD:  'bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400',
  CXD_OUT: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
}
const displayBarcodeStock = (stockQty: number | undefined, type: BarcodeUnitType, unitQty: number, barcodes: ProductBarcode[]) => {
  const stock = Number(stockQty ?? 0)
  if (type === 'CXD') return `${formatDecimal(stock / Math.max(1, unitQty))}IN`
  if (type === 'CXD_OUT') {
    const inoutUnitQty = barcodes.find((barcode) => barcode.type === 'CXD' && barcode.isPrimary)?.unitQty
      ?? barcodes.find((barcode) => barcode.type === 'CXD')?.unitQty
      ?? 1
    return `${formatDecimal(stock / (Math.max(1, inoutUnitQty) * Math.max(1, unitQty)))}OUT`
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

  // Esc → pendingScan 취소
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pendingScan) {
        setPendingScan(null)
        setTimeout(() => inputRef.current?.focus(), 0)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [pendingScan])

  if (!warehouse) {
    return <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">창고를 먼저 선택하세요</div>
  }

  const locationOptions = (
    <>
      <option value="">위치 선택 (스캔 시 자동)</option>
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
    </>
  )

  return (
    <>
      {cameraOpen && <CameraScanner onScan={(barcode) => handleScan(barcode)} onClose={() => setCameraOpen(false)} />}

      <div className="mx-auto max-w-xl space-y-3">
        <div>
          <h2 className="text-[15px] font-bold text-gray-900 dark:text-white">{pageTitle}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">스캔으로 입출고를 처리하고 상품 정보를 조회합니다</p>
        </div>

        {/* 모드 + 즉시처리 */}
        <div className="flex items-center gap-2">
          <div className="flex flex-1 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 divide-x divide-gray-200 dark:divide-gray-700">
            {SCAN_MODES.filter((m) => m === 'INBOUND' || m === 'OUTBOUND' || m === 'INQUIRY').map((m) => (
              <button key={m} onClick={() => { setMode(m); setPendingScan(null) }}
                className={cn('flex-1 py-2 text-sm font-medium transition-colors',
                  mode === m
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700',
                )}>
                {SCAN_MODE_LABEL[m]}
              </button>
            ))}
          </div>
          {mode !== 'INQUIRY' && (
            <button
              onClick={() => setInstantMode((v) => !v)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                instantMode
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                  : 'border-gray-200 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-800',
              )}
            >
              <span className={cn('relative h-4 w-7 rounded-full transition-colors', instantMode ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600')}>
                <span className={cn('absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform', instantMode ? 'left-3.5' : 'left-0.5')} />
              </span>
              즉시
            </button>
          )}
        </div>

        {/* 입고 위치 */}
        {mode === 'INBOUND' && (
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2">
            <span className="shrink-0 text-xs text-gray-400">위치</span>
            <select
              value={selectedLocation?.id ?? ''}
              onChange={(e) => {
                const loc = (locations as any[]).find((l: any) => l.id === e.target.value)
                setSelectedLocation(loc ?? null)
                setTimeout(() => inputRef.current?.focus(), 0)
              }}
              className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 focus:outline-none"
            >
              {locationOptions}
            </select>
            {selectedLocation && (
              <span className="shrink-0 text-xs font-medium text-[var(--color-primary)] dark:text-emerald-400">{selectedLocation.code} ✓</span>
            )}
          </div>
        )}

        {/* 바코드 입력 */}
        <div className={cn('rounded-xl border-2 transition-colors', pendingScan ? 'border-gray-200 dark:border-gray-700' : 'border-[var(--color-primary)]')}>
          <div className="relative p-1">
            <input
              ref={inputRef}
              type="text"
              onKeyDown={handleKeyDown}
              disabled={!!pendingScan}
              className={cn(
                'w-full rounded-lg px-4 py-3.5 pr-20 font-mono text-base focus:outline-none transition-colors',
                pendingScan
                  ? 'cursor-not-allowed bg-gray-50 text-gray-400 dark:bg-gray-800'
                  : 'bg-transparent text-gray-900 dark:text-gray-100',
              )}
              placeholder={
                pendingScan ? '↓ 수량 확인 후 Enter 저장' :
                mode === 'INQUIRY' ? '바코드 스캔 → 상품 정보 조회' :
                '바코드 스캔 또는 입력 후 Enter'
              }
              autoFocus
            />
            <button
              onClick={() => setCameraOpen(true)}
              disabled={!!pendingScan}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-40 transition-colors"
            >
              카메라
            </button>
          </div>
          {processing && <p className="pb-2 text-center text-xs text-gray-400 animate-pulse">처리 중...</p>}
        </div>

        {/* 미등록 바코드 */}
        {notFoundBarcode && !pendingScan && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-red-700 dark:text-red-400">미등록 바코드</p>
              <p className="break-all font-mono text-sm text-red-600 dark:text-red-500">{notFoundBarcode}</p>
              <p className="mt-1 text-xs text-red-500">바코드 관리 페이지에서 등록해주세요</p>
            </div>
            <button onClick={() => setNotFoundBarcode(null)} className="shrink-0 text-xs text-red-300 hover:text-red-500">닫기</button>
          </div>
        )}

        {/* 스캔 확인 카드 */}
        {pendingScan && (
          <div className="overflow-hidden rounded-xl border-2 border-[#D2691E] bg-white dark:bg-gray-800">
            {/* 상품 헤더 */}
            <div className="flex items-center gap-3 border-b border-[#D2691E]/20 bg-[#D2691E]/5 dark:bg-[#D2691E]/10 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold leading-tight text-gray-900 dark:text-white">{pendingScan.result.product.name}</p>
                <p className="mt-0.5 font-mono text-[11px] text-gray-400">
                  {pendingScan.result.product.code} · {pendingScan.barcode}
                  {' · '}<span className={cn('font-semibold', UNIT_CLS[pendingScan.result.unitType as BarcodeUnitType])}>{UNIT_LABEL[pendingScan.result.unitType as BarcodeUnitType]}</span>
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{formatNumber(pendingScan.result.product.stockQty ?? 0)}</p>
                <p className="text-[10px] text-gray-400">현재 재고</p>
              </div>
            </div>

            <div className="space-y-3 px-4 py-3">
              {/* 위치 */}
              <div className="flex items-center gap-3">
                <span className="w-8 shrink-0 text-xs text-gray-400">위치</span>
                {mode === 'INBOUND' ? (
                  <select
                    value={pendingScan.locationId}
                    onChange={(e) => {
                      const loc = (locations as any[]).find((l: any) => l.id === e.target.value)
                      if (loc) setPendingScan((prev) => prev ? { ...prev, locationId: loc.id, locationCode: loc.code, autoLocation: false } : null)
                    }}
                    className="flex-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:outline-none"
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
                  <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">{pendingScan.locationCode || '위치 없음'}</span>
                )}
                {pendingScan.autoLocation && (
                  <span className="shrink-0 rounded bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">자동</span>
                )}
              </div>

              {/* 수량 */}
              <div className="flex items-center gap-3">
                <span className="w-8 shrink-0 text-xs text-gray-400">수량</span>
                <div className="flex flex-1 items-center gap-2">
                  <button
                    onClick={() => setPendingScan((prev) => prev ? { ...prev, quantity: Math.max(1, prev.quantity - 1) } : null)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-lg font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >−</button>
                  <input
                    ref={qtyRef}
                    type="number" min={1}
                    value={pendingScan.quantity}
                    onChange={(e) => setPendingScan((prev) => prev ? { ...prev, quantity: Math.max(1, Number(e.target.value) || 1) } : null)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmScan() }}
                    className="flex-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-center text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#D2691E]/30"
                  />
                  <button
                    onClick={() => setPendingScan((prev) => prev ? { ...prev, quantity: prev.quantity + 1 } : null)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-lg font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >＋</button>
                  <span className="text-xs text-gray-400">OUT</span>
                </div>
                <span className="shrink-0 text-[10px] text-gray-400">1회={formatNumber(pendingScan.result.qtyPerScan)}</span>
              </div>

              {/* 버튼 */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleConfirmScan}
                  disabled={processing || !pendingScan.locationId}
                  className="flex-1 rounded-lg bg-[#D2691E] py-2.5 text-sm font-semibold text-white hover:bg-[#b85c18] disabled:opacity-40 transition-colors"
                >
                  {instantMode ? '즉시 저장' : '카트에 추가'} — Enter
                </button>
                <button
                  onClick={() => { setPendingScan(null); setTimeout(() => inputRef.current?.focus(), 0) }}
                  className="rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  취소 Esc
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 조회 결과 */}
        {!pendingScan && lastResult && (
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-gray-900 dark:text-white">{lastResult.product.name}</p>
                <p className="mt-0.5 font-mono text-[11px] text-gray-400">
                  {lastResult.product.code}
                  {lastResult.product.spec && <> · {lastResult.product.spec}</>}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {lastResult.product.category && (
                    <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-[10px] text-gray-600 dark:text-gray-300">{lastResult.product.category}</span>
                  )}
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', UNIT_CLS[lastResult.unitType])}>{UNIT_LABEL[lastResult.unitType]}</span>
                  <span className="rounded-full bg-[#D2691E]/10 px-2 py-0.5 text-[10px] font-medium text-[#D2691E]">{formatNumber(lastResult.qtyPerScan)}개/스캔</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{formatNumber(lastResult.product.stockQty ?? 0)}</p>
                <p className="text-[10px] text-gray-400">총 재고</p>
              </div>
            </div>

            {/* 위치별 재고 */}
            {inquiryInventory.length > 0 && (
              <div className="border-b border-gray-100 dark:border-gray-700">
                <p className="px-4 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">위치별 재고</p>
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {(inquiryInventory as any[]).map((inv: any) => (
                    <div key={inv.id} className="flex items-center gap-3 px-4 py-2">
                      <span className="flex-1 font-mono text-xs text-gray-600 dark:text-gray-300">{inv.location?.code ?? inv.locationId}</span>
                      <span className="font-bold tabular-nums text-sm text-gray-900 dark:text-gray-100">{formatNumber(inv.quantity)} EA</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 등록 바코드 */}
            {inquiryBarcodes.length > 0 && (
              <div>
                <p className="px-4 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">바코드 ({inquiryBarcodes.length})</p>
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {inquiryBarcodes.map((bc) => (
                    <div key={bc.id} className="flex items-center gap-2 px-4 py-2">
                      <span className="flex-1 font-mono text-sm text-gray-800 dark:text-gray-100">{bc.barcode}</span>
                      <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold', UNIT_CLS[bc.type])}>{UNIT_LABEL[bc.type]}</span>
                      <span className="shrink-0 text-xs text-gray-400">
                        {displayBarcodeStock(lastResult.product.stockQty, bc.type, bc.unitQty, inquiryBarcodes)}
                        {bc.type === 'CXD' && ` · ${formatNumber(bc.unitQty)}개`}
                        {bc.type === 'CXD_OUT' && ` · IN${formatNumber(bc.unitQty)}`}
                      </span>
                      {bc.isPrimary && <span className="text-[11px] text-amber-400">★</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 가격 */}
            {(lastResult.product.sellPrice != null || lastResult.product.retailPrice != null) && (
              <div className="flex gap-4 border-t border-gray-100 dark:border-gray-700 px-4 py-2.5">
                {lastResult.product.sellPrice != null && (
                  <div>
                    <p className="text-[10px] text-gray-400">판매가</p>
                    <p className="text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-100">₩{formatNumber(lastResult.product.sellPrice)}</p>
                  </div>
                )}
                {lastResult.product.retailPrice != null && (
                  <div>
                    <p className="text-[10px] text-gray-400">소비자가</p>
                    <p className="text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-100">₩{formatNumber(lastResult.product.retailPrice)}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 카트 (비즉시 모드) */}
        {!instantMode && cart.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-4 py-2.5">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">처리 대기 {cart.length}건</span>
              <button onClick={clearCart} className="text-xs text-gray-400 hover:text-red-500 transition-colors">전체 삭제</button>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {cart.map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{item.productName}</p>
                    <p className="text-xs text-gray-400">{item.locationCode}</p>
                  </div>
                  <span className="font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(item.quantity)}개</span>
                  <button onClick={() => removeFromCart(i)} className="text-xs text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400">삭제</button>
                </div>
              ))}
            </div>
            <div className="p-3">
              <button
                onClick={() => submitMutation.mutate(cart)}
                disabled={submitMutation.isPending}
                className="w-full rounded-lg bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
              >
                {submitMutation.isPending ? '처리 중...' : `${SCAN_MODE_LABEL[mode as 'INBOUND' | 'OUTBOUND']} 완료 (${cart.length}건)`}
              </button>
            </div>
          </div>
        )}

        {/* 오늘 이력 피드 */}
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-4 py-2.5">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">오늘 이력</span>
            <span className="text-xs text-gray-400">{historyItems.length}건</span>
          </div>
          {historyItems.length === 0 ? (
            <p className="py-8 text-center text-xs text-gray-400">오늘 처리된 이력이 없습니다</p>
          ) : (
            <div className="max-h-72 divide-y divide-gray-100 dark:divide-gray-800 overflow-y-auto">
              {[...historyItems].reverse().map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    tx.txType === 'INBOUND'
                      ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
                  )}>
                    {tx.txType === 'INBOUND' ? '+' : '−'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{tx.product?.name ?? tx.productId}</p>
                    {tx.barcodeScanned && <p className="font-mono text-[10px] text-gray-400">{tx.barcodeScanned}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-gray-700 dark:text-gray-300">{formatNumber(tx.qtyAfter)}</p>
                    <p className="text-[10px] text-gray-400">{tx.createdAt.slice(11, 16)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
