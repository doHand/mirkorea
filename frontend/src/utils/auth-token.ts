const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'
const SESSION_EXPIRY_KEY = 'wms-session-expiry'

export const SESSION_MINUTES = 30

export function getSessionExpiry(minutes = SESSION_MINUTES) {
  return Date.now() + minutes * 60 * 1000
}

export function getAccessToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function saveAuthTokens(accessToken: string, refreshToken: string, sessionExpiresAt = getSessionExpiry()) {
  if (typeof window === 'undefined') return
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  localStorage.setItem(SESSION_EXPIRY_KEY, String(sessionExpiresAt))
}

export function saveSessionExpiry(sessionExpiresAt = getSessionExpiry()) {
  if (typeof window === 'undefined') return sessionExpiresAt
  localStorage.setItem(SESSION_EXPIRY_KEY, String(sessionExpiresAt))
  return sessionExpiresAt
}

export function clearAuthTokens() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(SESSION_EXPIRY_KEY)
}
