import { api, ApiError } from '@/lib/auth'
import { normalizeAltGuardConfig } from '@/lib/altguard'
import type { AltGuardApply, AltGuardConfig, AltGuardSaveResult } from '@/types/api'

const BASE = (guildId: string | number) => `/guilds/${guildId}/modules/altguard`

/**
 * Sépare la config de l'accusé du bot. `_apply` n'est jamais de la config : il
 * ne doit ni entrer dans l'état du formulaire, ni repartir dans le body suivant.
 */
function splitApply(body: unknown): AltGuardSaveResult {
  const { _apply, ...rest } = (body ?? {}) as Record<string, unknown> & {
    _apply?: AltGuardApply
  }
  return {
    config: normalizeAltGuardConfig(rest),
    apply: _apply ?? null,
  }
}

/**
 * Config actuelle. Un `404` veut dire « jamais configuré » — ce n'est pas une
 * erreur : on renvoie `null` et l'appelant part d'un formulaire vierge.
 */
export async function getAltGuardConfig(
  guildId: string | number
): Promise<AltGuardConfig | null> {
  try {
    return normalizeAltGuardConfig((await api(BASE(guildId))) as Record<string, unknown>)
  } catch (e) {
    if (e instanceof ApiError && e.isNotFound) return null
    throw e
  }
}

/**
 * Sauvegarde. `PUT` et `PATCH` sont identiques ici : les deux **remplacent**
 * toute la config, il n'y a pas de patch partiel.
 *
 * - `message_id` est volontairement omis : c'est du bookkeeping du bot, le
 *   backend reconduit la valeur stockée.
 * - `enabled` est omis aussi : il est calculé côté serveur, l'envoyer n'a aucun
 *   effet.
 * - L'appel peut prendre jusqu'à ~25 s (le bot republie le panneau, reverrouille
 *   les salons et resynchronise) : pas de timeout côté client.
 *
 * Une config incomplète est acceptée (`200`, `enabled: false`) — c'est ce qui
 * permet de sauvegarder au fil de l'eau.
 */
export async function saveAltGuardConfig(
  guildId: string | number,
  config: AltGuardConfig
): Promise<AltGuardSaveResult> {
  const body = {
    channel_id: config.channel_id || null,
    unverified_role_id: config.unverified_role_id || null,
    verified_role_id: config.verified_role_id || null,
    log_channel_id: config.log_channel_id || null,
    panel_locale: config.panel_locale,
  }
  return splitApply(
    await api(BASE(guildId), { method: 'PUT', body: JSON.stringify(body) })
  )
}

/**
 * Désactive le module : supprime la config et demande au bot de retirer le
 * panneau. L'accusé se lit comme celui d'une sauvegarde — `cleaned: false`
 * signale un panneau resté orphelin dans Discord.
 */
export async function deleteAltGuardConfig(
  guildId: string | number
): Promise<AltGuardApply | null> {
  return splitApply(await api(BASE(guildId), { method: 'DELETE' })).apply
}
