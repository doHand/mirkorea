'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'
import { warehouseApi } from '@/api/warehouse.api'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { QUERY_KEYS } from '@/constants/query-keys'
import { ExportButton } from '@/components/ExportButton'

export default function WarehousePage() {
  const qc        = useQueryClient()
  const warehouse = useWarehouseStore((s) => s.selectedWarehouse)
  const [selectedZone, setSelectedZone] = useState<string>('')
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [locForm, setLocForm] = useState({ zoneId: '', code: '', aisle: '', rack: '', shelf: '' })

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

  const createLocationMutation = useMutation({
    mutationFn: () => warehouseApi.createLocation(warehouse!.id, locForm),
    onSuccess: () => {
      toast.success('위치가 등록되었습니다')
      qc.invalidateQueries({ queryKey: ['locations'] })
      setShowLocationModal(false)
    },
  })

  if (!warehouse) {
    return <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">창고를 먼저 선택하세요</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">창고 위치 관리 — {warehouse.name}</h2>
        <div className="flex items-center gap-2">
          <ExportButton
            filename="위치목록"
            getData={() => (locations as any[]).map((loc) => ({
              '위치코드': loc.code,
              '통로':     loc.aisle ?? '',
              '랙':       loc.rack  ?? '',
              '단':       loc.shelf ?? '',
              '상태':     loc.isActive ? '사용중' : '비활성',
            }))}
          />
          <button
            onClick={() => setShowLocationModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700"
          >
            <Plus size={15} /> 위치 추가
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* 구역 패널 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">구역</h3>
          <div className="space-y-1">
            <button
              onClick={() => setSelectedZone('')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                !selectedZone
                  ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-medium'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              전체
            </button>
            {zones.map((z: any) => (
              <button
                key={z.id}
                onClick={() => setSelectedZone(z.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedZone === z.id
                    ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-medium'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {z.code} — {z.name}
              </button>
            ))}
          </div>
        </div>

        {/* 위치 목록 */}
        <div className="col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-medium text-gray-900 dark:text-white">위치 목록 ({locations.length})</h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-96 overflow-y-auto">
            {locations.map((loc: any) => (
              <div key={loc.id} className="flex items-center p-3 gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <MapPin size={14} className="text-gray-400 dark:text-gray-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100">{loc.code}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {[loc.aisle && `통로:${loc.aisle}`, loc.rack && `랙:${loc.rack}`, loc.shelf && `단:${loc.shelf}`]
                      .filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  loc.isActive
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                }`}>
                  {loc.isActive ? '사용중' : '비활성'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 위치 추가 모달 */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">위치 추가</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">구역 *</label>
                <select
                  value={locForm.zoneId}
                  onChange={(e) => setLocForm((p) => ({ ...p, zoneId: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">구역 선택</option>
                  {zones.map((z: any) => <option key={z.id} value={z.id}>{z.code} - {z.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">위치코드 *</label>
                <input
                  value={locForm.code}
                  onChange={(e) => setLocForm((p) => ({ ...p, code: e.target.value }))}
                  placeholder="A-01-01-01"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['aisle', 'rack', 'shelf'].map((key) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 capitalize">
                      {key === 'aisle' ? '통로' : key === 'rack' ? '랙' : '단'}
                    </label>
                    <input
                      value={(locForm as any)[key]}
                      onChange={(e) => setLocForm((p) => ({ ...p, [key]: e.target.value }))}
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowLocationModal(false)}
                className="flex-1 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">취소</button>
              <button
                onClick={() => createLocationMutation.mutate()}
                disabled={!locForm.zoneId || !locForm.code || createLocationMutation.isPending}
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
