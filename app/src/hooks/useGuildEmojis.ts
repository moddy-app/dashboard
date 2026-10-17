import { useEffect, useState } from 'react'
import { getEmojis } from '@/services/guilds'
import type { GuildEmoji } from '@/types/api'

// Cache module : les émojis d'un serveur changent rarement et le backend les
// garde 5 min. Une promesse en vol est partagée ; un échec n'est jamais gardé.
const cache = new Map<string, GuildEmoji[]>()
const inflight = new Map<string, Promise<GuildEmoji[]>>()

function load(guildId: string): Promise<GuildEmoji[]> {
  const pending = inflight.get(guildId)
  if (pending) return pending
  const p = getEmojis(guildId)
    .then((list) => {
      const emojis = Array.isArray(list) ? list : []
      cache.set(guildId, emojis)
      return emojis
    })
    .finally(() => inflight.delete(guildId))
  inflight.set(guildId, p)
  return p
}

/**
 * Émojis personnalisés d'un serveur, chargés **paresseusement** : rien n'est
 * demandé tant que `enabled` est faux (ex. le popover est fermé).
 */
export function useGuildEmojis(guildId: string | null | undefined, enabled = true) {
  const [, setTick] = useState(0)
  const [error, setError] = useState(false)
  const cached = guildId ? cache.get(guildId) : undefined

  useEffect(() => {
    if (!guildId || !enabled || cache.has(guildId)) return
    let cancelled = false
    load(guildId)
      .then(() => !cancelled && setTick((n) => n + 1))
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [guildId, enabled])

  return {
    emojis: cached ?? [],
    loading: Boolean(guildId) && enabled && !cached && !error,
    error,
  }
}
