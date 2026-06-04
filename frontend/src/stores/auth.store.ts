import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types/api.types'

const SESSION_MINUTES = 30

interface AuthState {
  user:             User | null
  accessToken:      string | null
  refreshToken:     string | null
  isAuth:           boolean
  sessionExpiresAt: number | null
  _hasHydrated:     boolean
  setHasHydrated:   (v: boolean) => void
  setAuth:          (user: User, access: string, refresh: string) => void
  setUser:          (user: User) => void
  extendSession:    () => void
  clearAuth:        () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:             null,
      accessToken:      null,
      refreshToken:     null,
      isAuth:           false,
      sessionExpiresAt: null,
      _hasHydrated:     false,
      setHasHydrated:   (v) => set({ _hasHydrated: v }),

      setAuth: (user, accessToken, refreshToken) => {
        const sessionExpiresAt = Date.now() + SESSION_MINUTES * 60 * 1000
        localStorage.setItem('access_token', accessToken)
        localStorage.setItem('refresh_token', refreshToken)
        localStorage.setItem('wms-session-expiry', String(sessionExpiresAt))
        set({ user, accessToken, refreshToken, isAuth: true, sessionExpiresAt })
      },

      setUser: (user) => set({ user }),

      extendSession: () => {
        const sessionExpiresAt = Date.now() + SESSION_MINUTES * 60 * 1000
        localStorage.setItem('wms-session-expiry', String(sessionExpiresAt))
        set({ sessionExpiresAt })
      },

      clearAuth: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('wms-session-expiry')
        set({ user: null, accessToken: null, refreshToken: null, isAuth: false, sessionExpiresAt: null })
      },
    }),
    {
      name: 'wms-auth',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
      partialize: (s) => ({
        user: s.user,
        isAuth: s.isAuth,
        sessionExpiresAt: s.sessionExpiresAt,
      }),
    }
  )
)
