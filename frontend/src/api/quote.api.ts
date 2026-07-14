import { get, post, put, del } from './client'
import type { Quote, PageResponse } from '@/types/api.types'

interface QuoteFilter {
  docType?: string
  search?: string
  status?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

interface QuoteItemBody {
  productId?: string
  productCode?: string
  productName?: string
  category?: string
  barcode?: string
  spec?: string
  inUnitQty?: number
  outUnitQty?: number
  unit?: string
  qty: number
  unitPrice: number
}

interface QuoteBody {
  docType?: string
  clientId?: string
  clientName?: string
  docDate: string
  memo?: string
  items: QuoteItemBody[]
}

export const quoteApi = {
  findAll: (filter?: QuoteFilter) =>
    get<PageResponse<Quote>>('/quotes', filter),

  findById: (id: string) =>
    get<Quote>(`/quotes/${id}`),

  create: (data: QuoteBody) =>
    post<Quote>('/quotes', data),

  update: (id: string, data: QuoteBody) =>
    put<Quote>(`/quotes/${id}`, data),

  delete: (id: string) =>
    del(`/quotes/${id}`),
}
