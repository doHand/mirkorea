'use client'
import { useState } from 'react'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import type { Location } from '@/types/api.types'

interface Props {
  locations: Location[]
  onSelect: (location: Location | null) => void
  onClose: () => void
  allowClear?: boolean
  isLoading?: boolean
}

export function LocationPickerModal({ locations, onSelect, onClose, allowClear, isLoading }: Props) {
  useEscapeKey(onClose)
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const filtered = q
    ? locations.filter((l) =>
        [l.code, l.aisle, l.rack, l.shelf, l.bin, l.zone?.name, l.zone?.code]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      )
    : locations

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden bg-white shadow-2xl dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">위치 선택</h3>
            <p className="mt-0.5 text-xs text-gray-500">위치코드 또는 랙 정보로 검색합니다.</p>
          </div>
          <button type="button" onClick={onClose} className="px-2 py-1 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100">닫기</button>
        </div>
        <div className="border-b border-gray-100 p-3 dark:border-gray-800 shrink-0">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="위치 검색 (코드, 통로, 랙, 선반)"
            className="wms-inline-input w-full border px-3 py-2 text-sm outline-none dark:border-gray-700 dark:bg-gray-800"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-gray-400">
              <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-orange-500" />
              위치 목록 불러오는 중...
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-400">
              {search ? '검색 결과가 없습니다.' : '등록된 위치가 없습니다.'}
            </p>
          ) : (
            filtered.map((location) => (
              <button
                key={location.id}
                type="button"
                onClick={() => onSelect(location)}
                className="wms-list-option flex w-full items-center justify-between border-b border-gray-100 px-4 py-3 text-left dark:border-gray-800 dark:hover:bg-gray-800"
              >
                <span className="font-mono font-medium text-gray-900 dark:text-white">{location.code}</span>
                <span className="text-xs text-gray-500">
                  {[location.aisle, location.rack, location.shelf, location.bin].filter(Boolean).join('-') || '-'}
                </span>
              </button>
            ))
          )}
        </div>
        <div className="flex items-center justify-between border-t border-gray-200 p-3 dark:border-gray-700 shrink-0">
          <span className="text-xs text-gray-400">전체 {locations.length}개 · 검색 {filtered.length}개</span>
          {allowClear && (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="text-sm text-gray-500 hover:text-red-500 transition-colors"
            >
              위치 해제
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
