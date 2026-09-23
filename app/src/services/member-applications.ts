import { api, ApiError } from '@/lib/auth'
import {
  normalizeApplication,
  normalizeApplicationsPage,
  normalizeApplicationStats,
  normalizeMemberApplicationsConfig,
  normalizeMemberApplicationsDiagnostics,
  serializeMemberApplicationsConfig,
} from '@/lib/member-applications'
import type {
  Application,
  ApplicationsPage,
  ApplicationStats,
  ApplicationStatus,
  MemberApplicationsConfig,
  MemberApplicationsDiagnostics,
} from '@/types/member-applications'

const BASE = (guildId: string) => `/guilds/${guildId}/modules/member_applications`

/**
 * Config actuelle. Un `404` veut dire « jamais configuré » : on renvoie `null`
 * et l'appelant part d'un formulaire vierge.
 */
export async function getMemberApplicationsConfig(
  guildId: string
): Promise<MemberApplicationsConfig | null> {
  try {
    return normalizeMemberApplicationsConfig(await api(BASE(guildId)))
  } catch (e) {
    if (e instanceof ApiError && e.isNotFound) return null
    throw e
  }
}

/**
 * `PUT` avec l'**objet complet** — `PUT` comme `PATCH` remplacent tout.
 * Quand `enabled` est vrai, le backend vérifie en plus la permission
 * « Expulser des membres », l'accès au salon et l'existence des rôles (422
 * lisible sinon). Aucun accusé à attendre : le bot relit la config en ~2 min.
 */
export async function saveMemberApplicationsConfig(
  guildId: string,
  config: MemberApplicationsConfig
): Promise<MemberApplicationsConfig> {
  return normalizeMemberApplicationsConfig(
    await api(BASE(guildId), {
      method: 'PUT',
      body: JSON.stringify(serializeMemberApplicationsConfig(config)),
    })
  )
}

/** Désactive **et vide** la config (`{}`). */
export async function deleteMemberApplicationsConfig(guildId: string): Promise<void> {
  await api(BASE(guildId), { method: 'DELETE' })
}

/** À appeler à l'ouverture et après chaque sauvegarde : les permissions bougent. */
export async function getMemberApplicationsDiagnostics(
  guildId: string
): Promise<MemberApplicationsDiagnostics> {
  return normalizeMemberApplicationsDiagnostics(await api(`${BASE(guildId)}/diagnostics`))
}

export interface ApplicationsQuery {
  status?: ApplicationStatus | null
  userId?: string | null
  limit?: number
  offset?: number
}

/** Plus récentes d'abord. Pas de temps réel : l'appelant recharge. */
export async function listApplications(
  guildId: string,
  query: ApplicationsQuery = {}
): Promise<ApplicationsPage> {
  const params = new URLSearchParams()
  if (query.status) params.set('status', query.status)
  if (query.userId) params.set('user_id', query.userId)
  params.set('limit', String(query.limit ?? 50))
  params.set('offset', String(query.offset ?? 0))
  return normalizeApplicationsPage(await api(`${BASE(guildId)}/applications?${params}`))
}

export async function getApplication(guildId: string, requestId: string): Promise<Application> {
  return normalizeApplication(
    await api(`${BASE(guildId)}/applications/${encodeURIComponent(requestId)}`)
  )
}

export async function getApplicationStats(guildId: string): Promise<ApplicationStats> {
  return normalizeApplicationStats(await api(`${BASE(guildId)}/stats`))
}
