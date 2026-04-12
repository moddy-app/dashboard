const API_BASE = import.meta.env.VITE_API_URL || 'https://api.moddy.app'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
  get isUnauthorized() { return this.status === 401 }
  get isForbidden() { return this.status === 403 }
  get isNotFound() { return this.status === 404 }
  get isServerError() { return this.status >= 500 }
}

export async function api(path: string, options: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new ApiError(response.status, (error as { error: string }).error)
  }

  const text = await response.text()
  return text ? JSON.parse(text) : null
}

export interface Guild {
  id: number
  name: string
  icon: string | null
}

export interface User {
  user_id: string
  username: string
  avatar: string | null
  guilds: Guild[]
  is_staff: boolean
  staff_roles: string[]
}

export function getAvatarUrl(userId: string, avatarHash: string | null): string {
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

/**
 * Récupère les infos de l'utilisateur connecté. Retourne null si 401.
 */
export async function getMe(): Promise<User | null> {
  try {
    return await api('/auth/me') as User
  } catch (e) {
    if (e instanceof ApiError && e.isUnauthorized) return null
    throw e
  }
}

/**
 * Redirige vers Discord OAuth2
 */
export function login() {
  window.location.href = `${API_BASE}/auth/login`
}

/**
 * Déconnecte l'utilisateur
 */
export async function logout(): Promise<boolean> {
  try {
    await api('/auth/logout', { method: 'POST' })
    return true
  } catch {
    return false
  }
}

/**
 * Maintient la session active (appeler toutes les 24h)
 */
export async function refreshSession(): Promise<void> {
  await api('/auth/refresh', { method: 'POST' })
}

/**
 * Rafraîchit la liste des serveurs de l'utilisateur
 */
export async function refreshGuilds(): Promise<Guild[]> {
  const data = await api('/auth/refresh-guilds', { method: 'POST' }) as { guilds: Guild[] }
  return data.guilds
}
