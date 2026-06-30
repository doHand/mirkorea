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

const DEFAULT_MENUS: MenuDef[] = [
  { menuId: 'dashboard',        href: '/',                 label: '대시보드',          section: '홈', roles: ALL },
  { menuId: 'help',             href: '/help',             label: '사용 설명서',        section: '홈', roles: ALL },
  { menuId: 'products',         href: '/products',         label: '상품 관리',         section: '상품 관리', roles: ALL },
  { menuId: 'product-attrs',    href: '/product-attrs',    label: '상품 마스터',       section: '상품 관리', roles: ALL },
  { menuId: 'barcodes',         href: '/barcodes',         label: '바코드 관리',       section: '상품 관리', roles: ALL },
  { menuId: 'units',            href: '/units',            label: '단위 관리',         section: '상품 관리', roles: ALL },
  { menuId: 'categories',       href: '/categories',       label: '카테고리 관리',      section: '상품 관리', roles: ALL },
  { menuId: 'inbound',          href: '/inbound',          label: '입고 관리',         section: '입출고 관리', roles: ['ADMIN', 'MANAGER', 'WORKER'] },
  { menuId: 'outbound',         href: '/outbound',         label: '출고 관리',         section: '입출고 관리', roles: ['ADMIN', 'MANAGER', 'WORKER'] },
  { menuId: 'scan',             href: '/scan',             label: '스캔',              section: '입출고 관리', roles: ALL },
  { menuId: 'transactions',     href: '/transactions',     label: '이력 조회',         section: '입출고 관리', roles: ALL },
  { menuId: 'inventory-audit',  href: '/inventory-audit',  label: '재고조사',           section: '입출고 관리', roles: ['ADMIN', 'MANAGER'] },
  { menuId: 'clients',          href: '/clients',          label: '거래처 관리',       section: '영업 관리', roles: ['ADMIN', 'MANAGER'] },
  { menuId: 'quotes',           href: '/quotes',           label: '출력서류 관리',      section: '영업 관리', roles: ['ADMIN', 'MANAGER'] },
  { menuId: 'warehouse',        href: '/warehouse',        label: '창고/위치',         section: '시스템 관리', roles: ALL },
  { menuId: 'users',            href: '/users',            label: '사용자 & 역할 관리', section: '시스템 관리', roles: ADMIN_ONLY },
  { menuId: 'supplier-settings', href: '/supplier-settings', label: '공급자 정보',    section: '시스템 관리', roles: ADMIN_ONLY },
  { menuId: 'menu-permissions', href: '/menu-permissions', label: '메뉴 권한',         section: '시스템 관리', roles: ADMIN_ONLY },
  { menuId: 'audit-logs',       href: '/audit-logs',       label: '수정·삭제 로그',     section: '시스템 관리', roles: ADMIN_ONLY },
  { menuId: 'alerts',           href: '/alerts',           label: '알림',               section: '시스템 관리', roles: ADMIN_ONLY },
  { menuId: 'profile',          href: '/profile',          label: '내 계정',           section: '계정', roles: ALL },
]

const DEFAULT_SECTION_ORDER = ['홈', '상품 관리', '입출고 관리', '영업 관리', '시스템 관리', '계정']

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
      version: 23,
      migrate: (stored: unknown) => {
        const s = stored as Partial<MenuPermissionState>
        // Remove obsolete menus: product-codes/box-qty/lot merged into product-attrs,
        // pricing merged into inventory, role-management merged into users
        // Note: barcodes is now a standalone page — removed from obsolete list
        const purchaseOrderRoles = s.menus?.find((m) => m.menuId === 'purchase-orders')?.roles ?? []
        const obsolete = new Set(['product-codes', 'box-qty', 'lot', 'pricing', 'role-management', 'inventory', 'purchase-orders', 'picking-list', 'permissions'])
        let menus = (s.menus ?? []).filter((m) => !obsolete.has(m.menuId))
        // Rename product-attrs label to "상품 마스터"
        menus = menus.map((m) =>
          m.menuId === 'product-attrs' ? { ...m, label: '상품 마스터', href: '/product-attrs' } : m,
        )
        // Update labels for merged pages
        menus = menus.map((m) => {
          if (m.menuId === 'quotes') {
            return { ...m, label: '출력서류 관리', roles: Array.from(new Set([...m.roles, ...purchaseOrderRoles])) }
          }
          if (m.menuId === 'inventory' && m.label === '재고 조회') return { ...m, label: '재고/가격 현황' }
          if (m.menuId === 'scan' && m.label === '바코드 스캔') return { ...m, label: '스캔 조회/입출고' }
          if (m.menuId === 'users' && m.label === '사용자 관리') return { ...m, label: '사용자 & 역할 관리' }
          if (m.menuId === 'outbound') return { ...m, label: '출고 관리' }
          return m
        })
        // Fix labels that may have been corrupted in earlier versions
        const FORCED_LABELS: Record<string, string> = {
          'alerts':     '알림',
          'audit-logs': '수정·삭제 로그',
        }
        menus = menus.map((m) =>
          FORCED_LABELS[m.menuId] ? { ...m, label: FORCED_LABELS[m.menuId] } : m,
        )
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
