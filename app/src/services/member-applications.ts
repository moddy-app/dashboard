import { api, ApiError } from '@/lib/auth'
import {
  normalizeMemberApplicationsConfig,
  normalizeMemberApplicationsDiagnostics,
  serializeMemberApplicationsConfig,
} from '@/lib/member-applications'
import type {
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
 * Quand un salon est configuré, le backend vérifie en plus la permission
 * « Expulser des membres », l'accès au salon et l'existence des rôles (422
 * lisible sinon). Sans salon, aucune vérification : on peut toujours retirer
 * un salon supprimé. Aucun accusé à attendre : le bot relit la config en ~2 min.
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
