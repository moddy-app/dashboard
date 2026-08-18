import { useEffect, useState } from 'react'
import {
  getUserProfile,
  getGuildProfile,
  getPublicUser,
  getPublicGuild,
} from '@/services/cases'
import type { DiscordUserProfile, DiscordGuildProfile } from '@/types/cases'
import { logger } from '@/lib/logger'

// Cache module-level partagé entre tous les composants — un ID donné n'est
// résolu qu'une seule fois par session (le back-end cache déjà 5 min côté Redis).

const userCache = new Map<string, Promise<DiscordUserProfile>>()
const guildCache = new Map<string, Promise<DiscordGuildProfile>>()

// Le profil enrichi d'abord (il porte le statut Moddy), l'identité publique en
// repli : sous sanction, `/users/{id}/profile` et `/guilds/{id}/profile` sont
// refusés alors que `GET /users/{id}` (public) et `GET /guilds/{id}` répondent
// encore. Sans ce repli, un compte suspendu ne voit que des snowflakes.

function loadUser(id: string): Promise<DiscordUserProfile> {
  let p = userCache.get(id)
  if (!p) {
    p = getUserProfile(id)
      .catch(() => getPublicUser(id))
      .catch((e) => {
        userCache.delete(id) // autorise un nouvel essai plus tard
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
