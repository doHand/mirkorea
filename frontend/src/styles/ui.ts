// Shared Tailwind class constants — import instead of repeating strings across pages.
// Usage: import { card, tableWrap, btnPrimary } from '@/styles/ui'

// ── Container / Card ────────────────────────────────────────────────────────
/** Card with overflow-hidden for tables */
export const tableWrap = 'wms-table-wrap'

/** Horizontal filter bar card */
export const filterCard = 'wms-filter-card'

// ── Table internals ─────────────────────────────────────────────────────────
export const thead = 'wms-table-header'
export const th    = 'text-center px-3 py-2 text-xs font-semibold'
export const thR   = 'text-right px-3 py-2 text-xs font-semibold'
export const tbody = 'wms-table-body'
export const tr    = 'wms-table-row'

// ── Typography ───────────────────────────────────────────────────────────────
export const h2Cls   = 'wms-heading'
export const subText = 'wms-subtext'
export const label   = 'wms-label'

// ── Form elements ────────────────────────────────────────────────────────────
/** Generic form input (modal / inline edit) */
export const formInput = 'wms-input'

/** Select element */
export const selectCls = 'wms-input'

// ── Buttons ──────────────────────────────────────────────────────────────────
export const btnPrimary   = 'wms-primary-button'
export const btnSecondary = 'wms-secondary-button'
export const btnDanger    = 'wms-danger-button'
export const btnIcon       = 'wms-icon-button'
export const btnIconDelete = 'wms-icon-button wms-icon-button-danger'

// ── Modal ────────────────────────────────────────────────────────────────────
export const modalOverlay = 'wms-modal-overlay'
export const modalBox     = 'wms-modal-box w-full max-w-sm'
export const modalBoxMd   = 'wms-modal-box w-full max-w-md'
