import { useMemo } from "react"
import { useSubscription, invalidateSubscription } from "@/hooks/useSubscription"

// Ensemble des serveurs premium (Moddy Max), dérivé de l'abonnement actif de
// l'utilisateur (cf. API_ENDPOINTS.md → GET /stripe/subscription → servers[]).
// On ne se base PAS sur l'attribut PREMIUM de la guilde.

/** Vide le cache premium (à appeler après un changement d'abonnement). */
export const invalidatePremiumGuilds = invalidateSubscription

/** Retourne l'ensemble des IDs de serveurs liés à l'abonnement Max actif. */
export function usePremiumGuilds(): Set<string> {
  const sub = useSubscription()
  return useMemo(() => {
    const ids = new Set<string>()
    if (sub?.is_active) {
      for (const s of sub.servers) ids.add(String(s.server_id))
    }
    return ids
  }, [sub])
}
