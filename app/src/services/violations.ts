import { api } from '@/lib/auth'
import type {
  ViolationDetail,
  ViolationFilters,
  ViolationGroup,
  ViolationStatusResponse,
} from '@/types/violations'

// Endpoints des sanctions globales. Tous restent accessibles à un compte
// suspendu — ce sont les seuls, avec /auth/*, à ne pas renvoyer 403.

/**
 * Statut de sanction du compte connecté, et du serveur passé en paramètre.
 * `guildId` doit être un serveur de l'utilisateur (sinon 403).
 */
export async function getViolationStatus(
  guildId?: string | number | null
): Promise<ViolationStatusResponse> {
  const query = guildId != null ? `?guild_id=${encodeURIComponent(String(guildId))}` : ''
  return (await api(`/violations/status${query}`)) as ViolationStatusResponse
}

/** Liste des infractions — l'unité renvoyée est le **groupe**, pas la case. */
export async function getViolations(filters: ViolationFilters = {}): Promise<ViolationGroup[]> {
  const query = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    query.set(key, String(value))
  })
  const qs = query.toString()
  return (await api(`/violations${qs ? `?${qs}` : ''}`)) as ViolationGroup[]
}

/** Détail d'une infraction. `404` si elle n'existe pas **ou** ne nous concerne pas. */
export async function getViolation(groupId: string): Promise<ViolationDetail> {
  return (await api(`/violations/${encodeURIComponent(groupId)}`)) as ViolationDetail
}
