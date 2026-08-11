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
  | 'automod_ai'
  | 'bot_customization'

export interface StarboardConfig {
  channel_id: string
  reaction_count: number
  emoji: string
}

/**
 * Message de bienvenue (v2). Un message = un salon ; jusqu'à
 * {@link MAX_WELCOME_MESSAGES} par serveur. Plus aucun embed Discord : le bot
 * envoie un Container Components V2 (texte + barre d'accent uniquement).
 */
export interface WelcomeMessage {
  /** `wm_` + 8 hex minuscules, unique dans la guilde. Généré côté client. */
  id: string
  /** Snowflake en chaîne — ne JAMAIS parser en Number. */
  channel_id: string
  /** 1–1500 caractères (trim côté serveur). */
  message: string
  /** Entier décimal 0–0xFFFFFF ; `null` = couleur par défaut (0x5865F2). */
  accent_color: number | null
  enabled: boolean
  /** Informatif seulement (rempli par le backend). */
  created_by: string | null
  /** Informatif seulement, ISO 8601 UTC. */
  created_at: string | null
}

export interface WelcomeChannelConfig {
  version: 2
  messages: WelcomeMessage[]
}

/** Plafond serveur (MAX_WELCOME_MESSAGES) — un dépassement renvoie 422. */
export const MAX_WELCOME_MESSAGES = 5

/** Couleur d'accent appliquée par le bot quand `accent_color` vaut `null`. */
export const WELCOME_DEFAULT_ACCENT = 0x5865f2

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

// ─── Automod AI ────────────────────────────────────────────────────────────────

export type AutomodMaxAction = 'warn' | 'mute' | 'ban'
export type AutomodLanguage = 'auto' | 'fr' | 'en-US'

/** Un détecteur. `features` est une map ouverte : seul `content` existe
 *  aujourd'hui, mais les suivants auront la même forme → rendu générique. */
export interface AutomodFeature {
  enabled: boolean
  /** Snowflakes en chaînes — ne jamais passer par Number() (> 2^53). */
  exempt_roles: string[]
  exempt_channels: string[]
}

/**
 * Config du module `automod_ai`. Identique en lecture et en écriture : le PUT
 * remplace l'objet entier, on repart donc toujours de l'objet reçu.
 *
 * `categories_desactivees` est un champ ops sans sélecteur UI : il est conservé
 * tel quel et renvoyé au PUT, sinon on écraserait un réglage posé côté staff.
 * L'index signature permet de préserver aussi les champs ajoutés plus tard côté
 * backend et inconnus de ce front.
 */
export interface AutomodAiConfig {
  enabled: boolean
  /** ≤ 3000 caractères, injecté verbatim dans le prompt IA. */
  indications: string
  notify_channel_id: string | null
  ignore_moderators: boolean
  /** 1 (permissif) → 5 (strict) */
  severity: number
  max_action: AutomodMaxAction
  langue_serveur: AutomodLanguage
  categories_desactivees: string[]
  dry_run: boolean
  features: Record<string, AutomodFeature>
  [key: string]: unknown
}

export type AutomodWarning =
  | 'missing_notify_channel'
  | 'no_feature_enabled'
  | 'dry_run'
  | (string & {})

/** État *réel* du module : `running` ≠ `enabled` (voir GET /status). */
export interface AutomodAiStatus {
  guild_id: string
  module_id: string
  running: boolean
  enabled: boolean
  dry_run: boolean
  notify_channel_id: string | null
  active_features: string[]
  warnings: AutomodWarning[]
}

/** Réponse du contrôle anti-injection des indications. */
export interface AutomodIndicationsCheck {
  ok: boolean
  reason?: string
}

/** Budget IA quotidien (staff uniquement). */
export interface AutomodBudget {
  guild_id: string
  cap: number
  cap_overridden: boolean
  default_cap: number
  used_today: number
  /** Jour de comptage, format YYYYMMDD. */
  day: string
}

// ─── Bot Customization ─────────────────────────────────────────────────────────

/**
 * Style du pseudo (police / effet / couleurs). Toujours des **entiers 24-bit**
 * en lecture ; l'écriture accepte aussi des `"#RRGGBB"`.
 */
export interface BotCustomizationStyle {
  font_id: number | null
  effect_id: number | null
  colors: number[]
}

/**
 * Bloc stocké, `{}` si la guilde n'a jamais rien personnalisé. Les hashes
 * viennent de Discord (aucune image n'est stockée côté Moddy) — l'aperçu passe
 * par `avatar_url` / `banner_url`, à la racine de {@link BotCustomizationState}.
 */
export interface BotCustomizationConfig {
  nickname?: string | null
  bio?: string | null
  avatar_hash?: string | null
  banner_hash?: string | null
  /** URL source de la dernière image envoyée au bot (informative). */
  avatar_source?: string | null
  banner_source?: string | null
  style?: BotCustomizationStyle | null
  updated_at?: string | null
  /** Snowflake en **chaîne** — ne jamais passer dans `Number()`. */
  updated_by?: string | null
}

/**
 * Limites et listes pilotant le formulaire. À lire depuis l'API à chaque
 * chargement : polices, effets et plafonds peuvent bouger côté backend.
 */
export interface BotCustomizationLimits {
  nickname_max_length: number
  /** Ne compte **que** la partie serveur : le bot ajoute `bio_attribution`. */
  bio_max_length: number
  /** Dernière ligne ajoutée par le bot, au format markup Discord. */
  bio_attribution: string
  image_max_bytes: number
  image_content_types: string[]
  font_ids: number[]
  effect_ids: number[]
  /** Effet « dégradé » — le seul qui exige exactement 2 couleurs. */
  gradient_effect_id: number
}

export interface BotCustomizationState {
  guild_id: string
  config: BotCustomizationConfig
  /** URL CDN Discord de l'avatar de guilde, `null` sans hash. */
  avatar_url: string | null
  banner_url: string | null
  is_premium: boolean
  limits: BotCustomizationLimits
  /** Champs réservés au premium (les autres restent toujours modifiables). */
  premium_fields: string[]
}

/**
 * Corps du `PUT`/`PATCH` : **c'est la présence de la clé qui fait foi**.
 * Clé absente = inchangé, clé à `null` = réinitialisé. N'envoyer que le diff.
 */
export interface BotCustomizationUpdate {
  nickname?: string | null
  bio?: string | null
  avatar_url?: string | null
  banner_url?: string | null
  style?: {
    font_id: number | null
    effect_id: number | null
    /** `"#RRGGBB"` — le backend normalise en entiers. */
    colors: string[]
  } | null
}

/** Réponse de `POST .../uploads` — l'URL expire (`expires_in`, secondes). */
export interface BotCustomizationUpload {
  url: string
  content_type: string
  size: number
  expires_in: number
}

/**
 * Profil Discord **global** du bot (`GET /bot/profile`), lu en direct.
 *
 * À ne pas confondre avec le module `bot_customization`, qui personnalise le
 * bot **par guilde**. Celui-ci est ce que Discord affiche partout où aucune
 * personnalisation de guilde ne s'applique — donc la valeur de repli de
 * l'aperçu pour chaque champ laissé vide.
 */
export interface BotProfile {
  /** ID Discord du bot (= `DISCORD_CLIENT_ID`). */
  id: string
  username: string
  avatar_url: string | null
  banner_url: string | null
  /** Couleur d'accent, utilisée par Discord en fond quand il n'y a pas de bannière. */
  accent_color: number | null
  /** `null` si le RPC Discord est injoignable — best-effort, l'appel n'échoue pas. */
  bio: string | null
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
  | AutomodAiConfig
  | BotCustomizationConfig

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
  /**
   * `true` quand l'abonnement existe et est payé mais rendu **inopérant** par
   * une sanction globale (`is_active` vaut alors `false`). À afficher comme
   * « suspendu par une sanction », jamais comme « aucun abonnement ».
   */
  blocked_by_global_sanction?: boolean
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
