const SESSION_EXPIRY_KEY = 'wms-session-expiry'

export const SESSION_MINUTES = 30

export function getSessionExpiry(minutes = SESSION_MINUTES) {
  return Date.now() + minutes * 60 * 1000
}

export function saveSessionExpiry(sessionExpiresAt = getSessionExpiry()) {
  if (typeof window === 'undefined') return sessionExpiresAt
  localStorage.setItem(SESSION_EXPIRY_KEY, String(sessionExpiresAt))
  return sessionExpiresAt
}

export function clearSessionExpiry() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SESSION_EXPIRY_KEY)
}
