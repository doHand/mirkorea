import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { clearAuthTokens, getSessionExpiry, saveAuthTokens, saveSessionExpiry } from '@/utils/auth-token'
import type { User } from '@/types/api.types'

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
        const sessionExpiresAt = getSessionExpiry()
        saveAuthTokens(accessToken, refreshToken, sessionExpiresAt)
        set({ user, accessToken, refreshToken, isAuth: true, sessionExpiresAt })
      },

      setUser: (user) => set({ user }),

      extendSession: () => {
        const sessionExpiresAt = saveSessionExpiry()
        set({ sessionExpiresAt })
      },

      clearAuth: () => {
        clearAuthTokens()
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
