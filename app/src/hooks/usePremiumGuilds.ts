import { useEffect, useState } from "react"
import { getSubscriptionStatus } from "@/services/guilds"

// Ensemble des serveurs premium (Moddy Max), partagé entre composants.
// Source de vérité (cf. API_ENDPOINTS.md → GET /stripe/subscription) : les
// serveurs liés à l'abonnement actif de l'utilisateur (`servers[]`). On ne se
// base PAS sur l'attribut PREMIUM de la guilde.
// Mise en cache au niveau module : une seule requête quelle que soit le nombre
// de consommateurs (TeamSwitcher, GuildSelectionView, GuildContext…).

let cache: Set<string> | null = null
let inflight: Promise<Set<string>> | null = null

async function fetchPremiumIds(): Promise<Set<string>> {
  const ids = new Set<string>()
  const sub = await getSubscriptionStatus()
  if (sub.is_active) {
    for (const s of sub.servers) ids.add(String(s.server_id))
  }
  return ids
}

function load(): Promise<Set<string>> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = fetchPremiumIds()
      .then((ids) => {
        cache = ids
        return ids
      })
      .catch(() => new Set<string>())
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/** Vide le cache premium (à appeler après un changement d'abonnement). */
export function invalidatePremiumGuilds() {
  cache = null
  inflight = null
}

/** Retourne l'ensemble des IDs de serveurs liés à l'abonnement Max actif. */
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
