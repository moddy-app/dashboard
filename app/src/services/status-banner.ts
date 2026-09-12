const STATUS_API_BASE = import.meta.env.VITE_STATUS_API_URL || 'https://health.moddy.app'

/** Identifie le dashboard auprès de `health.moddy.app` (paramètre `service`). */
const SERVICE_ID = 'moddy-dashboard'

/**
 * Niveaux connus, pour le choix du style. Le backend peut en introduire
 * d'autres sans coordination — un niveau inconnu retombe silencieusement sur
 * un style générique (voir `status-banner.tsx`), jamais une erreur.
 */
export type StatusLevel =
  | 'operational'
  | 'degraded_performance'
  | 'partial_outage'
  | 'major_outage'
  | 'maintenance'
  | (string & {})

export interface StatusBanner {
  /** Niveau de l'incident en cours, sinon niveau global des services. */
  level: StatusLevel
  title: string | null
  url: string | null
  /** Markdown prêt à afficher tel quel (gras + lien `[View status](url)` déjà inclus). */
  message: string | null
}

export async function getStatusBanner(): Promise<StatusBanner | null> {
  try {
    const res = await fetch(
      `${STATUS_API_BASE}/v1/status/banner?service=${encodeURIComponent(SERVICE_ID)}`
    )
    if (!res.ok) return null
    const data: StatusBanner = await res.json()
    return data
  } catch {
    return null
  }
}
