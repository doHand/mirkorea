import type { UserRole } from '@/types/api.types'

export const isAdminOrManager = (role?: UserRole | null) => role === 'ADMIN' || role === 'MANAGER'

export const canManageMasterData = isAdminOrManager

export const canAdjustStock = isAdminOrManager
