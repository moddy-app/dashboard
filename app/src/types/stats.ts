/**
 * Statistiques internes (staff) et installation du bot.
 *
 * Contrat : `docs/backend-integration/stats-and-install.md`.
 * Deux règles de typage qui traversent tout ce fichier :
 *
 * 1. **Les identifiants Discord sont des chaînes.** Un snowflake dépasse
 *    `Number.MAX_SAFE_INTEGER` — `guild_id`, `installer_id`, `owner_id` ne
 *    sont jamais des `number`, même quand ils n'ont l'air que de chiffres.
 * 2. **Les valeurs de dimension sont des chaînes**, booléens compris :
 *    `{"ok": "true"}`. `{"ok": true}` est refusé en 422 par le backend.
 */

// ─── Installation ─────────────────────────────────────────────────────────────

/** Vocabulaire fermé des sources d'installation. Hors vocabulaire → `other`. */
export type InstallSource =
  | 'topgg'
  | 'discovery'
  | 'profile'
  | 'ads'
  | 'command'
  | 'direct'
  | 'other'

export interface InstallInfo {
  guild_id: string
  source: InstallSource | string
  /** UTM libres, tronqués à 200 caractères par le backend. */
  utm: Record<string, string>
  first_seen_at: string
  /** Posé par le bot à `on_guild_join` — `null` tant que Discord n'a pas livré l'événement. */
  confirmed_at: string | null
  /** `false` juste après le retour est **normal**, pas un échec. */
  confirmed: boolean
  /** Le serveur est déjà dans la liste de la session → le bouton « Configurer » peut être actif. */
  manageable: boolean
}

/** `install: null` = rien dans les 30 dernières minutes. */
export interface InstallLatestResponse {
  install: InstallInfo | null
}

export interface InstallSourcesResponse {
  sources: string[]
  default: string
  utm_params: string[]
}

// ─── Catalogue de métriques ───────────────────────────────────────────────────

/**
 * `counter` → « combien de fois » (s'additionne).
 * `gauge` → « combien y en a-t-il » (un état, ne s'additionne jamais).
 * `unique` → cardinalité approchée (HyperLogLog, ±0,8 %).
 */
export type MetricType = 'counter' | 'gauge' | 'unique'

export type MetricScope = 'global' | 'guild'

export interface MetricDescriptor {
  metric: string
  type: MetricType
  scopes: MetricScope[]
  bucket: string
  label: string
  /** Les seuls `by=` acceptés par `/breakdown`, et les seules clés de `dims`. */
  dims: string[]
  /** `micro_usd` → afficher en dollars (le backend rend déjà les deux formes). */
  unit: string
  /** `false` → n'afficher **aucun** total sur la période. */
  additive: boolean
  /** La courbe contiendra des points reconstruits (`filled: true`). */
  sparse: boolean
  /** Afficher « ~ » : c'est une estimation. */
  approximate: boolean
  notes: string
}

export interface StatsCatalog {
  metrics: MetricDescriptor[]
  types: Record<string, string>
  install_sources: string[]
}

// ─── Vue d'ensemble ───────────────────────────────────────────────────────────

export interface StatsWindow {
  from: string
  to: string
  days: number
  /** Journée en cours, toujours incomplète. */
  partial_day: string | null
}

export interface OverviewGauge {
  metric: string
  label: string
  value: number | null
  /** Peut dater d'hier : le rollup passe toutes les 6 h. Ce n'est pas un bug. */
  day: string | null
  previous: number | null
  /** `null` = aucune valeur connue avant la fenêtre → afficher « — », pas « 0 ». */
  delta: number | null
}

export interface GuildChurn {
  left_count: number
  /** En **secondes**. */
  avg_lifetime_seconds: number | null
  median_lifetime_seconds: number | null
}

export interface StatsOverview {
  window: StatsWindow
  gauges: OverviewGauge[]
  guilds: { joins: number; leaves: number; net: number; churn: GuildChurn }
  usage: { commands: number; command_errors: number; error_rate: number }
  ai: { cost_micro_usd: number; cost_usd: number }
  modules: { module: string; guilds: number; day: string | null }[]
}

// ─── Série journalière ────────────────────────────────────────────────────────

export interface SeriesPoint {
  day: string
  /** `null` = aucune valeur connue — laisser un **trou**, ne jamais tracer zéro. */
  value: number | null
  /** Point reconstruit (dernière valeur connue reportée) sur une jauge éparse. */
  filled?: boolean
}

export interface StatsSeries {
  metric: string
  type: MetricType
  unit: string
  label: string
  additive: boolean
  approximate: boolean
  from: string
  to: string
  partial_day: string | null
  points: SeriesPoint[]
  /** Ajouté pour `ai.cost` seulement. */
  total_usd?: number
}

// ─── Répartition ──────────────────────────────────────────────────────────────

export interface BreakdownItem {
  /** `unknown` = les lignes qui n'ont pas cette dimension. */
  key: string
  value: number
  /** Fraction 0→1, pas un pourcentage. */
  share: number
}

export interface StatsBreakdown {
  metric: string
  unit: string
  dimension: string
  from: string
  to: string
  total: number
  items: BreakdownItem[]
}

// ─── Classement de serveurs ───────────────────────────────────────────────────

export interface TopGuildItem {
  guild_id: string
  value: number
  /** Présent seulement pour `ai.cost`. */
  value_usd?: number
}

export interface StatsTopGuilds {
  metric: string
  unit: string
  from: string
  to: string
  items: TopGuildItem[]
}

// ─── Cycle de vie ─────────────────────────────────────────────────────────────

export interface LifecyclePoint {
  day: string
  joins: number
  leaves: number
  net: number
  /** Déjà calculé par le backend. */
  cumulative_net: number
}

export interface StatsLifecycle {
  days: number
  partial_day: string | null
  points: LifecyclePoint[]
  totals: { joins: number; leaves: number; net: number }
}

export interface RetentionCohort {
  /** Premier jour du mois de la cohorte (`YYYY-MM-DD`). */
  cohort: string
  acquired: number
  retained: number
  /** Fraction 0→1, `null` si la cohorte est vide. */
  rate: number | null
}

export interface StatsRetention {
  cohorts: RetentionCohort[]
}

export interface GuildEvent {
  id: number | string
  guild_id: string
  event: 'join' | 'leave' | string
  member_count: number | null
  owner_id: string | null
  /** En secondes. */
  guild_age_seconds: number | null
  lifetime_seconds: number | null
  source: string | null
  created_at: string
}

export interface StatsGuildEvents {
  events: GuildEvent[]
}

// ─── Acquisition ──────────────────────────────────────────────────────────────

export interface AcquisitionSource {
  source: string
  /** Compteur Redis best-effort — `null` si indisponible. Indicatif, rien ne se construit dessus. */
  clicks: number | null
  /** Autorisation Discord accordée (l'installation a pu échouer ensuite). */
  started: number
  /** Le bot a vraiment rejoint. */
  installed: number
  /** `installed / started` **sur la fenêtre**, déjà en pourcentage. */
  conversion_pct: number | null
  acquired_all_time: number
  still_here: number
  /** Serveurs encore présents / acquis, **sur toute l'histoire** — pas sur la fenêtre. */
  retention_pct: number | null
}

export interface StatsAcquisition {
  window: { days: number; partial_day: string | null }
  sources: AcquisitionSource[]
  notes?: Record<string, string>
}

export interface InstallRecord {
  guild_id: string
  installer_id: string | null
  source: string
  utm: Record<string, string>
  first_seen_at: string
  confirmed_at: string | null
  confirmed: boolean
}

export interface StatsInstalls {
  installs: InstallRecord[]
}

// ─── Consommation IA ──────────────────────────────────────────────────────────

export interface AiModelUsage {
  model: string
  cost_micro_usd: number
  cost_usd: number
  tokens: number
  calls: number
}

export interface AiDailyCost {
  day: string
  cost_micro_usd: number
  cost_usd: number
}

export interface StatsAi {
  window: StatsWindow
  guild_id: string | null
  cost_micro_usd: number
  cost_usd: number
  tokens: number
  calls: number
  failed_calls: number
  failure_rate: number
  by_model: AiModelUsage[]
  daily_cost: AiDailyCost[]
}

// ─── Santé de la collecte ─────────────────────────────────────────────────────

export interface StatsFreshness {
  last_bucket?: string | null
  rows?: number
  [key: string]: unknown
}

export interface StatsHealth {
  counters: StatsFreshness | null
  snapshots: StatsFreshness | null
  guild_events: StatsFreshness | null
  guild_installs: StatsFreshness | null
  /** Une partition de secours non vide = création de partition ratée côté bot. */
  default_partitions: Record<string, number>
  /** Déjà rédigées en clair par le backend. */
  alerts: string[]
  /** Le **seul** signal d'alerte de cette page. */
  ok: boolean
}
