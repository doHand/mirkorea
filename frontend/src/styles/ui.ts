// Shared Tailwind class constants — import instead of repeating strings across pages.
// Usage: import { card, tableWrap, btnPrimary } from '@/styles/ui'

// ── Container / Card ────────────────────────────────────────────────────────
export const card     = 'bg-white dark:bg-gray-900 rounded-md border border-warm-300/70 dark:border-gray-800'
export const cardFlat = 'bg-white dark:bg-gray-900 rounded-md border border-warm-300/70 dark:border-gray-800'

/** Card with overflow-hidden for tables */
export const tableWrap = 'bg-white dark:bg-gray-900 rounded-md border border-warm-300/70 dark:border-gray-800 overflow-hidden'

/** Horizontal filter bar card */
export const filterCard = 'bg-white dark:bg-gray-900 rounded-md border border-warm-300/70 dark:border-gray-800 p-3 flex gap-2.5'

// ── Table internals ─────────────────────────────────────────────────────────
export const thead = 'bg-[#2D4033] text-white'
export const th    = 'text-center px-3 py-2 text-xs font-semibold'
export const thC   = 'text-center px-3 py-2 text-xs font-semibold'
export const thR   = 'text-right px-3 py-2 text-xs font-semibold'
export const tbody = 'divide-y divide-gray-100 dark:divide-gray-800'
export const tr    = 'hover:bg-[#f7f8f5] dark:hover:bg-gray-800/10 transition-colors'
export const td    = 'px-3 py-2 text-sm text-gray-600 dark:text-gray-400'

// ── Typography ───────────────────────────────────────────────────────────────
export const h2Cls   = 'text-lg font-bold text-gray-900 dark:text-white'
export const subText = 'text-xs text-gray-400 mt-0.5'
export const label   = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

// ── Form elements ────────────────────────────────────────────────────────────
/** Search input (has left icon → pl-9) */
export const searchInput = [
  'w-full pl-9 pr-3 py-2 text-sm',
  'border border-warm-300/70 dark:border-gray-700',
  'outline-none focus:border-[#2D4033]',
  'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
  'placeholder-gray-400',
].join(' ')

/** Generic form input (modal / inline edit) */
export const formInput = [
  'w-full px-3 py-2 text-sm',
  'border border-warm-300/70 dark:border-gray-700',
  'outline-none focus:border-[#2D4033]',
  'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
  'placeholder-gray-400',
].join(' ')

/** Select element */
export const selectCls = [
  'px-3 py-2 text-sm',
  'border border-warm-300/70 dark:border-gray-700',
  'outline-none focus:border-[#2D4033]',
  'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
].join(' ')

// ── Buttons ──────────────────────────────────────────────────────────────────
export const btnPrimary   = 'px-3 py-1.5 text-sm bg-brand-600 text-white rounded hover:bg-brand-700 transition-colors font-medium'
export const btnSecondary = 'px-3 py-1.5 text-sm border border-warm-300/70 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded hover:bg-warm-50 dark:hover:bg-gray-800 transition-colors'
export const btnDanger    = 'px-3 py-1.5 text-sm bg-rose-600 text-white rounded hover:bg-rose-700 transition-colors font-medium'
export const btnIcon       = 'p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
export const btnIconEdit   = 'p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors'
export const btnIconDelete = 'p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors'
export const btnIconPrint  = 'p-1 rounded hover:bg-[#f7f8f5] dark:hover:bg-gray-800 text-gray-400 hover:text-[#2D4033] dark:hover:text-emerald-400 transition-colors'

// ── Modal ────────────────────────────────────────────────────────────────────
export const modalOverlay = 'fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50'
export const modalBox     = 'bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 w-full max-w-sm p-4'
export const modalBoxMd   = 'bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 w-full max-w-md p-4'
