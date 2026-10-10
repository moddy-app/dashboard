import { api, ApiError } from '@/lib/auth'
import { AUTOMOD_FEATURE_IDS, defaultAutomodFeature, normalizeAutomodConfig } from '@/lib/automod'
import type {
  AutomodAiConfig,
  AutomodAiStatus,
  AutomodBudget,
  AutomodCatalog,
  AutomodCustomInfraction,
  AutomodIndicationsCheck,
  AutomodInfractionCheck,
  AutomodProfileHolds,
} from '@/types/api'

const BASE = (guildId: string | number) => `/guilds/${guildId}/modules/automod_ai`

/** Longueur maximale du champ `indications` (validée aussi côté backend). */
export const INDICATIONS_MAX = 3000
/** Nombre maximal d'exemptions par liste et par détecteur. */
export const EXEMPT_MAX = 25

/** Config par défaut d'un serveur jamais configuré (le GET répond alors 404). */
export function defaultAutomodConfig(): AutomodAiConfig {
  return {
    enabled: false,
    indications: '',
    notify_channel_id: null,
    ignore_moderators: true,
    severity: 3,
    max_action: 'ban',
    dry_run: false,
    sanctions: {},
    infractions_perso: [],
    features: Object.fromEntries(AUTOMOD_FEATURE_IDS.map((id) => [id, defaultAutomodFeature(id)])),
  }
}

/**
 * Config actuelle. Un 404 signifie « jamais configuré » — ce n'est pas une
 * erreur : on retourne `null` et l'appelant part des défauts. Une ancienne
 * config sans blocs d'image est complétée (`normalizeAutomodConfig`).
 */
export async function getAutomodConfig(
  guildId: string | number
): Promise<AutomodAiConfig | null> {
  try {
    return normalizeAutomodConfig((await api(BASE(guildId))) as AutomodAiConfig)
  } catch (e) {
    if (e instanceof ApiError && e.isNotFound) return null
    throw e
  }
}

/**
 * Sauvegarde. Le corps **remplace** la config : toujours envoyer l'objet
 * complet dérivé de celui reçu (sinon on écrase tout champ que ce front ne
 * connaît pas encore).
 * La réponse est la config telle que persistée (normalisée : cinq blocs,
 * doublons d'exemptions retirés) → elle **remplace** l'état local.
 */
export async function saveAutomodConfig(
  guildId: string | number,
  config: AutomodAiConfig
): Promise<AutomodAiConfig> {
  // `langue_serveur` est mort : la langue est un réglage du **serveur**
  // (`PUT /guilds/{id}/settings/language`). L'index signature de la config
  // reconduit tout champ inconnu — sans ce retrait, une valeur héritée d'une
  // ancienne config repartirait dans le body. Pydantic l'ignorerait en
  // silence : ça semblerait marcher tout en ne réglant rien.
  // Même chose pour `categories_desactivees`, supprimé côté backend.
  const {
    langue_serveur: _dead,
    categories_desactivees: _dead2,
    ...body
  } = config as AutomodAiConfig & {
    langue_serveur?: unknown
    categories_desactivees?: unknown
  }
  void _dead
  void _dead2
  const saved = (await api(BASE(guildId), {
    method: 'PUT',
    body: JSON.stringify(body),
  })) as AutomodAiConfig
  return normalizeAutomodConfig(saved)
}

/** Supprime la config du module (bouton « Réinitialiser »). */
export async function deleteAutomodConfig(guildId: string | number): Promise<void> {
  await api(BASE(guildId), { method: 'DELETE' })
}

/**
 * État réel + avertissements. À rappeler après chaque sauvegarde réussie :
 * `running` dépend de trois conditions, pas du seul `enabled`.
 */
export async function getAutomodStatus(
  guildId: string | number
): Promise<AutomodAiStatus> {
  return (await api(`${BASE(guildId)}/status`)) as AutomodAiStatus
}

/**
 * Contrôle anti-injection du texte, sans rien sauvegarder. Le même contrôle est
 * rejoué au PUT : un `ok: true` ici ne garantit pas la sauvegarde.
 * Un 503 (bot injoignable) est propagé — l'appelant avertit sans bloquer.
 */
export async function checkIndications(
  guildId: string | number,
  indications: string
): Promise<AutomodIndicationsCheck> {
  return (await api(`${BASE(guildId)}/indications/check`, {
    method: 'POST',
    body: JSON.stringify({ indications }),
  })) as AutomodIndicationsCheck
}

/** Catalogue par serveur, en cache pour la session. Un échec n'est jamais mis en cache. */
const catalogCache = new Map<string, Promise<AutomodCatalog>>()

export function getAutomodCatalog(guildId: string | number): Promise<AutomodCatalog> {
  const key = String(guildId)
  const cached = catalogCache.get(key)
  if (cached) return cached
  const promise = (api(`${BASE(guildId)}/catalog`) as Promise<AutomodCatalog>).catch((e) => {
    catalogCache.delete(key)
    throw e
  })
  catalogCache.set(key, promise)
  return promise
}

/**
 * Contrôle d'une infraction personnalisée, sans rien sauvegarder (rejoué au
 * PUT). Un 503 (bot injoignable) est propagé.
 */
export async function checkCustomInfraction(
  guildId: string | number,
  infraction: AutomodCustomInfraction
): Promise<AutomodInfractionCheck> {
  return (await api(`${BASE(guildId)}/infractions/check`, {
    method: 'POST',
    body: JSON.stringify({ infraction }),
  })) as AutomodInfractionCheck
}

/** Profils retenus en attente de décision. Le chemin n'est pas sous `/modules/`. */
export async function getProfileHolds(
  guildId: string | number,
  { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {}
): Promise<AutomodProfileHolds> {
  return (await api(
    `/guilds/${guildId}/automod-ai/profile-holds?limit=${limit}&offset=${offset}`
  )) as AutomodProfileHolds
}

// ─── Budget IA (staff uniquement) ─────────────────────────────────────────────

export async function getAutomodBudget(
  guildId: string | number
): Promise<AutomodBudget> {
  return (await api(`${BASE(guildId)}/budget`)) as AutomodBudget
}

/** `cap: null` restaure le plafond par défaut. */
export async function setAutomodBudget(
  guildId: string | number,
  cap: number | null
): Promise<AutomodBudget> {
  return (await api(`${BASE(guildId)}/budget`, {
    method: 'PUT',
    body: JSON.stringify({ cap }),
  })) as AutomodBudget
}
