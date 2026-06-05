'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Shield, Pencil, Trash2, KeyRound, Lock, X, UserCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { userApi } from '@/api/user.api'
import { warehouseApi } from '@/api/warehouse.api'
import { useAuthStore } from '@/stores/auth.store'
import { useRoleStore, COLOR_OPTIONS } from '@/stores/role.store'
import { formatDateTime, formatNumber } from '@/utils/format'
import { cn } from '@/utils/cn'
import { ExportButton } from '@/components/ExportButton'
import { useMenuLabel } from '@/hooks/use-menu-label'
import type { UserDetail, UserRole } from '@/types/api.types'
import type { RoleDef } from '@/stores/role.store'

const ROLE_META: Record<UserRole, { label: string; cls: string }> = {
  ADMIN:   { label: '관리자',      cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  MANAGER: { label: '창고 관리자', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  WORKER:  { label: '작업자',      cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  VIEWER:  { label: '조회 전용',   cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
}

const EMPTY_FORM = { username: '', email: '', password: '', fullName: '', role: 'WORKER', warehouseId: '' }
type RoleFormState = { name: string; description: string; colorIdx: number }
const emptyRoleForm = (): RoleFormState => ({ name: '', description: '', colorIdx: 0 })

type RightTab = 'roles' | 'detail'

export default function UsersPage() {
  const pageTitle = useMenuLabel('사용자 & 역할 관리')
  const qc = useQueryClient()
  const me = useAuthStore((s) => s.user)

  // ── Users state ──
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<UserDetail | null>(null)
  const [form, setForm] = useState<typeof EMPTY_FORM & { isActive?: boolean }>(EMPTY_FORM)

  // ── Right panel state ──
  const [rightTab, setRightTab] = useState<RightTab>('roles')
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null)

  // ── Roles state ──
  const roles = useRoleStore((s) => s.roles)
  const { addRole, updateRole, deleteRole } = useRoleStore()
  const [showAddRole, setShowAddRole] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleDef | null>(null)
  const [deletingRole, setDeletingRole] = useState<RoleDef | null>(null)
  const [roleForm, setRoleForm] = useState<RoleFormState>(emptyRoleForm())

  // ── Queries ──
  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: userApi.findAll })
  const { data: warehouses = [] } = useQuery({ queryKey: ['warehouses'], queryFn: warehouseApi.findAll })

  // ── User mutations ──
  const createMutation = useMutation({
    mutationFn: () => userApi.create(form),
    onSuccess: () => { toast.success('사용자가 등록되었습니다'); qc.invalidateQueries({ queryKey: ['users'] }); closeModal() },
    onError: (err: any) => toast.error(err.response?.data?.code === 'USER_DUPLICATE' ? '이미 존재하는 사용자명/이메일입니다' : '등록 실패'),
  })
  const updateMutation = useMutation({
    mutationFn: () => userApi.update(editing!.id, { fullName: form.fullName, role: form.role, warehouseId: form.warehouseId, isActive: form.isActive, password: form.password || undefined }),
    onSuccess: () => {
      toast.success('수정되었습니다')
      qc.invalidateQueries({ queryKey: ['users'] })
      closeModal()
      if (selectedUser?.id === editing?.id) setSelectedUser((prev) => prev ? { ...prev, fullName: form.fullName, role: form.role as UserRole } : null)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => userApi.remove(id),
    onSuccess: () => {
      toast.success('사용자가 삭제되었습니다')
      qc.invalidateQueries({ queryKey: ['users'] })
      if (selectedUser) { setSelectedUser(null); setRightTab('roles') }
    },
  })

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true) }
  const openEdit = (u: UserDetail) => { setEditing(u); setForm({ username: u.username, email: u.email, password: '', fullName: u.fullName, role: u.role, warehouseId: u.warehouseId ?? '', isActive: u.isActive }); setShowModal(true) }
  const closeModal = () => { setShowModal(false); setEditing(null) }

  const selectUser = (u: UserDetail) => { setSelectedUser(u); setRightTab('detail') }

  // ── Role handlers ──
  const openAddRole = () => { setRoleForm(emptyRoleForm()); setShowAddRole(true) }
  const openEditRole = (r: RoleDef) => {
    const colorIdx = COLOR_OPTIONS.findIndex((c) => c.color === r.color)
    setRoleForm({ name: r.name, description: r.description, colorIdx: colorIdx < 0 ? 0 : colorIdx })
    setEditingRole(r)
  }
  const handleAddRole = () => {
    if (!roleForm.name.trim()) return
    const { color, badgeCls } = COLOR_OPTIONS[roleForm.colorIdx]
    addRole({ name: roleForm.name.trim(), description: roleForm.description.trim(), color, badgeCls })
    setShowAddRole(false)
  }
  const handleEditRole = () => {
    if (!editingRole || !roleForm.name.trim()) return
    const { color, badgeCls } = COLOR_OPTIONS[roleForm.colorIdx]
    updateRole(editingRole.id, { name: roleForm.name.trim(), description: roleForm.description.trim(), color, badgeCls })
    setEditingRole(null)
  }
  const handleDeleteRole = () => { if (deletingRole) { deleteRole(deletingRole.id); setDeletingRole(null) } }

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
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{pageTitle}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">사용자 {formatNumber(users.length)}명 · 역할 {formatNumber(roles.length)}개</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            filename="사용자목록"
            getData={() => users.map((u) => ({ '아이디': u.username, '이름': u.fullName, '이메일': u.email, '역할': ROLE_META[u.role].label, '활성': u.isActive ? 'Y' : 'N', '마지막 로그인': u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '-', '등록일': formatDateTime(u.createdAt) }))}
          />
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-500/20">
            <Plus size={15} />사용자 추가
          </button>
        </div>
      </div>

      {/* Split layout */}
      <div className="grid grid-cols-[1fr_380px] gap-4 items-start">

        {/* ── Left: Users list ── */}
        <div className="space-y-3">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-3 flex gap-2.5 shadow-sm">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="이름, 아이디, 이메일 검색"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 transition-shadow" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                    <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">사용자</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-600 dark:text-gray-400 w-24">역할</th>
                    <th className="text-center px-3 py-3 font-medium text-gray-600 dark:text-gray-400 w-16">상태</th>
                    <th className="px-3 py-3 w-16" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {isLoading && <tr><td colSpan={4} className="text-center py-8 text-gray-400 dark:text-gray-500">로딩 중...</td></tr>}
                  {!isLoading && filtered.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-400 dark:text-gray-500">사용자가 없습니다</td></tr>}
                  {filtered.map((u) => (
                    <tr key={u.id}
                      onClick={() => selectUser(u)}
                      className={cn('cursor-pointer transition-colors',
                        selectedUser?.id === u.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50',
                        !u.isActive && 'opacity-50')}>
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
                      <td className="px-3 py-3 text-center">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ROLE_META[u.role].cls)}>
                          {ROLE_META[u.role].label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full',
                          u.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500')}>
                          {u.isActive ? '활성' : '비활성'}
                        </span>
                      </td>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors" title="수정"><Pencil size={13} /></button>
                          <button onClick={() => { if (u.id === me?.id) { toast.error('본인 계정은 삭제할 수 없습니다'); return } if (confirm(`${u.fullName} 계정을 삭제하시겠습니까?`)) deleteMutation.mutate(u.id) }}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="삭제"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-800">
            <button onClick={() => setRightTab('roles')}
              className={cn('flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors',
                rightTab === 'roles' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300')}>
              <Shield size={12} />역할 관리
            </button>
            <button onClick={() => setRightTab('detail')}
              disabled={!selectedUser}
              className={cn('flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors',
                rightTab === 'detail' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
                !selectedUser && 'opacity-40 cursor-not-allowed')}>
              <UserCircle2 size={12} />사용자 상세
            </button>
          </div>

          {/* ── Role management ── */}
          {rightTab === 'roles' && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">역할 목록 ({formatNumber(roles.length)})</p>
                <button onClick={openAddRole} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                  <Plus size={12} />추가
                </button>
              </div>
              <div className="space-y-1.5">
                {roles.map((r) => (
                  <div key={r.id} className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 group/role transition-colors">
                    <Shield size={13} className={r.color} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded-full', r.badgeCls)}>{r.name}</span>
                        {r.builtIn && <Lock size={8} className="text-gray-300 dark:text-gray-600" />}
                      </div>
                      {r.description && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">{r.description}</p>}
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover/role:opacity-100 transition-opacity">
                      <button onClick={() => openEditRole(r)} className="p-1 rounded-lg text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"><Pencil size={11} /></button>
                      <button onClick={() => !r.builtIn && setDeletingRole(r)} disabled={r.builtIn}
                        className={cn('p-1 rounded-lg transition-colors', r.builtIn ? 'text-gray-200 dark:text-gray-700 cursor-not-allowed' : 'text-gray-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20')}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-300 dark:text-gray-700">* 기본 역할(ADMIN, MANAGER, WORKER, VIEWER)은 삭제할 수 없습니다</p>
            </div>
          )}

          {/* ── User detail ── */}
          {rightTab === 'detail' && (
            selectedUser ? (
              <div className="p-4 space-y-4">
                {/* Avatar + name */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-lg shrink-0">
                    {selectedUser.fullName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{selectedUser.fullName}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">@{selectedUser.username}</p>
                  </div>
                </div>
                {/* Info grid */}
                <div className="space-y-2 text-sm">
                  {[
                    { label: '이메일', value: selectedUser.email },
                    { label: '역할', value: <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ROLE_META[selectedUser.role].cls)}>{ROLE_META[selectedUser.role].label}</span> },
                    { label: '담당 창고', value: (warehouses as any[]).find((w) => w.id === selectedUser.warehouseId)?.name ?? '미지정' },
                    { label: '계정 상태', value: <span className={cn('text-xs px-2 py-0.5 rounded-full', selectedUser.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500')}>{selectedUser.isActive ? '활성' : '비활성'}</span> },
                    { label: '마지막 로그인', value: selectedUser.lastLoginAt ? formatDateTime(selectedUser.lastLoginAt) : '-' },
                    { label: '등록일', value: formatDateTime(selectedUser.createdAt) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">{label}</span>
                      <span className="text-xs text-gray-800 dark:text-gray-200 text-right">{value}</span>
                    </div>
                  ))}
                </div>
                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <button onClick={() => openEdit(selectedUser)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">
                    <Pencil size={12} />수정
                  </button>
                  <button
                    onClick={() => { if (selectedUser.id === me?.id) { toast.error('본인 계정은 삭제할 수 없습니다'); return } if (confirm(`${selectedUser.fullName} 계정을 삭제하시겠습니까?`)) deleteMutation.mutate(selectedUser.id) }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors border border-rose-200 dark:border-rose-900/40">
                    <Trash2 size={12} />삭제
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400 dark:text-gray-500">
                <UserCircle2 size={36} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">왼쪽 목록에서 사용자를 선택하세요</p>
              </div>
            )
          )}
        </div>
      </div>

      {/* ── User create/edit modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
              {editing ? <><Pencil size={18} />사용자 수정</> : <><Plus size={18} />사용자 추가</>}
            </h3>
            <div className="space-y-3">
              {!editing && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">아이디 *</label>
                    <input value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} placeholder="사용할 아이디"
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">이메일 *</label>
                    <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="email@example.com"
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">이름 *</label>
                <input value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} placeholder="실명"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"><KeyRound size={13} />{editing ? '새 비밀번호 (변경 시에만 입력)' : '비밀번호 *'}</label>
                <input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder={editing ? '변경하지 않으면 비워두세요' : '비밀번호'}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">역할 *</label>
                  <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                    {Object.entries(ROLE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">담당 창고</label>
                  <select value={form.warehouseId} onChange={(e) => setForm((p) => ({ ...p, warehouseId: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                    <option value="">미지정</option>
                    {(warehouses as any[]).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              </div>
              {editing && (
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={form.isActive ?? true} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} className="rounded" />
                  계정 활성화
                </label>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={closeModal} className="flex-1 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">취소</button>
              <button
                onClick={() => editing ? updateMutation.mutate() : createMutation.mutate()}
                disabled={createMutation.isPending || updateMutation.isPending || (!editing && (!form.username || !form.email || !form.password || !form.fullName))}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {(createMutation.isPending || updateMutation.isPending) ? '처리 중...' : (editing ? '수정' : '등록')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Role add/edit modal ── */}
      {(showAddRole || editingRole) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">{editingRole ? '역할 수정' : '역할 추가'}</h3>
              <button onClick={() => { setShowAddRole(false); setEditingRole(null) }} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition-colors"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">역할명 *</label>
                <input autoFocus value={roleForm.name} onChange={(e) => setRoleForm((p) => ({ ...p, name: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && (editingRole ? handleEditRole() : handleAddRole())}
                  placeholder="예: 임시 작업자"
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">설명</label>
                <textarea value={roleForm.description} onChange={(e) => setRoleForm((p) => ({ ...p, description: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none" />
              </div>
              {!editingRole?.builtIn && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">색상</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {COLOR_OPTIONS.map((c, idx) => (
                      <button key={idx} type="button" onClick={() => setRoleForm((p) => ({ ...p, colorIdx: idx }))}
                        className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border-2 transition-all', c.badgeCls, roleForm.colorIdx === idx ? 'border-current scale-110' : 'border-transparent opacity-60')}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowAddRole(false); setEditingRole(null) }} className="flex-1 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">취소</button>
              <button onClick={editingRole ? handleEditRole : handleAddRole} disabled={!roleForm.name.trim()}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {editingRole ? '저장' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Role delete confirm ── */}
      {deletingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">역할 삭제</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              <span className={cn('font-semibold', deletingRole.color)}>{deletingRole.name}</span> 역할을 삭제할까요?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingRole(null)} className="flex-1 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">취소</button>
              <button onClick={handleDeleteRole} className="flex-1 py-2 bg-rose-600 text-white rounded-xl text-sm font-medium hover:bg-rose-700 transition-colors">삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
