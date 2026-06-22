import { useEffect, useState } from "react"
import { getSubscriptionStatus } from "@/services/guilds"
import type { SubscriptionData } from "@/types/api"

// Abonnement de l'utilisateur courant (GET /stripe/subscription), mis en cache au
// niveau module et partagé entre tous les consommateurs (premium, badge Max,
// gestion d'abonnement dans la sidebar…). Une seule requête.

let cache: SubscriptionData | null = null
let inflight: Promise<SubscriptionData | null> | null = null

function load(): Promise<SubscriptionData | null> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = getSubscriptionStatus()
      .then((data) => {
        cache = data
        return data
      })
      .catch(() => null)
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/** Vide le cache (après un changement d'abonnement / lien de serveur). */
export function invalidateSubscription() {
  cache = null
  inflight = null
}

/** Retourne l'abonnement de l'utilisateur (null tant que non chargé / absent). */
export function useSubscription(): SubscriptionData | null {
  const [data, setData] = useState<SubscriptionData | null>(cache)
  useEffect(() => {
    let active = true
    load().then((d) => {
      if (active) setData(d)
    })
    return () => {
      active = false
    }
  }, [])
  return data
}
