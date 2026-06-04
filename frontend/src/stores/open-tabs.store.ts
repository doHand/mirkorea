import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface OpenTab {
  href: string
  label: string
}

interface OpenTabsState {
  tabs: OpenTab[]
  splitHref: string | null
  splitRatio: number        // 20–80, 기본 50 (메인 패널 %)
  addTab: (tab: OpenTab) => void
  closeTab: (href: string) => void
  clearTabs: () => void
  setSplit: (href: string | null) => void
  setSplitRatio: (ratio: number) => void
}

export const MAX_OPEN_TABS = 10

export const useOpenTabsStore = create<OpenTabsState>()(
  persist(
    (set) => ({
      tabs: [],
      splitHref: null,
      splitRatio: 50,

      addTab: (tab) =>
        set((state) => {
          const existingIndex = state.tabs.findIndex((t) => t.href === tab.href)
          if (existingIndex >= 0) {
            const tabs = [...state.tabs]
            tabs[existingIndex] = tab
            return { tabs }
          }
          return { tabs: [...state.tabs, tab].slice(-MAX_OPEN_TABS) }
        }),

      closeTab: (href) =>
        set((state) => ({
          tabs: state.tabs.filter((t) => t.href !== href),
          splitHref: state.splitHref === href ? null : state.splitHref,
        })),

      clearTabs: () => set({ tabs: [], splitHref: null }),

      setSplit: (href) => set({ splitHref: href }),

      setSplitRatio: (ratio) => set({ splitRatio: Math.min(80, Math.max(20, ratio)) }),
    }),
    { name: 'wms-open-tabs' },
  ),
)
