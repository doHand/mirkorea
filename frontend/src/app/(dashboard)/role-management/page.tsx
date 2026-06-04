'use client'
import { useState } from 'react'
import { Shield, Plus, Pencil, Trash2, X, Lock } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { useRoleStore, COLOR_OPTIONS } from '@/stores/role.store'
import type { RoleDef } from '@/stores/role.store'
import { cn } from '@/utils/cn'
import * as ui from '@/styles/ui'

type FormState = { name: string; description: string; colorIdx: number }
const emptyForm = (): FormState => ({ name: '', description: '', colorIdx: 0 })

export default function RoleManagementPage() {
  const me    = useAuthStore((s) => s.user)
  const roles = useRoleStore((s) => s.roles)
  const { addRole, updateRole, deleteRole } = useRoleStore()

  const [showAdd,  setShowAdd]  = useState(false)
  const [editing,  setEditing]  = useState<RoleDef | null>(null)
  const [deleting, setDeleting] = useState<RoleDef | null>(null)
  const [form,     setForm]     = useState<FormState>(emptyForm())

  if (me?.role !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400 dark:text-gray-500">
        <Shield size={40} className="opacity-40" />
        <p>관리자만 접근할 수 있습니다</p>
      </div>
    )
  }

  const openAdd = () => { setForm(emptyForm()); setShowAdd(true) }
  const openEdit = (r: RoleDef) => {
    const colorIdx = COLOR_OPTIONS.findIndex((c) => c.color === r.color)
    setForm({ name: r.name, description: r.description, colorIdx: colorIdx < 0 ? 0 : colorIdx })
    setEditing(r)
  }

  const handleAdd = () => {
    if (!form.name.trim()) return
    const { color, badgeCls } = COLOR_OPTIONS[form.colorIdx]
    addRole({ name: form.name.trim(), description: form.description.trim(), color, badgeCls })
    setShowAdd(false)
  }

  const handleEdit = () => {
    if (!editing || !form.name.trim()) return
    const { color, badgeCls } = COLOR_OPTIONS[form.colorIdx]
    updateRole(editing.id, { name: form.name.trim(), description: form.description.trim(), color, badgeCls })
    setEditing(null)
  }

  const handleDelete = () => {
    if (!deleting) return
    deleteRole(deleting.id)
    setDeleting(null)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={ui.h2Cls}>역할 관리</h2>
          <p className={ui.subText}>시스템 역할을 추가·수정·삭제합니다 · 전체 {roles.length}개</p>
        </div>
        <button onClick={openAdd} className={cn(ui.btnPrimary, 'flex items-center gap-1.5')}>
          <Plus size={14} />역할 추가
        </button>
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {roles.map((r) => (
          <div key={r.id} className={cn(ui.cardFlat, 'p-4')}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Shield size={15} className={r.color} />
                <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', r.badgeCls)}>{r.name}</span>
              </div>
              {r.builtIn && (
                <span className="flex items-center gap-0.5 text-[10px] text-gray-300 dark:text-gray-600">
                  <Lock size={9} />기본
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">{r.description || '—'}</p>
          </div>
        ))}
      </div>

      {/* Role table */}
      <div className={ui.tableWrap}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className={ui.thead}>
                <th className={ui.th}>역할명</th>
                <th className={ui.th}>설명</th>
                <th className={cn(ui.thC, 'w-24')}>구분</th>
                <th className="w-20 px-4 py-3" />
              </tr>
            </thead>
            <tbody className={ui.tbody}>
              {roles.map((r) => (
                <tr key={r.id} className={ui.tr}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Shield size={14} className={r.color} />
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', r.badgeCls)}>{r.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-xs">
                    {r.description || <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.builtIn ? (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                        <Lock size={10} />기본
                      </span>
                    ) : (
                      <span className="text-xs text-indigo-500 dark:text-indigo-400">커스텀</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => openEdit(r)}
                        className={ui.btnIcon}
                        title="수정"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => !r.builtIn && setDeleting(r)}
                        disabled={r.builtIn}
                        className={cn(
                          'p-1.5 rounded-lg transition-colors',
                          r.builtIn
                            ? 'text-gray-200 dark:text-gray-700 cursor-not-allowed'
                            : 'text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20'
                        )}
                        title={r.builtIn ? '기본 역할은 삭제할 수 없습니다' : '삭제'}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-600">
        * 기본 역할(ADMIN, MANAGER, WORKER, VIEWER)은 시스템 필수 역할로 삭제할 수 없습니다.
      </p>

      {/* Add modal */}
      {showAdd && (
        <RoleFormModal
          title="역할 추가"
          form={form}
          setForm={setForm}
          onConfirm={handleAdd}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* Edit modal */}
      {editing && (
        <RoleFormModal
          title="역할 수정"
          form={form}
          setForm={setForm}
          onConfirm={handleEdit}
          onClose={() => setEditing(null)}
          disableColor={editing.builtIn}
        />
      )}

      {/* Delete confirm */}
      {deleting && (
        <div className={ui.modalOverlay}>
          <div className={ui.modalBox}>
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">역할 삭제</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              <span className={cn('font-semibold', deleting.color)}>{deleting.name}</span> 역할을 삭제할까요?
              <br />이 역할이 사용자에게 지정된 경우 영향을 받을 수 있습니다.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleting(null)} className={cn(ui.btnSecondary, 'flex-1')}>취소</button>
              <button onClick={handleDelete} className={cn(ui.btnDanger, 'flex-1')}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RoleFormModal({
  title,
  form,
  setForm,
  onConfirm,
  onClose,
  disableColor = false,
}: {
  title: string
  form: FormState
  setForm: (f: FormState) => void
  onConfirm: () => void
  onClose: () => void
  disableColor?: boolean
}) {
  return (
    <div className={ui.modalOverlay}>
      <div className={ui.modalBox}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className={ui.btnIcon}><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className={ui.label}>역할명 *</label>
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
              placeholder="예: 임시 작업자"
              className={ui.formInput}
            />
          </div>
          <div>
            <label className={ui.label}>설명</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="역할 설명을 입력하세요"
              rows={2}
              className={cn(ui.formInput, 'resize-none')}
            />
          </div>
          {!disableColor && (
            <div>
              <label className={ui.label}>색상</label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_OPTIONS.map((c, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setForm({ ...form, colorIdx: idx })}
                    className={cn(
                      'text-xs font-semibold px-2.5 py-1 rounded-full border-2 transition-all',
                      c.badgeCls,
                      form.colorIdx === idx ? 'border-current scale-110' : 'border-transparent opacity-60'
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className={cn(ui.btnSecondary, 'flex-1')}>취소</button>
          <button
            onClick={onConfirm}
            disabled={!form.name.trim()}
            className={cn(ui.btnPrimary, 'flex-1 disabled:opacity-50')}
          >
            {title === '역할 추가' ? '추가' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
