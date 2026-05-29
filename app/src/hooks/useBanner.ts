import { useState, useEffect } from 'react'
import { getActiveBanner, type Banner } from '@/services/banner'

const POLL_INTERVAL = 60_000

export function useBanner(showKey: 'show_dashboard' | 'show_website'): Banner | null {
  const [banner, setBanner] = useState<Banner | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchBanner() {
      const data = await getActiveBanner()
      if (!cancelled) {
        setBanner(data && data[showKey] ? data : null)
      }
    }

    fetchBanner()
    const interval = setInterval(fetchBanner, POLL_INTERVAL)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [showKey])

  return banner
}
