import { get, post, patch, del } from './client'
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

  findAllLocations: () =>
    get<Location[]>('/warehouses/locations'),

  findLocations: (warehouseId: string, zoneId?: string) =>
    get<Location[]>(`/warehouses/${warehouseId}/locations`, { zoneId }),

  createLocation: (warehouseId: string, data: {
    zoneId: string; code: string; aisle?: string; rack?: string; shelf?: string; bin?: string
  }) => post<Location>(`/warehouses/${warehouseId}/locations`, data),

  updateLocation: (locationId: string, data: {
    isActive?: boolean
    capacityUnit?: number
    putawayPriority?: number
    pickPriority?: number
    allowMixedProducts?: boolean
  }) =>
    patch<Location>(`/warehouses/locations/${locationId}`, data),

  deleteZone: (warehouseId: string, zoneId: string) =>
    del(`/warehouses/${warehouseId}/zones/${zoneId}`),

  deleteLocation: (locationId: string) =>
    del(`/warehouses/locations/${locationId}`),
}
