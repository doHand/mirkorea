import { get, post } from './client'
import type { AuditLog, PageResponse } from '@/types/api.types'

export const auditLogApi = {
  findAll: (params: { search?: string; page?: number; limit?: number }) => get<PageResponse<AuditLog>>('/audit-logs', params),
  restore: (id: string) => post<void>(`/audit-logs/${id}/restore`),
}
