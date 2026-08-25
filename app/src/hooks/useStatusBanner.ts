import { useEffect, useState } from "react"

import { fetchStatusBanner, type StatusBanner } from "@/lib/statusBanner"

const POLL_INTERVAL_MS = 60_000

/**
 * Polls the status banner API. Keeps the last known banner on a transient
 * fetch failure instead of clearing it — a network blip shouldn't hide a
 * real incident.
 */
export function useStatusBanner(): StatusBanner | null {
  const [banner, setBanner] = useState<StatusBanner | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const load = async () => {
      try {
        const data = await fetchStatusBanner(controller.signal)
        setBanner(data)
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Failed to fetch status banner:", error)
        }
      }
    }

    load()
    const interval = window.setInterval(load, POLL_INTERVAL_MS)

    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [])

  return banner
}
