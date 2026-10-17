import { CHANNEL_TYPES } from '@/types/api'
import type { Channel, Role } from '@/types/api'
import type {
  MemberApplicationsConfig,
  MemberApplicationsDiagnostics,
  MemberApplicationsLimits,
} from '@/types/member-applications'

// Helpers du module Candidatures (`member_applications`). Les snowflakes
// restent des chaînes de bout en bout : aucun `Number()` ici, ils seraient
// arrondis au-delà de 2^53.

// ─── Lecture défensive ────────────────────────────────────────────────────────

type Raw = Record<string, unknown>

function asRecord(value: unknown): Raw {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : {}
}

function asSnowflake(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

function asSnowflakes(value: unknown): string[] {
  return Array.isArray(value) ? value.map(asSnowflake).filter((v): v is string => v !== null) : []
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

// ─── Config ───────────────────────────────────────────────────────────────────

/**
 * Limites de repli, **uniquement** si `/diagnostics` n'a pas répondu : la
 * source de vérité est `diagnostics.limits`.
 */
export const FALLBACK_MEMBER_APPLICATIONS_LIMITS: MemberApplicationsLimits = {
  ping_roles: 5,
  reviewer_roles: 10,
  rejection_reasons: 10,
  rejection_reason_length: 100,
}

/** Formulaire vierge. Après un `DELETE` la config vaut `{}` : même écran. */
export function emptyMemberApplicationsConfig(): MemberApplicationsConfig {
  return {
    channel_id: null,
    ping_role_ids: [],
    reviewer_role_ids: [],
    rejection_reasons: [],
  }
}

/**
 * Toute clé absente prend sa valeur par défaut. Un éventuel `enabled` reçu est
 * ignoré : l'activité ne dépend que du salon.
 */
export function normalizeMemberApplicationsConfig(raw: unknown): MemberApplicationsConfig {
  const r = asRecord(raw)
  return {
    channel_id: asSnowflake(r.channel_id),
    ping_role_ids: asSnowflakes(r.ping_role_ids),
    reviewer_role_ids: asSnowflakes(r.reviewer_role_ids),
    rejection_reasons: Array.isArray(r.rejection_reasons)
      ? r.rejection_reasons.filter((v): v is string => typeof v === 'string')
      : [],
  }
}

/**
 * Corps du `PUT` : **l'objet complet**, toujours — un champ omis reprendrait sa
 * valeur par défaut — mais **jamais la clé `enabled`** : le module est actif
 * dès qu'un salon est configuré. Les motifs sont rognés comme le fait le backend, les
 * lignes restées vides sont retirées (un motif vide serait un 422).
 */
export function serializeMemberApplicationsConfig(config: MemberApplicationsConfig): MemberApplicationsConfig {
  return {
    channel_id: config.channel_id || null,
    ping_role_ids: [...config.ping_role_ids],
    reviewer_role_ids: [...config.reviewer_role_ids],
    rejection_reasons: config.rejection_reasons.map((r) => r.trim()).filter(Boolean),
  }
}

export function isSameMemberApplicationsConfig(
  a: MemberApplicationsConfig,
  b: MemberApplicationsConfig
): boolean {
  return JSON.stringify(serializeMemberApplicationsConfig(a)) ===
    JSON.stringify(serializeMemberApplicationsConfig(b))
}

/** Actif dès qu'un salon est configuré — il n'y a pas d'interrupteur. */
export function isMemberApplicationsActive(config: unknown): boolean {
  if (!config) return false
  return normalizeMemberApplicationsConfig(config).channel_id !== null
}

// ─── Sélecteurs ───────────────────────────────────────────────────────────────

/** Salons proposables : texte ou annonces, comme le valide le backend. */
export function memberApplicationsChannels(channels: Channel[]): Channel[] {
  return channels.filter(
    (c) => c.type === CHANNEL_TYPES.TEXT || c.type === CHANNEL_TYPES.ANNOUNCEMENT
  )
}

/**
 * Rôles mentionnables / examinateurs : tout sauf `@everyone`. Les rôles gérés
 * restent proposés — le bot ne les attribue pas, il les mentionne ou les lit.
 */
export function memberApplicationsRoles(roles: Role[], guildId: string | null): Role[] {
  return roles
    .filter((r) => r.id !== guildId && r.name !== '@everyone')
    .sort((a, b) => b.position - a.position)
}

// ─── Validation (miroir du backend) ───────────────────────────────────────────

export type MemberApplicationsField =
  | 'channel_id'
  | 'ping_role_ids'
  | 'reviewer_role_ids'
  | 'rejection_reasons'

export interface MemberApplicationsIssue {
  field: MemberApplicationsField
  /** Clé i18n sous `modules.member_applications.errors`. */
  key: string
  params?: Record<string, unknown>
  /** Index du motif fautif, pour surligner la bonne ligne. */
  index?: number
}

/**
 * Refait les contrôles du backend avant l'appel : le 422 reste le filet, pas
 * l'expérience. Les doublons de motifs sont **insensibles à la casse**.
 */
export function validateMemberApplications(
  config: MemberApplicationsConfig,
  limits: MemberApplicationsLimits,
  guildId: string | null
): MemberApplicationsIssue[] {
  const issues: MemberApplicationsIssue[] = []

  const roleLists: [MemberApplicationsField, string[], number][] = [
    ['ping_role_ids', config.ping_role_ids, limits.ping_roles],
    ['reviewer_role_ids', config.reviewer_role_ids, limits.reviewer_roles],
  ]
  for (const [field, ids, max] of roleLists) {
    if (ids.length > max) issues.push({ field, key: 'tooManyRoles', params: { max } })
    if (new Set(ids).size !== ids.length) issues.push({ field, key: 'duplicateRole' })
    if (guildId && ids.includes(guildId)) issues.push({ field, key: 'everyoneRole' })
  }

  const reasons = config.rejection_reasons.map((r) => r.trim())
  if (reasons.filter(Boolean).length > limits.rejection_reasons) {
    issues.push({
      field: 'rejection_reasons',
      key: 'tooManyReasons',
      params: { max: limits.rejection_reasons },
    })
  }
  const seen = new Set<string>()
  reasons.forEach((reason, index) => {
    if (!reason) {
      issues.push({ field: 'rejection_reasons', key: 'reasonEmpty', index })
      return
    }
    if (reason.length > limits.rejection_reason_length) {
      issues.push({
        field: 'rejection_reasons',
        key: 'reasonTooLong',
        params: { max: limits.rejection_reason_length },
        index,
      })
    }
    const folded = reason.toLocaleLowerCase()
    if (seen.has(folded)) {
      issues.push({ field: 'rejection_reasons', key: 'reasonDuplicate', index })
    }
    seen.add(folded)
  })

  return issues
}

// ─── Diagnostic ───────────────────────────────────────────────────────────────

export function normalizeMemberApplicationsDiagnostics(raw: unknown): MemberApplicationsDiagnostics {
  const r = asRecord(raw)
  const limits = asRecord(r.limits)
  const channel = r.channel ? asRecord(r.channel) : null
  const approval = r.manual_approval_enabled
  return {
    guild_id: String(r.guild_id ?? ''),
    enabled: r.enabled === true,
    active: r.active === true,
    manual_approval_enabled: typeof approval === 'boolean' ? approval : null,
    required_guild_permissions: Array.isArray(r.required_guild_permissions)
      ? r.required_guild_permissions.map(String)
      : [],
    limits: {
      ping_roles: asNumber(limits.ping_roles, FALLBACK_MEMBER_APPLICATIONS_LIMITS.ping_roles),
      reviewer_roles: asNumber(limits.reviewer_roles, FALLBACK_MEMBER_APPLICATIONS_LIMITS.reviewer_roles),
      rejection_reasons: asNumber(
        limits.rejection_reasons,
        FALLBACK_MEMBER_APPLICATIONS_LIMITS.rejection_reasons
      ),
      rejection_reason_length: asNumber(
        limits.rejection_reason_length,
        FALLBACK_MEMBER_APPLICATIONS_LIMITS.rejection_reason_length
      ),
    },
    checked: r.checked === true,
    missing_guild_permissions: Array.isArray(r.missing_guild_permissions)
      ? r.missing_guild_permissions.map(String)
      : [],
    channel: channel
      ? {
          channel_id: String(channel.channel_id ?? ''),
          exists: channel.exists !== false,
          unsupported_type: channel.unsupported_type === true,
          missing: Array.isArray(channel.missing) ? channel.missing.map(String) : [],
        }
      : null,
  }
}

export interface MemberApplicationsNotice {
  /** Clé i18n sous `modules.member_applications.diagnostics` (titre = `<key>Title`). */
  key: string
  level: 'error' | 'warning'
  params?: Record<string, unknown>
}

/**
 * Alertes à afficher. `checked: false` et `manual_approval_enabled: null`
 * veulent dire « pas pu vérifier » — ce n'est **pas** une erreur : rien.
 * Le réglage d'adhésion passe en premier : sans lui le module ne reçoit rien.
 */
export function memberApplicationsNotices(
  diagnostics: MemberApplicationsDiagnostics | null
): MemberApplicationsNotice[] {
  if (!diagnostics) return []
  const notices: MemberApplicationsNotice[] = []

  if (diagnostics.manual_approval_enabled === false) {
    notices.push({ key: 'manualApprovalDisabled', level: 'error' })
  }
  if (!diagnostics.checked) return notices

  if (diagnostics.missing_guild_permissions.includes('kick_members')) {
    notices.push({ key: 'missingKickMembers', level: 'error' })
  }
  const channel = diagnostics.channel
  if (channel) {
    if (!channel.exists) {
      notices.push({ key: 'channelDeleted', level: 'error' })
    } else if (channel.unsupported_type) {
      notices.push({ key: 'channelUnsupported', level: 'error' })
    } else if (channel.missing.length > 0) {
      notices.push({
        key: 'channelMissingPermissions',
        level: 'error',
        params: { permissions: channel.missing.join(', ') },
      })
    }
  }
  return notices
}
