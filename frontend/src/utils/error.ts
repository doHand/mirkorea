export function getApiErrorMessage(err: unknown, fallback = '오류가 발생했습니다'): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message
    if (msg) return msg
  }
  return fallback
}
