const COOKIE_NAME = 'moddy_preferences'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

export interface UserPreferences {
  language?: string // 'en' | 'fr' | undefined (auto)
}

export function getPreferences(): UserPreferences {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`))
  if (!match) return {}
  try {
    return JSON.parse(decodeURIComponent(match[1]))
  } catch {
    return {}
  }
}

export function setPreferences(updates: Partial<UserPreferences>): void {
  const current = getPreferences()
  const merged = { ...current, ...updates }

  // Remove undefined keys
  for (const key of Object.keys(merged) as (keyof UserPreferences)[]) {
    if (merged[key] === undefined) delete merged[key]
  }

  const value = encodeURIComponent(JSON.stringify(merged))
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

export function detectBrowserLanguage(supportedLanguages: string[], fallback: string): string {
  for (const lang of navigator.languages) {
    const short = lang.split('-')[0]
    if (supportedLanguages.includes(short)) return short
  }
  return fallback
}
