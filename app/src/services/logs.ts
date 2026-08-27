import { api, ApiError } from '@/lib/auth'
import {
  normalizeLogsCatalog,
  normalizeLogsConfig,
  normalizeLogsDiagnostics,
} from '@/lib/logs'
import type { LogsCatalog, LogsConfig, LogsDiagnostics } from '@/types/api'

const BASE = (guildId: string | number) => `/guilds/${guildId}/modules/logs`

/**
 * Le catalogue est identique pour toutes les guildes : une requête par session
 * suffit. Un échec n'est jamais mis en cache — sinon la page resterait cassée
 * jusqu'au rechargement complet.
 */
let catalogCache: Promise<LogsCatalog> | null = null

export function getLogsCatalog(guildId: string | number): Promise<LogsCatalog> {
  if (!catalogCache) {
    catalogCache = api(`${BASE(guildId)}/catalog`)
      .then((body) => normalizeLogsCatalog(body as Record<string, unknown>))
      .catch((e) => {
        catalogCache = null
        throw e
      })
  }
  return catalogCache
}

/**
 * Config actuelle. Un `404` veut dire « jamais configuré » — ce n'est pas une
 * erreur : on renvoie `null` et l'appelant part d'un formulaire vierge. Après un
 * `DELETE`, l'endpoint renvoie `{}` complété par les défauts : les deux cas
 * mènent au même écran vierge.
 */
export async function getLogsConfig(guildId: string | number): Promise<LogsConfig | null> {
  try {
    return normalizeLogsConfig((await api(BASE(guildId))) as Record<string, unknown>)
  } catch (e) {
    if (e instanceof ApiError && e.isNotFound) return null
    throw e
  }
}

/**
 * Sauvegarde. `PUT` et `PATCH` ont ici la même sémantique : le corps envoyé
 * **devient** la config — il n'y a pas de fusion. On envoie donc toujours le
 * document complet, sans `enabled` (calculé côté serveur).
 *
 * ⚠️ La réponse peut contenir **moins de catégories** que l'envoi : le backend
 * retire celles qui n'ont ni salon ni exclusion. C'est elle le nouvel état, pas
 * le brouillon local.
 */
export async function saveLogsConfig(
  guildId: string | number,
  body: Omit<LogsConfig, 'enabled'>
): Promise<LogsConfig> {
  return normalizeLogsConfig(
    (await api(BASE(guildId), {
      method: 'PUT',
      body: JSON.stringify(body),
    })) as Record<string, unknown>
  )
}

/**
 * Diagnostic de la config **en base** (pas du brouillon) : salons supprimés,
 * permissions perdues après coup, `manage_webhooks` manquant. À appeler au
 * montage et après chaque sauvegarde réussie.
 */
export async function getLogsDiagnostics(guildId: string | number): Promise<LogsDiagnostics> {
  return normalizeLogsDiagnostics((await api(`${BASE(guildId)}/diagnostics`)) as Record<string, unknown>)
}

/**
 * Réinitialise le module : écrit `{}` côté backend — tout est perdu, exclusions
 * et listes d'ignorés comprises. Pour une simple mise en pause, vider les
 * `channel_ids` via {@link saveLogsConfig} conserve les décochages.
 */
export async function deleteLogsConfig(guildId: string | number): Promise<void> {
  await api(BASE(guildId), { method: 'DELETE' })
}
