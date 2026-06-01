'use client'
import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ScanLine, CheckCircle, XCircle, Trash2 } from 'lucide-react'
import { useScanStore, ScanCartItem } from '@/stores/scan.store'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { productApi } from '@/api/product.api'
import { stockApi } from '@/api/stock.api'
import { warehouseApi } from '@/api/warehouse.api'
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'
import { SCAN_MODE_LABEL, SCAN_MODES } from '@/constants/stock.constants'
import { QUERY_KEYS } from '@/constants/query-keys'
import { formatNumber } from '@/utils/format'
import type { BarcodeResolveResult } from '@/types/api.types'

export default function ScanPage() {
  const qc          = useQueryClient()
  const inputRef    = useRef<HTMLInputElement>(null)
  const warehouse   = useWarehouseStore((s) => s.selectedWarehouse)
  const { mode, cart, lastResult, selectedLocation,
          setMode, setLastResult, setSelectedLocation,
          addToCart, removeFromCart, clearCart } = useScanStore()

  const [processing, setProcessing] = useState(false)

  // 위치 목록
  const { data: locations = [] } = useQuery({
    queryKey: QUERY_KEYS.locations(warehouse?.id ?? ''),
    queryFn:  () => warehouseApi.findLocations(warehouse!.id),
    enabled:  !!warehouse?.id,
  })

  // 배치 입고/출고 처리
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

  const handleScan = async (barcode: string) => {
    if (processing || !warehouse) return
    setProcessing(true)
    try {
      const result: BarcodeResolveResult = await productApi.resolveBarcode(barcode)
      setLastResult(result)

      if (mode === 'INBOUND' && selectedLocation) {
        addToCart({
          productId:   result.product.id,
          productCode: result.product.code,
          productName: result.product.name,
          locationId:  selectedLocation.id,
          locationCode: selectedLocation.code,
          quantity:    result.qtyPerScan,
          barcodeUsed: barcode,
          unitType:    result.unitType,
          qtyPerScan:  result.qtyPerScan,
        })
        toast.success(`${result.product.name} — ${result.qtyPerScan}개 추가`)
      } else if (mode === 'OUTBOUND') {
        // 출고: 재고 있는 위치 자동 표시
        const invList = await stockApi.getInventoryByProduct(result.product.id, warehouse.id)
        const firstInv = invList.find((i: any) => i.quantity >= result.qtyPerScan)
        if (!firstInv) {
          toast.error('출고 가능 재고 없음')
        } else {
          addToCart({
            productId:   result.product.id,
            productCode: result.product.code,
            productName: result.product.name,
            locationId:  firstInv.locationId,
            locationCode: firstInv.location?.code ?? '',
            quantity:    result.qtyPerScan,
            barcodeUsed: barcode,
            unitType:    result.unitType,
            qtyPerScan:  result.qtyPerScan,
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
  }

  const { handleKeyDown } = useBarcodeScanner({ inputRef, onScan: handleScan })

  if (!warehouse) {
    return <div className="flex items-center justify-center h-64 text-gray-400">창고를 먼저 선택하세요</div>
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* 모드 선택 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-medium text-gray-500 mb-2">스캔 모드</p>
        <div className="flex gap-2">
          {SCAN_MODES.filter(m => m === 'INBOUND' || m === 'OUTBOUND').map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === m
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {SCAN_MODE_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      {/* 입고 위치 선택 */}
      {mode === 'INBOUND' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 mb-2">입고 위치</p>
          <select
            value={selectedLocation?.id ?? ''}
            onChange={(e) => {
              const loc = locations.find((l: any) => l.id === e.target.value)
              setSelectedLocation(loc ?? null)
            }}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">위치 선택</option>
            {locations.map((l: any) => (
              <option key={l.id} value={l.id}>{l.code}</option>
            ))}
          </select>
        </div>
      )}

      {/* 바코드 입력 */}
      <div className="bg-white rounded-xl border-2 border-brand-500 p-4">
        <div className="flex items-center gap-3 mb-3">
          <ScanLine size={20} className="text-brand-600" />
          <span className="font-medium text-gray-900">바코드 스캔</span>
          {processing && <span className="text-xs text-gray-400 animate-pulse">처리 중...</span>}
        </div>
        <input
          ref={inputRef}
          type="text"
          onKeyDown={handleKeyDown}
          className="w-full border border-gray-200 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
          placeholder="바코드를 스캔하거나 직접 입력 후 Enter"
          autoFocus
        />
        {lastResult && (
          <div className="mt-3 p-3 bg-green-50 rounded-lg">
            <p className="text-sm font-medium text-green-800">{lastResult.product.name}</p>
            <p className="text-xs text-green-600">
              {lastResult.unitType === 'BOX' ? '박스' : '낱개'} — {lastResult.qtyPerScan}개/스캔
            </p>
          </div>
        )}
      </div>

      {/* 처리 대기 목록 */}
      {cart.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <span className="font-medium text-gray-900">처리 대기 ({cart.length})</span>
            <button onClick={clearCart} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
              전체 삭제
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {cart.map((item, i) => (
              <div key={i} className="flex items-center p-3 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.productName}</p>
                  <p className="text-xs text-gray-400">{item.locationCode}</p>
                </div>
                <span className="font-bold text-gray-900 tabular-nums">
                  {formatNumber(item.quantity)}개
                </span>
                <button onClick={() => removeFromCart(i)} className="text-gray-300 hover:text-red-500">
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
  )
}
