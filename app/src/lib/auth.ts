import { generateSignature, generateRequestId } from './hmac'

const API_URL = import.meta.env.VITE_API_URL || ''
const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || ''
const REDIRECT_URI = `${API_URL}/auth/discord/callback`

export interface User {
  discord_id: number
  email: string | null
}

export interface VerifyResponse {
  valid: boolean
  discord_id?: number
  email?: string | null
}

export interface UserInfo {
  id: string
  username: string
  discriminator: string
  avatar: string | null
  email: string | null
  verified: boolean | null
  locale: string | null
  mfa_enabled: boolean | null
  premium_type: number | null
  public_flags: number | null
  avatar_url: string | null
}

/**
 * Vérifie si l'utilisateur est connecté
 */
export async function verifySession(): Promise<VerifyResponse> {
  try {
    const response = await fetch(`${API_URL}/auth/verify`, {
      credentials: 'include', // Important: envoie les cookies
    })

    if (!response.ok) {
      console.error('Failed to verify session:', response.status)
      return { valid: false }
    }

    const data: VerifyResponse = await response.json()
    return data
  } catch (error) {
    console.error('Error verifying session:', error)
    return { valid: false }
  }
}

/**
 * Démarre le flow d'authentification Discord
 */
export async function signInWithDiscord() {
  try {
    // 1. Initialiser l'auth et obtenir le state
    const requestId = generateRequestId()
    const body = {
      current_page: window.location.href,
    }
    const signature = await generateSignature(requestId, body)

    const response = await fetch(`${API_URL}/api/website/auth/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
        'X-Signature': signature,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Failed to initialize auth: ${response.status}`)
    }

    const { state } = await response.json()

    // 2. Construire l'URL Discord OAuth
    const discordUrl = new URL('https://discord.com/api/oauth2/authorize')
    discordUrl.searchParams.set('client_id', DISCORD_CLIENT_ID)
    discordUrl.searchParams.set('redirect_uri', REDIRECT_URI)
    discordUrl.searchParams.set('response_type', 'code')
    discordUrl.searchParams.set('scope', 'identify email')
    discordUrl.searchParams.set('state', state)

    // 3. Rediriger vers Discord
    window.location.href = discordUrl.toString()
  } catch (error) {
    console.error('Error signing in with Discord:', error)
    throw error
  }
}

/**
 * Déconnecte l'utilisateur
 */
export async function logout(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/auth/logout`, {
      credentials: 'include', // Important: envoie les cookies
    })

    if (!response.ok) {
      console.error('Failed to logout:', response.status)
      return false
    }

    const data = await response.json()
    return data.success === true
  } catch (error) {
    console.error('Error logging out:', error)
    return false
  }
}

/**
 * Récupère les informations complètes de l'utilisateur depuis Discord
 */
export async function getUserInfo(): Promise<UserInfo | null> {
  try {
    const response = await fetch(`${API_URL}/auth/user-info`, {
      credentials: 'include',
    })

    if (response.status === 401) {
      // Session invalide ou refresh token révoqué
      console.log('Session expired or invalid')
      return null
    }

    if (!response.ok) {
      console.error('Failed to get user info:', response.status)
      return null
    }

    const userInfo: UserInfo = await response.json()
    return userInfo
  } catch (error) {
    console.error('Error getting user info:', error)
    return null
  }
}
