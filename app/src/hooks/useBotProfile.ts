import { useEffect, useState } from 'react'
import { getBotProfile } from '@/services/bot'
import { logger } from '@/lib/logger'
import type { BotProfile } from '@/types/api'

// Ressource globale (le profil du bot est le même pour tout le monde) : cache
// au niveau module, une seule requête par session, partagée entre consommateurs.

let cache: BotProfile | null = null
let inflight: Promise<BotProfile | null> | null = null

function load(): Promise<BotProfile | null> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = getBotProfile()
      .then((data) => {
        cache = data
        return data
      })
      .catch((e) => {
        // L'aperçu doit rester utilisable sans le profil global : on retombe
        // sur les valeurs de la guilde et sur les repls visuels.
        logger.warn('bot', 'Failed to load bot profile', e)
        return null
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/** Vide le cache (le backend le régénère au plus toutes les 5 min). */
export function invalidateBotProfile() {
  cache = null
  inflight = null
}

export interface BotProfileState {
  /** `null` tant que non chargé, ou si l'appel a échoué. */
  profile: BotProfile | null
  /** `true` seulement pendant le tout premier chargement de la session. */
  loading: boolean
}

/**
 * Profil global du bot. `loading` permet d'afficher un squelette plutôt que des
 * valeurs de repli qui sauteraient à l'arrivée des vraies données ; il repasse
 * à `false` même en cas d'échec, l'aperçu devant rester utilisable sans.
 */
export function useBotProfile(): BotProfileState {
  const [state, setState] = useState<BotProfileState>(() => ({
    profile: cache,
    loading: cache === null,
  }))

  useEffect(() => {
    if (cache) return
    let active = true
    load().then((profile) => {
      if (active) setState({ profile, loading: false })
    })
    return () => {
      active = false
    }
  }, [])

  return state
}
