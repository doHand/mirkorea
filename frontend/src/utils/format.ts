export function formatNumber(n: number | undefined | null) {
  if (n == null) return '-'
  return n.toLocaleString('ko-KR')
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
