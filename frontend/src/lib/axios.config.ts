import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

let isRefreshing = false
let pendingQueue: Array<() => void> = []

function flushQueue() {
  pendingQueue.forEach((cb) => cb())
  pendingQueue = []
}

// 401 → /api/auth/refresh (Next.js API 라우트) → 새 쿠키 발급 → 재시도
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        pendingQueue.push(() => resolve(apiClient(original)))
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      const res = await axios.post('/api/auth/refresh')
      if (res.status !== 200) throw new Error()
      flushQueue()
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
  localStorage.removeItem('wms-auth')
  localStorage.removeItem('wms-session-expiry')
  fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
    window.location.href = '/login'
  })
}

export default apiClient
