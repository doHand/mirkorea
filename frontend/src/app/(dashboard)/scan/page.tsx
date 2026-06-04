'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ScanLine, CheckCircle, Trash2, Camera,
  Barcode, Search, ChevronDown, ChevronRight, Plus, Star, Pencil, Check, X,
} from 'lucide-react'
import { useScanStore, ScanCartItem } from '@/stores/scan.store'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { productApi } from '@/api/product.api'
import { stockApi } from '@/api/stock.api'
import { warehouseApi } from '@/api/warehouse.api'
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'
import { SCAN_MODE_LABEL, SCAN_MODES } from '@/constants/stock.constants'
import { QUERY_KEYS } from '@/constants/query-keys'
import { formatNumber } from '@/utils/format'
import { cn } from '@/utils/cn'
import { CameraScanner } from '@/components/CameraScanner'
import { useMenuLabel } from '@/hooks/use-menu-label'
import type { BarcodeResolveResult, Zone, BarcodeUnitType, Product } from '@/types/api.types'

const UNIT_TYPES: BarcodeUnitType[] = ['UNIT', 'BOX', 'CXD']
const UNIT_LABEL: Record<BarcodeUnitType, string> = { UNIT: '일반낱개', BOX: '박스', CXD: 'CXD낱개' }
const UNIT_CLS: Record<BarcodeUnitType, string> = {
  UNIT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  BOX:  'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  CXD:  'bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400',
}

type AddForm  = { barcode: string; type: BarcodeUnitType; unitQty: number; isPrimary: boolean }
type EditForm = { type: BarcodeUnitType; unitQty: number; isPrimary: boolean }
const defaultAddForm  = (): AddForm  => ({ barcode: '', type: 'UNIT', unitQty: 1, isPrimary: false })
const defaultEditForm = (type: BarcodeUnitType, unitQty: number, isPrimary: boolean): EditForm => ({ type, unitQty, isPrimary })

export default function ScanPage() {
  const pageTitle = useMenuLabel('스캔/바코드 관리')
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const warehouse = useWarehouseStore((s) => s.selectedWarehouse)
  const { mode, cart, lastResult, selectedLocation,
          setMode, setLastResult, setSelectedLocation,
          addToCart, removeFromCart, clearCart } = useScanStore()

  const [processing, setProcessing] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)

  // ── Barcode management state ──
  const [bcSearchInput, setBcSearchInput] = useState('')
  const [bcSearch, setBcSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [addForms, setAddForms] = useState<Record<string, AddForm>>({})
  const [editForms, setEditForms] = useState<Record<string, EditForm>>({})

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

  useEffect(() => { setSelectedLocation(null) }, [warehouse?.id, setSelectedLocation])

  // ── Barcode management queries ──
  const { data: bcPageData, isLoading: bcLoading } = useQuery({
    queryKey: ['products', bcSearch],
    queryFn: () => productApi.findAll({ search: bcSearch, limit: 200 }),
  })
  const bcProducts: Product[] = bcPageData?.items ?? []

  const { data: barcodeMap } = useQuery({
    queryKey: ['all-barcodes', bcProducts.map((p) => p.id).join(',')],
    queryFn: async () => {
      const results = await Promise.all(bcProducts.map((p) => productApi.findBarcodes(p.id)))
      return Object.fromEntries(bcProducts.map((p, i) => [p.id, results[i] ?? []]))
    },
    enabled: bcProducts.length > 0,
  })

  // ── Scan mutations ──
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
    onSuccess: () => { toast.success(`${mode === 'INBOUND' ? '입고' : '출고'} 처리 완료`); clearCart(); qc.invalidateQueries({ queryKey: ['inventory'] }) },
  })

  // ── Barcode mutations ──
  const addMutation = useMutation({
    mutationFn: ({ productId, form }: { productId: string; form: AddForm }) => productApi.addBarcode(productId, form),
    onSuccess: (_, { productId }) => {
      qc.invalidateQueries({ queryKey: ['all-barcodes'] })
      setAddForms((prev) => { const n = { ...prev }; delete n[productId]; return n })
      toast.success('바코드가 추가되었습니다')
    },
    onError: () => toast.error('바코드 추가 실패 (중복 또는 오류)'),
  })
  const editMutation = useMutation({
    mutationFn: ({ productId, barcodeId, form }: { productId: string; barcodeId: string; form: EditForm }) => productApi.updateBarcode(productId, barcodeId, form),
    onSuccess: (_, { barcodeId }) => {
      qc.invalidateQueries({ queryKey: ['all-barcodes'] })
      setEditForms((prev) => { const n = { ...prev }; delete n[barcodeId]; return n })
      toast.success('바코드가 수정되었습니다')
    },
    onError: () => toast.error('수정 실패'),
  })
  const deleteMutation = useMutation({
    mutationFn: ({ productId, barcodeId }: { productId: string; barcodeId: string }) => productApi.deleteBarcode(productId, barcodeId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['all-barcodes'] }); toast.success('삭제되었습니다') },
    onError: () => toast.error('삭제 실패'),
  })

  const handleScan = useCallback(async (barcode: string) => {
    if (processing || !warehouse) return
    setProcessing(true)
    try {
      const result: BarcodeResolveResult = await productApi.resolveBarcode(barcode)
      setLastResult(result)
      if (mode === 'INBOUND' && selectedLocation) {
        addToCart({ productId: result.product.id, productCode: result.product.code, productName: result.product.name, locationId: selectedLocation.id, locationCode: selectedLocation.code, quantity: result.qtyPerScan, barcodeUsed: barcode, unitType: result.unitType, qtyPerScan: result.qtyPerScan })
        toast.success(`${result.product.name} — ${result.qtyPerScan}개 추가`)
      } else if (mode === 'OUTBOUND') {
        const invList = await stockApi.getInventoryByProduct(result.product.id, warehouse.id)
        const firstInv = invList.find((i: any) => i.quantity >= result.qtyPerScan)
        if (!firstInv) { toast.error('출고 가능 재고 없음') }
        else {
          addToCart({ productId: result.product.id, productCode: result.product.code, productName: result.product.name, locationId: firstInv.locationId, locationCode: firstInv.location?.code ?? '', quantity: result.qtyPerScan, barcodeUsed: barcode, unitType: result.unitType, qtyPerScan: result.qtyPerScan })
          toast.success(`${result.product.name} — ${result.qtyPerScan}개 출고 예약`)
        }
      } else if (mode === 'INBOUND' && !selectedLocation) {
        toast.error('입고 위치를 먼저 선택하세요')
      }
    } catch (err: any) {
      const code = err.response?.data?.code
      if (code === 'BARCODE_NOT_FOUND') toast.error('등록되지 않은 바코드입니다')
      else toast.error('스캔 처리 중 오류가 발생했습니다')
    } finally { setProcessing(false) }
  }, [processing, warehouse, mode, selectedLocation, setLastResult, addToCart])

  const { handleKeyDown } = useBarcodeScanner({ inputRef, onScan: handleScan })

  const toggleBc = (id: string) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const patchAddForm = (id: string, patch: Partial<AddForm>) =>
    setAddForms((prev) => ({ ...prev, [id]: { ...(prev[id] ?? defaultAddForm()), ...patch } }))
  const patchEditForm = (barcodeId: string, patch: Partial<EditForm>) =>
    setEditForms((prev) => ({ ...prev, [barcodeId]: { ...(prev[barcodeId] ?? { type: 'UNIT', unitQty: 1, isPrimary: false }), ...patch } }))

  if (!warehouse) {
    return <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">창고를 먼저 선택하세요</div>
  }

  return (
    <>
      {cameraOpen && <CameraScanner onScan={(barcode) => handleScan(barcode)} onClose={() => setCameraOpen(false)} />}

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{pageTitle}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">스캔으로 입출고를 처리하고 바코드를 관리합니다</p>
        </div>

        <div className="grid grid-cols-2 gap-4 items-start">
          {/* ── Left: Scan panel ── */}
          <div className="space-y-3">
            {/* 모드 선택 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">스캔 모드</p>
              <div className="flex gap-2">
                {SCAN_MODES.filter((m) => m === 'INBOUND' || m === 'OUTBOUND').map((m) => (
                  <button key={m} onClick={() => setMode(m)}
                    className={cn('flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                      mode === m ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600')}>
                    {SCAN_MODE_LABEL[m]}
                  </button>
                ))}
              </div>
            </div>

            {/* 입고 위치 */}
            {mode === 'INBOUND' && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">입고 위치</p>
                <select value={selectedLocation?.id ?? ''}
                  onChange={(e) => { const loc = locations.find((l: any) => l.id === e.target.value); setSelectedLocation(loc ?? null); setTimeout(() => inputRef.current?.focus(), 0) }}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                  <option value="">위치 선택</option>
                  {zones.length > 0
                    ? (zones as Zone[]).map((z) => {
                        const zoneLocs = locations.filter((l: any) => l.zoneId === z.id)
                        if (zoneLocs.length === 0) return null
                        return (
                          <optgroup key={z.id} label={`[${z.code}] ${z.name}`}>
                            {zoneLocs.map((l: any) => <option key={l.id} value={l.id}>{l.code}</option>)}
                          </optgroup>
                        )
                      })
                    : locations.map((l: any) => <option key={l.id} value={l.id}>{l.code}</option>)}
                </select>
                {selectedLocation && <p className="mt-1.5 text-xs text-indigo-600 dark:text-indigo-400">선택됨: {selectedLocation.code}</p>}
              </div>
            )}

            {/* 바코드 입력 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-indigo-500 p-4">
              <div className="flex items-center gap-3 mb-3">
                <ScanLine size={20} className="text-indigo-600" />
                <span className="font-medium text-gray-900 dark:text-gray-100">바코드 스캔</span>
                {processing && <span className="text-xs text-gray-400 animate-pulse">처리 중...</span>}
                <div className="flex-1" />
                <button onClick={() => setCameraOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition-colors">
                  <Camera size={14} />카메라
                </button>
              </div>
              <input ref={inputRef} type="text" onKeyDown={handleKeyDown}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="바코드를 스캔하거나 직접 입력 후 Enter" autoFocus />
              {lastResult && (
                <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-600 dark:text-green-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-300">{lastResult.product.name}</p>
                    <p className="text-xs text-green-600 dark:text-green-500">{lastResult.unitType === 'BOX' ? '박스' : '낱개'} — {lastResult.qtyPerScan}개/스캔</p>
                  </div>
                </div>
              )}
            </div>

            {/* 처리 대기 목록 */}
            {cart.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-gray-100">처리 대기 ({cart.length})</span>
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
                  <button onClick={() => submitMutation.mutate(cart)} disabled={submitMutation.isPending}
                    className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                    {submitMutation.isPending ? '처리 중...' : `${SCAN_MODE_LABEL[mode as 'INBOUND' | 'OUTBOUND']} 완료 (${cart.length}건)`}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Barcode management ── */}
          <div className="space-y-3">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-3 flex gap-2.5 shadow-sm">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input value={bcSearchInput} onChange={(e) => setBcSearchInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') setBcSearch(bcSearchInput) }}
                  placeholder="상품코드 / 상품명"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 transition-shadow" />
              </div>
              <button onClick={() => setBcSearch(bcSearchInput)} className="px-3.5 py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium">검색</button>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                <Barcode size={14} className="text-indigo-500" />
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">바코드 관리 — 상품 행을 펼쳐 바코드를 관리합니다</span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[520px] overflow-y-auto">
                {bcLoading && <p className="text-center py-8 text-gray-400 text-sm">불러오는 중...</p>}
                {!bcLoading && bcProducts.length === 0 && <p className="text-center py-8 text-gray-300 text-sm">검색 결과 없음</p>}
                {bcProducts.map((p: Product) => {
                  const isOpen = expanded.has(p.id)
                  const barcodes = barcodeMap?.[p.id] ?? []
                  const addForm = addForms[p.id]
                  return (
                    <div key={p.id}>
                      <button onClick={() => toggleBc(p.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-800/20 text-left transition-colors">
                        {isOpen ? <ChevronDown size={13} className="text-indigo-500 shrink-0" /> : <ChevronRight size={13} className="text-gray-400 shrink-0" />}
                        <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400 w-24 shrink-0">{p.code}</span>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1 truncate">{p.name}</span>
                        <span className="text-xs text-gray-400">{barcodes.length}개</span>
                      </button>
                      {isOpen && (
                        <div className="bg-gray-50/40 dark:bg-gray-800/10 border-t border-gray-100 dark:border-gray-800 px-8 py-2 space-y-1.5">
                          {barcodes.map((bc: any) => {
                            const ef = editForms[bc.id]
                            return (
                              <div key={bc.id}>
                                {!ef && (
                                  <div className="flex items-center gap-2 py-1.5 group/bc">
                                    <span className="font-mono text-sm text-gray-800 dark:text-gray-200 flex-1">{bc.barcode}</span>
                                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', UNIT_CLS[bc.type as BarcodeUnitType])}>{UNIT_LABEL[bc.type as BarcodeUnitType]}</span>
                                    <span className="text-xs text-gray-400 w-10">×{bc.unitQty}</span>
                                    {bc.isPrimary && <Star size={11} className="text-amber-400 fill-amber-400 shrink-0" />}
                                    <button onClick={() => setEditForms((prev) => ({ ...prev, [bc.id]: defaultEditForm(bc.type, bc.unitQty, bc.isPrimary) }))} className="text-gray-300 hover:text-indigo-500 opacity-0 group-hover/bc:opacity-100 transition-all p-0.5"><Pencil size={12} /></button>
                                    <button onClick={() => { if (confirm('바코드를 삭제할까요?')) deleteMutation.mutate({ productId: p.id, barcodeId: bc.id }) }} className="text-gray-300 hover:text-rose-500 opacity-0 group-hover/bc:opacity-100 transition-all p-0.5"><Trash2 size={12} /></button>
                                  </div>
                                )}
                                {ef && (
                                  <div className="flex items-center gap-2 py-1.5 flex-wrap bg-indigo-50/50 dark:bg-indigo-900/10 rounded-lg px-2">
                                    <span className="font-mono text-sm text-gray-500 dark:text-gray-400 flex-1">{bc.barcode}</span>
                                    <select value={ef.type} onChange={(e) => patchEditForm(bc.id, { type: e.target.value as BarcodeUnitType })} className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 outline-none">
                                      {UNIT_TYPES.map((t) => <option key={t} value={t}>{UNIT_LABEL[t]}</option>)}
                                    </select>
                                    <input type="number" min={1} value={ef.unitQty} onChange={(e) => patchEditForm(bc.id, { unitQty: Number(e.target.value) })} onKeyDown={(e) => { if (e.key === 'Enter') editMutation.mutate({ productId: p.id, barcodeId: bc.id, form: ef }) }} className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none w-14 text-right" />
                                    <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer"><input type="checkbox" checked={ef.isPrimary} onChange={(e) => patchEditForm(bc.id, { isPrimary: e.target.checked })} className="rounded" />기본</label>
                                    <button onClick={() => editMutation.mutate({ productId: p.id, barcodeId: bc.id, form: ef })} disabled={editMutation.isPending} className="p-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"><Check size={12} /></button>
                                    <button onClick={() => setEditForms((prev) => { const n = { ...prev }; delete n[bc.id]; return n })} className="p-1 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-700"><X size={12} /></button>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                          {addForm ? (
                            <div className="flex items-center gap-2 pt-1.5 flex-wrap">
                              <input placeholder="바코드 값" value={addForm.barcode} onChange={(e) => patchAddForm(p.id, { barcode: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter' && addForm.barcode.trim()) addMutation.mutate({ productId: p.id, form: addForm }) }} className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:border-indigo-400 font-mono w-40" autoFocus />
                              <select value={addForm.type} onChange={(e) => patchAddForm(p.id, { type: e.target.value as BarcodeUnitType })} className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 outline-none">
                                {UNIT_TYPES.map((t) => <option key={t} value={t}>{UNIT_LABEL[t]}</option>)}
                              </select>
                              <input type="number" min={1} value={addForm.unitQty} onChange={(e) => patchAddForm(p.id, { unitQty: Number(e.target.value) })} className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 outline-none w-14 text-right" />
                              <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer"><input type="checkbox" checked={addForm.isPrimary} onChange={(e) => patchAddForm(p.id, { isPrimary: e.target.checked })} className="rounded" />기본</label>
                              <button onClick={() => addMutation.mutate({ productId: p.id, form: addForm })} disabled={!addForm.barcode.trim() || addMutation.isPending} className="px-2.5 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors">저장</button>
                              <button onClick={() => setAddForms((prev) => { const n = { ...prev }; delete n[p.id]; return n })} className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors">취소</button>
                            </div>
                          ) : (
                            <button onClick={() => patchAddForm(p.id, defaultAddForm())} className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-600 mt-0.5 py-1">
                              <Plus size={12} />바코드 추가
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
