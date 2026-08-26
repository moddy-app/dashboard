import i18n from '@/i18n'
import { ApiError } from '@/lib/auth'
import { CHANNEL_TYPES, THREAD_CHANNEL_TYPES } from '@/types/api'
import type {
  Channel,
  LogCategoryConfig,
  LogsCatalog,
  LogsConfig,
  LogsDiagnostics,
} from '@/types/api'

/**
 * Limites de repli, utilisées **uniquement** si `/catalog` ne les sert pas.
 * Les vraies valeurs viennent du catalogue : ce sont des valeurs de travail
 * susceptibles de bouger, les coder en dur ferait diverger le formulaire du
 * backend au premier changement.
 */
const FALLBACK_LIMITS: LogsCatalog['limits'] = {
  channels_per_category: 3,
  ignored_channels: 25,
  ignored_roles: 25,
}

const FALLBACK_LOCALE_KEYS: LogsCatalog['locale_keys'] = {
  event: 'modules.logs.events.{category}.{event}',
  title: 'modules.logs.titles.{category}.{event}',
}

// ─── Normalisation ────────────────────────────────────────────────────────────

/**
 * Snowflakes → chaînes, dédupliqués, ordre conservé. Un id de 19 chiffres
 * dépasse `Number.MAX_SAFE_INTEGER` : aucun ne doit jamais passer par `Number`.
 */
function asIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const raw of value) {
    if (raw === null || raw === undefined || raw === '') continue
    const id = String(raw)
    if (!out.includes(id)) out.push(id)
  }
  return out
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const raw of value) {
    if (typeof raw !== 'string' || !raw) continue
    if (!out.includes(raw)) out.push(raw)
  }
  return out
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/** Formulaire vierge : `404` sur le `GET` et config vidée par `DELETE` y mènent tous les deux. */
export function emptyLogsConfig(): LogsConfig {
  return {
    categories: {},
    ignored_channel_ids: [],
    ignored_role_ids: [],
    ignore_bots: false,
    attach_transcripts: true,
    merge_duplicates: true,
    enabled: false,
  }
}

export function normalizeLogsConfig(raw: Record<string, unknown> | null | undefined): LogsConfig {
  const base = emptyLogsConfig()
  if (!raw) return base

  const categories: Record<string, LogCategoryConfig> = {}
  const rawCategories = raw.categories
  if (rawCategories && typeof rawCategories === 'object') {
    for (const [id, value] of Object.entries(rawCategories as Record<string, unknown>)) {
      const cat = (value ?? {}) as Record<string, unknown>
      categories[id] = {
        channel_ids: asIdList(cat.channel_ids),
        disabled_events: asStringList(cat.disabled_events),
      }
    }
  }

  return {
    categories,
    ignored_channel_ids: asIdList(raw.ignored_channel_ids),
    ignored_role_ids: asIdList(raw.ignored_role_ids),
    ignore_bots: asBool(raw.ignore_bots, base.ignore_bots),
    attach_transcripts: asBool(raw.attach_transcripts, base.attach_transcripts),
    merge_duplicates: asBool(raw.merge_duplicates, base.merge_duplicates),
    enabled: raw.enabled === true,
  }
}

export function normalizeLogsCatalog(raw: Record<string, unknown> | null | undefined): LogsCatalog {
  const source = (raw ?? {}) as Record<string, unknown>
  const categories: Record<string, LogsCatalog['categories'][string]> = {}
  const rawCategories = source.categories
  if (rawCategories && typeof rawCategories === 'object') {
    for (const [id, value] of Object.entries(rawCategories as Record<string, unknown>)) {
      const cat = (value ?? {}) as Record<string, unknown>
      categories[id] = {
        events: asStringList(cat.events),
        unimplemented: asStringList(cat.unimplemented),
      }
    }
  }

  const rawLimits = (source.limits ?? {}) as Record<string, unknown>
  const limit = (key: keyof LogsCatalog['limits']): number =>
    typeof rawLimits[key] === 'number' && rawLimits[key] > 0
      ? (rawLimits[key] as number)
      : FALLBACK_LIMITS[key]

  const rawKeys = (source.locale_keys ?? {}) as Record<string, unknown>
  const locales = asStringList(source.locales)

  return {
    categories,
    category_count:
      typeof source.category_count === 'number'
        ? source.category_count
        : Object.keys(categories).length,
    event_count:
      typeof source.event_count === 'number'
        ? source.event_count
        : Object.values(categories).reduce((n, c) => n + c.events.length, 0),
    locales: locales.length > 0 ? locales : ['en-US'],
    locale_keys: {
      event: typeof rawKeys.event === 'string' ? rawKeys.event : FALLBACK_LOCALE_KEYS.event,
      title: typeof rawKeys.title === 'string' ? rawKeys.title : FALLBACK_LOCALE_KEYS.title,
    },
    limits: {
      channels_per_category: limit('channels_per_category'),
      ignored_channels: limit('ignored_channels'),
      ignored_roles: limit('ignored_roles'),
    },
    required_channel_permissions: asStringList(source.required_channel_permissions),
    recommended_channel_permissions: asStringList(source.recommended_channel_permissions),
  }
}

export function normalizeLogsDiagnostics(
  raw: Record<string, unknown> | null | undefined
): LogsDiagnostics {
  const source = (raw ?? {}) as Record<string, unknown>
  const channels = Array.isArray(source.channels) ? source.channels : []
  return {
    guild_id: source.guild_id ? String(source.guild_id) : '',
    enabled: source.enabled === true,
    checked: source.checked === true,
    channels: channels.map((entry) => {
      const c = (entry ?? {}) as Record<string, unknown>
      return {
        channel_id: c.channel_id ? String(c.channel_id) : '',
        exists: c.exists !== false,
        is_thread: c.is_thread === true,
        unsupported_type: c.unsupported_type === true,
        ok: c.ok === true,
        missing_permissions: asStringList(c.missing_permissions),
        degraded_permissions: asStringList(c.degraded_permissions),
        categories: asStringList(c.categories),
      }
    }),
  }
}

// ─── État dérivé ──────────────────────────────────────────────────────────────

export const EMPTY_CATEGORY: LogCategoryConfig = { channel_ids: [], disabled_events: [] }

export function categoryOf(config: LogsConfig, categoryId: string): LogCategoryConfig {
  return config.categories[categoryId] ?? EMPTY_CATEGORY
}

/**
 * `enabled` est calculé, jamais stocké : le module tourne dès qu'une catégorie
 * a un salon. Sert aussi à la vue d'ensemble, qui n'a que la config brute.
 */
export function isLogsActive(
  config: LogsConfig | Record<string, unknown> | null | undefined
): boolean {
  if (!config) return false
  const normalized = normalizeLogsConfig(config as Record<string, unknown>)
  return Object.values(normalized.categories).some((c) => c.channel_ids.length > 0)
}

/** Tous les salons rattachés à au moins une catégorie, dans l'ordre de rencontre. */
export function linkedChannelIds(config: LogsConfig): string[] {
  const ids: string[] = []
  for (const cat of Object.values(config.categories)) {
    for (const id of cat.channel_ids) if (!ids.includes(id)) ids.push(id)
  }
  return ids
}

/**
 * Corps du `PUT` : document complet, **sans** `enabled` (calculé côté serveur).
 * Les catégories sans salon ni exclusion sont retirées — le backend le ferait de
 * toute façon, autant ne pas envoyer de bruit. Une catégorie sans salon **avec**
 * des exclusions est conservée : elle garde les décochages d'un admin qui retire
 * un salon cinq minutes.
 */
export function buildLogsBody(draft: LogsConfig, catalog: LogsCatalog): Omit<LogsConfig, 'enabled'> {
  const categories: Record<string, LogCategoryConfig> = {}
  for (const categoryId of Object.keys(catalog.categories)) {
    const current = categoryOf(draft, categoryId)
    const channel_ids = [...new Set(current.channel_ids)]
    // Filtré sur le catalogue : une exclusion qui n'appartient plus à la
    // catégorie serait refusée en 422.
    const known = new Set(catalog.categories[categoryId].events)
    const disabled_events = catalog.categories[categoryId].events.filter(
      (event) => current.disabled_events.includes(event) && known.has(event)
    )
    if (channel_ids.length > 0 || disabled_events.length > 0) {
      categories[categoryId] = { channel_ids, disabled_events }
    }
  }

  return {
    categories,
    ignored_channel_ids: [...new Set(draft.ignored_channel_ids)],
    ignored_role_ids: [...new Set(draft.ignored_role_ids)],
    ignore_bots: draft.ignore_bots,
    attach_transcripts: draft.attach_transcripts,
    merge_duplicates: draft.merge_duplicates,
  }
}

/** Comparaison de deux configs par leur corps normalisé (`enabled` exclu). */
export function isSameLogsConfig(a: LogsConfig, b: LogsConfig, catalog: LogsCatalog): boolean {
  return JSON.stringify(buildLogsBody(a, catalog)) === JSON.stringify(buildLogsBody(b, catalog))
}

// ─── Validation (miroir du backend) ───────────────────────────────────────────

export interface LogsIssue {
  key: string
  params?: Record<string, unknown>
}

/**
 * Reprend les règles que le backend applique en 422, pour les dire avant
 * l'appel. Le 422 reste le filet — ceci est l'UX.
 */
export function validateLogsBody(
  body: Omit<LogsConfig, 'enabled'>,
  catalog: LogsCatalog
): LogsIssue[] {
  const issues: LogsIssue[] = []
  const limits = catalog.limits
  const P = 'modules.logs.validation.'

  for (const [categoryId, category] of Object.entries(body.categories)) {
    const known = catalog.categories[categoryId]
    if (!known) {
      issues.push({ key: `${P}unknownCategory`, params: { category: categoryId } })
      continue
    }
    if (category.channel_ids.length > limits.channels_per_category) {
      issues.push({
        key: `${P}tooManyChannels`,
        params: { category: categoryId, max: limits.channels_per_category },
      })
    }
    const events = new Set(known.events)
    for (const event of category.disabled_events) {
      if (!events.has(event)) {
        issues.push({ key: `${P}unknownEvent`, params: { category: categoryId, event } })
      }
    }
  }

  if (body.ignored_channel_ids.length > limits.ignored_channels) {
    issues.push({ key: `${P}tooManyIgnoredChannels`, params: { max: limits.ignored_channels } })
  }
  if (body.ignored_role_ids.length > limits.ignored_roles) {
    issues.push({ key: `${P}tooManyIgnoredRoles`, params: { max: limits.ignored_roles } })
  }
  return issues
}

// ─── Erreurs de l'API ─────────────────────────────────────────────────────────

export interface LogsErrors {
  /** Messages sans champ d'ancrage — à afficher en haut du formulaire. */
  global: string[]
  /** Message rattaché à un chemin Pydantic (`categories.server.channel_ids`). */
  byPath: Map<string, string[]>
  /** Catégories mises en cause, pour surligner leur carte. */
  categories: Set<string>
  /** Salons mis en cause, extraits du message contextuel Discord. */
  channels: Set<string>
}

function emptyLogsErrors(): LogsErrors {
  return { global: [], byPath: new Map(), categories: new Set(), channels: new Set() }
}

/** Pydantic préfixe ses `msg` — le préfixe n'a aucun sens pour un admin. */
function cleanMessage(msg: string): string {
  return msg.replace(/^Value error, /, '').trim()
}

/** Snowflakes cités dans un message contextuel (« … sur le salon 111… »). */
function extractChannelIds(message: string): string[] {
  return message.match(/\b\d{17,20}\b/g) ?? []
}

/**
 * Catégorie citée dans un message de validateur global, qui n'a **aucun** `loc`
 * (« categories.server.disabled_events: 'message_delete' n'appartient pas… »,
 * « categories: catégorie inconnue 'bogus' »).
 */
function extractCategory(message: string, catalog: LogsCatalog | null): string | null {
  const path = message.match(/^categories\.([A-Za-z0-9_]+)\./)
  if (path) return path[1]
  const quoted = message.match(/'([A-Za-z0-9_]+)'/)
  if (quoted && catalog && catalog.categories[quoted[1]]) return quoted[1]
  return null
}

/**
 * Normalise les **deux** formes du champ `error` : tableau d'erreurs Pydantic
 * (schéma) ou chaîne (erreur contextuelle Discord). Les messages à `loc: []`
 * viennent d'un validateur de modèle : sans emplacement global, ils
 * disparaîtraient de l'écran.
 */
export function mapLogsError(error: ApiError, catalog: LogsCatalog | null): LogsErrors {
  const out = emptyLogsErrors()
  const issues = error.validationIssues

  if (issues.length > 0) {
    for (const issue of issues) {
      const message = cleanMessage(String(issue.msg ?? ''))
      if (!message) continue
      const loc = (issue.loc ?? []).filter((p) => p !== 'body' && p !== 'config')
      const path = loc.join('.')
      if (loc[0] === 'categories' && typeof loc[1] === 'string') out.categories.add(loc[1])
      const inferred = extractCategory(message, catalog)
      if (inferred) out.categories.add(inferred)
      for (const id of extractChannelIds(message)) out.channels.add(id)

      if (!path) out.global.push(message)
      else out.byPath.set(path, [...(out.byPath.get(path) ?? []), message])
    }
    return out
  }

  const message = cleanMessage(error.message)
  if (message) {
    out.global.push(message)
    for (const id of extractChannelIds(message)) out.channels.add(id)
    const inferred = extractCategory(message, catalog)
    if (inferred) out.categories.add(inferred)
  }
  return out
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────

export type LogsDiagnosticLevel = 'error' | 'warning'

export interface LogsDiagnosticNotice {
  channelId: string
  level: LogsDiagnosticLevel
  key: string
  params?: Record<string, unknown>
  categories: string[]
}

/**
 * Traduit le diagnostic en avertissements affichables. `checked: false` ne
 * produit **rien** : Discord n'a pas pu être interrogé, ce n'est pas un
 * diagnostic négatif. `manage_webhooks` reste un avertissement — il n'a jamais
 * bloqué une sauvegarde.
 */
export function diagnosticNotices(diagnostics: LogsDiagnostics | null): LogsDiagnosticNotice[] {
  if (!diagnostics || !diagnostics.checked) return []
  const P = 'modules.logs.diagnostics.'
  const notices: LogsDiagnosticNotice[] = []

  for (const channel of diagnostics.channels) {
    const base = { channelId: channel.channel_id, categories: channel.categories }
    if (!channel.exists) {
      notices.push({ ...base, level: 'error', key: `${P}deleted` })
      continue
    }
    if (channel.unsupported_type) {
      notices.push({ ...base, level: 'error', key: `${P}unsupportedType` })
      continue
    }
    if (channel.missing_permissions.length > 0) {
      notices.push({
        ...base,
        level: 'error',
        key: `${P}missingPermissions`,
        params: { permissions: channel.missing_permissions.join(', ') },
      })
    }
    if (channel.degraded_permissions.includes('manage_webhooks')) {
      notices.push({ ...base, level: 'warning', key: `${P}manageWebhooks` })
    }
  }

  return notices
}

// ─── Libellés ─────────────────────────────────────────────────────────────────

function fillKey(template: string, categoryId: string, event: string): string {
  return template.replace('{category}', categoryId).replace('{event}', event)
}

/**
 * Rend un identifiant lisible sans le traduire mot à mot : chaque segment passe
 * par `modules.logs.words.<mot>` (repli sur le mot lui-même), et la phrase est
 * capitalisée. `role_delete` devient « Rôle supprimé » plutôt que `role_delete`.
 *
 * C'est le **dernier** repli : un identifiant nu à l'écran n'apprend rien à un
 * admin, mais une approximation reste moins fiable que le vrai libellé du bot.
 */
export function humanizeId(id: string): string {
  const words = id
    .split(/[._-]/)
    .filter(Boolean)
    .map((word) => i18n.t(`modules.logs.words.${word}`, { defaultValue: word }))
  const phrase = words.join(' ')
  return phrase.charAt(0).toUpperCase() + phrase.slice(1)
}

/**
 * Nom court d'un événement, dans cet ordre :
 *
 * 1. `locale_keys.event` du catalogue — les libellés du **bot**, la seule source
 *    qui garantit que `/config` sur Discord et le dashboard nomment un événement
 *    pareil. Poser le fichier de locales du bot dans `src/locales/` suffit ;
 * 2. `modules.logs.eventNames.<event>` — traductions du dashboard, en attendant ;
 * 3. l'identifiant rendu lisible ({@link humanizeId}).
 */
export function eventLabel(catalog: LogsCatalog, categoryId: string, event: string): string {
  const botKey = fillKey(catalog.locale_keys.event, categoryId, event)
  if (i18n.exists(botKey)) return i18n.t(botKey)

  const ownKey = `modules.logs.eventNames.${event}`
  if (i18n.exists(ownKey)) return i18n.t(ownKey)

  return humanizeId(event)
}

/** Phrase du log (utile en complément du nom court). `null` si non traduite. */
export function eventTitle(
  catalog: LogsCatalog,
  categoryId: string,
  event: string
): string | null {
  const key = fillKey(catalog.locale_keys.title, categoryId, event)
  return i18n.exists(key) ? i18n.t(key) : null
}

/**
 * Nom d'une catégorie. Le catalogue ne sert aucune clé pour elles : les
 * libellés viennent des locales du bot recopiées dans `src/locales/`
 * (`modules.logs.categories.<id>.name`), repli sur l'identifiant lisible.
 */
export function categoryLabel(categoryId: string): string {
  const key = `modules.logs.categories.${categoryId}.name`
  return i18n.exists(key) ? i18n.t(key) : humanizeId(categoryId)
}

/** Phrase décrivant ce que couvre la catégorie. `null` si non traduite. */
export function categoryDescription(categoryId: string): string | null {
  const key = `modules.logs.categories.${categoryId}.description`
  return i18n.exists(key) ? i18n.t(key) : null
}

// ─── Sélecteurs de salons ─────────────────────────────────────────────────────

/**
 * Destinations proposables : texte, annonces et fils **actifs** — exactement ce
 * que le backend accepte. Vocal, catégorie, forum et scène sont filtrés plutôt
 * que laissés à un 422.
 */
export function logsDestinationChannels(channels: Channel[]): Channel[] {
  return channels.filter(
    (c) =>
      c.type === CHANNEL_TYPES.TEXT ||
      c.type === CHANNEL_TYPES.ANNOUNCEMENT ||
      THREAD_CHANNEL_TYPES.includes(c.type)
  )
}

export function isThreadChannel(channel: Channel | undefined): boolean {
  return channel !== undefined && THREAD_CHANNEL_TYPES.includes(channel.type)
}
