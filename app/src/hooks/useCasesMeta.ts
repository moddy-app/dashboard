import { useEffect, useState } from 'react'
import { getCasesMeta } from '@/services/cases'
import type { CasesMeta } from '@/types/cases'
import { logger } from '@/lib/logger'

/** Charge (et cache) la meta des cases — source de vérité des formulaires. */
export function useCasesMeta(): { meta: CasesMeta | null; loading: boolean; error: boolean } {
  const [meta, setMeta] = useState<CasesMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    getCasesMeta()
      .then((m) => active && (setMeta(m), setLoading(false)))
      .catch((e) => {
        logger.warn('cases', 'Failed to load cases meta', e)
        if (active) {
          setError(true)
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [])

  return { meta, loading, error }
}
