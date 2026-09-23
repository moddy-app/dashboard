// Module Rappels de bump (`bump_reminder`).
//
// Moddy détecte un bump d'annuaire (DISBOARD…) dans un salon et y poste un
// rappel quand le serveur peut de nouveau être bumpé. Snowflakes en chaînes.

export const BUMP_PING_MODES = ['auto', 'button', 'never'] as const
export type BumpPingMode = (typeof BUMP_PING_MODES)[number]

export interface BumpDirectory {
  /** Clé technique, référencée par `BumpReminder.bot`. */
  key: string
  /** Marque — jamais traduite (DISBOARD, DSMonitoring…). */
  name: string
  application_id: string
  /** Délai de l'annuaire, en secondes. */
  default_interval: number
  /** Rappels **en base** pour cet annuaire, pauses comprises. */
  used: number
}

export interface BumpLimits {
  /** Quota applicable au serveur (1 gratuit, 3 premium). */
  per_directory: number
  per_directory_free: number
  per_directory_premium: number
  roles: number
  interval_min: number
  interval_max: number
}

export interface BumpCatalog {
  guild_id: string
  premium: boolean
  enabled: boolean
  directories: BumpDirectory[]
  limits: BumpLimits
  ping_modes: BumpPingMode[]
  default_ping_mode: BumpPingMode
}

export interface BumpReminder {
  /** `br_` + 8 hex. **Absent** pour une nouvelle entrée : le backend le génère. */
  id?: string
  bot: string
  channel_id: string
  role_ids: string[]
  ping_mode: BumpPingMode
  /** Secondes. Absent = délai de l'annuaire. */
  interval?: number
  /** `false` = en pause. */
  enabled: boolean
  created_by?: string | null
  created_at?: string | null
}

export interface BumpReminderConfig {
  version: 1
  reminders: BumpReminder[]
}

export type BumpDirectoryStateKind = 'never_bumped' | 'scheduled' | 'due' | 'sent'

export interface BumpDirectoryState {
  bot: string
  name: string
  /** `false` = annuaire retiré de la config : ligne masquée, le bot la purge. */
  configured: boolean
  state: BumpDirectoryStateKind
  seconds_remaining: number | null
  /** Salon où le dernier bump a été détecté. */
  channel_id: string | null
  /** Seule base du compte à rebours côté client. */
  due_at: string | null
  sent: boolean
  bumper_id: string | null
  /** La personne a cliqué « Me rappeler ». */
  opt_in: boolean
  bumped_at: string | null
}

export interface BumpState {
  guild_id: string
  enabled: boolean
  directories: BumpDirectoryState[]
}

export interface BumpReminderDiagnostic {
  id: string
  bot: string
  enabled: boolean
  channel_id: string | null
  channel_exists: boolean
  unsupported_type: boolean
  missing: string[]
  missing_roles: string[]
  unnotified_roles: string[]
}

export interface BumpDiagnostics {
  guild_id: string
  /** `false` = Discord n'a pas répondu : on n'affiche rien. */
  checked: boolean
  reminders: BumpReminderDiagnostic[]
}
