'use client'
import { useState } from 'react'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import type { Client } from '@/types/api.types'

interface Props {
  clients: Client[]
  onSelect: (client: Client | null) => void
  onClose: () => void
  allowClear?: boolean
}

export function ClientPickerModal({ clients, onSelect, onClose, allowClear }: Props) {
  useEscapeKey(onClose)
  const [search, setSearch] = useState('')
  const q = search.toLowerCase()
  const filtered = q
    ? clients.filter((c) =>
        [c.name, c.phone, c.businessNo]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      )
    : clients

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-2xl max-h-[80vh] flex flex-col border border-gray-200 dark:border-gray-700 shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">거래처 선택</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">닫기</button>
        </div>
        <div className="px-4 py-1.5 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="거래처명, 전화번호, 사업자번호 검색"
            className="w-full border border-gray-200 dark:border-gray-700 pl-3 pr-3 py-2 text-sm outline-none focus:border-[var(--color-primary)] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-400">거래처명</th>
                <th className="px-4 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-400">전화번호</th>
                <th className="px-4 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-400">사업자번호</th>
                <th className="px-4 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-400">주소</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400">검색 결과가 없습니다</td></tr>
              )}
              {filtered.map((client) => (
                <tr
                  key={client.id}
                  onClick={() => onSelect(client)}
                  className="cursor-pointer hover:bg-[#f7f8f5] dark:hover:bg-gray-800/40"
                >
                  <td className="px-4 py-1.5 font-medium text-gray-900 dark:text-gray-100">{client.name}</td>
                  <td className="px-4 py-1.5 text-gray-500 dark:text-gray-400">{client.phone ?? '-'}</td>
                  <td className="px-4 py-1.5 text-gray-500 dark:text-gray-400 font-mono text-xs">{client.businessNo ?? '-'}</td>
                  <td className="px-4 py-1.5 text-gray-500 dark:text-gray-400 truncate max-w-[180px]">{client.address ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-400 shrink-0">
          <span>전체 {clients.length}개 · 검색 {filtered.length}개</span>
          {allowClear && (
            <button
              onClick={() => onSelect(null)}
              className="text-gray-500 hover:text-red-500 transition-colors"
            >
              거래처 해제
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
