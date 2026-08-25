/**
 * Client for the Moddy status banner API (`health.moddy.app`).
 *
 * The endpoint returns markdown ready to render as-is (bold + a single
 * `[View status](url)` link) — this module only fetches and types the
 * payload, it does not reshape the message.
 */

const STATUS_API_URL = "https://health.moddy.app/v1/status/banner"

/** Identifies this app to the status API so affected-service messages can name it. */
const SERVICE_ID = "moddy-dashboard"

export interface StatusBanner {
  level: string
  title: string | null
  url: string | null
  message: string | null
}

export async function fetchStatusBanner(
  signal?: AbortSignal
): Promise<StatusBanner> {
  const response = await fetch(
    `${STATUS_API_URL}?service=${encodeURIComponent(SERVICE_ID)}`,
    { signal }
  )

  if (!response.ok) {
    throw new Error(`Status banner request failed: ${response.status}`)
  }

  return (await response.json()) as StatusBanner
}
