import { api, ApiError } from '@/lib/auth'
import {
  normalizeBumpCatalog,
  normalizeBumpConfig,
  normalizeBumpDiagnostics,
  normalizeBumpState,
  serializeBumpConfig,
} from '@/lib/bump-reminder'
import type { BumpReminderDraft } from '@/lib/bump-reminder'
import type { BumpCatalog, BumpDiagnostics, BumpState } from '@/types/bump-reminder'

const BASE = (guildId: string) => `/guilds/${guildId}/modules/bump_reminder`

/**
 * Annuaires, limites et quota du serveur. Pas de cache : `used` et `premium`
 * sont propres au serveur et bougent à chaque sauvegarde.
 */
export async function getBumpCatalog(guildId: string): Promise<BumpCatalog> {
  return normalizeBumpCatalog(await api(`${BASE(guildId)}/catalog`))
}

/** `404` = jamais configuré → `null`, l'appelant part d'une liste vide. */
export async function getBumpConfig(guildId: string): Promise<BumpReminderDraft[] | null> {
  try {
    return normalizeBumpConfig(await api(BASE(guildId)))
  } catch (e) {
    if (e instanceof ApiError && e.isNotFound) return null
    throw e
  }
}

/**
 * `PUT` avec **toute** la config (`PUT` comme `PATCH` remplacent tout). La
 * réponse porte les `id` générés : elle **remplace** l'état local, sinon la
 * prochaine sauvegarde renverrait l'entrée sans `id` et en créerait une autre.
 */
export async function saveBumpConfig(
  guildId: string,
  reminders: BumpReminderDraft[]
): Promise<BumpReminderDraft[]> {
  return normalizeBumpConfig(
    await api(BASE(guildId), {
      method: 'PUT',
      body: JSON.stringify(serializeBumpConfig(reminders)),
    })
  )
}

/** Supprime tout ; le bot efface aussi les comptes à rebours du serveur. */
export async function deleteBumpConfig(guildId: string): Promise<void> {
  await api(BASE(guildId), { method: 'DELETE' })
}

/** Une ligne par annuaire (pas par entrée). Pas de temps réel : l'appelant recharge. */
export async function getBumpState(guildId: string): Promise<BumpState> {
  return normalizeBumpState(await api(`${BASE(guildId)}/state`))
}

export async function getBumpDiagnostics(guildId: string): Promise<BumpDiagnostics> {
  return normalizeBumpDiagnostics(await api(`${BASE(guildId)}/diagnostics`))
}
