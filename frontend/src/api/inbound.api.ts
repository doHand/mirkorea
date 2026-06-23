import { get, post, patch, del } from './client'
import type { InboundOrder, InboundOrderItem, InboundStatus, PageResponse, UnitType } from '@/types/api.types'

export interface CreateInboundOrderRequest {
  warehouseId: string
  supplier?: string
  expectedDate?: string
  memo?: string
  items: {
    productId: string
    expectedQty: number
    inputUnit?: UnitType
    lotNumber?: string
    expireDate?: string
    locationId?: string
  }[]
}

export interface ReceiveItemRequest {
  itemId: string
  receivedQty: number
  barcodeScanned?: string
  lotNumber?: string
  expireDate?: string
  locationId?: string
}

export interface InspectItemRequest {
  itemId: string
  passedQty: number
  defectQty: number
  defectLocationId?: string
  note?: string
}

export const inboundApi = {
  findAll: (params: { warehouseId: string; status?: InboundStatus; page?: number; limit?: number }) =>
    get<PageResponse<InboundOrder>>('/inbound', params),

  findById: (id: string) => get<InboundOrder>(`/inbound/${id}`),

  create: (data: CreateInboundOrderRequest) => post<InboundOrder>('/inbound', data),

  receive: (id: string, items: ReceiveItemRequest[]) =>
    patch<InboundOrder>(`/inbound/${id}/receive`, items),

  inspect: (id: string, items: InspectItemRequest[]) =>
    patch<InboundOrder>(`/inbound/${id}/inspect`, items),

  complete: (id: string) => post<InboundOrder>(`/inbound/${id}/complete`),

  cancel: (id: string) => post<InboundOrder>(`/inbound/${id}/cancel`),

  delete: (id: string) => del(`/inbound/${id}`),
}
