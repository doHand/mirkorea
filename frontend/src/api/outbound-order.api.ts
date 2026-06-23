import { del, get, post, put } from './client'
import type { OutboundOrder, OutboundOrderStatus, OutboundOrderType, PageResponse, UnitType } from '@/types/api.types'

export interface OutboundOrderRequest {
  warehouseId: string
  clientId?: string
  orderType: OutboundOrderType
  channel?: string
  externalOrderNo?: string
  customer: string
  recipient?: string
  phone?: string
  address?: string
  orderDate: string
  requestedShipDate?: string
  memo?: string
  items: { productId: string; boxCount: number; inputQty?: number; inputUnit?: UnitType }[]
}

export const outboundOrderApi = {
  findAll: (params: { warehouseId: string; status?: OutboundOrderStatus; search?: string; limit?: number }) =>
    get<PageResponse<OutboundOrder>>('/outbound-orders', params),
  create: (data: OutboundOrderRequest) => post<OutboundOrder>('/outbound-orders', data),
  update: (id: string, data: OutboundOrderRequest) => put<OutboundOrder>(`/outbound-orders/${id}`, data),
  delete: (id: string) => del(`/outbound-orders/${id}`),
  instruct: (id: string) => post<OutboundOrder>(`/outbound-orders/${id}/instruct`),
  completePicking: (data: {
    orderIds: string[]
    items: { productId: string; boxCount: number }[]
  }) =>
    post<OutboundOrder[]>('/outbound-orders/complete-picking', data),
  cancel: (id: string) => post<OutboundOrder>(`/outbound-orders/${id}/cancel`),
}
