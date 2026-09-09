/**
 * `GET /ai/status` — disponibilité de Brocoli et quota du jour.
 *
 * Appelé au chargement du dashboard : `enabled: false` **masque complètement**
 * l'entrée Brocoli. Un bouton qui répond `503` est pire que pas de bouton.
 *
 * Le résultat est mis en cache pour la session et partagé entre les abonnés :
 * la sidebar, le menu de commandes et la page consomment le même objet, et un
 * rafraîchissement (après un tour, qui consomme du quota) les met tous à jour
 * d'un coup.
 */

import { useCallback, useEffect, useState } from 'react'
import { getAiStatus } from '@/services/ai'
import { logger } from '@/lib/logger'
import type { AiStatus } from '@/types/ai'

let cache: AiStatus | null = null
let inflight: Promise<AiStatus | null> | null = null
const subscribers = new Set<(status: AiStatus | null) => void>()

function publish(status: AiStatus | null): void {
  cache = status
  subscribers.forEach((notify) => notify(status))
}

async function load(): Promise<AiStatus | null> {
  if (inflight) return inflight
  inflight = getAiStatus()
    .then((status) => {
      publish(status)
      return status
    })
    .catch((e) => {
      // Échec silencieux : cet endpoint répond toujours en temps normal, donc
      // un échec est un problème de transport. On traite l'assistant comme
      // indisponible plutôt que d'afficher une entrée qui mènerait à une
      // erreur — mais sans mettre l'échec en cache, pour laisser une seconde
      // chance à la prochaine tentative.
      logger.warn('brocoli', 'GET /ai/status a échoué — assistant traité comme indisponible', e)
      return null
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

export interface AiStatusState {
  status: AiStatus | null
  loading: boolean
  /** `true` seulement quand le backend l'affirme — jamais par défaut. */
  enabled: boolean
  refresh: () => Promise<void>
}

export function useAiStatus(): AiStatusState {
  const [status, setStatus] = useState<AiStatus | null>(cache)
  const [loading, setLoading] = useState(cache === null)

  useEffect(() => {
    subscribers.add(setStatus)
    return () => {
      subscribers.delete(setStatus)
    }
  }, [])

  useEffect(() => {
    if (cache) return
    let active = true
    load().then(() => {
      if (active) setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  /** Relit le statut — surtout le quota, qui bouge à chaque tour. */
  const refresh = useCallback(async () => {
    // Court-circuite le cache : `load()` ne rappellerait pas le backend.
    try {
      publish(await getAiStatus())
    } catch (e) {
      logger.warn('brocoli', 'Rafraîchissement de /ai/status impossible', e)
    }
  }, [])

  return { status, loading, enabled: status?.enabled === true, refresh }
}
