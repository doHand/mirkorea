export function formatNumber(n: number | string | undefined | null) {
  if (n == null) return '-'
  const value = typeof n === 'string' ? Number(n) : n
  if (!Number.isFinite(value)) return '-'
  return value.toLocaleString('ko-KR')
}

export function formatDecimal(n: number | string | undefined | null, maximumFractionDigits = 2) {
  if (n == null) return '-'
  const value = typeof n === 'string' ? Number(n) : n
  if (!Number.isFinite(value)) return '-'
  return value.toLocaleString('ko-KR', { maximumFractionDigits })
}

export function formatDate(iso: string | undefined | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
}

export function formatDateTime(iso: string | undefined | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatQtyDelta(qty: number) {
  return qty >= 0 ? `+${formatNumber(qty)}` : formatNumber(qty)
}
