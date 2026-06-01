'use client'
import { useRef, useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ScanLine, CheckCircle, Trash2, Camera } from 'lucide-react'
import { useScanStore, ScanCartItem } from '@/stores/scan.store'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { productApi } from '@/api/product.api'
import { stockApi } from '@/api/stock.api'
import { warehouseApi } from '@/api/warehouse.api'
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'
import { SCAN_MODE_LABEL, SCAN_MODES } from '@/constants/stock.constants'
import { QUERY_KEYS } from '@/constants/query-keys'
import { formatNumber } from '@/utils/format'
import { CameraScanner } from '@/components/CameraScanner'
import type { BarcodeResolveResult } from '@/types/api.types'

export default function ScanPage() {
  const qc          = useQueryClient()
  const inputRef    = useRef<HTMLInputElement>(null)
  const warehouse   = useWarehouseStore((s) => s.selectedWarehouse)
  const { mode, cart, lastResult, selectedLocation,
          setMode, setLastResult, setSelectedLocation,
          addToCart, removeFromCart, clearCart } = useScanStore()

  const [processing, setProcessing]       = useState(false)
  const [cameraOpen, setCameraOpen]       = useState(false)

  const { data: locations = [] } = useQuery({
    queryKey: QUERY_KEYS.locations(warehouse?.id ?? ''),
    queryFn:  () => warehouseApi.findLocations(warehouse!.id),
    enabled:  !!warehouse?.id,
  })

  const submitMutation = useMutation({
    mutationFn: async (items: ScanCartItem[]) => {
      for (const item of items) {
        if (mode === 'INBOUND') {
          await stockApi.inbound({
            productId: item.productId, locationId: item.locationId,
            warehouseId: warehouse!.id, quantity: item.quantity,
            barcodeUsed: item.barcodeUsed,
          })
        } else if (mode === 'OUTBOUND') {
          await stockApi.outbound({
            productId: item.productId, locationId: item.locationId,
            warehouseId: warehouse!.id, quantity: item.quantity,
            barcodeUsed: item.barcodeUsed,
          })
        }
      }
    },
    onSuccess: () => {
      toast.success(`${mode === 'INBOUND' ? '입고' : '출고'} 처리 완료`)
      clearCart()
      qc.invalidateQueries({ queryKey: ['inventory'] })
    },
  })

  const handleScan = useCallback(async (barcode: string) => {
    if (processing || !warehouse) return
    setProcessing(true)
    try {
      const result: BarcodeResolveResult = await productApi.resolveBarcode(barcode)
      setLastResult(result)

      if (mode === 'INBOUND' && selectedLocation) {
        addToCart({
          productId:    result.product.id,
          productCode:  result.product.code,
          productName:  result.product.name,
          locationId:   selectedLocation.id,
          locationCode: selectedLocation.code,
          quantity:     result.qtyPerScan,
          barcodeUsed:  barcode,
          unitType:     result.unitType,
          qtyPerScan:   result.qtyPerScan,
        })
        toast.success(`${result.product.name} — ${result.qtyPerScan}개 추가`)
      } else if (mode === 'OUTBOUND') {
        const invList  = await stockApi.getInventoryByProduct(result.product.id, warehouse.id)
        const firstInv = invList.find((i: any) => i.quantity >= result.qtyPerScan)
        if (!firstInv) {
          toast.error('출고 가능 재고 없음')
        } else {
          addToCart({
            productId:    result.product.id,
            productCode:  result.product.code,
            productName:  result.product.name,
            locationId:   firstInv.locationId,
            locationCode: firstInv.location?.code ?? '',
            quantity:     result.qtyPerScan,
            barcodeUsed:  barcode,
            unitType:     result.unitType,
            qtyPerScan:   result.qtyPerScan,
          })
          toast.success(`${result.product.name} — ${result.qtyPerScan}개 출고 예약`)
        }
      } else if (mode === 'INBOUND' && !selectedLocation) {
        toast.error('입고 위치를 먼저 선택하세요')
      }
    } catch (err: any) {
      const code = err.response?.data?.code
      if (code === 'BARCODE_NOT_FOUND') toast.error('등록되지 않은 바코드입니다')
      else toast.error('스캔 처리 중 오류가 발생했습니다')
    } finally {
      setProcessing(false)
    }
  }, [processing, warehouse, mode, selectedLocation, setLastResult, addToCart])

  const { handleKeyDown } = useBarcodeScanner({ inputRef, onScan: handleScan })

  if (!warehouse) {
    return <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">창고를 먼저 선택하세요</div>
  }

  return (
    <>
      {/* 카메라 스캐너 모달 */}
      {cameraOpen && (
        <CameraScanner
          onScan={(barcode) => {
            handleScan(barcode)
            // 스캔 성공 시 카메라는 계속 열어두기 (사용자가 직접 닫음)
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}

      <div className="max-w-2xl mx-auto space-y-4">
        {/* 모드 선택 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">스캔 모드</p>
          <div className="flex gap-2">
            {SCAN_MODES.filter(m => m === 'INBOUND' || m === 'OUTBOUND').map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mode === m
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {SCAN_MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        {/* 입고 위치 선택 */}
        {mode === 'INBOUND' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">입고 위치</p>
            <select
              value={selectedLocation?.id ?? ''}
              onChange={(e) => {
                const loc = locations.find((l: any) => l.id === e.target.value)
                setSelectedLocation(loc ?? null)
              }}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">위치 선택</option>
              {locations.map((l: any) => (
                <option key={l.id} value={l.id}>{l.code}</option>
              ))}
            </select>
          </div>
        )}

        {/* 바코드 입력 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-brand-500 p-4">
          <div className="flex items-center gap-3 mb-3">
            <ScanLine size={20} className="text-brand-600" />
            <span className="font-medium text-gray-900 dark:text-gray-100">바코드 스캔</span>
            {processing && <span className="text-xs text-gray-400 animate-pulse">처리 중...</span>}
            <div className="flex-1" />
            {/* 카메라 버튼 */}
            <button
              onClick={() => setCameraOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-xs rounded-lg hover:bg-brand-700 transition-colors"
            >
              <Camera size={14} />
              카메라
            </button>
          </div>
          <input
            ref={inputRef}
            type="text"
            onKeyDown={handleKeyDown}
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="바코드를 스캔하거나 직접 입력 후 Enter"
            autoFocus
          />
          {lastResult && (
            <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center gap-2">
              <CheckCircle size={16} className="text-green-600 dark:text-green-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-300">{lastResult.product.name}</p>
                <p className="text-xs text-green-600 dark:text-green-500">
                  {lastResult.unitType === 'BOX' ? '박스' : '낱개'} — {lastResult.qtyPerScan}개/스캔
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 처리 대기 목록 */}
        {cart.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <span className="font-medium text-gray-900 dark:text-gray-100">처리 대기 ({cart.length})</span>
              <button onClick={clearCart} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                전체 삭제
              </button>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {cart.map((item, i) => (
                <div key={i} className="flex items-center p-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">{item.productName}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{item.locationCode}</p>
                  </div>
                  <span className="font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                    {formatNumber(item.quantity)}개
                  </span>
                  <button onClick={() => removeFromCart(i)} className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="p-4">
              <button
                onClick={() => submitMutation.mutate(cart)}
                disabled={submitMutation.isPending}
                className="w-full py-3 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-50"
              >
                {submitMutation.isPending ? '처리 중...' : `${SCAN_MODE_LABEL[mode as 'INBOUND'|'OUTBOUND']} 완료 (${cart.length}건)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
