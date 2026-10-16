import { useCallback, useEffect, useState } from 'react'
import { getAutomodPolicies } from '@/services/automod'
import type { AutomodPolicy } from '@/types/api'

interface PoliciesState {
  key: string | null
  policies: Record<string, AutomodPolicy> | null
}

/**
 * Politique effective par infraction (`GET .../policies`), défauts de Moddy
 * compris. Pas de cache : elle dépend de la config enregistrée (sévérité…),
 * `reload` la relit après une sauvegarde. Un échec est silencieux —
 * `policies` reste `null` et l'écran affiche un message de repli.
 */
export function useAutomodPolicies(guildId: string | number | null | undefined) {
  const key = guildId == null ? null : String(guildId)
  const [state, setState] = useState<PoliciesState>({ key: null, policies: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!key) return
    let cancelled = false
    getAutomodPolicies(key)
      .then((policies) => {
        if (!cancelled) setState({ key, policies })
      })
      .catch(() => {
        if (!cancelled) setState({ key, policies: null })
      })
    return () => {
      cancelled = true
    }
  }, [key, attempt])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  return { policies: state.key === key ? state.policies : null, reload }
}
