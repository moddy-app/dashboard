import { api, ApiError } from '@/lib/auth'
import {
  AUTOMOD_FEATURE_IDS,
  defaultAutomodFeature,
  normalizeActions,
  normalizeAutomodCatalog,
  normalizeAutomodConfig,
  readModuleState,
  stripDeadConfigKeys,
} from '@/lib/automod'
import type {
  AutomodAiConfig,
  AutomodAiStatus,
  AutomodBudget,
  AutomodCatalog,
  AutomodCustomInfraction,
  AutomodInfractionCheck,
  AutomodGravityPlan,
  AutomodPendingApproval,
  AutomodPendingApprovals,
  AutomodPolicy,
  AutomodProfileHolds,
} from '@/types/api'

const BASE = (guildId: string | number) => `/guilds/${guildId}/modules/automod_ai`

/** Nombre maximal d'exemptions par liste et par détecteur. */
export const EXEMPT_MAX = 25

/** Config par défaut d'un serveur jamais configuré (le GET répond alors 404). */
export function defaultAutomodConfig(): AutomodAiConfig {
  return {
    state: 'active',
    notify_channel_id: null,
    ignore_moderators: true,
    severity: 3,
    max_action: 'ban',
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
  // Clés mortes (`enabled`, `dry_run`, `indications`, `rules`,
  // `categories_desactivees`, `langue_serveur`) : l'index signature de la config
  // les reconduirait depuis une ancienne config. Pydantic les ignorerait en
  // silence, mais le backend les retire à l'écriture — ne jamais les envoyer.
  // `state` est gardé s'il est présent ; absent, le backend conserve l'état
  // enregistré (enregistrer des réglages ne relance jamais un module en pause).
  const body = stripDeadConfigKeys({ ...config })
  // `crans` (ancien format) est converti à la lecture et ne se réécrit jamais.
  body.sanctions = Object.fromEntries(
    Object.entries(body.sanctions ?? {}).map(([key, entry]) => {
      const { crans: _crans, ...rest } = entry
      void _crans
      return [key, rest]
    })
  )
  // Garde-fous du contrat : le détecteur de profils n'a jamais de salons
  // exemptés, et une clé `perso:<id>` sans infraction correspondante est un 422.
  const ids = new Set((body.infractions_perso ?? []).map((i) => i.id))
  body.sanctions = Object.fromEntries(
    Object.entries(body.sanctions ?? {}).filter(
      ([key]) => !key.startsWith('perso:') || ids.has(key.slice('perso:'.length))
    )
  )
  if (body.features?.profile) {
    body.features = { ...body.features, profile: { ...body.features.profile, exempt_channels: [] } }
  }
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
  const raw = (await api(`${BASE(guildId)}/status`)) as AutomodAiStatus
  return {
    ...raw,
    state: readModuleState(raw?.state),
    active_features: Array.isArray(raw?.active_features) ? raw.active_features : [],
    warnings: Array.isArray(raw?.warnings) ? raw.warnings : [],
  }
}

/** Catalogue par serveur, en cache pour la session. Un échec n'est jamais mis en cache. */
const catalogCache = new Map<string, Promise<AutomodCatalog>>()

export function getAutomodCatalog(guildId: string | number): Promise<AutomodCatalog> {
  const key = String(guildId)
  const cached = catalogCache.get(key)
  if (cached) return cached
  const promise = (api(`${BASE(guildId)}/catalog`) as Promise<AutomodCatalog>).then(normalizeAutomodCatalog).catch((e) => {
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
  const raw = (await api(
    `/guilds/${guildId}/automod-ai/profile-holds?limit=${limit}&offset=${offset}`
  )) as Partial<AutomodProfileHolds> | null
  const holds = Array.isArray(raw?.holds) ? raw.holds : []
  return { holds, total: typeof raw?.total === 'number' ? raw.total : holds.length }
}

// ─── Politiques effectives et sanctions en attente ────────────────────────────

function normalizeGravityPlans(raw: unknown): Partial<Record<string, AutomodGravityPlan>> {
  const plans: Partial<Record<string, AutomodGravityPlan>> = {}
  if (!raw || typeof raw !== 'object') return plans
  for (const [gravity, plan] of Object.entries(raw as Record<string, unknown>)) {
    if (!plan || typeof plan !== 'object') continue
    const p = plan as { actions?: unknown; timeout_seconds?: unknown }
    plans[gravity] = {
      actions: normalizeActions(p.actions),
      ...(typeof p.timeout_seconds === 'number' && { timeout_seconds: p.timeout_seconds }),
    }
  }
  return plans
}

/**
 * Politique effective par infraction (défauts de Moddy compris), à afficher à
 * la place de l'ancien « défaut de Moddy ». La réponse est lue sans hypothèse :
 * objet indexé par id d'infraction, `{policies: {...}}` ou tableau d'entrées
 * portant leur `id` — tout est ramené à `Record<id, AutomodPolicy>`.
 */
export async function getAutomodPolicies(
  guildId: string | number
): Promise<Record<string, AutomodPolicy>> {
  const raw = (await api(`${BASE(guildId)}/policies`)) as unknown
  let source: unknown = raw
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    const inner = (source as { policies?: unknown }).policies
    if (inner && typeof inner === 'object') source = inner
  }
  const entries: [string, unknown][] = Array.isArray(source)
    ? source.flatMap((item): [string, unknown][] => {
        const id = (item as { id?: unknown; infraction?: unknown } | null)?.id ??
          (item as { infraction?: unknown } | null)?.infraction
        return typeof id === 'string' ? [[id, item]] : []
      })
    : source && typeof source === 'object'
      ? Object.entries(source as Record<string, unknown>)
      : []
  const policies: Record<string, AutomodPolicy> = {}
  for (const [id, value] of entries) {
    if (!value || typeof value !== 'object') continue
    const p = value as Record<string, unknown>
    policies[id] = {
      mode: p.mode === 'perso' ? 'perso' : 'auto',
      enabled: p.enabled !== false,
      recidive: p.recidive !== false,
      require_approval: p.require_approval === true,
      family: typeof p.family === 'string' ? p.family : null,
      by_gravity: normalizeGravityPlans(p.by_gravity),
    }
  }
  return policies
}

/**
 * Sanctions en attente de validation (lecture seule : aucune route d'écriture,
 * le modérateur décide dans Discord). Le contenu du message supprimé n'est
 * jamais exposé. Chemin hors `/modules/`.
 */
export async function listAutomodPendingApprovals(
  guildId: string | number,
  {
    status,
    limit = 50,
    offset = 0,
  }: { status?: 'pending' | 'approved' | 'rejected' | 'expired'; limit?: number; offset?: number } = {}
): Promise<AutomodPendingApprovals> {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (status) query.set('status', status)
  const raw = (await api(
    `/guilds/${guildId}/automod-ai/pending-approvals?${query.toString()}`
  )) as Partial<AutomodPendingApprovals> | null
  const approvals: AutomodPendingApproval[] = (Array.isArray(raw?.approvals) ? raw.approvals : []).map(
    (a) => ({
      ...a,
      actions: normalizeActions(a.actions),
      timeout_seconds: typeof a.timeout_seconds === 'number' ? a.timeout_seconds : null,
      message_deleted: a.message_deleted === true,
      result: a.result
        ? {
            applied: Array.isArray(a.result.applied) ? a.result.applied : [],
            failed: Array.isArray(a.result.failed) ? a.result.failed : [],
            case_ref: a.result.case_ref ?? null,
          }
        : null,
    })
  )
  return { approvals, total: typeof raw?.total === 'number' ? raw.total : approvals.length }
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
