import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types/api.types'

interface AuthState {
  user:         User | null
  accessToken:  string | null
  refreshToken: string | null
  isAuth:       boolean
  setAuth:  (user: User, access: string, refresh: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:         null,
      accessToken:  null,
      refreshToken: null,
      isAuth:       false,

      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem('access_token',  accessToken)
        localStorage.setItem('refresh_token', refreshToken)
        set({ user, accessToken, refreshToken, isAuth: true })
      },

      clearAuth: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({ user: null, accessToken: null, refreshToken: null, isAuth: false })
      },
    }),
    { name: 'wms-auth', partialize: (s) => ({ user: s.user, isAuth: s.isAuth }) }
  )
)
