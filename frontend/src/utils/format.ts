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

export function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (!digits) return ''

  if (digits.startsWith('02')) {
    if (digits.length <= 2) return digits
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`
  }

  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

export function formatBusinessNoInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
}
