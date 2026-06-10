import { get, post, put } from './client'
import type { OutboundOrder, OutboundOrderStatus, PageResponse } from '@/types/api.types'

export interface OutboundOrderRequest {
  warehouseId: string
  channel?: string
  externalOrderNo?: string
  customer: string
  recipient?: string
  phone?: string
  address?: string
  orderDate: string
  requestedShipDate?: string
  memo?: string
  items: { productId: string; boxCount: number }[]
}

export const outboundOrderApi = {
  findAll: (params: { warehouseId: string; status?: OutboundOrderStatus; search?: string; limit?: number }) =>
    get<PageResponse<OutboundOrder>>('/outbound-orders', params),
  create: (data: OutboundOrderRequest) => post<OutboundOrder>('/outbound-orders', data),
  update: (id: string, data: OutboundOrderRequest) => put<OutboundOrder>(`/outbound-orders/${id}`, data),
  instruct: (id: string) => post<OutboundOrder>(`/outbound-orders/${id}/instruct`),
  cancel: (id: string) => post<OutboundOrder>(`/outbound-orders/${id}/cancel`),
}
