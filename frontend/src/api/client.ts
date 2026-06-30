import apiClient from '@/lib/axios.config'
import type { ApiResponse } from '@/types/api.types'

// 공통 요청 헬퍼
export async function get<T>(url: string, params?: object): Promise<T> {
  const res = await apiClient.get<ApiResponse<T>>(url, { params })
  return res.data.data as T
}

export async function post<T>(url: string, data?: object): Promise<T> {
  const res = await apiClient.post<ApiResponse<T>>(url, data)
  return res.data.data as T
}

export async function put<T>(url: string, data?: object): Promise<T> {
  const res = await apiClient.put<ApiResponse<T>>(url, data)
  return res.data.data as T
}

export async function patch<T>(url: string, data?: object): Promise<T> {
  const res = await apiClient.patch<ApiResponse<T>>(url, data)
  return res.data.data as T
}

export async function del<T = void>(url: string): Promise<T> {
  const res = await apiClient.delete<ApiResponse<T>>(url)
  return res.data.data as T
}
