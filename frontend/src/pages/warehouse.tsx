'use client'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileDown, Menu } from 'lucide-react'
import toast from 'react-hot-toast'
import { warehouseApi } from '@/api/warehouse.api'
import { stockApi } from '@/api/stock.api'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { QUERY_KEYS } from '@/constants/query-keys'
import { cn } from '@/utils/cn'
import { datedExcelFilename, writeRowsToExcel } from '@/utils/excel'
import { formatNumber } from '@/utils/format'
import { getApiErrorMessage } from '@/utils/error'
import * as ui from '@/styles/ui'
import type { Inventory, Zone, Location } from '@/types/api.types'

const ZONE_TYPE_LABEL: Record<string, string> = {
  STORAGE:   '보관',
  SHIPPING:  '출고',
  RECEIVING: '입고',
  STAGING:   '스테이징',
  DAMAGED:   '불량',
}
const ZONE_TYPE_COLOR: Record<string, string> = {
  STORAGE:   'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  SHIPPING:  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  RECEIVING: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  STAGING:   'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  DAMAGED:   'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
}

const IconX = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
)

function pad(n: number, len: number) {
  return String(n).padStart(len, '0')
}

const DEFAULT_BULK = {
  zoneId: '',
  aisle: '',
  rackFrom: 1, rackTo: 5, rackPad: 2,
  shelfFrom: 1, shelfTo: 5, shelfPad: 2,
  useBin: false, binFrom: 1, binTo: 3, binPad: 2,
  sep: '-',
}

export default function WarehousePage() {
  const qc        = useQueryClient()
  const menuRef   = useRef<HTMLDivElement>(null)
  const warehouse = useWarehouseStore((s) => s.selectedWarehouse)
  const [selectedZone, setSelectedZone] = useState('')
  const [selectedLoc, setSelectedLoc]   = useState<Location | null>(null)
  const [locationSearch, setLocationSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [showZoneModal, setShowZoneModal]   = useState(false)
  const [showLocModal, setShowLocModal]     = useState(false)
  const [showBulkModal, setShowBulkModal]   = useState(false)
  const [strategyLoc, setStrategyLoc]       = useState<Location | null>(null)
  const [moveInventory, setMoveInventory]   = useState<Inventory | null>(null)
  const [moveLocationSearch, setMoveLocationSearch] = useState('')
  const [moveForm, setMoveForm] = useState({ toLocationId: '', quantity: 1, reason: '선반 위치 이동' })
  const [deleteConfirm, setDeleteConfirm]   = useState<{ type: 'zone' | 'location'; id: string; name: string } | null>(null)
  const [zoneForm, setZoneForm] = useState({ code: '', name: '', type: 'STORAGE' })
  const [locForm, setLocForm]   = useState({ zoneId: '', code: '', aisle: '', rack: '', shelf: '', bin: '' })
  const [bulkForm, setBulkForm] = useState(DEFAULT_BULK)
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null)
  useEscapeKey(() => setMenuOpen(false), menuOpen)
  useEscapeKey(() => setShowZoneModal(false), showZoneModal)
  useEscapeKey(() => setShowLocModal(false), showLocModal)
  useEscapeKey(() => setShowBulkModal(false), showBulkModal && !bulkProgress)
  useEscapeKey(() => setMoveInventory(null), !!moveInventory)
  useEscapeKey(() => setDeleteConfirm(null), !!deleteConfirm)

  const { data: zones = [] } = useQuery({
    queryKey: QUERY_KEYS.zones(warehouse?.id ?? ''),
    queryFn:  () => warehouseApi.findZones(warehouse!.id),
    enabled:  !!warehouse?.id,
  })
  // All locations for zone counts
  const { data: allLocations = [] } = useQuery({
    queryKey: QUERY_KEYS.locations(warehouse?.id ?? ''),
    queryFn:  () => warehouseApi.findLocations(warehouse!.id),
    enabled:  !!warehouse?.id,
    staleTime: 30_000,
  })
  // Filtered locations for display
  const { data: locations = [] } = useQuery({
    queryKey: QUERY_KEYS.locations(warehouse?.id ?? '', selectedZone || undefined),
    queryFn:  () => warehouseApi.findLocations(warehouse!.id, selectedZone || undefined),
    enabled:  !!warehouse?.id,
  })
  const { data: inventory = [] } = useQuery({
    queryKey: QUERY_KEYS.inventory({ warehouseId: warehouse?.id }),
    queryFn:  () => stockApi.getInventory(warehouse!.id),
    enabled:  !!warehouse?.id,
  })

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleExportLocations = useCallback(async () => {
    setExporting(true)
    try {
      const rows = (allLocations as Location[]).map((loc) => ({
        '위치코드': loc.code,
        '통로': loc.aisle ?? '',
        '랙': loc.rack ?? '',
        '단': loc.shelf ?? '',
        '칸': loc.bin ?? '',
        '적치 우선순위': loc.putawayPriority,
        '피킹 우선순위': loc.pickPriority,
        '상태': loc.isActive ? '사용중' : '비활성',
      }))
      if (!rows.length) {
        toast.error('내보낼 데이터가 없습니다')
        return
      }
      await writeRowsToExcel(rows, datedExcelFilename('위치목록'))
    } catch {
      toast.error('내보내기 실패')
    } finally {
      setExporting(false)
    }
  }, [allLocations])

  // ── Mutations ──────────────────────────────────────────────────────────────

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
    mutationFn: (id: string) => warehouseApi.deleteZone(warehouse!.id, id),
    onSuccess: () => {
      toast.success('구역이 삭제되었습니다')
      qc.invalidateQueries({ queryKey: ['zones'] })
      qc.invalidateQueries({ queryKey: ['locations'] })
      if (selectedZone === deleteConfirm?.id) setSelectedZone('')
      setDeleteConfirm(null)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, '삭제 실패')),
  })

  const createLocMutation = useMutation({
    mutationFn: () => warehouseApi.createLocation(warehouse!.id, {
      ...locForm,
      zoneId: locForm.zoneId || selectedZone,
    }),
    onSuccess: () => {
      toast.success('위치가 등록되었습니다')
      qc.invalidateQueries({ queryKey: ['locations'] })
      setShowLocModal(false)
      setLocForm({ zoneId: '', code: '', aisle: '', rack: '', shelf: '', bin: '' })
    },
    onError: () => toast.error('등록 실패 (코드 중복 또는 오류)'),
  })

  const deleteLocMutation = useMutation({
    mutationFn: (id: string) => warehouseApi.deleteLocation(id),
    onSuccess: () => {
      toast.success('위치가 삭제되었습니다')
      qc.invalidateQueries({ queryKey: ['locations'] })
      setDeleteConfirm(null)
      setSelectedLoc(null)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, '삭제 실패')),
  })

  const updateStrategyMutation = useMutation({
    mutationFn: () => warehouseApi.updateLocation(strategyLoc!.id, {
      capacityUnit:       strategyLoc!.capacityUnit,
      putawayPriority:    strategyLoc!.putawayPriority,
      pickPriority:       strategyLoc!.pickPriority,
      allowMixedProducts: strategyLoc!.allowMixedProducts,
    }),
    onSuccess: () => {
      toast.success('적치 전략이 저장되었습니다')
      qc.invalidateQueries({ queryKey: ['locations'] })
      setStrategyLoc(null)
      setSelectedLoc(null)
    },
    onError: () => toast.error('저장 실패'),
  })

  const moveMutation = useMutation({
    mutationFn: () => stockApi.move({
      productId:      moveInventory!.productId,
      fromLocationId: moveInventory!.locationId,
      toLocationId:   moveForm.toLocationId,
      warehouseId:    warehouse!.id,
      quantity:       moveForm.quantity,
      reason:         moveForm.reason,
      lotNumber:      moveInventory!.lotNumber,
    }),
    onSuccess: () => {
      toast.success('재고 위치를 이동했습니다')
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      setMoveInventory(null)
      setMoveLocationSearch('')
    },
    onError: () => toast.error('위치 이동에 실패했습니다'),
  })

  // ── Computed ───────────────────────────────────────────────────────────────

  const occupancyByLocation = useMemo(() => {
    const m = new Map<string, number>()
    ;(inventory as Inventory[]).forEach((item) =>
      m.set(item.locationId, (m.get(item.locationId) ?? 0) + item.quantity),
    )
    return m
  }, [inventory])

  const productsByLocation = useMemo(() => {
    const m = new Map<string, Set<string>>()
    ;(inventory as Inventory[]).forEach((item) => {
      const s = m.get(item.locationId) ?? new Set<string>()
      s.add(item.productId)
      m.set(item.locationId, s)
    })
    return m
  }, [inventory])

  const locationCountByZone = useMemo(() => {
    const m = new Map<string, number>()
    ;(allLocations as Location[]).forEach((loc) =>
      m.set(loc.zoneId, (m.get(loc.zoneId) ?? 0) + 1),
    )
    return m
  }, [allLocations])

  const sortedLocations = useMemo(() =>
    [...(locations as Location[])].sort((a, b) =>
      (a.aisle ?? '').localeCompare(b.aisle ?? '', 'ko') ||
      (a.rack  ?? '').localeCompare(b.rack  ?? '', 'ko') ||
      (a.shelf ?? '').localeCompare(b.shelf ?? '', 'ko') ||
      (a.bin   ?? '').localeCompare(b.bin   ?? '', 'ko') ||
      a.code.localeCompare(b.code, 'ko'),
    ),
  [locations])

  const sortedAllLocations = useMemo(() =>
    [...(allLocations as Location[])].sort((a, b) =>
      (a.aisle ?? '').localeCompare(b.aisle ?? '', 'ko') ||
      (a.rack  ?? '').localeCompare(b.rack  ?? '', 'ko') ||
      (a.shelf ?? '').localeCompare(b.shelf ?? '', 'ko') ||
      (a.bin   ?? '').localeCompare(b.bin   ?? '', 'ko') ||
      a.code.localeCompare(b.code, 'ko'),
    ),
  [allLocations])

  const filteredLocations = useMemo(() => {
    if (!locationSearch.trim()) return sortedLocations
    const q = locationSearch.toLowerCase()
    return sortedLocations.filter((loc) =>
      loc.code.toLowerCase().includes(q) ||
      (loc.aisle ?? '').toLowerCase().includes(q) ||
      (loc.rack  ?? '').toLowerCase().includes(q) ||
      (loc.shelf ?? '').toLowerCase().includes(q) ||
      (loc.bin   ?? '').toLowerCase().includes(q),
    )
  }, [sortedLocations, locationSearch])

  const moveDestinations = useMemo(() => {
    if (!moveInventory) return []
    return sortedAllLocations
      .filter((loc) => {
        if (loc.id === moveInventory.locationId) return false
        const products    = productsByLocation.get(loc.id)
        const hasCapacity = (occupancyByLocation.get(loc.id) ?? 0) + moveForm.quantity <= loc.capacityUnit
        const allowsMix   = loc.allowMixedProducts || !products?.size || products.has(moveInventory.productId)
        return hasCapacity && allowsMix
      })
      .sort((a, b) => {
        const aDefault = moveInventory.product?.locationId === a.id ? 0 : 1
        const bDefault = moveInventory.product?.locationId === b.id ? 0 : 1
        return aDefault - bDefault || a.putawayPriority - b.putawayPriority || a.code.localeCompare(b.code, 'ko')
      })
  }, [moveInventory, sortedAllLocations, productsByLocation, occupancyByLocation, moveForm.quantity])

  const selectedLocInventoryQty = selectedLoc ? (occupancyByLocation.get(selectedLoc.id) ?? 0) : 0
  const selectedZoneLocationCount = selectedZone ? (locationCountByZone.get(selectedZone) ?? 0) : 0
  const filteredMoveDestinations = useMemo(() => {
    const q = moveLocationSearch.trim().toLowerCase()
    if (!q) return moveDestinations
    return moveDestinations.filter((loc) => {
      const zone = (zones as Zone[]).find((z) => z.id === loc.zoneId)
      return [
        loc.code,
        loc.aisle,
        loc.rack,
        loc.shelf,
        loc.bin,
        zone?.code,
        zone?.name,
      ].some((value) => value?.toLowerCase().includes(q))
    })
  }, [moveDestinations, moveLocationSearch, zones])
  const selectedMoveDestination = moveForm.toLocationId
    ? (allLocations as Location[]).find((loc) => loc.id === moveForm.toLocationId)
    : null

  // Bulk preview
  const bulkPreview = useMemo(() => {
    const rCount = Math.max(0, bulkForm.rackTo  - bulkForm.rackFrom  + 1)
    const sCount = Math.max(0, bulkForm.shelfTo - bulkForm.shelfFrom + 1)
    const bCount = bulkForm.useBin ? Math.max(0, bulkForm.binTo - bulkForm.binFrom + 1) : 1
    const total  = rCount * sCount * bCount
    if (total === 0 || !bulkForm.zoneId) return { total: 0, examples: [] as string[] }
    const examples: string[] = []
    outer: for (let r = bulkForm.rackFrom; r <= bulkForm.rackTo; r++) {
      for (let s = bulkForm.shelfFrom; s <= bulkForm.shelfTo; s++) {
        const rk = pad(r, bulkForm.rackPad)
        const sh = pad(s, bulkForm.shelfPad)
        if (bulkForm.useBin) {
          for (let b = bulkForm.binFrom; b <= bulkForm.binTo; b++) {
            const bn = pad(b, bulkForm.binPad)
            examples.push([bulkForm.aisle, rk, sh, bn].filter(Boolean).join(bulkForm.sep))
            if (examples.length >= 3) break outer
          }
        } else {
          examples.push([bulkForm.aisle, rk, sh].filter(Boolean).join(bulkForm.sep))
          if (examples.length >= 3) break outer
        }
      }
    }
    return { total, examples }
  }, [bulkForm])

  const handleBulkCreate = useCallback(async () => {
    const rows: Array<{ zoneId: string; code: string; aisle?: string; rack?: string; shelf?: string; bin?: string }> = []
    for (let r = bulkForm.rackFrom; r <= bulkForm.rackTo; r++) {
      for (let s = bulkForm.shelfFrom; s <= bulkForm.shelfTo; s++) {
        const rk = pad(r, bulkForm.rackPad)
        const sh = pad(s, bulkForm.shelfPad)
        if (bulkForm.useBin) {
          for (let b = bulkForm.binFrom; b <= bulkForm.binTo; b++) {
            const bn = pad(b, bulkForm.binPad)
            rows.push({
              zoneId: bulkForm.zoneId,
              code:   [bulkForm.aisle, rk, sh, bn].filter(Boolean).join(bulkForm.sep),
              aisle:  bulkForm.aisle || undefined, rack: rk, shelf: sh, bin: bn,
            })
          }
        } else {
          rows.push({
            zoneId: bulkForm.zoneId,
            code:   [bulkForm.aisle, rk, sh].filter(Boolean).join(bulkForm.sep),
            aisle:  bulkForm.aisle || undefined, rack: rk, shelf: sh,
          })
        }
      }
    }
    setBulkProgress({ done: 0, total: rows.length })
    let done = 0; let errors = 0
    for (const row of rows) {
      try { await warehouseApi.createLocation(warehouse!.id, row); done++ }
      catch { errors++ }
      setBulkProgress({ done, total: rows.length })
    }
    qc.invalidateQueries({ queryKey: ['locations'] })
    setBulkProgress(null)
    setShowBulkModal(false)
    setBulkForm(DEFAULT_BULK)
    if (errors === 0) toast.success(`위치 ${done}개가 생성되었습니다`)
    else toast.success(`${done}개 생성 완료 (${errors}개 실패 — 코드 중복 등)`)
  }, [bulkForm, warehouse, qc])

  // ── Empty state ────────────────────────────────────────────────────────────

  if (!warehouse) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800">
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400">창고를 먼저 선택하세요</p>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-500/20">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">창고 위치 관리</p>
              <h2 className="truncate text-lg font-bold text-gray-900 dark:text-white">{warehouse.name}</h2>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setShowZoneModal(true)} className={ui.btnSecondary}>
              구역 추가
            </button>
            <button
              onClick={() => { setBulkForm({ ...DEFAULT_BULK, zoneId: selectedZone }); setShowBulkModal(true) }}
              className={ui.btnSecondary}
            >
              일괄 생성
            </button>
            <button
              onClick={() => { setLocForm({ zoneId: selectedZone, code: '', aisle: '', rack: '', shelf: '', bin: '' }); setShowLocModal(true) }}
              className={ui.btnPrimary}
            >
              위치 추가
            </button>
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                title="추가 작업"
                aria-label="추가 작업"
                aria-expanded={menuOpen}
                className="wms-toolbar-action inline-flex h-8 w-8 items-center justify-center rounded transition-colors"
              >
                <Menu size={17} strokeWidth={2.2} />
              </button>
              {menuOpen && (
                <div className="product-grid-overflow absolute right-0 top-9 z-50 flex min-w-[156px] flex-col gap-1 rounded border border-gray-200 bg-white p-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      void handleExportLocations()
                    }}
                    disabled={exporting}
                    className="wms-toolbar-action inline-flex h-8 items-center gap-2 rounded px-2 text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    <FileDown size={13} />
                    {exporting ? '준비 중...' : '엑셀 내보내기'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">

        {/* Zone panel */}
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">구역</h3>
            <div className="flex items-center gap-1">
              {selectedZone && (
                <button
                  onClick={() => {
                    if (selectedZoneLocationCount > 0) {
                      toast.error('위치가 등록된 구역은 삭제할 수 없습니다')
                      return
                    }
                    const z = (zones as Zone[]).find((z) => z.id === selectedZone)
                    if (z) setDeleteConfirm({ type: 'zone', id: z.id, name: z.name })
                  }}
                  className={cn(
                    'inline-flex h-8 items-center justify-center rounded-md border px-2.5 text-xs font-semibold transition-colors',
                    selectedZoneLocationCount > 0
                      ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-300 opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-600'
                      : 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50',
                  )}
                  title={selectedZoneLocationCount > 0 ? '위치가 없는 구역만 삭제할 수 있습니다' : '선택된 구역 삭제'}
                >
                  삭제
                </button>
              )}
              <span className="rounded-full bg-gray-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-gray-500 dark:text-slate-300 tabular-nums">
                {(zones as Zone[]).length}
              </span>
            </div>
          </div>
          <div className="space-y-0.5">
            <button
              onClick={() => { setSelectedZone(''); setSelectedLoc(null) }}
              className={cn(
                'w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
                !selectedZone
                  ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                  : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800',
              )}
            >
              전체
              <span className="ml-1.5 text-xs font-normal text-gray-400 dark:text-slate-500 tabular-nums">({(allLocations as Location[]).length})</span>
            </button>
            {(zones as Zone[]).map((z) => (
              <button
                key={z.id}
                onClick={() => { setSelectedZone(z.id); setSelectedLoc(null) }}
                className={cn(
                  'w-full rounded-md px-3 py-2 text-left text-sm transition-colors',
                  selectedZone === z.id
                    ? 'bg-indigo-50 dark:bg-indigo-950/50'
                    : 'hover:bg-gray-50 dark:hover:bg-slate-800',
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={cn('font-mono font-semibold', selectedZone === z.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-white')}>{z.code}</span>
                  <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium shrink-0', ZONE_TYPE_COLOR[z.type] ?? 'bg-gray-100 text-gray-600')}>
                    {ZONE_TYPE_LABEL[z.type] ?? z.type}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between">
                  <span className={cn('text-xs', selectedZone === z.id ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-500 dark:text-slate-400')}>{z.name}</span>
                  <span className="text-[10px] text-gray-400 dark:text-slate-500 tabular-nums">{locationCountByZone.get(z.id) ?? 0}곳</span>
                </div>
              </button>
            ))}
            {(zones as Zone[]).length === 0 && (
              <p className="py-6 text-center text-xs text-gray-400 dark:text-slate-600">구역이 없습니다</p>
            )}
          </div>
        </div>

        {/* Location list */}
        <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm xl:col-span-3">

          {/* Search bar */}
          <div className="border-b border-gray-100 dark:border-slate-700 p-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input
                  value={locationSearch}
                  onChange={(e) => setLocationSearch(e.target.value)}
                  placeholder="위치코드, 통로, 랙 검색..."
                  className="w-full rounded-md border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white placeholder:text-gray-400"
                />
                {locationSearch && (
                  <button
                    onClick={() => setLocationSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
                  >
                    <IconX />
                  </button>
                )}
              </div>
              {selectedLoc && (
                <>
                  <button
                    onClick={() => setStrategyLoc({ ...selectedLoc })}
                    className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 px-2.5 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
                    title="적치 전략 설정"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => {
                      if (selectedLocInventoryQty > 0) {
                        toast.error('재고가 있는 위치는 삭제할 수 없습니다')
                        return
                      }
                      setDeleteConfirm({ type: 'location', id: selectedLoc.id, name: selectedLoc.code })
                    }}
                    className={cn(
                      'inline-flex h-8 shrink-0 items-center justify-center rounded-md border px-2.5 text-xs font-semibold transition-colors',
                      selectedLocInventoryQty > 0
                        ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-300 opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-600'
                        : 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50',
                    )}
                    title={selectedLocInventoryQty > 0 ? '재고가 있는 위치는 삭제할 수 없습니다' : '위치 삭제'}
                  >
                    삭제
                  </button>
                </>
              )}
              <span className="shrink-0 text-xs text-gray-400 dark:text-slate-500 tabular-nums whitespace-nowrap">
                {filteredLocations.length} / {(locations as Location[]).length}
              </span>
            </div>
          </div>

          {/* Location rows */}
          <div className="divide-y divide-gray-100 dark:divide-slate-800 max-h-[calc(100vh-340px)] min-h-56 overflow-y-auto">
            {filteredLocations.map((loc) => {
              const locationInventory = (inventory as Inventory[]).filter((item) => item.locationId === loc.id && item.availableQty > 0)
              const occupancy   = occupancyByLocation.get(loc.id) ?? 0
              const utilization = loc.capacityUnit > 0 ? Math.min(100, Math.round((occupancy / loc.capacityUnit) * 100)) : 0
              const barColor    = utilization >= 90 ? 'bg-rose-500' : utilization >= 70 ? 'bg-amber-500' : 'bg-indigo-500'
              const zone        = (zones as Zone[]).find((z) => z.id === loc.zoneId)

              return (
                <div
                  key={loc.id}
                  onClick={() => setSelectedLoc((prev) => prev?.id === loc.id ? null : loc)}
                  className={cn(
                    'cursor-pointer px-4 py-3 transition-colors',
                    selectedLoc?.id === loc.id
                      ? 'bg-indigo-50 dark:bg-indigo-950/30'
                      : 'hover:bg-gray-50/70 dark:hover:bg-slate-800/40',
                    !loc.isActive && 'opacity-60',
                  )}
                >
                  <div className="flex flex-wrap items-start gap-x-3 gap-y-2">

                    {/* Code + zone + status */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">{loc.code}</span>
                        {zone && !selectedZone && (
                          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', ZONE_TYPE_COLOR[zone.type] ?? 'bg-gray-100 text-gray-600')}>
                            {zone.code}
                          </span>
                        )}
                        <span className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-medium',
                          loc.isActive
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400',
                        )}>
                          {loc.isActive ? '사용중' : '비활성'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-400 dark:text-slate-500">
                        {[loc.aisle && `통로 ${loc.aisle}`, loc.rack && `랙 ${loc.rack}`, loc.shelf && `단 ${loc.shelf}`, loc.bin && `칸 ${loc.bin}`]
                          .filter(Boolean).join(' · ') || '위치 구분 없음'}
                      </p>
                    </div>

                    {/* Occupancy bar */}
                    <div className="w-28 shrink-0 pt-0.5">
                      <div className="mb-1 flex items-center justify-between text-[10px] text-gray-400">
                        <span className="tabular-nums">{formatNumber(occupancy)}/{formatNumber(loc.capacityUnit)}</span>
                        <span className={cn('font-semibold tabular-nums', utilization >= 90 ? 'text-rose-500' : utilization >= 70 ? 'text-amber-500' : '')}>{utilization}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
                        <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${utilization}%` }} />
                      </div>
                    </div>

                    {/* Priority badges */}
                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      <span className="rounded bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-300 tabular-nums">
                        적치 {loc.putawayPriority}
                      </span>
                      <span className="rounded bg-orange-50 dark:bg-orange-950/40 px-1.5 py-0.5 text-[10px] font-medium text-orange-600 dark:text-orange-300 tabular-nums">
                        피킹 {loc.pickPriority}
                      </span>
                    </div>
                  </div>

                  {/* Inventory sub-rows */}
                  {locationInventory.length > 0 && (
                    <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3" onClick={(e) => e.stopPropagation()}>
                      {locationInventory.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-slate-800/70 px-2.5 py-1.5">
                          <span className="min-w-0 flex-1 truncate text-xs text-gray-700 dark:text-slate-300">{item.product?.name ?? item.productId}</span>
                          <span className="tabular-nums text-xs font-semibold text-gray-900 dark:text-white">{formatNumber(item.availableQty)}</span>
                          <button
                            onClick={() => {
                              setMoveInventory(item)
                              setMoveForm({ toLocationId: '', quantity: Math.max(1, item.availableQty), reason: '선반 위치 이동' })
                              setMoveLocationSearch('')
                            }}
                            className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-indigo-200 bg-white px-2.5 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
                            title="위치 이동"
                          >
                            이동
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {filteredLocations.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <svg className="mb-3 h-9 w-9 text-gray-200 dark:text-slate-700" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
                </svg>
                <p className="text-sm text-gray-400 dark:text-slate-500">
                  {locationSearch ? '검색 결과가 없습니다' : '위치가 없습니다'}
                </p>
                {!locationSearch && (
                  <button
                    onClick={() => { setBulkForm({ ...DEFAULT_BULK, zoneId: selectedZone }); setShowBulkModal(true) }}
                    className="mt-3 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    일괄 생성으로 위치 추가 →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 구역 추가 모달 ────────────────────────────────────── */}
      {showZoneModal && (
        <div className={ui.modalOverlay}>
          <div className={ui.modalBox}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">구역 추가</h3>
              <button onClick={() => setShowZoneModal(false)} className={ui.btnIcon}><IconX /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={ui.label}>구역 코드 *</label>
                <input
                  autoFocus
                  value={zoneForm.code}
                  onChange={(e) => setZoneForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                  onKeyDown={(e) => { if (e.key === 'Enter' && zoneForm.code && zoneForm.name) createZoneMutation.mutate() }}
                  placeholder="A, B, COLD 등"
                  className={ui.formInput}
                />
              </div>
              <div>
                <label className={ui.label}>구역명 *</label>
                <input
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm((p) => ({ ...p, name: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter' && zoneForm.code && zoneForm.name) createZoneMutation.mutate() }}
                  placeholder="일반 보관 구역"
                  className={ui.formInput}
                />
              </div>
              <div>
                <label className={ui.label}>구역 유형</label>
                <select value={zoneForm.type} onChange={(e) => setZoneForm((p) => ({ ...p, type: e.target.value }))} className={cn(ui.selectCls, 'w-full')}>
                  {Object.entries(ZONE_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
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

      {/* ── 위치 추가 모달 ────────────────────────────────────── */}
      {showLocModal && (
        <div className={ui.modalOverlay}>
          <div className={ui.modalBoxMd}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">위치 추가</h3>
              <button onClick={() => setShowLocModal(false)} className={ui.btnIcon}><IconX /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={ui.label}>구역 *</label>
                <select autoFocus value={locForm.zoneId} onChange={(e) => setLocForm((p) => ({ ...p, zoneId: e.target.value }))} className={cn(ui.selectCls, 'w-full')}>
                  <option value="">구역 선택</option>
                  {(zones as Zone[]).map((z) => <option key={z.id} value={z.id}>{z.code} — {z.name}</option>)}
                </select>
              </div>
              <div>
                <label className={ui.label}>위치코드 *</label>
                <input value={locForm.code} onChange={(e) => setLocForm((p) => ({ ...p, code: e.target.value }))}
                  placeholder="A-01-01-01" className={cn(ui.formInput, 'font-mono')} />
              </div>
              <div>
                <label className={ui.label}>위치 구분 (선택)</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(['aisle', 'rack', 'shelf', 'bin'] as const).map((key) => (
                    <div key={key}>
                      <label className="mb-1 block text-[10px] font-medium text-gray-400 dark:text-slate-500">
                        {key === 'aisle' ? '통로' : key === 'rack' ? '랙' : key === 'shelf' ? '단' : '칸'}
                      </label>
                      <input value={locForm[key]} onChange={(e) => setLocForm((p) => ({ ...p, [key]: e.target.value }))} className={ui.formInput} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setShowLocModal(false)} className={cn(ui.btnSecondary, 'flex-1')}>취소</button>
              <button
                onClick={() => createLocMutation.mutate()}
                disabled={!(locForm.zoneId || selectedZone) || !locForm.code.trim() || createLocMutation.isPending}
                className={cn(ui.btnPrimary, 'flex-1 disabled:opacity-50')}
              >
                {createLocMutation.isPending ? '등록 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 일괄 위치 생성 모달 ──────────────────────────────── */}
      {showBulkModal && (
        <div className={ui.modalOverlay}>
          <div className="wms-modal-box w-full max-w-lg">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">위치 일괄 생성</h3>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">랙·단·칸 범위를 지정하면 자동으로 위치코드를 생성합니다.</p>
              </div>
              <button onClick={() => setShowBulkModal(false)} className={ui.btnIcon}><IconX /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={ui.label}>구역 *</label>
                  <select value={bulkForm.zoneId} onChange={(e) => setBulkForm((p) => ({ ...p, zoneId: e.target.value }))} className={cn(ui.selectCls, 'w-full')}>
                    <option value="">선택</option>
                    {(zones as Zone[]).map((z) => <option key={z.id} value={z.id}>{z.code} — {z.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={ui.label}>통로 (선택)</label>
                  <input value={bulkForm.aisle} onChange={(e) => setBulkForm((p) => ({ ...p, aisle: e.target.value.toUpperCase() }))}
                    placeholder="A" className={cn(ui.formInput, 'font-mono')} />
                </div>
              </div>

              <div>
                <label className={ui.label}>구분자</label>
                <div className="flex gap-2 flex-wrap">
                  {(['-', '/', '_', ''] as const).map((s) => (
                    <button key={s || 'none'} onClick={() => setBulkForm((p) => ({ ...p, sep: s }))}
                      className={cn('rounded border px-3 py-1.5 text-sm font-mono transition-colors', bulkForm.sep === s
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                        : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-600')}>
                      {s || '없음'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rack range */}
              <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">랙 범위</label>
                  <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
                    자릿수
                    <select value={bulkForm.rackPad} onChange={(e) => setBulkForm((p) => ({ ...p, rackPad: Number(e.target.value) }))}
                      className="ml-1 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-0.5 text-xs">
                      {[1, 2, 3].map((n) => <option key={n} value={n}>{n}자리</option>)}
                    </select>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" min={1} value={bulkForm.rackFrom} onChange={(e) => setBulkForm((p) => ({ ...p, rackFrom: Math.max(1, Number(e.target.value)) }))} className={cn(ui.formInput, 'text-center')} />
                  <span className="text-gray-400">~</span>
                  <input type="number" min={1} value={bulkForm.rackTo}   onChange={(e) => setBulkForm((p) => ({ ...p, rackTo:   Math.max(1, Number(e.target.value)) }))} className={cn(ui.formInput, 'text-center')} />
                </div>
              </div>

              {/* Shelf range */}
              <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">단 범위</label>
                  <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
                    자릿수
                    <select value={bulkForm.shelfPad} onChange={(e) => setBulkForm((p) => ({ ...p, shelfPad: Number(e.target.value) }))}
                      className="ml-1 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-0.5 text-xs">
                      {[1, 2, 3].map((n) => <option key={n} value={n}>{n}자리</option>)}
                    </select>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" min={1} value={bulkForm.shelfFrom} onChange={(e) => setBulkForm((p) => ({ ...p, shelfFrom: Math.max(1, Number(e.target.value)) }))} className={cn(ui.formInput, 'text-center')} />
                  <span className="text-gray-400">~</span>
                  <input type="number" min={1} value={bulkForm.shelfTo}   onChange={(e) => setBulkForm((p) => ({ ...p, shelfTo:   Math.max(1, Number(e.target.value)) }))} className={cn(ui.formInput, 'text-center')} />
                </div>
              </div>

              {/* Bin range */}
              <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                    <input type="checkbox" checked={bulkForm.useBin} onChange={(e) => setBulkForm((p) => ({ ...p, useBin: e.target.checked }))} />
                    칸 범위 사용
                  </label>
                  {bulkForm.useBin && (
                    <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
                      자릿수
                      <select value={bulkForm.binPad} onChange={(e) => setBulkForm((p) => ({ ...p, binPad: Number(e.target.value) }))}
                        className="ml-1 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-0.5 text-xs">
                        {[1, 2, 3].map((n) => <option key={n} value={n}>{n}자리</option>)}
                      </select>
                    </label>
                  )}
                </div>
                {bulkForm.useBin && (
                  <div className="flex items-center gap-2">
                    <input type="number" min={1} value={bulkForm.binFrom} onChange={(e) => setBulkForm((p) => ({ ...p, binFrom: Math.max(1, Number(e.target.value)) }))} className={cn(ui.formInput, 'text-center')} />
                    <span className="text-gray-400">~</span>
                    <input type="number" min={1} value={bulkForm.binTo}   onChange={(e) => setBulkForm((p) => ({ ...p, binTo:   Math.max(1, Number(e.target.value)) }))} className={cn(ui.formInput, 'text-center')} />
                  </div>
                )}
              </div>

              {/* Preview */}
              {bulkPreview.total > 0 && (
                <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/30 p-3">
                  <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                    {formatNumber(bulkPreview.total)}개 위치 생성 예정
                  </p>
                  <p className="mt-1 font-mono text-xs text-indigo-500 dark:text-indigo-400">
                    {bulkPreview.examples.join(', ')}{bulkPreview.total > 3 ? ` … 외 ${formatNumber(bulkPreview.total - 3)}개` : ''}
                  </p>
                </div>
              )}

              {/* Progress bar */}
              {bulkProgress && (
                <div className="rounded-lg bg-gray-50 dark:bg-slate-800 p-3">
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="text-gray-600 dark:text-slate-300 animate-pulse">생성 중...</span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">{bulkProgress.done}/{bulkProgress.total}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-slate-700">
                    <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${Math.round((bulkProgress.done / bulkProgress.total) * 100)}%` }} />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              <button onClick={() => setShowBulkModal(false)} className={cn(ui.btnSecondary, 'flex-1')} disabled={!!bulkProgress}>취소</button>
              <button
                onClick={handleBulkCreate}
                disabled={!bulkForm.zoneId || bulkPreview.total === 0 || !!bulkProgress}
                className={cn(ui.btnPrimary, 'flex-1 disabled:opacity-50')}
              >
                {bulkProgress
                  ? `생성 중... ${bulkProgress.done}/${bulkProgress.total}`
                  : `${formatNumber(bulkPreview.total)}개 생성`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 적치 전략 모달 ───────────────────────────────────── */}
      {strategyLoc && (
        <div className={ui.modalOverlay}>
          <div className={ui.modalBox}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">적치 전략 설정</h3>
                <p className="mt-0.5 font-mono text-xs text-gray-400 dark:text-slate-500">{strategyLoc.code}</p>
              </div>
              <button onClick={() => setStrategyLoc(null)} className={ui.btnIcon}><IconX /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={ui.label}>최대 적재 수량</label>
                <input type="number" min={1} value={strategyLoc.capacityUnit}
                  onChange={(e) => setStrategyLoc((p) => p ? { ...p, capacityUnit: Math.max(1, Number(e.target.value) || 1) } : p)}
                  className={ui.formInput} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={ui.label}>적치 우선순위</label>
                  <input type="number" min={0} value={strategyLoc.putawayPriority}
                    onChange={(e) => setStrategyLoc((p) => p ? { ...p, putawayPriority: Math.max(0, Number(e.target.value) || 0) } : p)}
                    className={ui.formInput} />
                  <p className="mt-1 text-[10px] text-gray-400 dark:text-slate-500">낮을수록 먼저 추천</p>
                </div>
                <div>
                  <label className={ui.label}>피킹 우선순위</label>
                  <input type="number" min={0} value={strategyLoc.pickPriority}
                    onChange={(e) => setStrategyLoc((p) => p ? { ...p, pickPriority: Math.max(0, Number(e.target.value) || 0) } : p)}
                    className={ui.formInput} />
                  <p className="mt-1 text-[10px] text-gray-400 dark:text-slate-500">낮을수록 먼저 피킹</p>
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 dark:border-slate-700 p-3 text-sm hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                <input type="checkbox" checked={strategyLoc.allowMixedProducts}
                  onChange={(e) => setStrategyLoc((p) => p ? { ...p, allowMixedProducts: e.target.checked } : p)} />
                <span className="text-gray-700 dark:text-slate-300">서로 다른 상품 혼적 허용</span>
              </label>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setStrategyLoc(null)} className={cn(ui.btnSecondary, 'flex-1')}>취소</button>
              <button onClick={() => updateStrategyMutation.mutate()} disabled={updateStrategyMutation.isPending}
                className={cn(ui.btnPrimary, 'flex-1 disabled:opacity-50')}>
                {updateStrategyMutation.isPending ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 재고 이동 모달 ───────────────────────────────────── */}
      {moveInventory && (
        <div className={ui.modalOverlay}>
          <div className={ui.modalBoxMd}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">재고 위치 이동</h3>
                <p className="mt-0.5 text-xs text-gray-400 dark:text-slate-500">{moveInventory.product?.name}</p>
              </div>
              <button onClick={() => setMoveInventory(null)} className={ui.btnIcon}><IconX /></button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-slate-800 p-3 text-sm">
                <div>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500">현재 위치</p>
                  <p className="font-mono font-semibold text-gray-900 dark:text-white">
                    {moveInventory.location?.code ?? sortedAllLocations.find((l) => l.id === moveInventory.locationId)?.code ?? '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 dark:text-slate-500">이동 가능 수량</p>
                  <p className="font-semibold text-gray-900 dark:text-white tabular-nums">{formatNumber(moveInventory.availableQty)}</p>
                </div>
              </div>
              <div>
                <label className={ui.label}>이동 수량</label>
                <input type="number" min={1} max={moveInventory.availableQty} value={moveForm.quantity}
                  onChange={(e) => setMoveForm((p) => ({ ...p, quantity: Math.min(moveInventory.availableQty, Math.max(1, Number(e.target.value) || 1)) }))}
                  className={ui.formInput} />
              </div>
              <div>
                <label className={ui.label}>이동할 위치</label>
                <div className="flex gap-2">
                  <input
                    value={moveLocationSearch}
                    onChange={(e) => setMoveLocationSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return
                      e.preventDefault()
                      const first = filteredMoveDestinations[0]
                      if (!first) {
                        toast.error('검색 결과가 없습니다')
                        return
                      }
                      setMoveForm((p) => ({ ...p, toLocationId: first.id }))
                      setMoveLocationSearch(first.code)
                    }}
                    placeholder="위치코드, 구역, 통로, 랙 검색"
                    className={ui.formInput}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const first = filteredMoveDestinations[0]
                      if (!first) {
                        toast.error('검색 결과가 없습니다')
                        return
                      }
                      setMoveForm((p) => ({ ...p, toLocationId: first.id }))
                      setMoveLocationSearch(first.code)
                    }}
                    className={cn(ui.btnSecondary, 'shrink-0')}
                  >
                    검색
                  </button>
                </div>
                {selectedMoveDestination && (
                  <div className="mt-2 flex items-center justify-between rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs dark:border-indigo-900/60 dark:bg-indigo-950/30">
                    <span className="font-mono font-semibold text-indigo-700 dark:text-indigo-300">{selectedMoveDestination.code}</span>
                    <span className="text-indigo-500 dark:text-indigo-300">선택됨</span>
                  </div>
                )}
                {moveDestinations.length > 0 && (
                  <div className="mt-2 h-44 overflow-y-auto rounded-md border border-gray-200 dark:border-slate-700">
                    {filteredMoveDestinations.map((loc, i) => {
                      const freeQty = loc.capacityUnit - (occupancyByLocation.get(loc.id) ?? 0)
                      const selected = moveForm.toLocationId === loc.id
                      return (
                        <button
                          key={loc.id}
                          type="button"
                          onClick={() => {
                            setMoveForm((p) => ({ ...p, toLocationId: loc.id }))
                            setMoveLocationSearch(loc.code)
                          }}
                          className={cn(
                            'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors',
                            selected
                              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                              : 'hover:bg-gray-50 dark:hover:bg-slate-800',
                          )}
                        >
                          <span className="min-w-0">
                            <span className="font-mono font-semibold">{i === 0 ? '[추천] ' : ''}{loc.code}</span>
                            <span className="ml-2 text-gray-400 dark:text-slate-500">적치 {loc.putawayPriority}</span>
                          </span>
                          <span className="shrink-0 tabular-nums text-gray-500 dark:text-slate-400">여유 {formatNumber(freeQty)}</span>
                        </button>
                      )
                    })}
                    {filteredMoveDestinations.length === 0 && (
                      <div className="flex h-full items-center justify-center px-3 text-center text-xs text-gray-400 dark:text-slate-500">검색 결과가 없습니다.</div>
                    )}
                  </div>
                )}
                {!moveDestinations.length && (
                  <p className="mt-1.5 text-xs text-rose-500">용량과 혼적 전략을 만족하는 이동 가능 위치가 없습니다.</p>
                )}
              </div>
              <div>
                <label className={ui.label}>이동 사유</label>
                <input value={moveForm.reason} onChange={(e) => setMoveForm((p) => ({ ...p, reason: e.target.value }))} className={ui.formInput} />
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setMoveInventory(null)} className={cn(ui.btnSecondary, 'flex-1')}>취소</button>
              <button onClick={() => moveMutation.mutate()} disabled={!moveForm.toLocationId || moveMutation.isPending}
                className={cn(ui.btnPrimary, 'flex-1 disabled:opacity-50')}>
                {moveMutation.isPending ? '이동 중...' : '위치 이동'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 삭제 확인 다이얼로그 ─────────────────────────────── */}
      {deleteConfirm && (
        <div className={ui.modalOverlay}>
          <div className="wms-modal-box w-full max-w-xs">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/40">
                <svg className="h-5 w-5 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {deleteConfirm.type === 'zone' ? '구역 삭제' : '위치 삭제'}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                  <span className="font-mono font-semibold text-gray-900 dark:text-white">&quot;{deleteConfirm.name}&quot;</span>을(를) 삭제할까요?
                  {deleteConfirm.type === 'zone' && <span className="mt-1 block text-xs text-rose-500">위치가 없는 구역만 삭제할 수 있습니다.</span>}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className={cn(ui.btnSecondary, 'flex-1')}>취소</button>
              <button
                onClick={() => {
                  if (deleteConfirm.type === 'zone') deleteZoneMutation.mutate(deleteConfirm.id)
                  else deleteLocMutation.mutate(deleteConfirm.id)
                }}
                disabled={deleteZoneMutation.isPending || deleteLocMutation.isPending}
                className={cn(ui.btnDanger, 'flex-1 disabled:opacity-50')}
              >
                {deleteZoneMutation.isPending || deleteLocMutation.isPending ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
