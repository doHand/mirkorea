import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface OpenTab {
  href: string
  label: string
}

interface OpenTabsState {
  tabs: OpenTab[]
  splitTabs: OpenTab[]
  splitHref: string | null
  splitRatio: number        // 20–80, 기본 50 (메인 패널 %)
  addTab: (tab: OpenTab) => void
  closeTab: (href: string) => void
  clearTabs: () => void
  addSplitTab: (tab: OpenTab) => void
  closeSplitTab: (href: string) => void
  clearSplitTabs: () => void
  setSplit: (href: string | null) => void
  setSplitRatio: (ratio: number) => void
}

export const MAX_OPEN_TABS = 10

export const useOpenTabsStore = create<OpenTabsState>()(
  persist(
    (set) => ({
      tabs: [],
      splitTabs: [],
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
        })),

      clearTabs: () => set({ tabs: [], splitTabs: [], splitHref: null }),

      addSplitTab: (tab) =>
        set((state) => ({
          splitTabs: state.splitTabs.some((item) => item.href === tab.href)
            ? state.splitTabs.map((item) => item.href === tab.href ? tab : item)
            : [...state.splitTabs, tab].slice(-MAX_OPEN_TABS),
          splitHref: tab.href,
        })),

      closeSplitTab: (href) =>
        set((state) => {
          const index = state.splitTabs.findIndex((tab) => tab.href === href)
          const splitTabs = state.splitTabs.filter((tab) => tab.href !== href)
          const nextActive = state.splitHref === href
            ? splitTabs[index] ?? splitTabs[index - 1] ?? null
            : splitTabs.find((tab) => tab.href === state.splitHref) ?? null
          return { splitTabs, splitHref: nextActive?.href ?? null }
        }),

      clearSplitTabs: () => set({ splitTabs: [], splitHref: null }),

      setSplit: (href) => set({ splitHref: href }),

      setSplitRatio: (ratio) => set({ splitRatio: Math.min(80, Math.max(20, ratio)) }),
    }),
    {
      name: 'wms-open-tabs',
      version: 2,
      migrate: (stored: unknown) => {
        const state = stored as Partial<OpenTabsState>
        const previousSplit = state.splitHref
          ? state.tabs?.find((tab) => tab.href === state.splitHref)
          : null
        return {
          ...state,
          splitTabs: state.splitTabs ?? (previousSplit ? [previousSplit] : []),
        }
      },
    },
  ),
)
