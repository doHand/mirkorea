'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ColDef } from 'ag-grid-community'
import { userApi } from '@/api/user.api'
import { warehouseApi } from '@/api/warehouse.api'
import { useAuthStore } from '@/stores/auth.store'
import { AppAgGrid } from '@/components/AppAgGrid'
import { formatDateTime, formatNumber } from '@/utils/format'
import type { UserDetail, UserRole } from '@/types/api.types'

const ROLE_META: Record<UserRole, { label: string; cls: string }> = {
  ADMIN: { label: '관리자', cls: 'bg-purple-100 text-purple-700' },
  MANAGER: { label: '창고 관리자', cls: 'bg-blue-100 text-blue-700' },
  WORKER: { label: '작업자', cls: 'bg-emerald-100 text-emerald-700' },
  VIEWER: { label: '조회 전용', cls: 'bg-gray-100 text-gray-600' },
}

export default function PermissionsPage() {
  const me = useAuthStore((state) => state.user)
  const [search, setSearch] = useState('')
  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: userApi.findAll })
  const { data: warehouses = [] } = useQuery({ queryKey: ['warehouses'], queryFn: warehouseApi.findAll })
  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return keyword ? users.filter((user) => [user.fullName, user.username, user.email].some((value) => value.toLowerCase().includes(keyword))) : users
  }, [search, users])
  const columns = useMemo<ColDef<UserDetail>[]>(() => [
    { headerName: '사용자', minWidth: 180, flex: 1, valueGetter: (p) => p.data ? `${p.data.fullName} (@${p.data.username})` : '-' },
    { headerName: '이메일', field: 'email', minWidth: 200 },
    { headerName: '역할', width: 130, valueGetter: (p) => p.data ? ROLE_META[p.data.role].label : '-' },
    { headerName: '담당 창고', width: 160, valueGetter: (p) => warehouses.find((warehouse) => warehouse.id === p.data?.warehouseId)?.name ?? '-' },
    { headerName: '상태', width: 100, valueGetter: (p) => p.data?.isActive ? '활성' : '비활성' },
    { headerName: '마지막 로그인', width: 165, valueGetter: (p) => p.data?.lastLoginAt ? formatDateTime(p.data.lastLoginAt) : '-' },
  ], [warehouses])
  const roleCounts = (Object.keys(ROLE_META) as UserRole[]).map((role) => ({ role, count: users.filter((user) => user.role === role).length }))

  if (me?.role !== 'ADMIN' && me?.role !== 'MANAGER') return <div className="grid h-64 place-items-center text-gray-400">접근 권한이 없습니다.</div>
  return <div className="flex h-[calc(100vh-150px)] min-h-0 flex-col gap-4 overflow-hidden">
    <div><h2 className="text-lg font-bold text-gray-900 dark:text-white">권한 관리</h2><p className="mt-0.5 text-xs text-gray-400">사용자별 역할 및 접근 권한을 확인합니다 · 전체 {formatNumber(users.length)}명</p></div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{roleCounts.map(({ role, count }) => <div key={role} className="rounded border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900"><p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{formatNumber(count)}</p><p className={`mt-1 inline-flex rounded-full px-1.5 py-0.5 text-xs font-medium ${ROLE_META[role].cls}`}>{ROLE_META[role].label}</p></div>)}</div>
    <div className="rounded border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="이름, 아이디, 이메일 검색" className="w-full rounded border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" /></div>
    <div className="min-h-0 flex-1 overflow-hidden rounded border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"><AppAgGrid rows={filteredUsers} columns={columns} loading={isLoading} /></div>
  </div>
}
