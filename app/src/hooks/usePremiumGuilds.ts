import { useEffect, useState } from "react"
import { getGuilds, getSubscriptionStatus } from "@/services/guilds"

// Ensemble des serveurs premium (Moddy Max), partagé entre composants.
// On combine deux sources fiables :
//   1. l'attribut PREMIUM exposé par GET /guilds (couvre les serveurs liés à
//      l'abonnement d'un autre utilisateur) ;
//   2. les serveurs liés à l'abonnement actif de l'utilisateur courant
//      (GET /stripe/subscription) — la source de vérité côté billing.
// Mise en cache au niveau module : une seule paire de requêtes quelle que soit
// le nombre de consommateurs (TeamSwitcher, GuildSelectionView, GuildContext…).

let cache: Set<string> | null = null
let inflight: Promise<Set<string>> | null = null

async function fetchPremiumIds(): Promise<Set<string>> {
  const ids = new Set<string>()
  const [guildsRes, subRes] = await Promise.allSettled([
    getGuilds(),
    getSubscriptionStatus(),
  ])
  if (guildsRes.status === "fulfilled") {
    for (const g of guildsRes.value) {
      if (g.attributes?.PREMIUM) ids.add(String(g.guild_id))
    }
  }
  if (subRes.status === "fulfilled" && subRes.value.is_active) {
    for (const s of subRes.value.servers) ids.add(String(s.server_id))
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
