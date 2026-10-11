import { useCallback, useEffect, useState } from 'react'
import { getAutomodCatalog } from '@/services/automod'
import type { AutomodCatalog } from '@/types/api'

interface CatalogState {
  /** Serveur pour lequel l'état est valable (évite d'afficher le catalogue d'un autre). */
  key: string | null
  catalog: AutomodCatalog | null
  error: string | null
}

/**
 * Catalogue du module `automod_ai`. Mis en cache par serveur dans le service ;
 * un échec n'est jamais mis en cache, `retry` relance donc un vrai appel.
 */
export function useAutomodCatalog(guildId: string | number | null | undefined) {
  const key = guildId == null ? null : String(guildId)
  const [state, setState] = useState<CatalogState>({ key: null, catalog: null, error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!key) return
    let cancelled = false
    getAutomodCatalog(key)
      .then((catalog) => {
        if (!cancelled) setState({ key, catalog, error: null })
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setState({ key, catalog: null, error: e instanceof Error ? e.message : 'Catalog unavailable' })
      })
    return () => {
      cancelled = true
    }
  }, [key, attempt])

  const retry = useCallback(() => {
    setState({ key: null, catalog: null, error: null })
    setAttempt((n) => n + 1)
  }, [])

  const current = state.key === key
  return {
    catalog: current ? state.catalog : null,
    loading: key !== null && !(current && (state.catalog || state.error)),
    error: current ? state.error : null,
    retry,
  }
}
