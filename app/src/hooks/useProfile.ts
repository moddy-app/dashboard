import { useEffect, useState } from 'react'
import {
  getUserProfile,
  getGuildProfile,
  getPublicUser,
  getPublicGuild,
} from '@/services/cases'
import type { DiscordUserProfile, DiscordGuildProfile } from '@/types/cases'
import { logger } from '@/lib/logger'
import { ApiError } from '@/lib/auth'

// Cache module-level partagé entre tous les composants — un ID donné n'est
// résolu qu'une seule fois par session (le back-end cache déjà 5 min côté Redis).

const userCache = new Map<string, Promise<DiscordUserProfile>>()
const guildCache = new Map<string, Promise<DiscordGuildProfile>>()

// Le profil enrichi d'abord (il porte le statut Moddy), l'identité publique en
// repli : sous sanction, `/users/{id}/profile` et `/guilds/{id}/profile` sont
// refusés alors que `GET /users/{id}` (public) et `GET /guilds/{id}` répondent
// encore. Sans ce repli, un compte suspendu ne voit que des snowflakes.

// `GET /users/{id}` partage un budget global d'appels Discord : au-delà, `429`
// avec `Retry-After` (~60 s). On attend le délai et on réessaie une fois — le
// profil reste « en chargement » plutôt que de basculer sur un snowflake nu.
// Un `404` est mis en cache 10 min par le backend : il est gardé ici aussi
// (pas de nouvel essai dans la session), réessayer ne changerait rien.

const RATE_LIMIT_FALLBACK_S = 60

function wait(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
}

async function loadPublicUser(id: string): Promise<DiscordUserProfile> {
  try {
    return await getPublicUser(id)
  } catch (e) {
    if (!(e instanceof ApiError) || !e.isRateLimited) throw e
    await wait(e.retryAfter ?? RATE_LIMIT_FALLBACK_S)
    return getPublicUser(id)
  }
}

function loadUser(id: string): Promise<DiscordUserProfile> {
  let p = userCache.get(id)
  if (!p) {
    p = getUserProfile(id)
      .catch(() => loadPublicUser(id))
      .catch((e) => {
        // autorise un nouvel essai plus tard, sauf sur un utilisateur inexistant
        if (!(e instanceof ApiError) || !e.isNotFound) userCache.delete(id)
        throw e
      })
    userCache.set(id, p)
  }
  return p
}

function loadGuild(id: string): Promise<DiscordGuildProfile> {
  let p = guildCache.get(id)
  if (!p) {
    p = getGuildProfile(id)
      .catch(() => getPublicGuild(id))
      .catch((e) => {
        guildCache.delete(id)
        throw e
      })
    guildCache.set(id, p)
  }
  return p
}

export interface ProfileState<T> {
  data: T | null
  loading: boolean
  error: boolean
}

// L'état porte l'`id` résolu : tant qu'il ne correspond pas à l'`id` demandé,
// on renvoie un état « chargement » dérivé — évite tout setState synchrone dans
// l'effet (les setState ne se produisent que dans les callbacks async).

export function useUserProfile(id: string | null | undefined): ProfileState<DiscordUserProfile> {
  const [state, setState] = useState<ProfileState<DiscordUserProfile> & { id: string | null | undefined }>({
    id,
    data: null,
    loading: !!id,
    error: false,
  })

  useEffect(() => {
    if (!id) return
    let active = true
    loadUser(id)
      .then((data) => active && setState({ id, data, loading: false, error: false }))
      .catch((e) => {
        logger.warn('profile', `Failed to load user profile ${id}`, e)
        if (active) setState({ id, data: null, loading: false, error: true })
      })
    return () => {
      active = false
    }
  }, [id])

  return state.id === id ? state : { data: null, loading: !!id, error: false }
}

export function useGuildProfile(id: string | null | undefined): ProfileState<DiscordGuildProfile> {
  const [state, setState] = useState<ProfileState<DiscordGuildProfile> & { id: string | null | undefined }>({
    id,
    data: null,
    loading: !!id,
    error: false,
  })

  useEffect(() => {
    if (!id) return
    let active = true
    loadGuild(id)
      .then((data) => active && setState({ id, data, loading: false, error: false }))
      .catch((e) => {
        logger.warn('profile', `Failed to load guild profile ${id}`, e)
        if (active) setState({ id, data: null, loading: false, error: true })
      })
    return () => {
      active = false
    }
  }, [id])

  return state.id === id ? state : { data: null, loading: !!id, error: false }
}
