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
  let response: Response

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
  } catch {
    throw new ApiError(0, 'Network error — check your connection')
  }

  if (!response.ok) {
    // 401 → session expirée → redirection login
    if (response.status === 401) {
      window.location.href = `${API_BASE}/auth/login`
      throw new ApiError(401, 'Unauthorized')
    }

    const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
    throw new ApiError(response.status, (error as { error: string }).error ?? `HTTP ${response.status}`)
  }

  const text = await response.text()
  return text ? JSON.parse(text) : null
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
    return await api('/auth/me') as User
  } catch (e) {
    if (e instanceof ApiError && e.isUnauthorized) return null
    throw e
  }
}

export function login() {
  window.location.href = `${API_BASE}/auth/login`
}

export async function logout(): Promise<boolean> {
  try {
    await api('/auth/logout', { method: 'POST' })
    return true
  } catch {
    return false
  }
}

export async function refreshSession(): Promise<void> {
  await api('/auth/refresh', { method: 'POST' })
}

export async function refreshGuilds(): Promise<Guild[]> {
  const data = await api('/auth/refresh-guilds', { method: 'POST' }) as { guilds: Guild[] }
  return data.guilds
}
