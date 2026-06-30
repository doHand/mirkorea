'use client'
import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColDef } from 'ag-grid-community'
import toast from 'react-hot-toast'
import { userApi } from '@/api/user.api'
import { warehouseApi } from '@/api/warehouse.api'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useAuthStore } from '@/stores/auth.store'
import { useRoleStore, COLOR_OPTIONS } from '@/stores/role.store'
import { formatDate, formatDateTime, formatNumber, formatPhoneInput } from '@/utils/format'
import { cn } from '@/utils/cn'
import { Plus } from 'lucide-react'
import { ExportButton } from '@/components/ExportButton'
import { AppAgGrid } from '@/components/AppAgGrid'
import { useMenuLabel } from '@/hooks/use-menu-label'
import type { UserDetail, UserRole } from '@/types/api.types'
import type { RoleDef } from '@/stores/role.store'

const ROLE_META: Record<UserRole, { label: string; cls: string }> = {
  ADMIN:   { label: '관리자',      cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  MANAGER: { label: '창고 관리자', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  WORKER:  { label: '작업자',      cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  VIEWER:  { label: '조회 전용',   cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
}

const EMPTY_FORM = { username: '', email: '', phone: '', hireDate: '', password: '', fullName: '', role: 'WORKER', warehouseId: '' }
type UserFormState = typeof EMPTY_FORM & { isActive?: boolean }
type RoleFormState = { name: string; description: string; colorIdx: number }
const emptyRoleForm = (): RoleFormState => ({ name: '', description: '', colorIdx: 0 })

type RightTab = 'roles' | 'detail'

function userToForm(user: UserDetail): UserFormState {
  return {
    username: user.username,
    email: user.email,
    phone: user.phone ?? '',
    hireDate: user.hireDate ?? '',
    password: '',
    fullName: user.fullName,
    role: user.role,
    warehouseId: user.warehouseId ?? '',
    isActive: user.isActive,
  }
}

export default function UsersPage() {
  const pageTitle = useMenuLabel('사용자 & 역할 관리')
  const qc = useQueryClient()
  const me = useAuthStore((s) => s.user)

  // ── Users state ──
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM)

  // ── Right panel state ──
  const [rightTab, setRightTab] = useState<RightTab>('roles')
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null)
  const [panelEditing, setPanelEditing] = useState(false)

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
    onError: (err: unknown) => {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
      toast.error(code === 'USER_DUPLICATE' ? '이미 존재하는 사용자명/이메일입니다' : '등록 실패')
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UserFormState }) => userApi.update(id, { fullName: data.fullName, email: data.email, phone: data.phone, hireDate: data.hireDate, role: data.role, warehouseId: data.warehouseId, isActive: data.isActive, password: data.password || undefined }),
    onSuccess: (updated) => {
      toast.success('수정되었습니다')
      qc.invalidateQueries({ queryKey: ['users'] })
      setSelectedUser(updated)
      setForm(userToForm(updated))
      setPanelEditing(false)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => userApi.remove(id),
    onSuccess: () => {
      toast.success('사용자가 삭제되었습니다')
      qc.invalidateQueries({ queryKey: ['users'] })
      if (selectedUser) { setSelectedUser(null); setRightTab('roles'); setPanelEditing(false) }
    },
  })

  const openCreate = () => { setForm(EMPTY_FORM); setShowModal(true) }
  const closeModal = () => { setShowModal(false) }
  useEscapeKey(closeModal, showModal)
  useEscapeKey(() => setShowAddRole(false), showAddRole)
  useEscapeKey(() => setEditingRole(null), !!editingRole)
  useEscapeKey(() => setDeletingRole(null), !!deletingRole)

  const selectUser = (u: UserDetail) => { setSelectedUser(u); setForm(userToForm(u)); setPanelEditing(false); setRightTab('detail') }
  const editUserInPanel = (u: UserDetail) => { setSelectedUser(u); setForm(userToForm(u)); setPanelEditing(true); setRightTab('detail') }

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

  const columns = useMemo<ColDef<UserDetail>[]>(() => [
    {
      headerName: '사용자',
      minWidth: 160,
      flex: 1.2,
      pinned: 'left',
      valueGetter: (p) => p.data ? `${p.data.fullName} @${p.data.username}` : '-',
      cellRenderer: (p: { data?: UserDetail }) => p.data ? (
        <div className="flex h-full min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
            {p.data.fullName.charAt(0)}
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate font-semibold text-gray-900 dark:text-gray-100">{p.data.fullName}</p>
            <p className="truncate text-xs text-gray-400">@{p.data.username}</p>
          </div>
        </div>
      ) : '-',
    },
    {
      headerName: '역할',
      width: 110,
      valueGetter: (p) => p.data ? ROLE_META[p.data.role].label : '-',
      cellRenderer: (p: { data?: UserDetail }) => p.data ? (
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', ROLE_META[p.data.role].cls)}>
          {ROLE_META[p.data.role].label}
        </span>
      ) : '-',
    },
    {
      headerName: '연락처',
      minWidth: 140,
      flex: 1,
      valueGetter: (p) => [p.data?.email, p.data?.phone].filter(Boolean).join(' / ') || '-',
      cellRenderer: (p: { data?: UserDetail }) => p.data ? (
        <div className="flex h-full flex-col justify-center leading-tight text-xs text-gray-600 dark:text-gray-300">
          <span className="truncate">{p.data.email}</span>
          <span className="truncate text-gray-400">{p.data.phone || '-'}</span>
        </div>
      ) : '-',
    },
    {
      headerName: '담당 창고',
      width: 110,
      valueGetter: (p) => warehouses.find((w) => w.id === p.data?.warehouseId)?.name ?? '미지정',
    },
    {
      headerName: '상태',
      width: 90,
      valueGetter: (p) => p.data?.isActive ? '활성' : '비활성',
      cellRenderer: (p: { data?: UserDetail }) => p.data ? (
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', p.data.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500')}>
          {p.data.isActive ? '활성' : '비활성'}
        </span>
      ) : '-',
    },
    {
      headerName: '마지막 로그인',
      width: 150,
      valueGetter: (p) => p.data?.lastLoginAt ? formatDateTime(p.data.lastLoginAt) : '-',
    },
  ], [warehouses])

  if (me?.role !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400 dark:text-gray-500">
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
          <button onClick={openCreate} className="flex items-center gap-1.5 h-7 px-3 rounded text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
            <Plus className="h-3.5 w-3.5" />
            사용자 추가
          </button>
        </div>
      </div>

      {/* Split layout */}
      <div className="grid grid-cols-1 gap-4 items-start xl:grid-cols-[1fr_380px]">

        {/* ── Left: Users list ── */}
        <div className="space-y-3">
          <div className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800 p-3 flex gap-2.5 shadow-none">
            <div className="relative flex-1">
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="이름, 아이디, 이메일 검색"
                className="w-full pl-3 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 transition-shadow" />
            </div>
          </div>

          <div className="h-[620px] min-h-0 overflow-hidden rounded border border-gray-200 bg-white shadow-none dark:border-gray-800 dark:bg-gray-900">
            <AppAgGrid
              rows={filtered}
              columns={columns}
              loading={isLoading}
              onRowClicked={selectUser}
              onRowDoubleClicked={editUserInPanel}
              className="h-full"
            />
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800 shadow-none overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-800">
            <button onClick={() => setRightTab('roles')}
              className={cn('flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors',
                rightTab === 'roles' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300')}>
              역할 관리
            </button>
            <button onClick={() => setRightTab('detail')}
              disabled={!selectedUser}
              className={cn('flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors',
                rightTab === 'detail' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
                !selectedUser && 'opacity-40 cursor-not-allowed')}>
              사용자 상세
            </button>
          </div>

          {/* ── Role management ── */}
          {rightTab === 'roles' && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 font-medium">역할 목록 ({formatNumber(roles.length)})</p>
                <button onClick={openAddRole} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                  추가
                </button>
              </div>
              <div className="space-y-1.5">
                {roles.map((r) => (
                  <div key={r.id} className="flex items-center gap-2.5 p-2.5 rounded hover:bg-gray-50 dark:hover:bg-gray-800 group/role transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded-full', r.badgeCls)}>{r.name}</span>
                      </div>
                      {r.description && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">{r.description}</p>}
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover/role:opacity-100 transition-opacity">
                      <button onClick={() => openEditRole(r)} className="p-1 rounded-lg text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">수정</button>
                      <button onClick={() => !r.builtIn && setDeletingRole(r)} disabled={r.builtIn}
                        className={cn('p-1 rounded-lg transition-colors', r.builtIn ? 'text-gray-200 dark:text-gray-700 cursor-not-allowed' : 'text-gray-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20')}>
                        삭제
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
                  <div className="min-w-0 flex-1">
                    {panelEditing ? (
                      <input
                        value={form.fullName}
                        onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                        className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-sm font-semibold text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      />
                    ) : (
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{selectedUser.fullName}</p>
                    )}
                    <p className="text-xs text-gray-400 dark:text-gray-500">@{selectedUser.username}</p>
                  </div>
                </div>
                {/* Info grid */}
                {panelEditing ? (
                  <div className="space-y-3 text-sm">
                    <PanelField label="이메일">
                      <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                    </PanelField>
                    <PanelField label="연락처">
                      <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: formatPhoneInput(e.target.value) }))} inputMode="numeric" placeholder="010-0000-0000" className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                    </PanelField>
                    <PanelField label="입사일">
                      <input type="date" value={form.hireDate} onChange={(e) => setForm((p) => ({ ...p, hireDate: e.target.value }))} className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                    </PanelField>
                    <PanelField label="역할">
                      <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                        {Object.entries(ROLE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </PanelField>
                    <PanelField label="담당 창고">
                      <select value={form.warehouseId} onChange={(e) => setForm((p) => ({ ...p, warehouseId: e.target.value }))} className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                        <option value="">미지정</option>
                        {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </PanelField>
                    <PanelField label="새 비밀번호">
                      <input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="변경 시에만 입력" className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                    </PanelField>
                    <label className="flex items-center gap-2 rounded border border-gray-100 px-3 py-2 text-xs text-gray-700 dark:border-gray-800 dark:text-gray-300">
                      <input type="checkbox" checked={form.isActive ?? true} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} className="rounded" />
                      계정 활성화
                    </label>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    {[
                      { label: '이메일', value: selectedUser.email },
                      { label: '연락처', value: selectedUser.phone ?? '-' },
                      { label: '입사일', value: selectedUser.hireDate ? formatDate(selectedUser.hireDate) : '-' },
                      { label: '역할', value: <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ROLE_META[selectedUser.role].cls)}>{ROLE_META[selectedUser.role].label}</span> },
                      { label: '담당 창고', value: warehouses.find((w) => w.id === selectedUser.warehouseId)?.name ?? '미지정' },
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
                )}
                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={() => {
                      if (panelEditing) {
                        if (!form.fullName.trim() || !form.email.trim()) {
                          toast.error('이름과 이메일을 입력하세요')
                          return
                        }
                        updateMutation.mutate({ id: selectedUser.id, data: form })
                        return
                      }
                      setForm(userToForm(selectedUser))
                      setPanelEditing(true)
                    }}
                    disabled={updateMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors">
                    {panelEditing ? (updateMutation.isPending ? '저장 중...' : '저장') : '수정'}
                  </button>
                  {panelEditing ? (
                    <button
                      onClick={() => { setForm(userToForm(selectedUser)); setPanelEditing(false) }}
                      className="flex-1 rounded border border-gray-200 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                      취소
                    </button>
                  ) : (
                    <button
                      onClick={() => { if (selectedUser.id === me?.id) { toast.error('본인 계정은 삭제할 수 없습니다'); return } if (confirm(`${selectedUser.fullName} 계정을 삭제하시겠습니까?`)) deleteMutation.mutate(selectedUser.id) }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded transition-colors border border-rose-200 dark:border-rose-900/40">
                      삭제
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400 dark:text-gray-500">
                <p className="text-sm">왼쪽 목록에서 사용자를 선택하세요</p>
              </div>
            )
          )}
        </div>
      </div>

      {/* ── User create/edit modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
              사용자 추가
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">아이디 *</label>
                <input value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} placeholder="사용할 아이디"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">이름 *</label>
                <input value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} placeholder="실명"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">이메일 *</label>
                <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="email@example.com"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">연락처</label>
                  <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: formatPhoneInput(e.target.value) }))} inputMode="numeric" placeholder="010-0000-0000"
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">입사일</label>
                  <input type="date" value={form.hireDate} onChange={(e) => setForm((p) => ({ ...p, hireDate: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">비밀번호 *</label>
                <input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="비밀번호"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={closeModal} className="flex-1 py-2 border border-gray-200 dark:border-gray-600 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">취소</button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !form.username || !form.email || !form.password || !form.fullName}
                className="flex-1 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {createMutation.isPending ? '처리 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Role add/edit modal ── */}
      {(showAddRole || editingRole) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-none">
          <div className="bg-white dark:bg-gray-800 rounded shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">{editingRole ? '역할 수정' : '역할 추가'}</h3>
              <button onClick={() => { setShowAddRole(false); setEditingRole(null) }} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition-colors">닫기</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">역할명 *</label>
                <input autoFocus value={roleForm.name} onChange={(e) => setRoleForm((p) => ({ ...p, name: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && (editingRole ? handleEditRole() : handleAddRole())}
                  placeholder="예: 임시 작업자"
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">설명</label>
                <textarea value={roleForm.description} onChange={(e) => setRoleForm((p) => ({ ...p, description: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none" />
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
              <button onClick={() => { setShowAddRole(false); setEditingRole(null) }} className="flex-1 py-2 border border-gray-200 dark:border-gray-600 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">취소</button>
              <button onClick={editingRole ? handleEditRole : handleAddRole} disabled={!roleForm.name.trim()}
                className="flex-1 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {editingRole ? '저장' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Role delete confirm ── */}
      {deletingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-none">
          <div className="bg-white dark:bg-gray-800 rounded shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">역할 삭제</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              <span className={cn('font-semibold', deletingRole.color)}>{deletingRole.name}</span> 역할을 삭제할까요?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingRole(null)} className="flex-1 py-2 border border-gray-200 dark:border-gray-600 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">취소</button>
              <button onClick={handleDeleteRole} className="flex-1 py-2 bg-rose-600 text-white rounded text-sm font-medium hover:bg-rose-700 transition-colors">삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PanelField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-[82px_minmax(0,1fr)] items-center gap-3">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      {children}
    </label>
  )
}
