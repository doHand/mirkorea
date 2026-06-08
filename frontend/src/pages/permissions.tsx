'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { KeyRound, Search, Shield } from 'lucide-react'
import { userApi } from '@/api/user.api'
import { warehouseApi } from '@/api/warehouse.api'
import { useAuthStore } from '@/stores/auth.store'
import { formatDateTime, formatNumber } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { UserRole } from '@/types/api.types'

const ROLE_META: Record<UserRole, { label: string; cls: string }> = {
  ADMIN:   { label: '관리자',      cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  MANAGER: { label: '창고 관리자', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  WORKER:  { label: '작업자',      cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  VIEWER:  { label: '조회 전용',   cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
}

export default function PermissionsPage() {
  const me = useAuthStore((s) => s.user)
  const [search, setSearch] = useState('')

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn:  userApi.findAll,
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn:  warehouseApi.findAll,
  })

  if (me?.role !== 'ADMIN' && me?.role !== 'MANAGER') {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400 dark:text-gray-500">
        <Shield size={40} className="opacity-40" />
        <p>접근 권한이 없습니다</p>
      </div>
    )
  }

  const filtered = users.filter((u) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      u.fullName.toLowerCase().includes(s) ||
      u.username.toLowerCase().includes(s) ||
      u.email.toLowerCase().includes(s)
    )
  })

  const roleCounts = (Object.keys(ROLE_META) as UserRole[]).map((role) => ({
    role,
    count: users.filter((u) => u.role === role).length,
  }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">권한 관리</h2>
          <p className="text-xs text-gray-400 mt-0.5">사용자별 역할 및 접근 권한을 확인합니다 · 전체 {formatNumber(users.length)}명</p>
        </div>
      </div>

      {/* 역할별 요약 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {roleCounts.map(({ role, count }) => (
          <div
            key={role}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-3 shadow-sm"
          >
            <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{formatNumber(count)}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', ROLE_META[role].cls)}>
                {ROLE_META[role].label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 검색 */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-3 flex gap-2.5 shadow-sm">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름, 아이디, 이메일 검색"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 transition-shadow"
          />
        </div>
      </div>

      {/* 사용자 목록 */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-[#2D4033] text-white">
                <th className="text-center px-4 py-3 font-semibold">사용자</th>
                <th className="text-center px-4 py-3 font-semibold">이메일</th>
                <th className="text-center px-4 py-3 font-semibold w-28">역할</th>
                <th className="text-center px-4 py-3 font-semibold w-32">담당 창고</th>
                <th className="text-center px-4 py-3 font-semibold w-20">상태</th>
                <th className="text-center px-4 py-3 font-semibold w-36">마지막 로그인</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading && (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400 dark:text-gray-500">로딩 중...</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400 dark:text-gray-500">사용자가 없습니다</td></tr>
              )}
              {filtered.map((u) => {
                const warehouseName = warehouses.find((w: any) => w.id === u.warehouseId)?.name
                return (
                  <tr key={u.id} className={cn('hover:bg-gray-50/30 dark:hover:bg-gray-800/10 transition-colors', !u.isActive && 'opacity-50')}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm shrink-0">
                          {u.fullName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{u.fullName}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{u.email}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ROLE_META[u.role].cls)}>
                        {ROLE_META[u.role].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {warehouseName ?? <span className="text-gray-300 dark:text-gray-600">-</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full',
                        u.isActive
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                      )}>
                        {u.isActive ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500">
                      {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {me?.role !== 'ADMIN' && (
        <p className="text-xs text-gray-400 flex items-center gap-1.5">
          <KeyRound size={12} />
          사용자 추가·수정·삭제는 관리자(ADMIN)만 가능합니다
        </p>
      )}
    </div>
  )
}
