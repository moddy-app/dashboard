import { useState, useEffect } from 'react'
import { getStatusBanner, type StatusBanner } from '@/services/status-banner'

const POLL_INTERVAL = 60_000

/**
 * `null` quand tout est opérationnel — le payload le confirme (`message`
 * vide dans ce cas), donc c'est ce champ qui décide, pas `level`.
 */
export function useStatusBanner(): StatusBanner | null {
  const [status, setStatus] = useState<StatusBanner | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchStatus() {
      const data = await getStatusBanner()
      if (!cancelled) {
        setStatus(data && data.message ? data : null)
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, POLL_INTERVAL)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return status
}
