import { get, post, patch } from './client'
import type { Warehouse, Zone, Location } from '@/types/api.types'

export const warehouseApi = {
  findAll: () => get<Warehouse[]>('/warehouses'),

  findById: (id: string) => get<Warehouse>(`/warehouses/${id}`),

  create: (data: { code: string; name: string; address?: string }) =>
    post<Warehouse>('/warehouses', data),

  findZones: (warehouseId: string) =>
    get<Zone[]>(`/warehouses/${warehouseId}/zones`),

  createZone: (warehouseId: string, data: { code: string; name: string; type?: string }) =>
    post<Zone>(`/warehouses/${warehouseId}/zones`, data),

  findLocations: (warehouseId: string, zoneId?: string) =>
    get<Location[]>(`/warehouses/${warehouseId}/locations`, { zoneId }),

  createLocation: (warehouseId: string, data: {
    zoneId: string; code: string; aisle?: string; rack?: string; shelf?: string; bin?: string
  }) => post<Location>(`/warehouses/${warehouseId}/locations`, data),

  updateLocation: (locationId: string, data: { isActive?: boolean; capacityUnit?: number }) =>
    patch<Location>(`/warehouses/locations/${locationId}`, data),
}
