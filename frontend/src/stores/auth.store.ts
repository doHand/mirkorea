import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getSessionExpiry, saveSessionExpiry, clearSessionExpiry } from '@/utils/auth-token'
import type { User } from '@/types/api.types'

interface AuthState {
  user:             User | null
  isAuth:           boolean
  sessionExpiresAt: number | null
  _hasHydrated:     boolean
  setHasHydrated:   (v: boolean) => void
  setAuth:          (user: User) => void
  setUser:          (user: User) => void
  extendSession:    () => void
  clearAuth:        () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:             null,
      isAuth:           false,
      sessionExpiresAt: null,
      _hasHydrated:     false,
      setHasHydrated:   (v) => set({ _hasHydrated: v }),

      setAuth: (user) => {
        const sessionExpiresAt = getSessionExpiry()
        saveSessionExpiry(sessionExpiresAt)
        set({ user, isAuth: true, sessionExpiresAt })
      },

      setUser: (user) => set({ user }),

      extendSession: () => {
        const sessionExpiresAt = saveSessionExpiry()
        set({ sessionExpiresAt })
      },

      clearAuth: () => {
        clearSessionExpiry()
        set({ user: null, isAuth: false, sessionExpiresAt: null })
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
