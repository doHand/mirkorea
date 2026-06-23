'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { warehouseApi } from '@/api/warehouse.api'
import { stockApi } from '@/api/stock.api'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { QUERY_KEYS } from '@/constants/query-keys'
import { ExportButton } from '@/components/ExportButton'
import { cn } from '@/utils/cn'
import { formatNumber } from '@/utils/format'
import * as ui from '@/styles/ui'
import type { Inventory, Zone, Location } from '@/types/api.types'

const ZONE_TYPE_LABEL: Record<string, string> = {
  STORAGE:  '보관',
  SHIPPING: '출고',
  RECEIVING:'입고',
  STAGING:  '스테이징',
  DAMAGED:  '불량',
}

export default function WarehousePage() {
  const qc        = useQueryClient()
  const warehouse = useWarehouseStore((s) => s.selectedWarehouse)
  const [selectedZone, setSelectedZone]           = useState<string>('')
  const [showZoneModal, setShowZoneModal]         = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [strategyLocation, setStrategyLocation] = useState<Location | null>(null)
  const [moveInventory, setMoveInventory] = useState<Inventory | null>(null)
  const [moveForm, setMoveForm] = useState({ toLocationId: '', quantity: 1, reason: '선반 위치 이동' })
  const [zoneForm, setZoneForm] = useState({ code: '', name: '', type: 'STORAGE' })
  const [locForm,  setLocForm]  = useState({ zoneId: '', code: '', aisle: '', rack: '', shelf: '', bin: '' })

  const { data: zones = [] } = useQuery({
    queryKey: QUERY_KEYS.zones(warehouse?.id ?? ''),
    queryFn:  () => warehouseApi.findZones(warehouse!.id),
    enabled:  !!warehouse?.id,
  })

  const { data: locations = [] } = useQuery({
    queryKey: QUERY_KEYS.locations(warehouse?.id ?? '', selectedZone || undefined),
    queryFn:  () => warehouseApi.findLocations(warehouse!.id, selectedZone || undefined),
    enabled:  !!warehouse?.id,
  })
  const { data: inventory = [] } = useQuery({
    queryKey: QUERY_KEYS.inventory({ warehouseId: warehouse?.id }),
    queryFn: () => stockApi.getInventory(warehouse!.id),
    enabled: !!warehouse?.id,
  })

  const createZoneMutation = useMutation({
    mutationFn: () => warehouseApi.createZone(warehouse!.id, zoneForm),
    onSuccess: () => {
      toast.success('구역이 등록되었습니다')
      qc.invalidateQueries({ queryKey: ['zones'] })
      setShowZoneModal(false)
      setZoneForm({ code: '', name: '', type: 'STORAGE' })
    },
    onError: () => toast.error('등록 실패'),
  })

  const deleteZoneMutation = useMutation({
    mutationFn: (zoneId: string) => warehouseApi.deleteZone(warehouse!.id, zoneId),
    onSuccess: () => {
      toast.success('구역이 삭제되었습니다')
      qc.invalidateQueries({ queryKey: ['zones'] })
      setSelectedZone('')
    },
    onError: () => toast.error('삭제 실패'),
  })

  const createLocationMutation = useMutation({
    mutationFn: () => warehouseApi.createLocation(warehouse!.id, {
      ...locForm,
      zoneId: locForm.zoneId || selectedZone,
    }),
    onSuccess: () => {
      toast.success('위치가 등록되었습니다')
      qc.invalidateQueries({ queryKey: ['locations'] })
      setShowLocationModal(false)
      setLocForm({ zoneId: '', code: '', aisle: '', rack: '', shelf: '', bin: '' })
    },
    onError: () => toast.error('등록 실패 (코드 중복 또는 오류)'),
  })

  const updateStrategyMutation = useMutation({
    mutationFn: () => warehouseApi.updateLocation(strategyLocation!.id, {
      capacityUnit: strategyLocation!.capacityUnit,
      putawayPriority: strategyLocation!.putawayPriority,
      pickPriority: strategyLocation!.pickPriority,
      allowMixedProducts: strategyLocation!.allowMixedProducts,
    }),
    onSuccess: () => {
      toast.success('적치 전략이 저장되었습니다')
      qc.invalidateQueries({ queryKey: ['locations'] })
      setStrategyLocation(null)
    },
    onError: () => toast.error('적치 전략 저장에 실패했습니다'),
  })

  const moveMutation = useMutation({
    mutationFn: () => stockApi.move({
      productId: moveInventory!.productId,
      fromLocationId: moveInventory!.locationId,
      toLocationId: moveForm.toLocationId,
      warehouseId: warehouse!.id,
      quantity: moveForm.quantity,
      reason: moveForm.reason,
      lotNumber: moveInventory!.lotNumber,
    }),
    onSuccess: () => {
      toast.success('재고 위치를 이동했습니다')
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      setMoveInventory(null)
    },
    onError: () => toast.error('위치 이동에 실패했습니다'),
  })

  const occupancyByLocation = new Map<string, number>()
  const productsByLocation = new Map<string, Set<string>>()
  ;(inventory as Inventory[]).forEach((item) => {
    occupancyByLocation.set(item.locationId, (occupancyByLocation.get(item.locationId) ?? 0) + item.quantity)
    const products = productsByLocation.get(item.locationId) ?? new Set<string>()
    products.add(item.productId)
    productsByLocation.set(item.locationId, products)
  })
  const sortedLocations = [...(locations as Location[])].sort((a, b) =>
    (a.aisle ?? '').localeCompare(b.aisle ?? '', 'ko')
    || (a.rack ?? '').localeCompare(b.rack ?? '', 'ko')
    || (a.shelf ?? '').localeCompare(b.shelf ?? '', 'ko')
    || (a.bin ?? '').localeCompare(b.bin ?? '', 'ko')
    || a.code.localeCompare(b.code, 'ko')
  )
  const moveDestinations = moveInventory
    ? sortedLocations
      .filter((loc) => {
        if (loc.id === moveInventory.locationId) return false
        const products = productsByLocation.get(loc.id)
        const hasCapacity = (occupancyByLocation.get(loc.id) ?? 0) + moveForm.quantity <= loc.capacityUnit
        const allowsProduct = loc.allowMixedProducts || !products?.size || products.has(moveInventory.productId)
        return hasCapacity && allowsProduct
      })
      .sort((a, b) => {
        const aDefault = moveInventory.product?.locationId === a.id ? 0 : 1
        const bDefault = moveInventory.product?.locationId === b.id ? 0 : 1
        return aDefault - bDefault || a.putawayPriority - b.putawayPriority || a.code.localeCompare(b.code, 'ko')
      })
    : []

  const deleteLocationMutation = useMutation({
    mutationFn: (locationId: string) => warehouseApi.deleteLocation(locationId),
    onSuccess: () => {
      toast.success('위치가 삭제되었습니다')
      qc.invalidateQueries({ queryKey: ['locations'] })
    },
    onError: () => toast.error('삭제 실패'),
  })

  if (!warehouse) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
        창고를 먼저 선택하세요
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded bg-indigo-600 text-white shadow-sm shadow-indigo-500/20 sm:flex">
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">창고 위치 및 재고 관리</p>
              <h2 className="mt-1 truncate text-xl font-bold text-gray-950 dark:text-white">{warehouse.name}</h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-300">구역 및 위치를 등록하고 관리합니다.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton
              filename="위치목록"
              getData={() => (locations as Location[]).map((loc) => ({
                '위치코드': loc.code,
                '통로':     loc.aisle ?? '',
                '랙':       loc.rack  ?? '',
                '단':       loc.shelf ?? '',
                '칸':       loc.bin ?? '',
                '적치 우선순위': loc.putawayPriority,
                '피킹 우선순위': loc.pickPriority,
                '상태':     loc.isActive ? '사용중' : '비활성',
              }))}
            />
            <button
              onClick={() => setShowZoneModal(true)}
              title="구역 추가"
              aria-label="구역 추가"
              className={cn(ui.btnSecondary, 'responsive-icon-action px-0 sm:px-3')}
            >
              <span className="responsive-action-label">구역 추가</span>
            </button>
            <button
              onClick={() => {
                setLocForm({ zoneId: selectedZone, code: '', aisle: '', rack: '', shelf: '', bin: '' })
                setShowLocationModal(true)
              }}
              title="위치 추가"
              aria-label="위치 추가"
              className={cn(ui.btnPrimary, 'responsive-icon-action px-0 sm:px-3')}
            >
              <span className="responsive-action-label">위치 추가</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* 구역 패널 */}
        <div className="rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-950 dark:text-white">
              구역
            </h3>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-gray-500 dark:bg-slate-800 dark:text-slate-200">
              {formatNumber((zones as Zone[]).length)}
            </span>
          </div>
          <div className="space-y-0.5">
            <button
              onClick={() => setSelectedZone('')}
              className={cn(
                'w-full px-3 py-2 rounded text-sm transition-colors text-left',
                !selectedZone
                  ? 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-100 font-semibold'
                  : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200',
              )}
            >
              전체 ({formatNumber((locations as Location[]).length)})
            </button>
            {(zones as Zone[]).map((z) => (
              <div
                key={z.id}
                className={cn(
                  'flex items-center rounded transition-colors group/zone',
                  selectedZone === z.id
                    ? 'bg-indigo-100 dark:bg-indigo-950/70'
                    : 'hover:bg-gray-50 dark:hover:bg-slate-800',
                )}
              >
                <button
                  onClick={() => setSelectedZone(z.id)}
                  className={cn(
                    'flex-1 text-left px-3 py-2 text-sm',
                    selectedZone === z.id
                      ? 'text-indigo-700 dark:text-indigo-100 font-semibold'
                      : 'text-gray-700 dark:text-slate-200',
                  )}
                >
                  <span className="font-mono font-semibold">{z.code}</span>
                  <span className="ml-1.5 text-gray-500 dark:text-slate-300 font-normal text-xs">{z.name}</span>
                  <span className="ml-1 text-[10px] text-gray-400 dark:text-slate-400">
                    {ZONE_TYPE_LABEL[z.type] ?? z.type}
                  </span>
                </button>
                <button
                  onClick={() => { if (confirm(`"${z.name}" 구역을 삭제할까요?`)) deleteZoneMutation.mutate(z.id) }}
                  className="p-1.5 text-gray-400 hover:text-rose-500 sm:opacity-0 sm:group-hover/zone:opacity-100 transition-all mr-1 shrink-0"
                  title="구역 삭제"
                >
                  삭제
                </button>
              </div>
            ))}
            {zones.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-slate-500 px-3 py-2">구역이 없습니다</p>
            )}
          </div>
        </div>

        {/* 위치 목록 */}
        <div className="rounded border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 xl:col-span-2">
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 p-4 dark:border-slate-700">
            <h3 className="text-sm font-bold text-gray-950 dark:text-white">
              선반 위치 ({formatNumber((locations as Location[]).length)})
            </h3>
            <span className="text-xs text-gray-400 dark:text-slate-400">{selectedZone ? '선택 구역' : '전체 구역'}</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-slate-800 max-h-[calc(100vh-330px)] min-h-56 overflow-y-auto">
            {sortedLocations.map((loc) => {
              const locationInventory = (inventory as Inventory[]).filter((item) => item.locationId === loc.id && item.availableQty > 0)
              const occupancy = occupancyByLocation.get(loc.id) ?? 0
              const utilization = loc.capacityUnit > 0 ? Math.min(100, Math.round((occupancy / loc.capacityUnit) * 100)) : 0
              return <div key={loc.id} className="p-3 hover:bg-gray-50/60 dark:hover:bg-slate-800/60 group/loc">
                <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono font-semibold text-gray-950 dark:text-white break-all">{loc.code}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-300">
                    {[loc.aisle && `통로:${loc.aisle}`, loc.rack && `랙:${loc.rack}`, loc.shelf && `단:${loc.shelf}`, loc.bin && `칸:${loc.bin}`]
                      .filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <div className="w-32 shrink-0">
                  <div className="mb-1 flex justify-between text-[10px] text-gray-400"><span>적재 {formatNumber(occupancy)}</span><span>{utilization}%</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${utilization}%` }} />
                  </div>
                </div>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">적치 {loc.putawayPriority}</span>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full shrink-0',
                  loc.isActive
                    ? 'bg-green-100 dark:bg-green-950/70 text-green-700 dark:text-green-100'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-300',
                )}>
                  {loc.isActive ? '사용중' : '비활성'}
                </span>
                <button onClick={() => setStrategyLocation({ ...loc })}
                  className="p-1.5 text-gray-400 hover:text-indigo-600" title="적치 전략 설정">
                  설정
                </button>
                <button
                  onClick={() => { if (confirm(`"${loc.code}" 위치를 삭제할까요?`)) deleteLocationMutation.mutate(loc.id) }}
                  className="p-1.5 text-gray-400 hover:text-rose-500 sm:opacity-0 sm:group-hover/loc:opacity-100 transition-all shrink-0"
                  title="위치 삭제"
                >
                  삭제
                </button>
                </div>
                {locationInventory.length > 0 && <div className="mt-2 ml-7 grid gap-1 sm:grid-cols-2">
                  {locationInventory.map((item) => <div key={item.id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs dark:bg-slate-800">
                    <span className="min-w-0 flex-1 truncate">{item.product?.name ?? item.productId}</span>
                    <b>{formatNumber(item.availableQty)}</b>
                    <button onClick={() => {
                      setMoveInventory(item)
                      setMoveForm({ toLocationId: '', quantity: Math.max(1, item.availableQty), reason: '선반 위치 이동' })
                    }} className="rounded-md border border-indigo-200 p-1 text-indigo-600 hover:bg-indigo-50" title="위치 이동">
                      이동
                    </button>
                  </div>)}
                </div>}
              </div>
            })}
            {(locations as Location[]).length === 0 && (
              <p className="text-center py-10 text-sm text-gray-400 dark:text-slate-500">위치가 없습니다</p>
            )}
          </div>
        </div>
      </div>

      {/* 구역 추가 모달 */}
      {showZoneModal && (
        <div className={ui.modalOverlay}>
          <div className={ui.modalBox}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">구역 추가</h3>
              <button onClick={() => setShowZoneModal(false)} className={ui.btnIcon}>닫기</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={ui.label}>구역 코드 *</label>
                <input
                  autoFocus
                  value={zoneForm.code}
                  onChange={(e) => setZoneForm((p) => ({ ...p, code: e.target.value }))}
                  placeholder="A, B, COLD 등"
                  className={ui.formInput}
                />
              </div>
              <div>
                <label className={ui.label}>구역명 *</label>
                <input
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="일반 보관 구역"
                  className={ui.formInput}
                />
              </div>
              <div>
                <label className={ui.label}>구역 유형</label>
                <select
                  value={zoneForm.type}
                  onChange={(e) => setZoneForm((p) => ({ ...p, type: e.target.value }))}
                  className={cn(ui.selectCls, 'w-full')}
                >
                  {Object.entries(ZONE_TYPE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowZoneModal(false)} className={cn(ui.btnSecondary, 'flex-1')}>취소</button>
              <button
                onClick={() => createZoneMutation.mutate()}
                disabled={!zoneForm.code.trim() || !zoneForm.name.trim() || createZoneMutation.isPending}
                className={cn(ui.btnPrimary, 'flex-1 disabled:opacity-50')}
              >
                {createZoneMutation.isPending ? '등록 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 위치 추가 모달 */}
      {showLocationModal && (
        <div className={ui.modalOverlay}>
          <div className={ui.modalBoxMd}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">위치 추가</h3>
              <button onClick={() => setShowLocationModal(false)} className={ui.btnIcon}>닫기</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={ui.label}>구역 *</label>
                <select
                  value={locForm.zoneId}
                  onChange={(e) => setLocForm((p) => ({ ...p, zoneId: e.target.value }))}
                  className={cn(ui.selectCls, 'w-full')}
                >
                  <option value="">구역 선택</option>
                  {(zones as Zone[]).map((z) => (
                    <option key={z.id} value={z.id}>{z.code} — {z.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={ui.label}>위치코드 *</label>
                <input
                  value={locForm.code}
                  onChange={(e) => setLocForm((p) => ({ ...p, code: e.target.value }))}
                  placeholder="A-01-01-01"
                  className={cn(ui.formInput, 'font-mono')}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(['aisle', 'rack', 'shelf', 'bin'] as const).map((key) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {key === 'aisle' ? '통로' : key === 'rack' ? '랙' : key === 'shelf' ? '단' : '칸'}
                    </label>
                    <input
                      value={locForm[key]}
                      onChange={(e) => setLocForm((p) => ({ ...p, [key]: e.target.value }))}
                      className={ui.formInput}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowLocationModal(false)} className={cn(ui.btnSecondary, 'flex-1')}>취소</button>
              <button
                onClick={() => createLocationMutation.mutate()}
                disabled={!(locForm.zoneId || selectedZone) || !locForm.code.trim() || createLocationMutation.isPending}
                className={cn(ui.btnPrimary, 'flex-1 disabled:opacity-50')}
              >
                {createLocationMutation.isPending ? '등록 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {strategyLocation && (
        <div className={ui.modalOverlay}>
          <div className={ui.modalBox}>
            <div className="mb-4 flex items-center justify-between">
              <div><h3 className="font-bold">적치 전략 설정</h3><p className="text-xs text-gray-400">{strategyLocation.code}</p></div>
              <button onClick={() => setStrategyLocation(null)} className={ui.btnIcon}>닫기</button>
            </div>
            <div className="space-y-3">
              <div><label className={ui.label}>최대 적재 수량</label><input type="number" min={1} value={strategyLocation.capacityUnit}
                onChange={(e) => setStrategyLocation((prev) => prev ? { ...prev, capacityUnit: Math.max(1, Number(e.target.value) || 1) } : prev)}
                className={ui.formInput} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={ui.label}>적치 우선순위</label><input type="number" min={0} value={strategyLocation.putawayPriority}
                  onChange={(e) => setStrategyLocation((prev) => prev ? { ...prev, putawayPriority: Math.max(0, Number(e.target.value) || 0) } : prev)}
                  className={ui.formInput} /><p className="mt-1 text-[10px] text-gray-400">낮을수록 먼저 추천</p></div>
                <div><label className={ui.label}>피킹 우선순위</label><input type="number" min={0} value={strategyLocation.pickPriority}
                  onChange={(e) => setStrategyLocation((prev) => prev ? { ...prev, pickPriority: Math.max(0, Number(e.target.value) || 0) } : prev)}
                  className={ui.formInput} /><p className="mt-1 text-[10px] text-gray-400">낮을수록 먼저 피킹</p></div>
              </div>
              <label className="flex items-center gap-2 rounded border p-3 text-sm dark:border-slate-700">
                <input type="checkbox" checked={strategyLocation.allowMixedProducts}
                  onChange={(e) => setStrategyLocation((prev) => prev ? { ...prev, allowMixedProducts: e.target.checked } : prev)} />
                서로 다른 상품 혼적 허용
              </label>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setStrategyLocation(null)} className={cn(ui.btnSecondary, 'flex-1')}>취소</button>
              <button onClick={() => updateStrategyMutation.mutate()} disabled={updateStrategyMutation.isPending}
                className={cn(ui.btnPrimary, 'flex-1 disabled:opacity-50')}>저장</button>
            </div>
          </div>
        </div>
      )}

      {moveInventory && (
        <div className={ui.modalOverlay}>
          <div className={ui.modalBoxMd}>
            <div className="mb-4 flex items-center justify-between">
              <div><h3 className="font-bold">재고 위치 이동</h3><p className="text-xs text-gray-400">{moveInventory.product?.name}</p></div>
              <button onClick={() => setMoveInventory(null)} className={ui.btnIcon}>닫기</button>
            </div>
            <div className="space-y-3">
              <div className="rounded bg-gray-50 p-3 text-sm dark:bg-slate-800">
                현재 위치 <b className="font-mono">{moveInventory.location?.code ?? sortedLocations.find((loc) => loc.id === moveInventory.locationId)?.code}</b>
                <span className="float-right">이동 가능 <b>{formatNumber(moveInventory.availableQty)}</b></span>
              </div>
              <div><label className={ui.label}>이동 수량</label><input type="number" min={1} max={moveInventory.availableQty} value={moveForm.quantity}
                onChange={(e) => setMoveForm((prev) => ({ ...prev, quantity: Math.min(moveInventory.availableQty, Math.max(1, Number(e.target.value) || 1)) }))}
                className={ui.formInput} /></div>
              <div><label className={ui.label}>이동할 위치</label><select value={moveForm.toLocationId}
                onChange={(e) => setMoveForm((prev) => ({ ...prev, toLocationId: e.target.value }))} className={cn(ui.selectCls, 'w-full')}>
                <option value="">위치 선택</option>
                {moveDestinations.map((loc, index) => <option key={loc.id} value={loc.id}>
                  {index === 0 ? '[추천] ' : ''}{loc.code} · 적치순위 {loc.putawayPriority} · 여유 {formatNumber(loc.capacityUnit - (occupancyByLocation.get(loc.id) ?? 0))}
                </option>)}
              </select></div>
              <div><label className={ui.label}>이동 사유</label><input value={moveForm.reason}
                onChange={(e) => setMoveForm((prev) => ({ ...prev, reason: e.target.value }))} className={ui.formInput} /></div>
              {!moveDestinations.length && <p className="text-sm text-rose-500">용량과 혼적 전략을 만족하는 이동 가능 위치가 없습니다.</p>}
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setMoveInventory(null)} className={cn(ui.btnSecondary, 'flex-1')}>취소</button>
              <button onClick={() => moveMutation.mutate()} disabled={!moveForm.toLocationId || moveMutation.isPending}
                className={cn(ui.btnPrimary, 'flex-1 disabled:opacity-50')}>위치 이동</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
