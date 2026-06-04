import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserRole } from '@/types/api.types'

export interface MenuDef {
  menuId: string
  href: string
  label: string
  section: string
  roles: UserRole[]
}

const ALL: UserRole[] = ['ADMIN', 'MANAGER', 'WORKER', 'VIEWER']
const ADMIN_ONLY: UserRole[] = ['ADMIN']

export const DEFAULT_MENUS: MenuDef[] = [
  { menuId: 'dashboard',        href: '/',                 label: '대시보드',          section: '운영', roles: ALL },
  { menuId: 'products',         href: '/products',         label: '상품 관리',         section: '운영', roles: ALL },
  { menuId: 'inventory',        href: '/inventory',        label: '재고/가격 현황',    section: '운영', roles: ALL },
  { menuId: 'inbound',          href: '/inbound',          label: '입고 관리',         section: '입출고', roles: ['ADMIN', 'MANAGER', 'WORKER'] },
  { menuId: 'scan',             href: '/scan',             label: '스캔/바코드 관리',  section: '운영', roles: ALL },
  { menuId: 'product-attrs',    href: '/product-attrs',    label: '상품 마스터',       section: '상품 마스터 관리', roles: ALL },
  { menuId: 'units',            href: '/units',            label: '단위 관리',         section: '상품 마스터 관리', roles: ALL },
  { menuId: 'clients',          href: '/clients',          label: '거래처 관리',       section: '영업', roles: ['ADMIN', 'MANAGER'] },
  { menuId: 'quotes',           href: '/quotes',           label: '거래명세서/견적서', section: '영업', roles: ['ADMIN', 'MANAGER'] },
  { menuId: 'warehouse',        href: '/warehouse',        label: '창고/위치',         section: '관리', roles: ALL },
  { menuId: 'transactions',     href: '/transactions',     label: '이력 조회',         section: '관리', roles: ALL },
  { menuId: 'users',            href: '/users',            label: '사용자 & 역할 관리', section: '관리', roles: ADMIN_ONLY },
  { menuId: 'permissions',      href: '/permissions',      label: '권한 관리',         section: '관리', roles: ['ADMIN', 'MANAGER'] },
  { menuId: 'supplier-settings', href: '/supplier-settings', label: '공급자 정보',    section: '관리', roles: ADMIN_ONLY },
  { menuId: 'menu-permissions', href: '/menu-permissions', label: '메뉴 권한',         section: '관리', roles: ADMIN_ONLY },
  { menuId: 'profile',          href: '/profile',          label: '내 계정',           section: '계정', roles: ALL },
]

export const DEFAULT_SECTION_ORDER = ['운영', '입출고', '영업', '상품 마스터 관리', '관리', '계정']

interface MenuPermissionState {
  menus: MenuDef[]
  sectionOrder: string[]
  toggleRole: (menuId: string, role: UserRole) => void
  moveMenu: (menuId: string, toSection: string, beforeMenuId?: string) => void
  reorderMenusInSection: (section: string, orderedIds: string[]) => void
  reorderSections: (newOrder: string[]) => void
  addSection: (label: string) => void
  renameSection: (oldLabel: string, newLabel: string) => void
  renameMenu: (menuId: string, newLabel: string) => void
  deleteSection: (label: string) => void
  reset: () => void
}

export const useMenuPermissionStore = create<MenuPermissionState>()(
  persist(
    (set) => ({
      menus: DEFAULT_MENUS,
      sectionOrder: DEFAULT_SECTION_ORDER,

      toggleRole: (menuId, role) =>
        set((s) => ({
          menus: s.menus.map((m) => {
            if (m.menuId !== menuId) return m
            const has = m.roles.includes(role)
            return { ...m, roles: has ? m.roles.filter((r) => r !== role) : [...m.roles, role] }
          }),
        })),

      moveMenu: (menuId, toSection, beforeMenuId) =>
        set((s) => {
          const menu = s.menus.find((m) => m.menuId === menuId)
          if (!menu) return s
          const updatedMenu = { ...menu, section: toSection }
          const withoutMenu = s.menus.filter((m) => m.menuId !== menuId)

          if (beforeMenuId) {
            const idx = withoutMenu.findIndex((m) => m.menuId === beforeMenuId)
            if (idx !== -1) {
              const result = [...withoutMenu]
              result.splice(idx, 0, updatedMenu)
              return { menus: result }
            }
          }

          // Append to end of toSection block
          const result: MenuDef[] = []
          let placed = false
          let inTarget = false
          for (let i = 0; i < withoutMenu.length; i++) {
            const m = withoutMenu[i]
            result.push(m)
            if (m.section === toSection) {
              inTarget = true
              const next = withoutMenu[i + 1]
              if (!next || next.section !== toSection) {
                result.push(updatedMenu)
                placed = true
              }
            }
          }
          if (!placed) result.push(updatedMenu)
          return { menus: result }
        }),

      reorderMenusInSection: (section, orderedIds) =>
        set((s) => {
          const menuMap = new Map(s.menus.map((m) => [m.menuId, m]))
          const reordered = orderedIds.map((id) => menuMap.get(id)).filter((m): m is MenuDef => !!m && m.section === section)
          const result: MenuDef[] = []
          let inserted = false
          for (const m of s.menus) {
            if (m.section === section) {
              if (!inserted) { result.push(...reordered); inserted = true }
            } else {
              result.push(m)
            }
          }
          return { menus: result }
        }),

      reorderSections: (newOrder) => set({ sectionOrder: newOrder }),

      addSection: (label) => set((s) => ({ sectionOrder: [...s.sectionOrder, label] })),

      renameSection: (oldLabel, newLabel) =>
        set((s) => ({
          menus: s.menus.map((m) => m.section === oldLabel ? { ...m, section: newLabel } : m),
          sectionOrder: s.sectionOrder.map((l) => l === oldLabel ? newLabel : l),
        })),

      renameMenu: (menuId, newLabel) =>
        set((s) => ({
          menus: s.menus.map((m) => m.menuId === menuId ? { ...m, label: newLabel } : m),
        })),

      deleteSection: (label) =>
        set((s) => ({
          menus: s.menus.filter((m) => m.section !== label),
          sectionOrder: s.sectionOrder.filter((l) => l !== label),
        })),

      reset: () => set({ menus: DEFAULT_MENUS, sectionOrder: DEFAULT_SECTION_ORDER }),
    }),
    {
      name: 'wms-menu-permissions',
      version: 8,
      migrate: (stored: unknown) => {
        const s = stored as Partial<MenuPermissionState>
        // Remove obsolete menus: product-codes/box-qty/lot merged into product-attrs,
        // pricing merged into inventory, barcodes merged into scan, role-management merged into users
        const obsolete = new Set(['product-codes', 'box-qty', 'lot', 'pricing', 'barcodes', 'role-management'])
        let menus = (s.menus ?? []).filter((m) => !obsolete.has(m.menuId))
        // Rename product-attrs label to "상품 마스터"
        menus = menus.map((m) =>
          m.menuId === 'product-attrs' ? { ...m, label: '상품 마스터', href: '/product-attrs' } : m,
        )
        // Update labels for merged pages
        menus = menus.map((m) => {
          if (m.menuId === 'inventory' && m.label === '재고 조회') return { ...m, label: '재고/가격 현황' }
          if (m.menuId === 'scan' && m.label === '바코드 스캔') return { ...m, label: '스캔/바코드 관리' }
          if (m.menuId === 'users' && m.label === '사용자 관리') return { ...m, label: '사용자 & 역할 관리' }
          return m
        })
        // Add any new menus not yet in stored state
        const storedIds = new Set(menus.map((m) => m.menuId))
        const newMenus  = DEFAULT_MENUS.filter((m) => !storedIds.has(m.menuId))
        const mergedMenus = [...menus, ...newMenus]
        // Merge sections
        const storedSections = new Set(s.sectionOrder ?? [])
        const newSections = DEFAULT_SECTION_ORDER.filter((sec) => !storedSections.has(sec))
        const mergedSections = [...(s.sectionOrder ?? DEFAULT_SECTION_ORDER), ...newSections]
        return { ...s, menus: mergedMenus, sectionOrder: mergedSections }
      },
    }
  )
)
