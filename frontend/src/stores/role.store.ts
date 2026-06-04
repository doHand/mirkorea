import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface RoleDef {
  id: string
  name: string
  description: string
  color: string       // Tailwind text color class
  badgeCls: string    // Tailwind badge (bg + text) classes
  builtIn: boolean    // built-in roles cannot be deleted
}

export const COLOR_OPTIONS: { label: string; color: string; badgeCls: string }[] = [
  { label: '보라',  color: 'text-purple-600 dark:text-purple-400', badgeCls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  { label: '파랑',  color: 'text-blue-600 dark:text-blue-400',     badgeCls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  { label: '초록',  color: 'text-emerald-600 dark:text-emerald-400', badgeCls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  { label: '주황',  color: 'text-orange-600 dark:text-orange-400', badgeCls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  { label: '핑크',  color: 'text-pink-600 dark:text-pink-400',     badgeCls: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' },
  { label: '시안',  color: 'text-cyan-600 dark:text-cyan-400',     badgeCls: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' },
  { label: '회색',  color: 'text-gray-500 dark:text-gray-400',     badgeCls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
]

export const DEFAULT_ROLES: RoleDef[] = [
  {
    id: 'ADMIN',
    name: '관리자',
    description: '시스템 전체 접근 권한 — 모든 메뉴, 사용자 관리, 설정 변경 가능',
    color: COLOR_OPTIONS[0].color,
    badgeCls: COLOR_OPTIONS[0].badgeCls,
    builtIn: true,
  },
  {
    id: 'MANAGER',
    name: '창고 관리자',
    description: '창고 운영 및 거래처 관리 권한 — 입출고, 재고, 영업 메뉴 접근 가능',
    color: COLOR_OPTIONS[1].color,
    badgeCls: COLOR_OPTIONS[1].badgeCls,
    builtIn: true,
  },
  {
    id: 'WORKER',
    name: '작업자',
    description: '현장 작업 권한 — 바코드 스캔, 입고, 재고 조회 가능',
    color: COLOR_OPTIONS[2].color,
    badgeCls: COLOR_OPTIONS[2].badgeCls,
    builtIn: true,
  },
  {
    id: 'VIEWER',
    name: '조회 전용',
    description: '읽기 전용 — 데이터 조회만 가능, 수정·삭제 불가',
    color: COLOR_OPTIONS[6].color,
    badgeCls: COLOR_OPTIONS[6].badgeCls,
    builtIn: true,
  },
]

interface RoleStore {
  roles: RoleDef[]
  addRole: (role: Omit<RoleDef, 'id' | 'builtIn'>) => void
  updateRole: (id: string, updates: Partial<Pick<RoleDef, 'name' | 'description' | 'color' | 'badgeCls'>>) => void
  deleteRole: (id: string) => void
  reset: () => void
}

export const useRoleStore = create<RoleStore>()(
  persist(
    (set) => ({
      roles: DEFAULT_ROLES,

      addRole: (role) =>
        set((s) => ({
          roles: [...s.roles, { ...role, id: crypto.randomUUID(), builtIn: false }],
        })),

      updateRole: (id, updates) =>
        set((s) => ({
          roles: s.roles.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        })),

      deleteRole: (id) =>
        set((s) => ({
          roles: s.roles.filter((r) => r.builtIn || r.id !== id),
        })),

      reset: () => set({ roles: DEFAULT_ROLES }),
    }),
    { name: 'wms-roles', version: 1 }
  )
)
