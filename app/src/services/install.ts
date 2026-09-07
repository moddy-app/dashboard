import { api } from '@/lib/auth'
import type {
  InstallLatestResponse,
  InstallSource,
  InstallSourcesResponse,
} from '@/types/stats'

/** Base de l'API — le lien d'installation n'est pas un appel XHR, c'est une redirection. */
const API_BASE = import.meta.env.VITE_API_URL || 'https://api.moddy.app'

/**
 * Dernière installation lancée par le compte connecté (30 min max), ou `null`.
 *
 * Repli de l'écran de remerciement quand le `?installed=` de l'URL de retour a
 * été perdu (rafraîchissement, redirection intermédiaire, app mobile). La
 * fenêtre de 30 minutes est volontaire : l'écran ne doit pas ressurgir des
 * semaines plus tard sur une simple reconnexion.
 */
export async function getLatestInstall(): Promise<InstallLatestResponse> {
  return (await api('/install/latest')) as InstallLatestResponse
}

/** Vocabulaire des sources et paramètres UTM reconnus (endpoint public). */
export async function getInstallSources(): Promise<InstallSourcesResponse> {
  return (await api('/install/sources')) as InstallSourcesResponse
}

export interface InstallLinkParams {
  /** Vocabulaire **fermé** — n'inventez pas de valeur, elle tomberait sur `other`. */
  source?: InstallSource
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  /** Présélectionne un serveur sur l'écran Discord. Snowflake, donc chaîne. */
  guild_id?: string
  /** Destination finale après l'installation (allowlist `*.moddy.app`). */
  redirect?: string
}

/**
 * Fabrique le lien d'installation. Une seule autorisation Discord ajoute le bot
 * **et** connecte la personne au dashboard : elle revient déjà authentifiée.
 */
export function buildInstallUrl(params: InstallLinkParams = {}): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value)
  }
  const qs = query.toString()
  return `${API_BASE}/install${qs ? `?${qs}` : ''}`
}
