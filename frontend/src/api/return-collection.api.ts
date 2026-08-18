import { get, post, del } from './client'
import type { ReturnCollection, ReturnCollectionType, PageResponse } from '@/types/api.types'

export const returnCollectionApi = {
  findAll: (params: {
    warehouseId: string; type?: ReturnCollectionType; productId?: string
    search?: string; from?: string; to?: string; page?: number; limit?: number
  }) => get<PageResponse<ReturnCollection>>('/return-collections', params),

  getSummary: (warehouseId: string) =>
    get<Record<string, number>>('/return-collections/summary', { warehouseId }),

  create: (data: {
    type: ReturnCollectionType; productId: string; warehouseId: string
    locationId?: string; quantity: number; lotNumber?: string
    outboundOrderId?: string; outboundOrderItemId?: string; clientId?: string
    reason?: string; memo?: string; barcodeScanned?: string
  }) => post<ReturnCollection>('/return-collections', data),

  createBatch: (items: {
    type: ReturnCollectionType; productId: string; warehouseId: string
    locationId?: string; quantity: number; lotNumber?: string
    reason?: string; memo?: string; barcodeScanned?: string
  }[]) => post<{ batchId: string; batchNo: string; items: ReturnCollection[] }>('/return-collections/batch', { items }),

  delete: (id: string) => del(`/return-collections/${id}`),
  deleteBatch: (batchId: string) => del(`/return-collections/batch/${batchId}`),
  deleteAll: (ids: string[]) => post<void>('/return-collections/delete', { ids }),
}
