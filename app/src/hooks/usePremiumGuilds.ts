import { useEffect, useState } from "react"
import { getGuilds } from "@/services/guilds"

// Ensemble des serveurs premium (attribut PREMIUM), partagé entre composants.
// Mise en cache au niveau module : une seule requête /guilds quelle que soit le
// nombre de consommateurs (TeamSwitcher, GuildSelectionView…).

let cache: Set<string> | null = null
let inflight: Promise<Set<string>> | null = null

function load(): Promise<Set<string>> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = getGuilds()
      .then((list) => {
        cache = new Set(
          list.filter((g) => g.attributes?.PREMIUM).map((g) => String(g.guild_id))
        )
        return cache
      })
      .catch(() => new Set<string>())
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/** Retourne l'ensemble des IDs de serveurs premium (Moddy Max). */
export function usePremiumGuilds(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(cache ?? new Set())
  useEffect(() => {
    let active = true
    load().then((s) => {
      if (active) setIds(s)
    })
    return () => {
      active = false
    }
  }, [])
  return ids
}
