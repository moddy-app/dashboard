import { useCallback, useEffect, useState } from 'react'
import { logger } from '@/lib/logger'

export interface StatsResource<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  reload: () => void
}

/**
 * Lecture d'un endpoint de statistiques. Les écrans du panneau sont tous en
 * lecture seule et rechargent sur le même schéma (fenêtre de jours, filtres) :
 * ce hook évite d'en réécrire la mécanique — annulation comprise, sans quoi une
 * réponse lente d'une fenêtre abandonnée écraserait celle de la fenêtre courante.
 */
export function useStatsResource<T>(
  load: () => Promise<T>,
  deps: unknown[],
  options: { enabled?: boolean } = {}
): StatsResource<T> {
  const enabled = options.enabled ?? true
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    load()
      .then((result) => {
        if (cancelled) return
        setData(result)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        logger.error('stats', 'Load failed', e)
        setData(null)
        setError(e instanceof Error ? e.message : 'Unable to load statistics')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
    // `load` est recréé à chaque rendu par l'appelant : ce sont `deps` qui
    // décrivent vraiment la requête.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, attempt, ...deps])

  return { data, isLoading, error, reload }
}
