import { useEffect, useReducer } from 'react'
import { getEmojis } from '@/services/guilds'
import type { GuildEmoji } from '@/types/api'

// Émojis personnalisés d'un serveur (`GET /guilds/{id}/emojis`).
//
// Le cache est volontairement module-scope : plusieurs champs d'un même écran
// (une ligne de catégorie, un sélecteur ouvert, l'éditeur de message) demandent
// la même liste, et la route est déjà mise en cache 5 min côté backend — une
// requête par serveur et par session suffit ici.

const cache = new Map<string, GuildEmoji[]>()
const inFlight = new Map<string, Promise<GuildEmoji[]>>()

function load(guildId: string): Promise<GuildEmoji[]> {
  const pending = inFlight.get(guildId)
  if (pending) return pending

  // Un échec n'est jamais mis en cache : la liste n'est pas critique (le champ
  // reste saisissable), mais une erreur réseau ne doit pas figer un « aucun
  // émoji » pour toute la session.
  const promise = getEmojis(guildId)
    .then((emojis) => {
      const list = emojis ?? []
      cache.set(guildId, list)
      return list
    })
    .catch(() => [] as GuildEmoji[])
    .finally(() => inFlight.delete(guildId))

  inFlight.set(guildId, promise)
  return promise
}

export interface GuildEmojisState {
  emojis: GuildEmoji[]
  isLoading: boolean
}

const EMPTY: GuildEmoji[] = []

export function useGuildEmojis(guildId: string | null | undefined): GuildEmojisState {
  const key = guildId ? String(guildId) : null
  // Le cache est la source de vérité : l'état local ne sert qu'à redemander un
  // rendu quand la requête revient.
  const [, rerender] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    if (!key || cache.has(key)) return
    let active = true
    load(key).then(() => active && rerender())
    return () => {
      active = false
    }
  }, [key])

  const cached = key ? cache.get(key) : undefined
  return { emojis: cached ?? EMPTY, isLoading: Boolean(key) && cached === undefined }
}
