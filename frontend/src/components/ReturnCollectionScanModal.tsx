'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Minus, Plus, Trash2, X } from 'lucide-react'
import { productApi } from '@/api/product.api'
import { warehouseApi } from '@/api/warehouse.api'
import { returnCollectionApi } from '@/api/return-collection.api'
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'
import {
  RETURN_COLLECTION_TYPE_LABEL, RETURN_COLLECTION_TYPE_COLOR,
  RETURN_REASON_OPTIONS, RECALL_REASON_OPTIONS,
} from '@/constants/stock.constants'
import { QUERY_KEYS } from '@/constants/query-keys'
import { formatNumber } from '@/utils/format'
import { cn } from '@/utils/cn'
import { CameraScanner } from '@/components/CameraScanner'
import type { BarcodeResolveResult, Location, Zone, ReturnCollectionType } from '@/types/api.types'

type Mode = ReturnCollectionType

interface ScanItem {
  key: string
  barcode: string
  result: BarcodeResolveResult
  quantity: number
  locationId: string
  reason: string
  memo: string
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; code?: string } | undefined
    return data?.message || data?.code || fallback
  }
  return fallback
}

export function ReturnCollectionScanModal({
  warehouseId,
  onClose,
  onCreated,
}: {
  warehouseId: string
  onClose: () => void
  onCreated: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<Mode>('RETURN')
  const [processing, setProcessing] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null)
  const [items, setItems] = useState<ScanItem[]>([])

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 0) }, [])

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: QUERY_KEYS.locations(warehouseId),
    queryFn: () => warehouseApi.findLocations(warehouseId),
  })
  const { data: zones = [] } = useQuery<Zone[]>({
    queryKey: QUERY_KEYS.zones(warehouseId),
    queryFn: () => warehouseApi.findZones(warehouseId),
  })

  const reasonOptions = mode === 'RETURN' ? RETURN_REASON_OPTIONS : RECALL_REASON_OPTIONS
  const totalQuantity = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items])

  const updateItem = (key: string, patch: Partial<ScanItem>) => {
    setItems((current) => current.map((item) => item.key === key ? { ...item, ...patch } : item))
  }

  const handleModeChange = (nextMode: Mode) => {
    if (nextMode === mode) return
    if (items.length > 0 && !window.confirm('스캔 목록을 비우고 유형을 변경할까요?')) return
    setItems([])
    setMode(nextMode)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleScan = useCallback(async (barcode: string) => {
    if (processing) return
    setProcessing(true)
    setNotFoundBarcode(null)
    try {
      const result = await productApi.resolveBarcode(barcode) as BarcodeResolveResult
      const key = `${result.product.id}:${barcode}`
      setItems((current) => {
        const existing = current.find((item) => item.key === key)
        if (existing) {
          return current.map((item) => item.key === key
            ? { ...item, quantity: item.quantity + result.qtyPerScan }
            : item)
        }
        return [...current, {
          key,
          barcode,
          result,
          quantity: result.qtyPerScan,
          locationId: '',
          reason: (mode === 'RETURN' ? RETURN_REASON_OPTIONS : RECALL_REASON_OPTIONS)[0],
          memo: '',
        }]
      })
      toast.success(`${result.product.name} 추가`)
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.code === 'BARCODE_NOT_FOUND') setNotFoundBarcode(barcode)
      else toast.error('스캔 처리 중 오류가 발생했습니다')
    } finally {
      setProcessing(false)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [mode, processing])

  const handleSaveAll = async () => {
    if (items.length === 0) { toast.error('먼저 바코드를 스캔하세요'); return }
    setProcessing(true)
    try {
      const result = await returnCollectionApi.createBatch(items.map((item) => ({
          type: mode,
          productId: item.result.product.id,
          warehouseId,
          locationId: item.locationId || undefined,
          quantity: item.quantity,
          reason: item.reason,
          memo: item.memo || undefined,
          barcodeScanned: item.barcode,
      })))
      setItems([])
      onCreated()
      toast.success(`${result.batchNo} · ${result.items.length}건을 저장했습니다`)
      onClose()
    } catch (error) {
      toast.error(getApiErrorMessage(error, '일괄 저장에 실패했습니다. 저장된 항목은 없습니다.'))
    } finally {
      setProcessing(false)
    }
  }

  const { handleKeyDown } = useBarcodeScanner({ inputRef, onScan: handleScan })

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || cameraOpen) return
      if (items.length === 0 || window.confirm('저장하지 않은 스캔 목록을 닫을까요?')) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [cameraOpen, items.length, onClose])

  const locationOptions = (
    <>
      <option value="">위치 선택 안함</option>
      {zones.length > 0
        ? zones.map((zone) => {
            const zoneLocations = locations.filter((location) => location.zoneId === zone.id)
            if (zoneLocations.length === 0) return null
            return (
              <optgroup key={zone.id} label={`[${zone.code}] ${zone.name}`}>
                {zoneLocations.map((location) => <option key={location.id} value={location.id}>{location.code}</option>)}
              </optgroup>
            )
          })
        : locations.map((location) => <option key={location.id} value={location.id}>{location.code}</option>)}
    </>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      {cameraOpen && <CameraScanner onScan={handleScan} onClose={() => setCameraOpen(false)} />}
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl dark:bg-gray-800">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">반품/회수 일괄 스캔</h3>
            <p className="text-xs text-gray-400">{formatNumber(items.length)}개 품목 · 총 {formatNumber(totalQuantity)}개</p>
          </div>
          <button onClick={() => { if (!items.length || window.confirm('저장하지 않은 스캔 목록을 닫을까요?')) onClose() }} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div className="flex overflow-hidden rounded-lg border border-gray-200 divide-x divide-gray-200 dark:border-gray-700 dark:divide-gray-700">
            {(['RETURN', 'RECALL'] as Mode[]).map((value) => (
              <button key={value} onClick={() => handleModeChange(value)} className={cn('flex-1 py-2 text-sm font-medium', mode === value ? 'bg-[var(--color-primary)] text-white' : 'text-gray-600 dark:text-gray-400')}>
                {RETURN_COLLECTION_TYPE_LABEL[value]}
              </button>
            ))}
          </div>

          <div className="rounded-xl border-2 border-[var(--color-primary)]">
            <div className="relative p-1">
              <input ref={inputRef} type="text" onKeyDown={handleKeyDown} disabled={processing}
                className="w-full rounded-lg bg-transparent px-4 py-3 pr-20 font-mono text-base text-gray-900 focus:outline-none disabled:opacity-50 dark:text-gray-100"
                placeholder="바코드를 계속 스캔하세요" />
              <button onClick={() => setCameraOpen(true)} disabled={processing} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs text-white disabled:opacity-40">카메라</button>
            </div>
            {processing && <p className="pb-2 text-center text-xs text-gray-400 animate-pulse">처리 중...</p>}
          </div>

          {notFoundBarcode && (
            <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20">
              <span>미등록 바코드: <b className="font-mono">{notFoundBarcode}</b></span>
              <button onClick={() => setNotFoundBarcode(null)}><X size={14} /></button>
            </div>
          )}

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center text-sm text-gray-400 dark:border-gray-600">스캔한 상품이 여기에 쌓입니다</div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.key} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{item.result.product.name}</p>
                        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', RETURN_COLLECTION_TYPE_COLOR[mode])}>{RETURN_COLLECTION_TYPE_LABEL[mode]}</span>
                      </div>
                      <p className="font-mono text-[11px] text-gray-400">{item.result.product.code} · {item.barcode}</p>
                    </div>
                    <button onClick={() => setItems((current) => current.filter((row) => row.key !== item.key))} className="p-1.5 text-gray-400 hover:text-red-500" title="목록에서 삭제"><Trash2 size={14} /></button>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[140px_1fr_1fr]">
                    <div className="flex items-center overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600">
                      <button onClick={() => updateItem(item.key, { quantity: Math.max(1, item.quantity - 1) })} className="grid h-8 w-8 place-items-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"><Minus size={13} /></button>
                      <input type="number" min={1} value={item.quantity} onChange={(event) => updateItem(item.key, { quantity: Math.max(1, Number(event.target.value) || 1) })} className="h-8 min-w-0 flex-1 border-x border-gray-200 bg-transparent text-center text-sm font-bold outline-none dark:border-gray-600" />
                      <button onClick={() => updateItem(item.key, { quantity: item.quantity + 1 })} className="grid h-8 w-8 place-items-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"><Plus size={13} /></button>
                    </div>
                    <select value={item.locationId} onChange={(event) => updateItem(item.key, { locationId: event.target.value })} className="h-8 min-w-0 rounded-lg border border-gray-200 bg-white px-2 text-xs dark:border-gray-600 dark:bg-gray-700">{locationOptions}</select>
                    <select value={item.reason} onChange={(event) => updateItem(item.key, { reason: event.target.value })} className="h-8 min-w-0 rounded-lg border border-gray-200 bg-white px-2 text-xs dark:border-gray-600 dark:bg-gray-700">
                      {reasonOptions.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                    </select>
                  </div>
                  <input value={item.memo} onChange={(event) => updateItem(item.key, { memo: event.target.value })} placeholder="메모 (선택)" className="mt-2 h-8 w-full rounded-lg border border-gray-200 bg-transparent px-2 text-xs outline-none dark:border-gray-600" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
          <button onClick={() => { if (items.length && window.confirm('스캔 목록을 모두 비울까요?')) setItems([]) }} disabled={!items.length || processing} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 disabled:opacity-40 dark:border-gray-600">목록 비우기</button>
          <button onClick={handleSaveAll} disabled={!items.length || processing} className="rounded-lg bg-[#D2691E] px-6 py-2 text-sm font-semibold text-white hover:bg-[#b85c18] disabled:opacity-40">
            {items.length}건 일괄 저장
          </button>
        </div>
      </div>
    </div>
  )
}
