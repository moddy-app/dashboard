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

/** Profil global du bot — `null` tant qu'il n'est pas chargé, ou en cas d'échec. */
export function useBotProfile(): BotProfile | null {
  const [data, setData] = useState<BotProfile | null>(cache)

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
