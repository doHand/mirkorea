// Shared Tailwind class constants — import instead of repeating strings across pages.
// Usage: import { card, tableWrap, btnPrimary } from '@/styles/ui'

// ── Container / Card ────────────────────────────────────────────────────────
export const card     = 'bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm'
export const cardFlat = 'bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800'

/** Card with overflow-hidden for tables */
export const tableWrap = 'bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm'

/** Horizontal filter bar card */
export const filterCard = 'bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-3 flex gap-2.5 shadow-sm'

// ── Table internals ─────────────────────────────────────────────────────────
export const thead = 'bg-gray-50/80 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700'
export const th    = 'text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide'
export const thC   = 'text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide'
export const thR   = 'text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide'
export const tbody = 'divide-y divide-gray-100 dark:divide-gray-800'
export const tr    = 'hover:bg-gray-50/30 dark:hover:bg-gray-800/10 transition-colors'
export const td    = 'px-4 py-3 text-sm text-gray-600 dark:text-gray-400'

// ── Typography ───────────────────────────────────────────────────────────────
export const h2Cls   = 'text-lg font-bold text-gray-900 dark:text-white'
export const subText = 'text-xs text-gray-400 mt-0.5'
export const label   = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

// ── Form elements ────────────────────────────────────────────────────────────
/** Search input (has left icon → pl-9) */
export const searchInput = [
  'w-full pl-9 pr-3 py-2 text-sm',
  'border border-gray-200 dark:border-gray-700 rounded-xl',
  'focus:outline-none focus:ring-2 focus:ring-indigo-500/40',
  'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
  'placeholder-gray-400 transition-shadow',
].join(' ')

/** Generic form input (modal / inline edit) */
export const formInput = [
  'w-full px-3 py-2 text-sm',
  'border border-gray-200 dark:border-gray-700 rounded-xl',
  'focus:outline-none focus:ring-2 focus:ring-indigo-500/40',
  'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
  'placeholder-gray-400',
].join(' ')

/** Select element */
export const selectCls = [
  'px-3 py-2 text-sm',
  'border border-gray-200 dark:border-gray-700 rounded-xl',
  'focus:outline-none focus:ring-2 focus:ring-indigo-500/40',
  'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
].join(' ')

// ── Buttons ──────────────────────────────────────────────────────────────────
export const btnPrimary   = 'px-3.5 py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium'
export const btnSecondary = 'px-3.5 py-2 text-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
export const btnDanger    = 'px-3.5 py-2 text-sm bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors font-medium'
export const btnIcon      = 'p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'

// ── Modal ────────────────────────────────────────────────────────────────────
export const modalOverlay = 'fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50'
export const modalBox     = 'bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm p-6'
export const modalBoxMd   = 'bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md p-6'
