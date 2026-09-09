import { useCallback, useEffect, useState } from 'react'
import { logger } from '@/lib/logger'
import { getStatsCatalog } from '@/services/stats'
import type { StatsCatalog } from '@/types/stats'

/**
 * Catalogue des métriques — la source de vérité des écrans de statistiques :
 * quelle métrique propose quel filtre, laquelle se somme, laquelle est
 * approximative. Rien n'est codé en dur à partir de lui.
 *
 * Mis en cache pour la session (il est identique d'un écran à l'autre), mais
 * **un échec n'est jamais mis en cache** : un 403 transitoire ou une coupure
 * réseau rendrait sinon le panneau inutilisable jusqu'au rechargement.
 */
let cached: StatsCatalog | null = null
let inflight: Promise<StatsCatalog> | null = null

async function loadCatalog(): Promise<StatsCatalog> {
  if (cached) return cached
  if (!inflight) {
    inflight = getStatsCatalog()
      .then((catalog) => {
        cached = catalog
        return catalog
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

export interface UseStatsCatalog {
  catalog: StatsCatalog | null
  isLoading: boolean
  error: string | null
  reload: () => void
}

export function useStatsCatalog(): UseStatsCatalog {
  const [catalog, setCatalog] = useState<StatsCatalog | null>(cached)
  const [isLoading, setIsLoading] = useState(cached === null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const reload = useCallback(() => {
    cached = null
    // `isLoading` est posé ici plutôt que dans l'effet : un `setState`
    // synchrone dans un effet déclenche un rendu en cascade.
    setIsLoading(true)
    setError(null)
    setAttempt((n) => n + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    // `loadCatalog()` répond immédiatement quand le catalogue est déjà en cache :
    // pas besoin d'un chemin synchrone séparé, qui serait un rendu de plus.
    loadCatalog()
      .then((result) => {
        if (cancelled) return
        setCatalog(result)
        setError(null)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        logger.error('stats', 'Catalog load failed', e)
        setError(e instanceof Error ? e.message : 'Catalog unavailable')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  return { catalog, isLoading, error, reload }
}
