import { get, post, patch, del } from './client'
import type { UserDetail } from '@/types/api.types'

interface CreateUserData {
  username: string
  email: string
  password: string
  fullName: string
  role: string
  warehouseId?: string
}

interface UpdateUserData {
  fullName?: string
  role?: string
  isActive?: boolean
  warehouseId?: string
  password?: string
}

export const userApi = {
  getMe: () => get<UserDetail>('/users/me'),

  updateMe: (data: { fullName?: string; password?: string }) =>
    patch<UserDetail>('/users/me', data),

  findAll: () => get<UserDetail[]>('/users'),

  create: (data: CreateUserData) => post<UserDetail>('/users', data),

  update: (id: string, data: UpdateUserData) => patch<UserDetail>(`/users/${id}`, data),

  remove: (id: string) => del(`/users/${id}`),
}
