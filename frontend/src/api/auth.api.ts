import apiClient from '@/lib/axios.config'
import type { User, ApiResponse } from '@/types/api.types'

interface LoginResponse {
  accessToken:  string
  refreshToken: string
  user: User
}

export const authApi = {
  register: async (data: { username: string; email: string; fullName: string; phone?: string; password: string }): Promise<void> => {
    await apiClient.post('/auth/register', data)
  },

  resetPassword: async (data: { username: string; email: string; newPassword: string }): Promise<void> => {
    await apiClient.post('/auth/reset-password', data)
  },

  login: async (username: string, password: string): Promise<LoginResponse> => {
    const res = await apiClient.post<ApiResponse<LoginResponse>>('/auth/login', { username, password })
    return res.data.data!
  },

  refresh: async (refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> => {
    const res = await apiClient.post('/auth/refresh', { refreshToken })
    return res.data.data
  },

  me: async (): Promise<User> => {
    const res = await apiClient.get<ApiResponse<User>>('/auth/me')
    return res.data.data!
  },
}
