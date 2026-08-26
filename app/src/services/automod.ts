import { api, ApiError } from '@/lib/auth'
import type {
  AutomodAiConfig,
  AutomodAiStatus,
  AutomodBudget,
  AutomodIndicationsCheck,
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
    categories_desactivees: [],
    dry_run: false,
    features: {
      content: { enabled: false, exempt_roles: [], exempt_channels: [] },
    },
  }
}

/**
 * Config actuelle. Un 404 signifie « jamais configuré » — ce n'est pas une
 * erreur : on retourne `null` et l'appelant part des défauts.
 */
export async function getAutomodConfig(
  guildId: string | number
): Promise<AutomodAiConfig | null> {
  try {
    return (await api(BASE(guildId))) as AutomodAiConfig
  } catch (e) {
    if (e instanceof ApiError && e.isNotFound) return null
    throw e
  }
}

/**
 * Sauvegarde. Le corps **remplace** la config : toujours envoyer l'objet
 * complet dérivé de celui reçu (sinon on écrase `categories_desactivees` et
 * tout champ que ce front ne connaît pas encore).
 * La réponse est la config telle que persistée → ré-hydrater le formulaire avec.
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
  const { langue_serveur: _dead, ...body } = config as AutomodAiConfig & {
    langue_serveur?: unknown
  }
  void _dead
  return (await api(BASE(guildId), {
    method: 'PUT',
    body: JSON.stringify(body),
  })) as AutomodAiConfig
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
