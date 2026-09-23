import { CHANNEL_TYPES } from '@/types/api'
import type { Channel, Role } from '@/types/api'
import { BUMP_PING_MODES } from '@/types/bump-reminder'
import type {
  BumpCatalog,
  BumpDiagnostics,
  BumpDirectory,
  BumpDirectoryState,
  BumpDirectoryStateKind,
  BumpLimits,
  BumpPingMode,
  BumpReminder,
  BumpReminderConfig,
  BumpState,
} from '@/types/bump-reminder'

// Helpers du module Rappels de bump (`bump_reminder`). Snowflakes en chaînes,
// aucun `Number()` sur un identifiant.

type Raw = Record<string, unknown>

function asRecord(value: unknown): Raw {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : {}
}

function asSnowflake(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asPingMode(value: unknown, fallback: BumpPingMode = 'button'): BumpPingMode {
  return (BUMP_PING_MODES as readonly unknown[]).includes(value) ? (value as BumpPingMode) : fallback
}

// ─── Icônes des annuaires ─────────────────────────────────────────────────────

/**
 * Émojis Discord des annuaires, par clé `bot`. Seul endroit du code qui
 * connaît ces identifiants : un annuaire ajouté au catalogue sans émoji
 * retombe sur une icône générique, jamais sur une image cassée.
 */
const DIRECTORY_EMOJI_IDS: Record<string, string> = {
  disboard: '1545025221612802101',
  dsmonitoring: '1545027259323256842',
  dinvites: '1545025725948624956',
  dl: '1545024517066465370',
  beemp: '1545026898520969216',
  dtop: '1545026416331198515',
  frenchgg: '1545026009235988490',
}

export function directoryIconUrl(bot: string): string | null {
  const id = DIRECTORY_EMOJI_IDS[bot]
  return id ? `https://cdn.discordapp.com/emojis/${id}.webp?size=64` : null
}

// ─── Catalogue ────────────────────────────────────────────────────────────────

/** Repli si le catalogue ne sert pas `limits` — jamais une source de vérité. */
const FALLBACK_LIMITS: BumpLimits = {
  per_directory: 1,
  per_directory_free: 1,
  per_directory_premium: 3,
  roles: 5,
  interval_min: 300,
  interval_max: 86400,
}

export function normalizeBumpCatalog(raw: unknown): BumpCatalog {
  const r = asRecord(raw)
  const l = asRecord(r.limits)
  const directories: BumpDirectory[] = Array.isArray(r.directories)
    ? r.directories.map((d) => {
        const x = asRecord(d)
        return {
          key: String(x.key ?? ''),
          name: asString(x.name) ?? String(x.key ?? ''),
          application_id: String(x.application_id ?? ''),
          default_interval: asNumber(x.default_interval, 7200),
          used: asNumber(x.used),
        }
      })
    : []
  const pingModes = Array.isArray(r.ping_modes)
    ? r.ping_modes.filter((m): m is BumpPingMode => (BUMP_PING_MODES as readonly unknown[]).includes(m))
    : []
  return {
    guild_id: String(r.guild_id ?? ''),
    premium: r.premium === true,
    enabled: r.enabled === true,
    directories,
    limits: {
      per_directory: asNumber(l.per_directory, FALLBACK_LIMITS.per_directory),
      per_directory_free: asNumber(l.per_directory_free, FALLBACK_LIMITS.per_directory_free),
      per_directory_premium: asNumber(l.per_directory_premium, FALLBACK_LIMITS.per_directory_premium),
      roles: asNumber(l.roles, FALLBACK_LIMITS.roles),
      interval_min: asNumber(l.interval_min, FALLBACK_LIMITS.interval_min),
      interval_max: asNumber(l.interval_max, FALLBACK_LIMITS.interval_max),
    },
    ping_modes: pingModes.length > 0 ? pingModes : [...BUMP_PING_MODES],
    default_ping_mode: asPingMode(r.default_ping_mode),
  }
}

// ─── Config ───────────────────────────────────────────────────────────────────

/**
 * Entrée du brouillon. `key` est une clé React **locale** (jamais envoyée) :
 * une nouvelle entrée n'a pas encore d'`id`, c'est le backend qui le génère.
 */
export interface BumpReminderDraft {
  key: string
  id: string | null
  bot: string
  channel_id: string | null
  role_ids: string[]
  ping_mode: BumpPingMode
  /** Secondes ; `null` = délai de l'annuaire. */
  interval: number | null
  enabled: boolean
  created_by: string | null
  created_at: string | null
}

let localKeySeq = 0
function localKey(): string {
  localKeySeq += 1
  return `local-${localKeySeq}`
}

export function normalizeBumpConfig(raw: unknown): BumpReminderDraft[] {
  const r = asRecord(raw)
  if (!Array.isArray(r.reminders)) return []
  return r.reminders.map((item) => {
    const x = asRecord(item)
    const id = asString(x.id)
    return {
      key: id ?? localKey(),
      id,
      bot: String(x.bot ?? ''),
      channel_id: asSnowflake(x.channel_id),
      role_ids: Array.isArray(x.role_ids)
        ? x.role_ids.map(asSnowflake).filter((v): v is string => v !== null)
        : [],
      ping_mode: asPingMode(x.ping_mode),
      interval: typeof x.interval === 'number' ? x.interval : null,
      enabled: x.enabled !== false,
      created_by: asSnowflake(x.created_by),
      created_at: asString(x.created_at),
    }
  })
}

export function newBumpReminderDraft(
  bot: string,
  pingMode: BumpPingMode,
  createdBy: string | null
): BumpReminderDraft {
  return {
    key: localKey(),
    id: null,
    bot,
    channel_id: null,
    role_ids: [],
    ping_mode: pingMode,
    interval: null,
    enabled: true,
    // Le backend ne le remplit pas : on garde l'auteur de la création.
    created_by: createdBy,
    created_at: null,
  }
}

/**
 * Corps du `PUT` : **toute** la config. Une entrée existante renvoie son `id`
 * tel quel ; une nouvelle n'en porte **pas** (le backend le génère). `interval`
 * absent = délai de l'annuaire.
 */
export function serializeBumpConfig(reminders: BumpReminderDraft[]): BumpReminderConfig {
  return {
    version: 1,
    reminders: reminders.map((r) => {
      const out: BumpReminder = {
        bot: r.bot,
        channel_id: r.channel_id ?? '',
        role_ids: [...r.role_ids],
        ping_mode: r.ping_mode,
        enabled: r.enabled,
      }
      if (r.id) out.id = r.id
      if (r.interval !== null) out.interval = r.interval
      if (r.created_by) out.created_by = r.created_by
      if (r.created_at) out.created_at = r.created_at
      return out
    }),
  }
}

export function isSameBumpConfig(a: BumpReminderDraft[], b: BumpReminderDraft[]): boolean {
  return JSON.stringify(serializeBumpConfig(a)) === JSON.stringify(serializeBumpConfig(b))
}

/** Actif dès qu'un rappel est actif **et** rattaché à un salon. */
export function isBumpReminderActive(config: unknown): boolean {
  return normalizeBumpConfig(config).some((r) => r.enabled && r.channel_id)
}

/** Rappels par annuaire dans le brouillon, pauses comprises (miroir de `used`). */
export function usedByDirectory(reminders: BumpReminderDraft[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const r of reminders) counts[r.bot] = (counts[r.bot] ?? 0) + 1
  return counts
}

/** Salons proposables : texte ou annonces (le `/bump` y est tapé, le rappel y est posté). */
export function bumpChannels(channels: Channel[]): Channel[] {
  return channels.filter(
    (c) => c.type === CHANNEL_TYPES.TEXT || c.type === CHANNEL_TYPES.ANNOUNCEMENT
  )
}

/** Rôles mentionnables : tout sauf `@everyone` (refusé par le backend). */
export function bumpRoles(roles: Role[], guildId: string | null): Role[] {
  return roles
    .filter((r) => r.id !== guildId && r.name !== '@everyone')
    .sort((a, b) => b.position - a.position)
}

// ─── Validation (miroir du backend) ───────────────────────────────────────────

export type BumpReminderField = 'bot' | 'channel_id' | 'role_ids' | 'interval'

export interface BumpReminderIssue {
  field: BumpReminderField
  /** Clé i18n sous `modules.bump_reminder.errors`. */
  key: string
  params?: Record<string, unknown>
}

/** Contrôles d'une entrée, indépendants des autres. */
export function validateBumpReminder(
  reminder: BumpReminderDraft,
  limits: BumpLimits,
  guildId: string | null
): BumpReminderIssue[] {
  const issues: BumpReminderIssue[] = []
  if (!reminder.bot) issues.push({ field: 'bot', key: 'directoryRequired' })
  if (!reminder.channel_id) issues.push({ field: 'channel_id', key: 'channelRequired' })
  if (reminder.role_ids.length > limits.roles) {
    issues.push({ field: 'role_ids', key: 'tooManyRoles', params: { max: limits.roles } })
  }
  if (new Set(reminder.role_ids).size !== reminder.role_ids.length) {
    issues.push({ field: 'role_ids', key: 'duplicateRole' })
  }
  if (guildId && reminder.role_ids.includes(guildId)) {
    issues.push({ field: 'role_ids', key: 'everyoneRole' })
  }
  if (
    reminder.interval !== null &&
    (reminder.interval < limits.interval_min || reminder.interval > limits.interval_max)
  ) {
    issues.push({
      field: 'interval',
      key: 'intervalRange',
      params: {
        min: formatInterval(limits.interval_min),
        max: formatInterval(limits.interval_max),
      },
    })
  }
  return issues
}

/** Deux rappels du même annuaire dans le même salon — refusé quel que soit le palier. */
export function hasDuplicateTarget(
  reminder: BumpReminderDraft,
  all: BumpReminderDraft[]
): boolean {
  return Boolean(
    reminder.channel_id &&
      all.some(
        (other) =>
          other.key !== reminder.key &&
          other.bot === reminder.bot &&
          other.channel_id === reminder.channel_id
      )
  )
}

/** Annuaires dont le brouillon dépasse le quota (typiquement : premium perdu). */
export function overQuotaDirectories(
  reminders: BumpReminderDraft[],
  limits: BumpLimits
): string[] {
  return Object.entries(usedByDirectory(reminders))
    .filter(([, count]) => count > limits.per_directory)
    .map(([bot]) => bot)
}

/** `true` si le brouillon peut partir tel quel. */
export function isBumpConfigValid(
  reminders: BumpReminderDraft[],
  limits: BumpLimits,
  guildId: string | null
): boolean {
  return (
    overQuotaDirectories(reminders, limits).length === 0 &&
    reminders.every(
      (r) => validateBumpReminder(r, limits, guildId).length === 0 && !hasDuplicateTarget(r, reminders)
    )
  )
}

// ─── Délais ───────────────────────────────────────────────────────────────────

/** Secondes → { heures, minutes } pour l'éditeur ; stocké en secondes. */
export function splitInterval(seconds: number): { hours: number; minutes: number } {
  return { hours: Math.floor(seconds / 3600), minutes: Math.round((seconds % 3600) / 60) }
}

/** « 2 h », « 1 h 30 », « 45 min » — unités universelles, pas de traduction requise. */
export function formatInterval(seconds: number): string {
  const { hours, minutes } = splitInterval(seconds)
  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours} h`
  return `${hours} h ${String(minutes).padStart(2, '0')}`
}

/** Compte à rebours « 1:02:03 » / « 12:34 », toujours calculé depuis `due_at`. */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

// ─── État en direct ───────────────────────────────────────────────────────────

const STATE_KINDS: BumpDirectoryStateKind[] = ['never_bumped', 'scheduled', 'due', 'sent']

export function normalizeBumpState(raw: unknown): BumpState {
  const r = asRecord(raw)
  const directories: BumpDirectoryState[] = Array.isArray(r.directories)
    ? r.directories.map((d) => {
        const x = asRecord(d)
        const state = STATE_KINDS.includes(x.state as BumpDirectoryStateKind)
          ? (x.state as BumpDirectoryStateKind)
          : 'never_bumped'
        return {
          bot: String(x.bot ?? ''),
          name: asString(x.name) ?? String(x.bot ?? ''),
          configured: x.configured !== false,
          state,
          seconds_remaining: typeof x.seconds_remaining === 'number' ? x.seconds_remaining : null,
          channel_id: asSnowflake(x.channel_id),
          due_at: asString(x.due_at),
          sent: x.sent === true,
          bumper_id: asSnowflake(x.bumper_id),
          opt_in: x.opt_in === true,
          bumped_at: asString(x.bumped_at),
        }
      })
    : []
  return { guild_id: String(r.guild_id ?? ''), enabled: r.enabled === true, directories }
}

// ─── Diagnostic ───────────────────────────────────────────────────────────────

export function normalizeBumpDiagnostics(raw: unknown): BumpDiagnostics {
  const r = asRecord(raw)
  const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : [])
  return {
    guild_id: String(r.guild_id ?? ''),
    checked: r.checked === true,
    reminders: Array.isArray(r.reminders)
      ? r.reminders.map((item) => {
          const x = asRecord(item)
          return {
            id: String(x.id ?? ''),
            bot: String(x.bot ?? ''),
            enabled: x.enabled !== false,
            channel_id: asSnowflake(x.channel_id),
            channel_exists: x.channel_exists !== false,
            unsupported_type: x.unsupported_type === true,
            missing: list(x.missing),
            missing_roles: list(x.missing_roles),
            unnotified_roles: list(x.unnotified_roles),
          }
        })
      : [],
  }
}

export interface BumpNotice {
  /** Clé i18n sous `modules.bump_reminder.diagnostics`. */
  key: string
  level: 'error' | 'warning'
  roleIds?: string[]
}

/**
 * Alertes d'une entrée. Un rôle non mentionnable n'est qu'un avertissement :
 * la sauvegarde n'est pas bloquée, la mention ne notifiera simplement personne.
 */
export function bumpReminderNotices(
  diagnostics: BumpDiagnostics | null,
  reminderId: string | null
): BumpNotice[] {
  if (!diagnostics?.checked || !reminderId) return []
  const d = diagnostics.reminders.find((x) => x.id === reminderId)
  if (!d) return []
  const notices: BumpNotice[] = []
  if (!d.channel_exists) notices.push({ key: 'channelDeleted', level: 'error' })
  else if (d.unsupported_type) notices.push({ key: 'channelUnsupported', level: 'error' })
  else if (d.missing.length > 0) notices.push({ key: 'channelMissingPermissions', level: 'error' })
  if (d.missing_roles.length > 0) {
    notices.push({ key: 'missingRoles', level: 'error', roleIds: d.missing_roles })
  }
  if (d.unnotified_roles.length > 0) {
    notices.push({ key: 'unnotifiedRoles', level: 'warning', roleIds: d.unnotified_roles })
  }
  return notices
}
