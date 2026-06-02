'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Shield, Pencil, Trash2, KeyRound } from 'lucide-react'
import toast from 'react-hot-toast'
import { userApi } from '@/api/user.api'
import { warehouseApi } from '@/api/warehouse.api'
import { useAuthStore } from '@/stores/auth.store'
import { formatDateTime } from '@/utils/format'
import { cn } from '@/utils/cn'
import { ExportButton } from '@/components/ExportButton'
import type { UserDetail, UserRole } from '@/types/api.types'

const ROLE_META: Record<UserRole, { label: string; cls: string }> = {
  ADMIN:   { label: '관리자',      cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  MANAGER: { label: '창고 관리자', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  WORKER:  { label: '작업자',      cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  VIEWER:  { label: '조회 전용',   cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
}

const EMPTY_FORM = { username: '', email: '', password: '', fullName: '', role: 'WORKER', warehouseId: '' }

export default function UsersPage() {
  const qc        = useQueryClient()
  const me        = useAuthStore((s) => s.user)
  const [search, setSearch]       = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState<UserDetail | null>(null)
  const [form, setForm]           = useState<typeof EMPTY_FORM & { isActive?: boolean }>(EMPTY_FORM)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn:  userApi.findAll,
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn:  warehouseApi.findAll,
  })

  const createMutation = useMutation({
    mutationFn: () => userApi.create(form),
    onSuccess: () => {
      toast.success('사용자가 등록되었습니다')
      qc.invalidateQueries({ queryKey: ['users'] })
      closeModal()
    },
    onError: (err: any) => {
      const code = err.response?.data?.code
      toast.error(code === 'USER_DUPLICATE' ? '이미 존재하는 사용자명/이메일입니다' : '등록 실패')
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => userApi.update(editing!.id, {
      fullName:    form.fullName,
      role:        form.role,
      warehouseId: form.warehouseId,
      isActive:    form.isActive,
      password:    form.password || undefined,
    }),
    onSuccess: () => {
      toast.success('수정되었습니다')
      qc.invalidateQueries({ queryKey: ['users'] })
      closeModal()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => userApi.remove(id),
    onSuccess: () => {
      toast.success('사용자가 삭제되었습니다')
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = (u: UserDetail) => {
    setEditing(u)
    setForm({ username: u.username, email: u.email, password: '', fullName: u.fullName,
              role: u.role, warehouseId: u.warehouseId ?? '', isActive: u.isActive })
    setShowModal(true)
  }

  const closeModal = () => { setShowModal(false); setEditing(null) }

  const filtered = users.filter((u) => {
    if (!search) return true
    const s = search.toLowerCase()
    return u.fullName.toLowerCase().includes(s) || u.username.toLowerCase().includes(s) || u.email.toLowerCase().includes(s)
  })

  if (me?.role !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400 dark:text-gray-500">
        <Shield size={40} className="opacity-40" />
        <p>관리자만 접근할 수 있습니다</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">권한 관리</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">전체 {users.length}명</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            filename="사용자목록"
            getData={() => users.map((u) => ({
              '아이디':      u.username,
              '이름':        u.fullName,
              '이메일':      u.email,
              '역할':        ROLE_META[u.role].label,
              '활성':        u.isActive ? 'Y' : 'N',
              '마지막 로그인': u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '-',
              '등록일':      formatDateTime(u.createdAt),
            }))}
          />
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors"
          >
            <Plus size={15} /> 사용자 추가
          </button>
        </div>
      </div>

      {/* 검색 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름, 아이디, 이메일 검색"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">사용자</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">이메일</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-28">역할</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-32">담당 창고</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-20">상태</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 w-36">마지막 로그인</th>
              <th className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading && (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400 dark:text-gray-500">로딩 중...</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400 dark:text-gray-500">사용자가 없습니다</td></tr>
            )}
            {filtered.map((u) => {
              const warehouseName = warehouses.find((w: any) => w.id === u.warehouseId)?.name
              return (
                <tr key={u.id} className={cn('hover:bg-gray-50 dark:hover:bg-gray-700/50', !u.isActive && 'opacity-50')}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold text-sm shrink-0">
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
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(u)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                        title="수정"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => { if (u.id === me?.id) { toast.error('본인 계정은 삭제할 수 없습니다'); return } if (confirm(`${u.fullName} 계정을 삭제하시겠습니까?`)) deleteMutation.mutate(u.id) }}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        title="삭제"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* 등록/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
              {editing ? <><Pencil size={18} /> 사용자 수정</> : <><Plus size={18} /> 사용자 추가</>}
            </h3>

            <div className="space-y-3">
              {/* 등록 시에만 아이디/이메일 */}
              {!editing && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">아이디 *</label>
                    <input
                      value={form.username}
                      onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                      placeholder="사용할 아이디"
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">이메일 *</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="email@example.com"
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">이름 *</label>
                <input
                  value={form.fullName}
                  onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                  placeholder="실명"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                  <KeyRound size={13} />
                  {editing ? '새 비밀번호 (변경 시에만 입력)' : '비밀번호 *'}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder={editing ? '변경하지 않으면 비워두세요' : '비밀번호'}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">역할 *</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    {Object.entries(ROLE_META).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">담당 창고</label>
                  <select
                    value={form.warehouseId}
                    onChange={(e) => setForm((p) => ({ ...p, warehouseId: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">미지정</option>
                    {warehouses.map((w: any) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {editing && (
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive ?? true}
                    onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                    className="rounded"
                  />
                  계정 활성화
                </label>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={closeModal}
                className="flex-1 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">
                취소
              </button>
              <button
                onClick={() => editing ? updateMutation.mutate() : createMutation.mutate()}
                disabled={
                  createMutation.isPending || updateMutation.isPending ||
                  (!editing && (!form.username || !form.email || !form.password || !form.fullName))
                }
                className="flex-1 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                {(createMutation.isPending || updateMutation.isPending) ? '처리 중...' : (editing ? '수정' : '등록')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
