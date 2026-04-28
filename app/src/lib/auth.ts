import { logger } from '@/lib/logger'

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.moddy.app'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
  get isUnauthorized() { return this.status === 401 }
  get isForbidden() { return this.status === 403 }
  get isNotFound() { return this.status === 404 }
  get isServerError() { return this.status >= 500 }
  get isNetworkError() { return this.status === 0 }
}

export async function api(path: string, options: RequestInit = {}): Promise<unknown> {
  const method = (options.method ?? 'GET').toUpperCase()
  const url = `${API_BASE}${path}`
  const start = performance.now()
  logger.api('api', `→ ${method} ${path}`, options.body ? { body: options.body } : '')

  let response: Response

  try {
    response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options.headers },
    })
  } catch (e) {
    logger.error('api', `✗ ${method} ${path} — network error`, e)
    throw new ApiError(0, 'Network error — check your connection')
  }

  const duration = Math.round(performance.now() - start)

  if (!response.ok) {
    if (response.status === 401) {
      logger.warn('api', `← ${method} ${path} 401 ${duration}ms — redirecting to /auth/login`)
      window.location.href = `${API_BASE}/auth/login`
      throw new ApiError(401, 'Unauthorized')
    }
    const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
    const message = (error as { error: string }).error ?? `HTTP ${response.status}`
    logger.error('api', `← ${method} ${path} ${response.status} ${duration}ms`, message)
    throw new ApiError(response.status, message)
  }

  const text = await response.text()
  // Snowflakes Discord sont des entiers 64-bit (> 2^53) — JSON.parse les arrondirait.
  // La regex alterne : soit elle consomme un string literal entier (→ inchangé),
  // soit elle wrappe un grand entier nu (après :, [, ou ,) dans des quotes.
  const safe = text ? text.replace(
    /"(?:[^"\\]|\\.)*"|([:\[,]\s*)(-?\d{15,})/g,
    (match, prefix, digits) => prefix !== undefined ? `${prefix}"${digits}"` : match
  ) : text
  const parsed = safe ? JSON.parse(safe) : null
  logger.success('api', `← ${method} ${path} ${response.status} ${duration}ms`, parsed)
  return parsed
}

// ─── Types basés sur la vraie réponse de /auth/me ─────────────────────────────

/** Serveur Discord (depuis /auth/me et /auth/refresh-guilds) */
export interface Guild {
  id: number | string  // Snowflake Discord — peut être number ou string selon l'endpoint
  name: string
  icon: string | null
}

/** Profil complet de l'utilisateur connecté (GET /auth/me) */
export interface User {
  // Identité Discord
  user_id: string            // Snowflake string
  username: string           // Nom unique Discord
  global_name: string | null // Nom d'affichage (peut différer du username)
  discriminator?: string     // "0" sur les nouveaux comptes
  avatar: string | null      // Hash avatar
  avatar_url: string | null  // URL CDN complète pré-construite par le backend
  banner: string | null      // Hash bannière
  banner_url: string | null  // URL CDN bannière
  accent_color: number | null
  avatar_decoration_data?: { asset: string; sku_id: string } | null
  // Compte
  email: string | null
  verified: boolean | null
  locale: string | null
  mfa_enabled: boolean | null
  premium_type: number | null  // 0=Aucun, 1=Classic, 2=Nitro, 3=Basic
  public_flags: number | null
  flags: number | null
  discord_badges: string[]     // Noms lisibles des flags actifs
  // Moddy
  guilds: Guild[]
  is_staff: boolean
  staff_roles: string[]
}

// ─── Helpers URL ──────────────────────────────────────────────────────────────

export function getAvatarUrl(userId: string, avatarHash: string | null, avatarUrl?: string | null): string {
  // Utilise l'URL pré-construite par le backend si disponible
  if (avatarUrl) return avatarUrl
  if (!avatarHash) {
    const defaultIndex = (BigInt(userId) >> 22n) % 6n
    return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`
  }
  const ext = avatarHash.startsWith('a_') ? 'gif' : 'png'
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}?size=128`
}

export function getGuildIconUrl(guildId: number | string, iconHash: string | null): string | null {
  if (!iconHash) return null
  const ext = iconHash.startsWith('a_') ? 'gif' : 'png'
  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${ext}?size=128`
}

/** Nom d'affichage — préfère global_name, sinon username */
export function getDisplayName(user: User): string {
  return user.global_name ?? user.username
}

/** Description du niveau Nitro */
export function getNitroLabel(premiumType: number | null | undefined): string | null {
  switch (premiumType) {
    case 1: return 'Nitro Classic'
    case 2: return 'Nitro'
    case 3: return 'Nitro Basic'
    default: return null
  }
}

// ─── Appels API auth ──────────────────────────────────────────────────────────

export async function getMe(): Promise<User | null> {
  try {
    const user = await api('/auth/me') as User
    logger.success('auth', `Logged in as @${user.username} (${user.user_id})`, { guilds: user.guilds.length, is_staff: user.is_staff })
    return user
  } catch (e) {
    if (e instanceof ApiError && e.isUnauthorized) {
      logger.warn('auth', 'No active session')
      return null
    }
    throw e
  }
}

export function login() {
  logger.event('auth', 'Redirecting to Discord login')
  window.location.href = `${API_BASE}/auth/login`
}

export async function logout(): Promise<boolean> {
  logger.event('auth', 'Logout requested')
  try {
    await api('/auth/logout', { method: 'POST' })
    logger.success('auth', 'Logged out')
    return true
  } catch (e) {
    logger.error('auth', 'Logout failed', e)
    return false
  }
}

export async function refreshSession(): Promise<void> {
  await api('/auth/refresh', { method: 'POST' })
}

export async function refreshGuilds(): Promise<Guild[]> {
  logger.event('auth', 'Refreshing guild list from Discord')
  const data = await api('/auth/refresh-guilds', { method: 'POST' }) as { guilds: Guild[] }
  logger.success('auth', `Refreshed ${data.guilds.length} guilds`)
  return data.guilds
}
