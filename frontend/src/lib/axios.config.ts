import axios from 'axios'
import { clearAuthTokens, getAccessToken, getRefreshToken, saveAuthTokens } from '@/utils/auth-token'

const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// 요청 인터셉터: JWT 자동 첨부
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 재발급 중복 방지
let isRefreshing = false
let pendingQueue: Array<(token: string) => void> = []

function flushQueue(token: string) {
  pendingQueue.forEach((cb) => cb(token))
  pendingQueue = []
}

// 응답 인터셉터: 401 → refresh 시도 → 실패 시 로그인 페이지
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    const refreshToken = getRefreshToken()
    if (!refreshToken) {
      redirectToLogin()
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        pendingQueue.push((newToken) => {
          original.headers.Authorization = `Bearer ${newToken}`
          resolve(apiClient(original))
        })
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      const res = await axios.post('/api/v1/auth/refresh', { refreshToken })
      const { accessToken, refreshToken: newRefreshToken } = res.data.data
      saveAuthTokens(accessToken, newRefreshToken)

      apiClient.defaults.headers.common.Authorization = `Bearer ${accessToken}`
      original.headers.Authorization = `Bearer ${accessToken}`
      flushQueue(accessToken)
      return apiClient(original)
    } catch {
      redirectToLogin()
      return Promise.reject(error)
    } finally {
      isRefreshing = false
    }
  }
)

function redirectToLogin() {
  if (typeof window === 'undefined') return
  clearAuthTokens()
  window.location.href = '/login'
}

export default apiClient
