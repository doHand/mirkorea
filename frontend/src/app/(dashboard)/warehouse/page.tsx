'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, MapPin, Trash2, FolderOpen, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { warehouseApi } from '@/api/warehouse.api'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { QUERY_KEYS } from '@/constants/query-keys'
import { ExportButton } from '@/components/ExportButton'
import { cn } from '@/utils/cn'
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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            창고 위치 관리 — {warehouse.name}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">구역 및 위치를 등록하고 관리합니다.</p>
        </div>
        <div className="flex items-center gap-2">
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
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
          >
            <Plus size={14} /><span className="hidden sm:inline">구역 추가</span>
          </button>
          <button
            onClick={() => {
              setLocForm({ zoneId: selectedZone, code: '', aisle: '', rack: '', shelf: '' })
              setShowLocationModal(true)
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors"
          >
            <Plus size={15} /><span className="hidden sm:inline">위치 추가</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* 구역 패널 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2 text-sm">
            <FolderOpen size={14} className="text-gray-400" />구역
          </h3>
          <div className="space-y-0.5">
            <button
              onClick={() => setSelectedZone('')}
              className={cn(
                'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                !selectedZone
                  ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-medium'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300',
              )}
            >
              전체 ({(locations as Location[]).length})
            </button>
            {(zones as Zone[]).map((z) => (
              <div
                key={z.id}
                className={cn(
                  'flex items-center rounded-lg transition-colors group/zone',
                  selectedZone === z.id
                    ? 'bg-brand-100 dark:bg-brand-900/30'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700',
                )}
              >
                <button
                  onClick={() => setSelectedZone(z.id)}
                  className={cn(
                    'flex-1 text-left px-3 py-2 text-sm',
                    selectedZone === z.id
                      ? 'text-brand-700 dark:text-brand-300 font-medium'
                      : 'text-gray-700 dark:text-gray-300',
                  )}
                >
                  <span className="font-mono font-semibold">{z.code}</span>
                  <span className="ml-1.5 text-gray-400 dark:text-gray-500 font-normal text-xs">{z.name}</span>
                  <span className="ml-1 text-[10px] text-gray-300 dark:text-gray-600">
                    {ZONE_TYPE_LABEL[z.type] ?? z.type}
                  </span>
                </button>
                <button
                  onClick={() => { if (confirm(`"${z.name}" 구역을 삭제할까요?`)) deleteZoneMutation.mutate(z.id) }}
                  className="p-1.5 opacity-0 group-hover/zone:opacity-100 text-gray-300 hover:text-rose-500 transition-all mr-1 shrink-0"
                  title="구역 삭제"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {zones.length === 0 && (
              <p className="text-xs text-gray-300 dark:text-gray-700 px-3 py-2">구역이 없습니다</p>
            )}
          </div>
        </div>

        {/* 위치 목록 */}
        <div className="col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-medium text-gray-900 dark:text-white text-sm">
              위치 목록 ({(locations as Location[]).length})
            </h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[420px] overflow-y-auto">
            {(locations as Location[]).map((loc) => (
              <div key={loc.id} className="flex items-center p-3 gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 group/loc">
                <MapPin size={14} className="text-gray-400 dark:text-gray-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100">{loc.code}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {[loc.aisle && `통로:${loc.aisle}`, loc.rack && `랙:${loc.rack}`, loc.shelf && `단:${loc.shelf}`]
                      .filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full shrink-0',
                  loc.isActive
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500',
                )}>
                  {loc.isActive ? '사용중' : '비활성'}
                </span>
                <button
                  onClick={() => { if (confirm(`"${loc.code}" 위치를 삭제할까요?`)) deleteLocationMutation.mutate(loc.id) }}
                  className="p-1.5 opacity-0 group-hover/loc:opacity-100 text-gray-300 hover:text-rose-500 transition-all shrink-0"
                  title="위치 삭제"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {(locations as Location[]).length === 0 && (
              <p className="text-center py-10 text-sm text-gray-400 dark:text-gray-500">위치가 없습니다</p>
            )}
          </div>
        </div>
      </div>

      {/* 구역 추가 모달 */}
      {showZoneModal && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">구역 추가</h3>
              <button onClick={() => setShowZoneModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">구역 코드 *</label>
                <input
                  autoFocus
                  value={zoneForm.code}
                  onChange={(e) => setZoneForm((p) => ({ ...p, code: e.target.value }))}
                  placeholder="A, B, COLD 등"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">구역명 *</label>
                <input
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="일반 보관 구역"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">구역 유형</label>
                <select
                  value={zoneForm.type}
                  onChange={(e) => setZoneForm((p) => ({ ...p, type: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {Object.entries(ZONE_TYPE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowZoneModal(false)}
                className="flex-1 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                취소
              </button>
              <button
                onClick={() => createZoneMutation.mutate()}
                disabled={!zoneForm.code.trim() || !zoneForm.name.trim() || createZoneMutation.isPending}
                className="flex-1 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                {createZoneMutation.isPending ? '등록 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 위치 추가 모달 */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">위치 추가</h3>
              <button onClick={() => setShowLocationModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">구역 *</label>
                <select
                  value={locForm.zoneId}
                  onChange={(e) => setLocForm((p) => ({ ...p, zoneId: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">구역 선택</option>
                  {(zones as Zone[]).map((z) => (
                    <option key={z.id} value={z.id}>{z.code} — {z.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">위치코드 *</label>
                <input
                  value={locForm.code}
                  onChange={(e) => setLocForm((p) => ({ ...p, code: e.target.value }))}
                  placeholder="A-01-01-01"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['aisle', 'rack', 'shelf'] as const).map((key) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {key === 'aisle' ? '통로' : key === 'rack' ? '랙' : '단'}
                    </label>
                    <input
                      value={locForm[key]}
                      onChange={(e) => setLocForm((p) => ({ ...p, [key]: e.target.value }))}
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowLocationModal(false)}
                className="flex-1 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                취소
              </button>
              <button
                onClick={() => createLocationMutation.mutate()}
                disabled={!(locForm.zoneId || selectedZone) || !locForm.code.trim() || createLocationMutation.isPending}
                className="flex-1 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
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
