'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, MapPin, Trash2, FolderOpen, X, Warehouse } from 'lucide-react'
import toast from 'react-hot-toast'
import { warehouseApi } from '@/api/warehouse.api'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { QUERY_KEYS } from '@/constants/query-keys'
import { ExportButton } from '@/components/ExportButton'
import { cn } from '@/utils/cn'
import { formatNumber } from '@/utils/format'
import * as ui from '@/styles/ui'
import type { Zone, Location } from '@/types/api.types'

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
  const [zoneForm, setZoneForm] = useState({ code: '', name: '', type: 'STORAGE' })
  const [locForm,  setLocForm]  = useState({ zoneId: '', code: '', aisle: '', rack: '', shelf: '' })

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
      setLocForm({ zoneId: '', code: '', aisle: '', rack: '', shelf: '' })
    },
    onError: () => toast.error('등록 실패 (코드 중복 또는 오류)'),
  })

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
      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-500/20">
              <Warehouse size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">창고 위치 관리</p>
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
                '상태':     loc.isActive ? '사용중' : '비활성',
              }))}
            />
            <button
              onClick={() => setShowZoneModal(true)}
              className={cn(ui.btnSecondary, 'flex flex-1 items-center justify-center gap-1.5 sm:flex-none')}
            >
              <Plus size={14} /><span>구역 추가</span>
            </button>
            <button
              onClick={() => {
                setLocForm({ zoneId: selectedZone, code: '', aisle: '', rack: '', shelf: '' })
                setShowLocationModal(true)
              }}
              className={cn(ui.btnPrimary, 'flex flex-1 items-center justify-center gap-1.5 sm:flex-none')}
            >
              <Plus size={15} /><span>위치 추가</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* 구역 패널 */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-950 dark:text-white">
              <FolderOpen size={15} className="text-indigo-500" />구역
            </h3>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-gray-500 dark:bg-slate-800 dark:text-slate-200">
              {formatNumber((zones as Zone[]).length)}
            </span>
          </div>
          <div className="space-y-0.5">
            <button
              onClick={() => setSelectedZone('')}
              className={cn(
                'w-full px-3 py-2 rounded-xl text-sm transition-colors text-left',
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
                  'flex items-center rounded-xl transition-colors group/zone',
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
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {zones.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-slate-500 px-3 py-2">구역이 없습니다</p>
            )}
          </div>
        </div>

        {/* 위치 목록 */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 xl:col-span-2">
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 p-4 dark:border-slate-700">
            <h3 className="text-sm font-bold text-gray-950 dark:text-white">
              위치 목록 ({formatNumber((locations as Location[]).length)})
            </h3>
            <span className="text-xs text-gray-400 dark:text-slate-400">{selectedZone ? '선택 구역' : '전체 구역'}</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-slate-800 max-h-[calc(100vh-330px)] min-h-56 overflow-y-auto">
            {(locations as Location[]).map((loc) => (
              <div key={loc.id} className="flex flex-wrap items-center gap-3 p-3 hover:bg-gray-50/60 dark:hover:bg-slate-800/60 group/loc">
                <MapPin size={14} className="text-gray-400 dark:text-gray-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono font-semibold text-gray-950 dark:text-white break-all">{loc.code}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-300">
                    {[loc.aisle && `통로:${loc.aisle}`, loc.rack && `랙:${loc.rack}`, loc.shelf && `단:${loc.shelf}`]
                      .filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full shrink-0',
                  loc.isActive
                    ? 'bg-green-100 dark:bg-green-950/70 text-green-700 dark:text-green-100'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-300',
                )}>
                  {loc.isActive ? '사용중' : '비활성'}
                </span>
                <button
                  onClick={() => { if (confirm(`"${loc.code}" 위치를 삭제할까요?`)) deleteLocationMutation.mutate(loc.id) }}
                  className="p-1.5 text-gray-400 hover:text-rose-500 sm:opacity-0 sm:group-hover/loc:opacity-100 transition-all shrink-0"
                  title="위치 삭제"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
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
              <button onClick={() => setShowZoneModal(false)} className={ui.btnIcon}><X size={16} /></button>
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
              <button onClick={() => setShowLocationModal(false)} className={ui.btnIcon}><X size={16} /></button>
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(['aisle', 'rack', 'shelf'] as const).map((key) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {key === 'aisle' ? '통로' : key === 'rack' ? '랙' : '단'}
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
    </div>
  )
}
