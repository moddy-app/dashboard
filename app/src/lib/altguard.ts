import { CHANNEL_TYPES } from '@/types/api'
import type {
  AltGuardApply,
  AltGuardConfig,
  Channel,
  Role,
} from '@/types/api'

// ─── Config ───────────────────────────────────────────────────────────────────

/** Snowflake → chaîne, jamais un nombre (19 chiffres > `Number.MAX_SAFE_INTEGER`). */
function asSnowflake(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

/** Formulaire vierge — état d'un serveur qui n'a jamais configuré le module. */
export function emptyAltGuardConfig(): AltGuardConfig {
  return {
    channel_id: null,
    unverified_role_id: null,
    verified_role_id: null,
    log_channel_id: null,
    enabled: false,
  }
}

/**
 * Normalise une config reçue de l'API (ou lue depuis `modules`) : ids en
 * chaînes, champs absents ramenés à `null`.
 */
export function normalizeAltGuardConfig(raw: Record<string, unknown> | null | undefined): AltGuardConfig {
  if (!raw) return emptyAltGuardConfig()
  return {
    channel_id: asSnowflake(raw.channel_id),
    unverified_role_id: asSnowflake(raw.unverified_role_id),
    verified_role_id: asSnowflake(raw.verified_role_id),
    log_channel_id: asSnowflake(raw.log_channel_id),
    message_id: asSnowflake(raw.message_id),
    enabled: raw.enabled === true,
  }
}

/** Champs obligatoires manquants — sert à expliquer un module inactif. */
export type AltGuardRequiredField = 'channel_id' | 'unverified_role_id' | 'verified_role_id'

export function altGuardMissingFields(config: AltGuardConfig): AltGuardRequiredField[] {
  const missing: AltGuardRequiredField[] = []
  if (!config.channel_id) missing.push('channel_id')
  if (!config.unverified_role_id) missing.push('unverified_role_id')
  if (!config.verified_role_id) missing.push('verified_role_id')
  return missing
}

/**
 * Le module est actif dès que le salon et les deux rôles sont remplis — il n'y
 * a pas d'interrupteur. Le serveur calcule le même `enabled`, mais la vue
 * d'ensemble ne dispose que de la config brute stockée en base.
 */
export function isAltGuardActive(
  config: AltGuardConfig | Record<string, unknown> | null | undefined
): boolean {
  if (!config) return false
  return altGuardMissingFields(normalizeAltGuardConfig(config as Record<string, unknown>)).length === 0
}

export function isSameAltGuardConfig(a: AltGuardConfig, b: AltGuardConfig): boolean {
  return (
    a.channel_id === b.channel_id &&
    a.unverified_role_id === b.unverified_role_id &&
    a.verified_role_id === b.verified_role_id &&
    a.log_channel_id === b.log_channel_id
  )
}

// ─── Filtrage des sélecteurs ──────────────────────────────────────────────────

/** Salons proposables : texte ou annonces, comme le valide le backend. */
export function altGuardChannels(channels: Channel[]): Channel[] {
  return channels.filter(
    (c) => c.type === CHANNEL_TYPES.TEXT || c.type === CHANNEL_TYPES.ANNOUNCEMENT
  )
}

/**
 * Position du rôle le plus haut du bot, déduite de son rôle d'intégration
 * (`tags.bot_id === VITE_DISCORD_CLIENT_ID`). `null` quand on ne le retrouve
 * pas : dans ce cas la hiérarchie n'est **pas** contrôlée côté client, le 422
 * du backend fait foi.
 *
 * C'est une borne *basse* : un bot peut porter des rôles supplémentaires plus
 * hauts que son rôle d'intégration. Les rôles au-dessus sont donc signalés et
 * désactivés dans les sélecteurs, jamais masqués — les masquer ferait
 * disparaître sans explication des rôles peut-être valides.
 */
export function botTopRolePosition(roles: Role[]): number | null {
  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID
  if (!clientId) return null
  const botRole = roles.find((r) => r.managed && r.tags?.bot_id === String(clientId))
  return botRole ? botRole.position : null
}

/** Rôles jamais attribuables par le bot : `@everyone` et les rôles d'intégration. */
export function altGuardRoles(roles: Role[], guildId: string | null): Role[] {
  return roles
    .filter((r) => r.id !== guildId && r.name !== '@everyone' && !r.managed)
    .sort((a, b) => b.position - a.position)
}

/** `true` si le rôle est hors de portée du bot (hiérarchie Discord). */
export function isRoleAboveBot(role: Role, botTop: number | null): boolean {
  return botTop !== null && role.position >= botTop
}

// ─── Accusé du bot (`_apply`) ─────────────────────────────────────────────────

export type ApplyLevel = 'success' | 'info' | 'warning' | 'error'

export interface ApplyProblem {
  key: string
  params?: Record<string, unknown>
}

export interface ApplyFeedback {
  level: ApplyLevel
  /** Clé i18n du message principal. */
  key: string
  /** Détails à afficher en plus du message principal (permissions manquantes…). */
  problems: ApplyProblem[]
}

const P = 'modules.altguard.apply.'

/**
 * Traduit l'accusé du bot en retour utilisateur. Un `200` ne veut pas dire que
 * Discord a suivi : `panel === "failed"` et `permissions.failed > 0` sont les
 * **seuls** signaux qu'il manque une permission au bot — sans eux l'admin voit
 * « Enregistré ✅ » alors que son serveur n'est pas protégé.
 */
export function applyFeedback(apply?: AltGuardApply | null): ApplyFeedback {
  if (!apply) return { level: 'success', key: `${P}savedOnly`, problems: [] }

  // La config est enregistrée **et** la tâche reste dans la file : le bot
  // l'exécutera. Surtout pas de « Réessayer » qui re-sauvegarderait.
  if (apply.error === 'bot_timeout') {
    return { level: 'info', key: `${P}pending`, problems: [] }
  }

  if (apply.error === 'task_transport_unavailable') {
    return { level: 'error', key: `${P}transportUnavailable`, problems: [] }
  }

  if (!apply.ok) {
    return { level: 'error', key: `${P}notApplied`, problems: [] }
  }

  const problems: ApplyProblem[] = []
  if (apply.panel === 'failed') problems.push({ key: `${P}panelFailed` })
  const failed = apply.permissions?.failed ?? 0
  if (failed > 0) problems.push({ key: `${P}permissionsFailed`, params: { count: failed } })
  if (apply.hook_error) problems.push({ key: `${P}hookError` })
  // `DELETE` : le bot n'a pas retrouvé le panneau (cache froid) — il reste
  // orphelin dans Discord et doit être supprimé à la main.
  if (apply.cleaned === false) {
    problems.push({ key: `${P}notCleaned` })
  }

  if (problems.length > 0) {
    return { level: 'warning', key: `${P}appliedWithProblems`, problems }
  }

  return {
    level: 'success',
    key: apply.action === 'deleted' ? `${P}deleted` : `${P}applied`,
    problems: [],
  }
}
