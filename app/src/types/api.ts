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
  ANNOUNCEMENT_THREAD: 10,
  PUBLIC_THREAD: 11,
  PRIVATE_THREAD: 12,
  STAGE: 13,
  FORUM: 15,
} as const

/** Fils Discord — acceptés comme destination de logs tant qu'ils sont actifs. */
export const THREAD_CHANNEL_TYPES: number[] = [
  CHANNEL_TYPES.ANNOUNCEMENT_THREAD,
  CHANNEL_TYPES.PUBLIC_THREAD,
  CHANNEL_TYPES.PRIVATE_THREAD,
]

export interface Role {
  id: string
  name: string
  color: number
  position: number
  permissions: string
  mentionable: boolean
  managed: boolean
  hoist: boolean
  /**
   * Objets rôle Discord bruts : `tags` n'est présent que sur les rôles liés à
   * une intégration (`bot_id`), un booster (`premium_subscriber`)…
   */
  tags?: {
    bot_id?: string
    integration_id?: string
    premium_subscriber?: null
  }
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
  | 'adaptive_slowmode'
  | 'social_notifications'
  | 'automod_ai'
  | 'bot_customization'
  | 'altguard'
  | 'logs'

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

/**
 * Message privé de bienvenue (welcome_dm, v2). Jumeau de {@link WelcomeMessage}
 * à une différence structurelle près : **pas de `channel_id`** (le message part
 * en DM). Préfixe d'id `wdm_`, plafond {@link MAX_WELCOME_DMS} — à ne jamais
 * croiser avec ceux de `welcome_channel`.
 */
export interface WelcomeDmMessage {
  /** `wdm_` + 8 hex minuscules, unique dans la guilde. Généré côté client. */
  id: string
  /** 1–1500 caractères (trim côté serveur). */
  message: string
  /** Entier décimal 0–0xFFFFFF ; `null` = couleur par défaut (0x5865F2). */
  accent_color: number | null
  enabled: boolean
  /** Informatif seulement (rempli par le backend), snowflake en chaîne. */
  created_by: string | null
  /** Informatif seulement, ISO 8601 UTC. */
  created_at: string | null
}

export interface WelcomeDmConfig {
  version: 2
  messages: WelcomeDmMessage[]
}

/** Plafond serveur (MAX_WELCOME_DMS) — un dépassement renvoie 422. */
export const MAX_WELCOME_DMS = 3

/** Couleur d'accent appliquée par le bot quand `accent_color` vaut `null`. */
export const WELCOME_DM_DEFAULT_ACCENT = 0x5865f2

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

// ─── AltGuard ─────────────────────────────────────────────────────────────────

/** Langues disponibles pour le panneau de vérification (le texte, lui, est figé). */
export const ALTGUARD_PANEL_LOCALES = ['en-US', 'fr', 'es-ES', 'pt-BR', 'de'] as const

export type AltGuardPanelLocale = (typeof ALTGUARD_PANEL_LOCALES)[number]

/** Langue appliquée par le bot quand `panel_locale` est absent. */
export const ALTGUARD_DEFAULT_LOCALE: AltGuardPanelLocale = 'en-US'

/**
 * Config du module AltGuard. Tous les snowflakes sont des **chaînes** : un id de
 * 19 chiffres dépasse `Number.MAX_SAFE_INTEGER`, le passer par `Number()` le
 * corromprait.
 */
export interface AltGuardConfig {
  /** Salon de vérification — seul salon visible par le rôle non vérifié. */
  channel_id: string | null
  /** Rôle donné au join, qui bloque l'accès. */
  unverified_role_id: string | null
  /** Rôle donné quand la vérification passe. */
  verified_role_id: string | null
  /** Verdicts et décisions manuelles. Optionnel. */
  log_channel_id: string | null
  panel_locale: AltGuardPanelLocale
  /**
   * Bookkeeping du bot (id du panneau posté). **Jamais affiché ni envoyé** —
   * présent uniquement parce que le `GET` le renvoie.
   */
  message_id?: string | null
  /**
   * **Lecture seule** : calculé côté serveur (salon + les deux rôles). L'envoyer
   * est sans effet ; il n'existe pas d'interrupteur d'activation.
   */
  enabled?: boolean
}

/**
 * Accusé du bot renvoyé sous `_apply` par le `PUT` et le `DELETE` : une
 * sauvegarde peut réussir en base et échouer à moitié dans Discord.
 * Ce n'est **pas** de la config — à ne jamais stocker dans le formulaire ni
 * renvoyer dans le body suivant.
 */
export interface AltGuardApply {
  ok: boolean
  action?: 'updated' | 'deleted'
  enabled?: boolean
  panel?: 'posted' | 'failed' | 'deleted'
  panel_message_id?: string
  permissions?: { updated: number; failed: number; skipped: number }
  /** `bot_timeout`, `task_transport_unavailable`, `invalid_config`… */
  error?: string
  /** Le côté Discord a planté ; la config reste stockée et chargée. */
  hook_error?: string
  /** `DELETE` uniquement : `false` = le bot n'a pas retrouvé le panneau. */
  cleaned?: boolean
}

/** Réponse d'une écriture AltGuard : la config persistée + l'accusé du bot. */
export interface AltGuardSaveResult {
  config: AltGuardConfig
  apply: AltGuardApply | null
}

// ─── Logs ─────────────────────────────────────────────────────────────────────
//
// L'ancien module `logging` (endpoints `/guilds/{id}/logging`) n'est plus exposé
// par le dashboard : `logs` est le seul écran de logs.

/**
 * Une catégorie du catalogue reliée à ses salons. Le routage se fait **par
 * catégorie**, jamais par événement.
 */
export interface LogCategoryConfig {
  /** Snowflakes en chaînes. Limite lue dans `LogsCatalog.limits`. */
  channel_ids: string[]
  /**
   * **Exclusions uniquement** : ce qui est *coupé*, tout le reste de la
   * catégorie est actif. Stocker la liste des activés casserait la propriété
   * voulue — un événement ajouté plus tard au registre démarre allumé.
   */
  disabled_events: string[]
}

/**
 * Document de configuration du module. Il est lu et réécrit **en entier** :
 * `PUT` comme `PATCH` remplacent tout, il n'existe pas de patch partiel.
 */
export interface LogsConfig {
  categories: Record<string, LogCategoryConfig>
  ignored_channel_ids: string[]
  ignored_role_ids: string[]
  ignore_bots: boolean
  /** `false` → les `.txt` (transcripts, contenus débordants) sont retirés. */
  attach_transcripts: boolean
  /** Un log par *acte* plutôt qu'un par événement du registre (délai ~3 s). */
  merge_duplicates: boolean
  /** Valeurs autorisées lues dans `LogsCatalog.locales`, jamais codées en dur. */
  locale: string
  /**
   * **Lecture seule** : calculé côté serveur (`any(categories[*].channel_ids)`).
   * Ne jamais l'envoyer — il n'y a pas d'interrupteur d'activation.
   */
  enabled?: boolean
}

/** Une catégorie du catalogue : ses événements, dans l'ordre du registre du bot. */
export interface LogsCatalogCategory {
  events: string[]
  /**
   * Déclarés au registre mais qu'aucune source n'émet aujourd'hui. Configurables
   * (ils s'allumeront tout seuls) : à **griser**, jamais à masquer.
   */
  unimplemented: string[]
}

/**
 * Source de vérité du formulaire : catégories, limites et locales viennent
 * d'ici. Rien de tout ça ne doit être codé en dur côté dashboard — ce sont des
 * valeurs de travail susceptibles de bouger.
 */
export interface LogsCatalog {
  categories: Record<string, LogsCatalogCategory>
  category_count: number
  event_count: number
  locales: string[]
  /** Gabarits de clés i18n des libellés, servis par les locales du bot. */
  locale_keys: { event: string; title: string }
  limits: {
    channels_per_category: number
    ignored_channels: number
    ignored_roles: number
  }
  required_channel_permissions: string[]
  recommended_channel_permissions: string[]
}

export interface LogsChannelDiagnostic {
  channel_id: string
  exists: boolean
  is_thread: boolean
  unsupported_type: boolean
  ok: boolean
  /** Bloquant : rien ne sera logué dans ce salon. */
  missing_permissions: string[]
  /** Avertissement seulement (`manage_webhooks`) — la config reste valide. */
  degraded_permissions: string[]
  /** Catégories qui routent vers ce salon. */
  categories: string[]
}

/**
 * Inspecte la config **en base**, pas le brouillon. Seul endroit qui remonte les
 * problèmes non bloquants (permissions perdues après coup, `manage_webhooks`).
 */
export interface LogsDiagnostics {
  guild_id: string
  enabled: boolean
  /** `false` = Discord injoignable : rien à conclure, surtout pas une alerte. */
  checked: boolean
  channels: LogsChannelDiagnostic[]
}

export type ModuleConfig =
  | StarboardConfig
  | WelcomeChannelConfig
  | WelcomeDmConfig
  | AutoRoleConfig
  | AutoRestoreRolesConfig
  | InterserverConfig
  | AdaptiveSlowmodeConfig
  | SocialNotificationsConfig
  | AutomodAiConfig
  | BotCustomizationConfig
  | AltGuardConfig
  | LogsConfig

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

// ─── Tickets ─────────────────────────────────────────────────────────────────
//
// Module `tickets` : des **panneaux** (un message posté par le bot dans un
// salon) portant chacun des **catégories** (un bouton ou une option de menu qui
// ouvre un ticket). La config est un document unique, réécrit **en entier** à
// chaque sauvegarde — `PUT` et `PATCH` ont la même sémantique, il n'y a pas de
// patch partiel.

/** Boutons proposés dans le salon du ticket. */
export const TICKET_BUTTONS = [
  'close',
  'claim',
  'escalate',
  'staff_thread',
  'participants',
  'close_request',
] as const
export type TicketButton = (typeof TICKET_BUTTONS)[number]

/**
 * Ce que le bot pose quand `buttons` vaut `null`. `close_request` n'en fait
 * volontairement pas partie (il vit dans `/ticket close-request`), mais reste
 * cochable.
 */
export const TICKET_DEFAULT_BUTTONS: readonly TicketButton[] = [
  'close',
  'claim',
  'escalate',
  'staff_thread',
  'participants',
]

/** Permissions par rôle **et par catégorie**. `admin` implique toutes les autres. */
export const TICKET_PERMISSIONS = [
  'view',
  'close',
  'claim',
  'unclaim_others',
  'staff_thread',
  'rename',
  'move',
  'participants',
  'admin',
] as const
export type TicketPermission = (typeof TICKET_PERMISSIONS)[number]

export const TICKET_LOCALES = ['en-US', 'fr', 'es-ES', 'pt-BR', 'de'] as const
export type TicketLocale = (typeof TICKET_LOCALES)[number]
export const TICKET_DEFAULT_LOCALE: TicketLocale = 'en-US'

export const TICKET_BUTTON_STYLES = ['primary', 'secondary', 'success', 'danger'] as const
export type TicketButtonStyle = (typeof TICKET_BUTTON_STYLES)[number]

export const TICKET_PANEL_STYLES = ['buttons', 'select'] as const
export type TicketPanelStyle = (typeof TICKET_PANEL_STYLES)[number]

/** Longueurs maximales validées par l'API (rejouées côté formulaire). */
export const TICKET_TEXT_LIMITS = {
  name: 60,
  emoji: 64,
  categoryDescription: 100,
  title: 100,
  description: 2000,
  placeholder: 150,
  message: 2000,
  nameFormat: 90,
} as const

export const TICKET_DEFAULT_NAME_FORMAT = 'ticket-{number}'
export const TICKET_OPEN_PER_USER = { min: 1, max: 10 } as const
export const TICKET_DEFAULT_MAX_OPEN_PER_USER = 1

/**
 * Plafonds Discord utilisés **en dernier recours** : la vraie source est
 * `discord_max_categories_per_panel` de `GET /modules/tickets/limits`, qui
 * bouge avec les plateformes. Ne jamais s'en servir quand `/limits` a répondu.
 */
export const TICKET_DISCORD_CATEGORY_CAPS: Record<TicketPanelStyle, number> = {
  buttons: 15,
  select: 25,
}

/** Placeholders substitués par le bot dans `open_message` / `close_message`. */
export const TICKET_PLACEHOLDERS = [
  '{user}',
  '{number}',
  '{category}',
  '{server}',
  '{username}',
  '{display_name}',
  '{ticket}',
] as const

export interface TicketCategory {
  /** `c_` + 6 hex — généré côté dashboard, **stable** dans le temps. */
  id: string
  name: string
  emoji: string | null
  /** Description de l'option, visible uniquement en style `select`. */
  description: string | null
  button_style: TicketButtonStyle
  /** Catégorie Discord (type 4) où créer le salon du ticket. */
  discord_category_id: string | null
  /** Vide = tout le monde peut ouvrir un ticket (ce n'est pas « personne »). */
  allowed_role_ids: string[]
  /** Gagne toujours, y compris sur un administrateur du serveur. */
  denied_role_ids: string[]
  ping_role_ids: string[]
  /** Clé = id de rôle **en chaîne**. Un rôle sans permission est retiré. */
  permissions: Record<string, TicketPermission[]>
  ping_staff_roles: boolean
  claim_enabled: boolean
  claim_lock: boolean
  /** `null` ≠ `[]` : `null` = défauts du bot, `[]` = aucun bouton. */
  buttons: TicketButton[] | null
  locale: TicketLocale
  /** Le message d'ouverture **entier** (titre et pied compris) — ou `null`. */
  open_message: string | null
  close_message: string | null
  name_format: string
  max_open_per_user: number
  enabled: boolean
}

export interface TicketPanel {
  /** `p_` + 6 hex — généré côté dashboard, **stable** dans le temps. */
  id: string
  /** Nom interne du panneau (sert de titre par défaut). */
  name: string
  /** `null` = brouillon valide : un panneau sans salon s'enregistre. */
  channel_id: string | null
  /** Propriété du bot : lu et renvoyé tel quel, jamais inventé. */
  message_id: string | null
  title: string | null
  description: string | null
  accent_color: number | null
  style: TicketPanelStyle
  /** Style `select` uniquement. */
  placeholder: string | null
  enabled: boolean
  categories: TicketCategory[]
}

export interface TicketsConfig {
  panels: TicketPanel[]
  /** Calculé côté serveur : lecture seule, jamais envoyé. */
  enabled?: boolean
}

/**
 * Accusé du **bot** joint à la réponse d'une écriture. Un `200` ne veut pas
 * dire que Discord a suivi : `panels_failed > 0` = la config est enregistrée
 * mais le panneau reste invisible dans le salon.
 */
export interface TicketsApply {
  type?: string
  ok?: boolean
  action?: string
  enabled?: boolean
  panels?: number
  panels_posted?: number
  panels_failed?: number
  panels_deleted?: number
  error?: string
  hook_error?: string | boolean | null
}

export interface TicketsSaveResult {
  config: TicketsConfig
  apply: TicketsApply | null
}

export interface TicketsLimits {
  guild_id: string
  /** Tient compte des sanctions globales : un serveur sanctionné n'est plus premium. */
  premium: boolean
  enabled: boolean
  max_panels: number
  max_categories_per_panel: number
  discord_max_categories_per_panel: Record<TicketPanelStyle, number>
  /** Consommation actuelle. */
  panels: number
  /** Nombre de catégories par panneau, indexé par id de panneau. */
  categories: Record<string, number>
}

export type TicketStatus = 'open' | 'closed'

/** Catégorie résolue jointe à un ticket. `null` = catégorie supprimée (orphelin). */
export interface TicketCategoryRef {
  name: string
  panel_id: string
  panel_name: string
}

export interface Ticket {
  id: number
  guild_id: string
  channel_id: string
  panel_id: string | null
  category_id: string | null
  /** Le numéro que citent les humains — à afficher plutôt que le snowflake. */
  number: number
  owner_id: string
  status: TicketStatus
  escalated: boolean
  claimed_by: string | null
  claimed_at: string | null
  /** Claim mis de côté pendant une escalade — jamais avec `claimed_by`. */
  pre_escalation_claim: string | null
  escalation_mute: boolean
  staff_thread_id: string | null
  participants: string[]
  participant_roles: string[]
  close_requested_by: string | null
  close_request_reason: string | null
  opened_at: string
  closed_at: string | null
  closed_by: string | null
  close_reason: string | null
  category: TicketCategoryRef | null
}

export interface TicketListResponse {
  tickets: Ticket[]
  total: number
  limit: number
  offset: number
}

export interface TicketListFilters {
  status?: TicketStatus
  panel_id?: string
  category_id?: string
  owner_id?: string
  limit?: number
  offset?: number
}

export interface TicketStatsCategory {
  panel_id: string
  category_id: string
  total: number
  category: TicketCategoryRef | null
}

export interface TicketStats {
  guild_id: string
  total: number
  open: number
  closed: number
  escalated: number
  close_requested: number
  /** Tickets **ouverts** actuellement pris en charge. */
  claimed: number
  /** `null` tant qu'aucun ticket n'a été fermé. */
  avg_resolution_seconds: number | null
  window_days: number
  by_category: TicketStatsCategory[]
}

export interface TicketOrphansResponse {
  guild_id: string
  tickets: Ticket[]
  count: number
}
