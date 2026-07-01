import apiClient from '@/lib/axios.config'
import type { User, ApiResponse } from '@/types/api.types'

export const authApi = {
  register: async (data: { username: string; email: string; fullName: string; phone?: string; password: string; securityQuestion: string; securityAnswer: string }): Promise<void> => {
    await apiClient.post('/auth/register', data)
  },

  getSecurityQuestion: async (username: string): Promise<string> => {
    const res = await apiClient.get<{ data: string }>(`/auth/security-question?username=${encodeURIComponent(username)}`)
    return res.data.data
  },

  resetPasswordByAnswer: async (data: { username: string; answer: string; newPassword: string }): Promise<void> => {
    await apiClient.post('/auth/reset-password-by-answer', data)
  },

  login: async (username: string, password: string): Promise<{ user: User }> => {
    const res = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (!res.ok) throw data
    return data.data
  },

  me: async (): Promise<User> => {
    const res = await apiClient.get<ApiResponse<User>>('/auth/me')
    return res.data.data!
  },
}
