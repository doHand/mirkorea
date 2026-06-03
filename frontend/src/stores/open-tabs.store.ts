import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface OpenTab {
  href: string
  label: string
}

interface OpenTabsState {
  tabs: OpenTab[]
  addTab: (tab: OpenTab) => void
  closeTab: (href: string) => void
  clearTabs: () => void
}

export const MAX_OPEN_TABS = 10

export const useOpenTabsStore = create<OpenTabsState>()(
  persist(
    (set) => ({
      tabs: [],

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
        set((state) => ({ tabs: state.tabs.filter((t) => t.href !== href) })),

      clearTabs: () => set({ tabs: [] }),
    }),
    { name: 'wms-open-tabs' },
  ),
)
