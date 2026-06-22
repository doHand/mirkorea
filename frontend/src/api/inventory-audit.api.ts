import { get, post, put, del } from './client'
import type { InventoryAudit } from '@/types/api.types'

export const inventoryAuditApi = {
  list: (warehouseId: string) =>
    get<InventoryAudit[]>('/inventory-audits', { warehouseId }),

  get: (id: string) =>
    get<InventoryAudit>(`/inventory-audits/${id}`),

  create: (data: { warehouseId: string; auditDate: string; memo?: string }) =>
    post<InventoryAudit>('/inventory-audits', data),

  updateCounts: (id: string, counts: { itemId: string; countedQty: number | null }[]) =>
    put<void>(`/inventory-audits/${id}/counts`, { counts }),

  confirm: (id: string) =>
    post<InventoryAudit>(`/inventory-audits/${id}/confirm`, {}),

  delete: (id: string) =>
    del<void>(`/inventory-audits/${id}`),
}
