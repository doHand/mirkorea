import { get, post } from './client'
import type { StockTransaction, Inventory, PageResponse, TxType } from '@/types/api.types'

export const stockApi = {
  inbound: (data: {
    productId: string; locationId: string; warehouseId: string
    quantity: number; barcodeUsed?: string; lotNumber?: string
    expireDate?: string; reason?: string; slipId?: string
  }) => post<StockTransaction>('/stock/inbound', data),

  cancelInbound: (txnId: string, reason: string) =>
    post<StockTransaction>(`/stock/inbound/${txnId}/cancel`, { reason }),

  outbound: (data: {
    productId: string; locationId: string; warehouseId: string
    quantity: number; barcodeUsed?: string; lotNumber?: string; reason?: string
  }) => post<StockTransaction>('/stock/outbound', data),

  cancelOutbound: (txnId: string, reason: string) =>
    post<StockTransaction>(`/stock/outbound/${txnId}/cancel`, { reason }),

  adjust: (data: {
    productId: string; locationId: string; warehouseId: string
    adjustedQty: number; reason: string; lotNumber?: string
  }) => post<StockTransaction>('/stock/adjustment', data),

  move: (data: {
    productId: string; fromLocationId: string; toLocationId: string
    warehouseId: string; quantity: number; reason?: string; lotNumber?: string
  }) => post<void>('/stock/move', data),

  // 재고 조회
  getInventory: (warehouseId: string) =>
    get<Inventory[]>('/inventory', { warehouseId }),

  getInventoryByProduct: (productId: string, warehouseId?: string) =>
    get<Inventory[]>('/inventory/by-product/' + productId, { warehouseId }),

  getLowStock: (warehouseId: string) =>
    get<Inventory[]>('/inventory/low-stock', { warehouseId }),

  getSummary: (warehouseId: string) =>
    get<{ totalSkus: number; totalQty: number; lowStockCount: number }>('/inventory/summary', { warehouseId }),

  // 거래 로그
  getTransactions: (filter?: {
    productId?: string; locationId?: string; warehouseId?: string
    txType?: TxType; from?: string; to?: string; page?: number; limit?: number
  }) => get<PageResponse<StockTransaction>>('/transactions', filter),
}
