import { get, post, put, del } from './client'
import type { Product, Barcode, BarcodeUnitType, PageResponse, SaleStatus, BarcodeResolveResult } from '@/types/api.types'

interface ProductFilter {
  search?: string
  category?: string
  status?: SaleStatus
  page?: number
  limit?: number
}

export const productApi = {
  findAll: (filter?: ProductFilter) =>
    get<PageResponse<Product>>('/products', filter),

  findById: (id: string) =>
    get<Product>(`/products/${id}`),

  create: (data: {
    code: string; name: string; category?: string; brand?: string
    unit?: string; boxQty?: number; safetyStock?: number; reorderPoint?: number
    costPrice?: number; sellPrice?: number; isLotManaged?: boolean; isExpiryManaged?: boolean
  }) => post<Product>('/products', data),

  update: (id: string, data: Partial<Product>) =>
    put<Product>(`/products/${id}`, data),

  delete: (id: string) => del(`/products/${id}`),

  findBarcodes: (productId: string) =>
    get<Barcode[]>(`/products/${productId}/barcodes`),

  addBarcode: (productId: string, data: { barcode: string; type: BarcodeUnitType; unitQty: number; isPrimary: boolean }) =>
    post<Barcode>(`/products/${productId}/barcodes`, data),

  deleteBarcode: (productId: string, barcodeId: string) =>
    del(`/products/${productId}/barcodes/${barcodeId}`),

  resolveBarcode: (barcodeValue: string) =>
    get<BarcodeResolveResult>(`/products/barcode/${encodeURIComponent(barcodeValue)}`),
}
