import { get, post, put, del, patch } from './client'
import type { Product, Barcode, BarcodeUnitType, PageResponse, SaleStatus, BarcodeResolveResult, ProductPricing, ProductUnit } from '@/types/api.types'

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

  updateBarcode: (productId: string, barcodeId: string, data: { type: BarcodeUnitType; unitQty: number; isPrimary: boolean }) =>
    put<Barcode>(`/products/${productId}/barcodes/${barcodeId}`, data),

  deleteBarcode: (productId: string, barcodeId: string) =>
    del(`/products/${productId}/barcodes/${barcodeId}`),

  resolveBarcode: (barcodeValue: string) =>
    get<BarcodeResolveResult>(`/products/barcode/${encodeURIComponent(barcodeValue)}`),

  getPricing: () =>
    get<ProductPricing[]>('/products/pricing'),

  updatePrice: (id: string, data: { costPrice?: number; sellPrice?: number }) =>
    patch<Product>(`/products/${id}`, data),
}

export const unitApi = {
  findAll: () => get<ProductUnit[]>('/product-units'),
  create: (data: { code: string; label: string; description?: string; sortOrder?: number }) =>
    post<ProductUnit>('/product-units', data),
  update: (id: string, data: { code?: string; label?: string; description?: string; sortOrder?: number; isActive?: boolean }) =>
    put<ProductUnit>(`/product-units/${id}`, data),
  delete: (id: string) => del(`/product-units/${id}`),
}
