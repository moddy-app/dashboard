// Types TypeScript complets basés sur docs/API_ENDPOINTS.md

// ─── Attributs ────────────────────────────────────────────────────────────────

export interface GuildAttributes {
  PREMIUM?: true
  BETA?: true
  BLACKLISTED?: true
}

export interface UserAttributes {
  TEAM?: true
  PREMIUM?: true
  BETA?: true
  BLACKLISTED?: true
  LANG?: 'FR' | 'EN'
}

// ─── Guilds ───────────────────────────────────────────────────────────────────

export interface GuildListItem {
  guild_id: number
  name: string
  icon: string | null
  attributes: GuildAttributes
  data: { modules?: Record<string, ModuleConfig> }
  in_database: boolean
}

export interface GuildDetail {
  guild_id: number
  name: string
  icon: string | null
  banner: string | null
  splash: string | null
  description: string | null
  owner_id: string
  premium_tier: 0 | 1 | 2 | 3
  premium_subscription_count: number
  preferred_locale: string
  verification_level: number
  vanity_url_code: string | null
  features: string[]
  member_count: number
  presence_count: number
  system_channel_id: string | null
  attributes: GuildAttributes
  data: { modules?: Record<string, ModuleConfig> }
  in_database: boolean
}

export interface Channel {
  id: string
  name: string
  type: number
  position: number
  parent_id: string | null
  permission_overwrites: unknown[]
  topic: string | null
}

export const CHANNEL_TYPES = {
  TEXT: 0,
  VOICE: 2,
  CATEGORY: 4,
  ANNOUNCEMENT: 5,
  STAGE: 13,
  FORUM: 15,
} as const

export interface Role {
  id: string
  name: string
  color: number
  position: number
  permissions: string
  mentionable: boolean
  managed: boolean
  hoist: boolean
}

export function roleColorToHex(color: number): string {
  return color === 0 ? '#99aab5' : `#${color.toString(16).padStart(6, '0')}`
}

export interface GuildStats {
  guild_id: number
  is_premium: boolean
  total_cases: number
  open_cases: number
}

// ─── Modules ──────────────────────────────────────────────────────────────────

export type ModuleId =
  | 'starboard'
  | 'welcome_channel'
  | 'welcome_dm'
  | 'auto_role'
  | 'auto_restore_roles'
  | 'interserver'
  | 'youtube_notifications'
  | 'logging'

export interface StarboardConfig {
  channel_id: number
  reaction_count: number
  emoji: string
}

export interface WelcomeChannelConfig {
  channel_id: number
  message_template: string
  mention_user: boolean
  embed_enabled: boolean
  embed_title?: string
  embed_description?: string | null
  embed_color?: number
  embed_footer?: string | null
  embed_image_url?: string | null
  embed_thumbnail_enabled?: boolean
  embed_author_enabled?: boolean
}

export interface WelcomeDmConfig {
  message_template: string
  embed_enabled: boolean
  embed_title?: string
  embed_description?: string | null
  embed_color?: number
}

export interface AutoRoleConfig {
  role_ids: number[]
}

export interface AutoRestoreRolesConfig {
  enabled: boolean
  ignored_role_ids: number[]
}

export interface InterserverConfig {
  channel_id: number
  network_id: string
  webhook_url: string
}

export interface LoggingConfig {
  channel_id: number
  events: string[]
}

export type ModuleConfig =
  | StarboardConfig
  | WelcomeChannelConfig
  | WelcomeDmConfig
  | AutoRoleConfig
  | AutoRestoreRolesConfig
  | InterserverConfig
  | LoggingConfig

// ─── Staff ────────────────────────────────────────────────────────────────────

export type StaffRole =
  | 'Dev'
  | 'Manager'
  | 'Supervisor_Mod'
  | 'Supervisor_Com'
  | 'Supervisor_Sup'
  | 'Moderator'
  | 'Communication'
  | 'Support'

export interface GlobalStats {
  total_users: number
  premium_users: number
  blacklisted_users: number
  stripe_users: number
  total_guilds: number
  premium_guilds: number
  total_staff: number
  open_cases: number
}

export interface UserFullProfile {
  user_id: number
  attributes: Record<string, boolean | string>
  stripe_customer_id: string | null
  email: string | null
  created_at: string
  staff_roles: string[]
  denied_commands: string[]
  total_cases: number
  open_cases: number
}

export interface ModerationCase {
  case_id: string
  case_type: 'global' | 'interserver'
  sanction_type: string
  entity_type: 'user' | 'guild'
  entity_id: number
  status: 'open' | 'closed'
  reason: string
  evidence: string | null
  duration: number | null
  staff_notes: { staff_id: number; note: string; timestamp: string }[]
  created_by: number
  created_at: string
  updated_by: number | null
  updated_at: string
  closed_by: number | null
  closed_at: string | null
  close_reason: string | null
}

export interface BlacklistEntry {
  case_id: string
  entity_type: 'user' | 'guild'
  entity_id: number
  reason?: string
  sanction_type: 'global_blacklist' | 'guild_blacklist'
  created_at: string
}

export interface BotStatus {
  shards: number
  latency: number
  uptime: number
  memory: number
}
