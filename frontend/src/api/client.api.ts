import { get, post, put, del } from './client'
import type { Client, PageResponse } from '@/types/api.types'

interface ClientFilter {
  search?: string
  page?: number
  limit?: number
}

interface ClientBody {
  name: string
  businessNo?: string
  address?: string
  industry?: string
  sector?: string
  email?: string
  phone?: string
  fax?: string
  customerType?: string
  salesperson?: string
  mobile?: string
  ceoName?: string
  postalCode?: string
  addressDetail?: string
  contactName?: string
  honorific?: string
  managerName?: string
  managerTitle?: string
  website?: string
  employeeCount?: number
  pricePolicy?: string
  taxType?: string
  discountRate?: number
  initialReceivable?: number
  unpaidOnly?: boolean
  registrationDate?: string
  managementNo?: string
  memo?: string
}

export const clientApi = {
  findAll: (filter?: ClientFilter) =>
    get<PageResponse<Client>>('/clients', filter),

  findAllActive: () =>
    get<Client[]>('/clients/all'),

  findById: (id: string) =>
    get<Client>(`/clients/${id}`),

  create: (data: ClientBody) =>
    post<Client>('/clients', data),

  update: (id: string, data: ClientBody) =>
    put<Client>(`/clients/${id}`, data),

  delete: (id: string) =>
    del(`/clients/${id}`),
}
