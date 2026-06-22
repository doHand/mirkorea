'use client'
import { Fragment, useState, useMemo, useCallback } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor, TouchSensor,
  useSensor, useSensors, closestCenter,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Shield, RotateCcw, Info, Check, GripVertical,
  FolderPlus, Pencil, Trash2, X, Folder,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/stores/auth.store'
import { useMenuPermissionStore } from '@/stores/menu-permission.store'
import { cn } from '@/utils/cn'
import { formatNumber } from '@/utils/format'
import type { UserRole } from '@/types/api.types'
import type { MenuDef } from '@/stores/menu-permission.store'

/* ─── constants ─────────────────────────────────────────────────────── */
const ROLES: { role: UserRole; label: string; headerCls: string; checkCls: string }[] = [
  { role: 'ADMIN',   label: '관리자',   headerCls: 'text-purple-600 dark:text-purple-400', checkCls: 'bg-purple-100 dark:bg-purple-900/30 cursor-not-allowed' },
  { role: 'MANAGER', label: '창고관리', headerCls: 'text-blue-600 dark:text-blue-400',     checkCls: 'bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/20' },
  { role: 'WORKER',  label: '작업자',   headerCls: 'text-emerald-600 dark:text-emerald-400', checkCls: 'bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-500/20' },
  { role: 'VIEWER',  label: '조회전용', headerCls: 'text-gray-500 dark:text-gray-400',     checkCls: 'bg-gray-500 hover:bg-gray-600' },
]
const ROLE_DESC: Record<UserRole, string> = {
  ADMIN:   '시스템 전체 관리 — 모든 메뉴 고정 허용',
  MANAGER: '창고 운영 및 관리 권한',
  WORKER:  '현장 입출고·스캔 작업 권한',
  VIEWER:  '조회 전용, 수정 불가',
}

/* ─── SortableSectionHeader ─────────────────────────────────────────── */
function SortableSectionHeader({
  label, itemCount, sectionOrder, onRename, onDelete,
}: {
  label: string
  itemCount: number
  sectionOrder: string[]
  onRename: (old: string, next: string) => void
  onDelete: (label: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `section-${label}` })
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(label)

  const commit = () => {
    const v = editVal.trim()
    if (v && v !== label) onRename(label, v)
    setEditing(false)
  }

  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('bg-gray-50/60 dark:bg-gray-800/30 group/sec', isDragging && 'opacity-40')}
    >
      <td className="pl-2 pr-0 py-2 w-8">
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-700 hover:text-gray-400 p-1 rounded block"
        >
          <GripVertical size={13} />
        </span>
      </td>
      <td colSpan={ROLES.length + 2} className="py-2 pr-4">
        <div className="flex items-center gap-2">
          <Folder size={11} className="text-gray-400 dark:text-gray-600 shrink-0" />
          {editing ? (
            <>
              <input
                autoFocus
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit()
                  if (e.key === 'Escape') setEditing(false)
                }}
                onBlur={commit}
                className="text-[10px] font-bold uppercase tracking-widest text-gray-600 dark:text-gray-400 bg-transparent border-b border-indigo-400 outline-none w-28"
              />
              <button onMouseDown={(e) => { e.preventDefault(); commit() }} className="text-indigo-500 hover:text-indigo-600 p-0.5">
                <Check size={11} />
              </button>
              <button onMouseDown={(e) => { e.preventDefault(); setEditing(false) }} className="text-gray-400 hover:text-gray-600 p-0.5">
                <X size={11} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setEditVal(label); setEditing(true) }}
                className="text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
              >
                {label}
              </button>
              <Pencil size={9} className="text-gray-300 dark:text-gray-700 opacity-0 group-hover/sec:opacity-100 transition-opacity" />
              <span className="text-[10px] tabular-nums text-gray-300 dark:text-gray-700">({formatNumber(itemCount)})</span>
              <button
                onClick={() => onDelete(label)}
                className="ml-auto text-gray-300 dark:text-gray-700 hover:text-rose-500 dark:hover:text-rose-400 transition-colors opacity-0 group-hover/sec:opacity-100 p-0.5 rounded"
              >
                <Trash2 size={11} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

/* ─── SortableMenuRow ────────────────────────────────────────────────── */
function SortableMenuRow({
  menu, sectionOrder, onToggle, onMove, onRename,
}: {
  menu: MenuDef
  sectionOrder: string[]
  onToggle: (menuId: string, role: UserRole, checked: boolean, label: string) => void
  onMove: (menuId: string, toSection: string) => void
  onRename: (menuId: string, newLabel: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: menu.menuId })
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(menu.label)

  const commit = () => {
    const v = editVal.trim()
    if (v && v !== menu.label) onRename(menu.menuId, v)
    setEditing(false)
  }

  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors group/row',
        isDragging && 'opacity-40 bg-indigo-50/60 dark:bg-indigo-900/5',
      )}
    >
      <td className="pl-2 pr-0 py-3 w-8 border-r border-gray-100 dark:border-gray-800">
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-700 hover:text-gray-400 p-1 rounded block"
        >
          <GripVertical size={13} />
        </span>
      </td>
      <td className="px-4 py-3.5 text-sm border-r border-gray-100 dark:border-gray-800">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') setEditing(false)
              }}
              onBlur={commit}
              className="font-medium text-gray-800 dark:text-gray-200 bg-transparent border-b border-indigo-400 outline-none w-36"
            />
            <button onMouseDown={(e) => { e.preventDefault(); commit() }} className="text-indigo-500 hover:text-indigo-600 p-0.5">
              <Check size={11} />
            </button>
            <button onMouseDown={(e) => { e.preventDefault(); setEditing(false) }} className="text-gray-400 hover:text-gray-600 p-0.5">
              <X size={11} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { setEditVal(menu.label); setEditing(true) }}
              className="font-medium text-gray-800 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left"
            >
              {menu.label}
            </button>
            <Pencil size={10} className="text-gray-300 dark:text-gray-700 opacity-0 group-hover/row:opacity-100 transition-opacity" />
          </div>
        )}
      </td>
      {ROLES.map(({ role, checkCls }) => {
        const isAdmin = role === 'ADMIN'
        const checked = menu.roles.includes(role)
        return (
          <td key={role} className="px-4 py-3.5 text-center border-r border-gray-100 dark:border-gray-800">
            <button
              disabled={isAdmin}
              onClick={() => onToggle(menu.menuId, role, checked, menu.label)}
              className={cn(
                'mx-auto w-6 h-6 rounded-md flex items-center justify-center transition-all',
                isAdmin ? checkCls : checked
                  ? checkCls
                  : 'border-2 border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-600',
              )}
            >
              {checked && (
                <Check
                  size={13}
                  className={cn('stroke-[3]', isAdmin ? 'text-purple-600 dark:text-purple-400' : 'text-white')}
                />
              )}
            </button>
          </td>
        )
      })}
      <td className="pr-4 py-3.5 text-right border-l border-gray-100 dark:border-gray-800">
        <select
          value={menu.section}
          onChange={(e) => onMove(menu.menuId, e.target.value)}
          className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-600 outline-none transition-colors"
        >
          {sectionOrder.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
    </tr>
  )
}

/* ─── DragOverlay content ───────────────────────────────────────────── */
function DragGhost({ id, menus }: { id: string; menus: MenuDef[] }) {
  if (id.startsWith('section-')) {
    return (
      <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-700 rounded px-4 py-2 shadow-xl opacity-95">
        <GripVertical size={13} className="text-indigo-400" />
        <Folder size={13} className="text-indigo-400" />
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
          {id.slice(8)}
        </span>
      </div>
    )
  }
  const menu = menus.find((m) => m.menuId === id)
  if (!menu) return null
  return (
    <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-700 rounded px-4 py-2.5 shadow-xl opacity-95">
      <GripVertical size={13} className="text-indigo-400" />
      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{menu.label}</span>
    </div>
  )
}

/* ─── Main page ─────────────────────────────────────────────────────── */
export default function MenuPermissionsPage() {
  const me = useAuthStore((s) => s.user)
  const {
    menus, sectionOrder,
    toggleRole, moveMenu, reorderMenusInSection, reorderSections,
    addSection, renameSection, renameMenu, deleteSection, reset,
  } = useMenuPermissionStore()

  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const sections = useMemo(
    () => sectionOrder.map((label) => ({ label, items: menus.filter((m) => m.section === label) })),
    [menus, sectionOrder],
  )

  const flatIds = useMemo(
    () => sections.flatMap(({ label, items }) => [`section-${label}`, ...items.map((m) => m.menuId)]),
    [sections],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleToggle = useCallback((menuId: string, role: UserRole, checked: boolean, label: string) => {
    const roleMeta = ROLES.find((r) => r.role === role)!
    toggleRole(menuId, role)
    toast.success(`${label} · ${roleMeta.label} 권한 ${checked ? '해제' : '허용'}`)
  }, [toggleRole])

  const handleMove = useCallback((menuId: string, toSection: string) => {
    const menu = menus.find((m) => m.menuId === menuId)
    if (!menu || menu.section === toSection) return
    moveMenu(menuId, toSection)
    toast.success(`${menu.label}을(를) "${toSection}"으로 이동했습니다`)
  }, [menus, moveMenu])

  const handleAddSection = useCallback(() => {
    const label = `새 폴더 ${formatNumber(sectionOrder.length + 1)}`
    addSection(label)
    toast.success(`"${label}" 폴더를 추가했습니다`)
  }, [sectionOrder, addSection])

  const handleRenameSection = useCallback((oldLabel: string, newLabel: string) => {
    if (sectionOrder.includes(newLabel)) {
      toast.error('같은 이름의 폴더가 이미 있습니다')
      return
    }
    renameSection(oldLabel, newLabel)
    toast.success(`"${oldLabel}"을(를) "${newLabel}"으로 변경했습니다`)
  }, [sectionOrder, renameSection])

  const handleDeleteSection = useCallback((label: string) => {
    const count = menus.filter((m) => m.section === label).length
    const msg = count > 0
      ? `"${label}" 폴더에 메뉴가 ${formatNumber(count)}개 있습니다. 폴더와 메뉴를 모두 삭제할까요?`
      : `"${label}" 폴더를 삭제할까요?`
    if (!confirm(msg)) return
    deleteSection(label)
    toast.success(`"${label}" 폴더를 삭제했습니다`)
  }, [menus, deleteSection])

  const handleRenameMenu = useCallback((menuId: string, newLabel: string) => {
    renameMenu(menuId, newLabel)
    toast.success(`메뉴 이름이 변경되었습니다`)
  }, [renameMenu])

  const handleReset = useCallback(() => {
    if (!confirm('모든 메뉴 권한과 폴더 구성을 기본값으로 초기화할까요?')) return
    reset()
    toast.success('기본값으로 초기화되었습니다')
  }, [reset])

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    setActiveDragId(String(active.id))
  }, [])

  const handleDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    setActiveDragId(null)
    if (!over || active.id === over.id) return

    const activeId = String(active.id)
    const overId   = String(over.id)
    const isActiveSection = activeId.startsWith('section-')
    const isOverSection   = overId.startsWith('section-')

    if (isActiveSection && isOverSection) {
      const oldIdx = sectionOrder.indexOf(activeId.slice(8))
      const newIdx = sectionOrder.indexOf(overId.slice(8))
      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        reorderSections(arrayMove(sectionOrder, oldIdx, newIdx))
      }
      return
    }

    if (!isActiveSection) {
      const activeMenu = menus.find((m) => m.menuId === activeId)
      if (!activeMenu) return

      if (isOverSection) {
        const targetSection = overId.slice(8)
        if (activeMenu.section !== targetSection) {
          moveMenu(activeId, targetSection)
          toast.success(`${activeMenu.label}을(를) "${targetSection}"으로 이동했습니다`)
        }
        return
      }

      const overMenu = menus.find((m) => m.menuId === overId)
      if (!overMenu) return

      if (activeMenu.section === overMenu.section) {
        const sec = menus.filter((m) => m.section === activeMenu.section)
        const oi = sec.findIndex((m) => m.menuId === activeId)
        const ni = sec.findIndex((m) => m.menuId === overId)
        if (oi !== ni) reorderMenusInSection(activeMenu.section, arrayMove(sec, oi, ni).map((m) => m.menuId))
      } else {
        moveMenu(activeId, overMenu.section, overId)
        toast.success(`${activeMenu.label}을(를) "${overMenu.section}"으로 이동했습니다`)
      }
    }
  }, [menus, sectionOrder, moveMenu, reorderMenusInSection, reorderSections])

  /* ── admin guard (after all hooks) ─────────────────────────────── */
  if (me?.role !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400 dark:text-gray-500">
        <Shield size={40} className="opacity-40" />
        <p className="text-sm">관리자만 접근할 수 있습니다</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">메뉴 권한 관리</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            역할별 접근 메뉴를 설정하고, 폴더로 메뉴를 구성합니다. 드래그로 순서를 바꿀 수 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleAddSection}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/40 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 transition-colors"
          >
            <FolderPlus size={14} />
            <span className="hidden sm:inline">새 폴더</span>
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
          >
            <RotateCcw size={14} />
            <span className="hidden sm:inline">초기화</span>
          </button>
        </div>
      </div>

      {/* 안내 배너 */}
      <div className="flex items-start gap-2.5 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800/30 rounded px-4 py-3">
        <Info size={15} className="text-indigo-500 dark:text-indigo-400 mt-0.5 shrink-0" />
        <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
          <strong>관리자(ADMIN)</strong>는 모든 메뉴에 항상 접근 가능합니다. 폴더 이름을 클릭하면 이름을 변경할 수 있으며, 드래그 핸들(<GripVertical size={11} className="inline" />)로 순서를 조정합니다.
          사이드바 표시만 제어하며 URL 직접 접근은 차단되지 않습니다.
        </p>
      </div>

      {/* ── 데스크톱: DnD 테이블 ─────────────────────────────────────── */}
      <div className="hidden md:block bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={flatIds} strategy={verticalListSortingStrategy}>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#2D4033] text-white">
                  <th className="w-8 border-r border-white/20" />
                  <th className="text-center px-4 py-3 font-semibold border-r border-white/20">메뉴</th>
                  {ROLES.map(({ role, label }) => (
                    <th key={role} className="text-center px-4 py-3 w-24 font-semibold border-r border-white/20">
                      {label}
                    </th>
                  ))}
                  <th className="text-center pr-4 py-3 w-28 font-semibold">폴더</th>
                </tr>
              </thead>
              <tbody>
                {sections.map(({ label, items }) => (
                  <Fragment key={label}>
                    <SortableSectionHeader
                      label={label}
                      itemCount={items.length}
                      sectionOrder={sectionOrder}
                      onRename={handleRenameSection}
                      onDelete={handleDeleteSection}
                    />
                    {items.map((menu) => (
                      <SortableMenuRow
                        key={menu.menuId}
                        menu={menu}
                        sectionOrder={sectionOrder}
                        onToggle={handleToggle}
                        onMove={handleMove}
                        onRename={handleRenameMenu}
                      />
                    ))}
                  </Fragment>
                ))}
                {sections.every((s) => s.items.length === 0) && (
                  <tr>
                    <td colSpan={ROLES.length + 3} className="px-8 py-6 text-center text-sm text-gray-300 dark:text-gray-700">
                      메뉴가 없습니다
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </SortableContext>

          <DragOverlay>
            {activeDragId && <DragGhost id={activeDragId} menus={menus} />}
          </DragOverlay>
        </DndContext>
      </div>

      {/* ── 모바일: 섹션별 카드 ──────────────────────────────────────── */}
      <div className="md:hidden space-y-4">
        {sections.map(({ label, items }) => (
          <div key={label} className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 bg-gray-50/80 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <Folder size={11} className="text-gray-400 dark:text-gray-500 shrink-0" />
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest flex-1">{label}</p>
              <button
                onClick={() => handleDeleteSection(label)}
                className="text-gray-300 dark:text-gray-700 hover:text-rose-500 transition-colors p-0.5"
              >
                <Trash2 size={12} />
              </button>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.length === 0 && (
                <p className="px-4 py-3 text-xs text-gray-300 dark:text-gray-700 italic">메뉴가 없습니다</p>
              )}
              {items.map((menu) => (
                <div key={menu.menuId} className="px-4 py-3.5">
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{menu.label}</p>
                    <select
                      value={menu.section}
                      onChange={(e) => handleMove(menu.menuId, e.target.value)}
                      className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-pointer outline-none shrink-0"
                    >
                      {sectionOrder.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {ROLES.map(({ role, label: roleLabel, headerCls, checkCls }) => {
                      const isAdmin = role === 'ADMIN'
                      const checked = menu.roles.includes(role)
                      return (
                        <button
                          key={role}
                          disabled={isAdmin}
                          onClick={() => handleToggle(menu.menuId, role, checked, menu.label)}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded border text-left transition-all',
                            checked
                              ? 'border-indigo-200 dark:border-indigo-800/50 bg-indigo-50 dark:bg-indigo-900/10'
                              : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50',
                            isAdmin && 'cursor-not-allowed',
                          )}
                        >
                          <div className={cn(
                            'w-5 h-5 rounded flex items-center justify-center shrink-0',
                            isAdmin ? checkCls : checked ? checkCls : 'border-2 border-gray-300 dark:border-gray-600',
                          )}>
                            {checked && <Check size={11} className={cn('stroke-[3]', isAdmin ? 'text-purple-600 dark:text-purple-400' : 'text-white')} />}
                          </div>
                          <span className={cn('text-xs font-medium', headerCls)}>{roleLabel}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <button
          onClick={handleAddSection}
          className="w-full flex items-center justify-center gap-2 py-3.5 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded text-sm text-gray-400 dark:text-gray-600 hover:border-indigo-300 hover:text-indigo-500 dark:hover:border-indigo-700 dark:hover:text-indigo-400 transition-colors"
        >
          <FolderPlus size={15} />
          새 폴더 추가
        </button>
      </div>

      {/* 역할 설명 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {ROLES.map(({ role, label, headerCls }) => (
          <div key={role} className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800 p-3">
            <p className={cn('text-xs font-bold mb-1', headerCls)}>{label}</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">{ROLE_DESC[role]}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
