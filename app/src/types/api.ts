// Types TypeScript complets basés sur docs/API_ENDPOINTS.md

// ─── Attributs ────────────────────────────────────────────────────────────────

export interface GuildAttributes {
  PREMIUM?: true
  BETA?: true
  BLACKLISTED?: true
  /** Serveur officiel de Moddy */
  OFFICIAL?: true
  /** Serveur d'une organisation vérifiée par Moddy */
  VERIFIED_ORG?: true
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
  guild_id: string
  name: string
  icon: string | null
  attributes: GuildAttributes
  data: { modules?: Record<string, ModuleConfig> }
  in_database: boolean
}

export interface GuildDetail {
  guild_id: string
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

export interface GuildEmoji {
  id: string
  name: string
  animated?: boolean
}

export interface GuildStats {
  guild_id: string
  is_premium: boolean
  total_cases: number
  open_cases: number
}

/** Statut premium d'un serveur (GET /guilds/{id}/premium). is_premium=true même si
 *  l'attribut PREMIUM n'est pas encore positionné mais qu'un abonné actif est lié. */
export interface GuildPremium {
  guild_id: string
  is_premium: boolean
  subscriber_id: string | null
  tier: string | null
  expires_at: string | null
  linked_at: string | null
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
  | 'adaptive_slowmode'
  | 'social_notifications'

export interface StarboardConfig {
  channel_id: string
  reaction_count: number
  emoji: string
}

export interface WelcomeChannelConfig {
  channel_id: string
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
  role_ids: string[]
}

export interface AutoRestoreRolesConfig {
  enabled: boolean
  ignored_role_ids: string[]
}

export interface InterserverConfig {
  channel_id: string
  network_id: string
  webhook_url: string
}

export interface LoggingConfig {
  channel_id: string
  events: string[]
}

export type Sensitivity = 'low' | 'medium' | 'high'

export interface ChannelSlowmodeConfig {
  min_delay: number
  max_delay: number
  sensitivity: Sensitivity
}

export interface AdaptiveSlowmodeConfig {
  channels: Record<string, ChannelSlowmodeConfig>
}

// ─── Social Notifications ──────────────────────────────────────────────────────

export type SocialPlatform = 'youtube' | 'twitch' | 'bluesky' | 'rss' | 'instagram'

/** Config globale du module (endpoint générique des modules) */
export interface SocialNotificationsConfig {
  enabled: boolean
  default_message: string | null
}

/** Un abonnement (ligne de la table social_subscriptions) */
export interface SocialSubscription {
  id: number
  guild_id?: string
  platform: SocialPlatform
  target_id: string
  identifier: string
  display_name: string | null
  avatar_url: string | null
  channel_id: string
  message: string | null
  mention_role_ids: string[]
  poll_interval?: number
  enabled: boolean
  embed_color: number | null
  show_avatar: boolean
  show_media: boolean
  created_by?: string
  created_at: string
  updated_at?: string
}

/** Corps d'un POST /subscriptions (création) */
export interface SocialSubscriptionCreate {
  platform: SocialPlatform
  identifier: string
  channel_id: string
  message: string | null
  mention_role_ids: string[]
  embed_color: number | null
  show_avatar: boolean
  show_media: boolean
}

/** Corps d'un PATCH /subscriptions/{platform}/{target_id} (tous optionnels) */
export interface SocialSubscriptionUpdate {
  channel_id?: string
  message?: string | null
  mention_role_ids?: string[]
  enabled?: boolean
  embed_color?: number | null
  show_avatar?: boolean
  show_media?: boolean
}

/** Réponse résolue par le bot lors d'un ajout */
export interface SocialSubscribeResult {
  ok: boolean
  platform: SocialPlatform
  target_id: string
  display_name: string | null
  avatar_url: string | null
  error?: string
  limit?: number
}

export type ModuleConfig =
  | StarboardConfig
  | WelcomeChannelConfig
  | WelcomeDmConfig
  | AutoRoleConfig
  | AutoRestoreRolesConfig
  | InterserverConfig
  | LoggingConfig
  | AdaptiveSlowmodeConfig
  | SocialNotificationsConfig

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
  user_id: string
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
  entity_id: string
  status: 'open' | 'closed'
  reason: string
  evidence: string | null
  duration: number | null
  staff_notes: { staff_id: string; note: string; timestamp: string }[]
  created_by: string
  created_at: string
  updated_by: string | null
  updated_at: string
  closed_by: string | null
  closed_at: string | null
  close_reason: string | null
}

export interface BlacklistEntry {
  case_id: string
  entity_type: 'user' | 'guild'
  entity_id: string
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

// ─── Stripe / Abonnement ──────────────────────────────────────────────────────

export interface SubscriptionServer {
  server_id: string
  added_at: string
}

export interface SubscriptionData {
  user_id: string
  tier: 'monthly' | 'yearly' | 'free_trial' | null
  expires_at: string | null
  is_active: boolean
  stripe_customer_id: string | null
  servers: SubscriptionServer[]
  max_servers: number
}

export interface SubscriptionServersResponse {
  servers: SubscriptionServer[]
  count: number
  max_servers: number
}

// ─── Tally (Formulaires/Candidatures) ────────────────────────────────────────

export type TallySubmissionStatus = 'pending' | 'done' | 'rejected'

export interface TallyForm {
  form_id: string
  title: string
  created_at: string
  submission_count: number
}

export interface TallySubmissionItem {
  submission_id: string
  form_id: string
  discord_id: string
  status: TallySubmissionStatus
  note: string | null
  created_at: string
}

export interface TallySubmissionsResponse {
  total: number
  limit: number
  offset: number
  items: TallySubmissionItem[]
}

export interface TallyAnswer {
  id: number
  submission_id: string
  form_id: string
  key: string
  type: string
  label: string
  value: string
}

export interface TallySubmissionDetail extends TallySubmissionItem {
  answers: TallyAnswer[]
}
