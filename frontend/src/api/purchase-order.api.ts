import { get, post, put } from './client'
import type { PageResponse, PurchaseOrder, PurchaseOrderStatus, UnitType } from '@/types/api.types'

export interface PurchaseOrderRequest {
  warehouseId: string
  clientId?: string
  supplier?: string
  orderDate: string
  expectedDate?: string
  manager?: string
  phone?: string
  fax?: string
  memo?: string
  items: { productId: string; quantity: number; inputUnit?: UnitType; boxCount: number; capSize?: string; unitPrice: number }[]
}

export const purchaseOrderApi = {
  findAll: (params: { warehouseId: string; status?: PurchaseOrderStatus; search?: string; limit?: number }) =>
    get<PageResponse<PurchaseOrder>>('/purchase-orders', params),
  create: (data: PurchaseOrderRequest) => post<PurchaseOrder>('/purchase-orders', data),
  update: (id: string, data: PurchaseOrderRequest) => put<PurchaseOrder>(`/purchase-orders/${id}`, data),
  markOrdered: (id: string) => post<PurchaseOrder>(`/purchase-orders/${id}/ordered`),
  convertToInbound: (id: string) => post<PurchaseOrder>(`/purchase-orders/${id}/convert-to-inbound`),
  cancel: (id: string) => post<PurchaseOrder>(`/purchase-orders/${id}/cancel`),
}
