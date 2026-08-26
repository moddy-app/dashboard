import {
  CHANNEL_TYPES,
  TICKET_BUTTONS,
  TICKET_BUTTON_STYLES,
  TICKET_DEFAULT_MAX_OPEN_PER_USER,
  TICKET_DEFAULT_NAME_FORMAT,
  TICKET_DISCORD_CATEGORY_CAPS,
  TICKET_OPEN_PER_USER,
  TICKET_PANEL_STYLES,
  TICKET_PERMISSIONS,
  TICKET_TEXT_LIMITS,
} from '@/types/api'
import type {
  Channel,
  Ticket,
  TicketButton,
  TicketButtonStyle,
  TicketCategory,
  TicketPanel,
  TicketPanelStyle,
  TicketPermission,
  TicketsApply,
  TicketsConfig,
  TicketsLimits,
} from '@/types/api'
import { ApiError } from '@/lib/auth'
import type { ApiValidationIssue } from '@/lib/auth'

// Helpers du module Tickets.
//
// Tout part d'un principe : la config est **un seul document**, réécrit en
// entier à chaque sauvegarde. Le dashboard lit, mute son brouillon, et renvoie
// l'objet complet — `message_id` compris, qui appartient au bot.

// ─── Identifiants ─────────────────────────────────────────────────────────────

/**
 * Génère un identifiant `p_xxxxxx` / `c_xxxxxx` (6 hex minuscules). Un id est
 * tiré **à la création de l'objet et jamais après** : le bot apparie les
 * panneaux par id, un id regénéré vaut panneau neuf — et laisse l'ancien
 * message orphelin dans le salon Discord.
 */
export function newTicketId(prefix: 'p' | 'c', existingIds: readonly string[] = []): string {
  const taken = new Set(existingIds)
  for (let attempt = 0; attempt < 20; attempt++) {
    const bytes = new Uint8Array(3)
    crypto.getRandomValues(bytes)
    const id = `${prefix}_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
    if (!taken.has(id)) return id
  }
  // 20 collisions d'affilée sur 2^24 : impossible en pratique, mais on ne
  // renvoie jamais un id déjà pris (le backend renverrait 422).
  throw new Error('Could not generate a unique ticket id')
}

// ─── Normalisation ────────────────────────────────────────────────────────────

/** Snowflake → chaîne, jamais un nombre (19 chiffres > `Number.MAX_SAFE_INTEGER`). */
function asSnowflake(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

function asSnowflakeList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => String(v)).filter(Boolean)
}

function asText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return value.length > 0 ? value : null
}

function asOneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

function asPermissions(value: unknown): Record<string, TicketPermission[]> {
  if (typeof value !== 'object' || value === null) return {}
  const out: Record<string, TicketPermission[]> = {}
  for (const [roleId, perms] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(perms)) continue
    const kept = perms.filter((p): p is TicketPermission =>
      TICKET_PERMISSIONS.includes(p as TicketPermission)
    )
    if (kept.length > 0) out[String(roleId)] = kept
  }
  return out
}

/**
 * `buttons` a **trois** états qu'il ne faut pas aplatir : absent/`null` (défauts
 * du bot), `[]` (aucun bouton, choix explicite) et une liste explicite.
 */
function asButtons(value: unknown): TicketButton[] | null {
  if (!Array.isArray(value)) return null
  const seen = new Set<TicketButton>()
  for (const b of value) {
    if (TICKET_BUTTONS.includes(b as TicketButton)) seen.add(b as TicketButton)
  }
  return Array.from(seen)
}

function asAccentColor(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.min(Math.max(Math.trunc(n), 0), 0xffffff)
}

export function normalizeTicketCategory(raw: Record<string, unknown>, existingIds: string[] = []): TicketCategory {
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newTicketId('c', existingIds),
    name: typeof raw.name === 'string' ? raw.name : '',
    emoji: asText(raw.emoji),
    description: asText(raw.description),
    button_style: asOneOf<TicketButtonStyle>(raw.button_style, TICKET_BUTTON_STYLES, 'secondary'),
    discord_category_id: asSnowflake(raw.discord_category_id),
    allowed_role_ids: asSnowflakeList(raw.allowed_role_ids),
    denied_role_ids: asSnowflakeList(raw.denied_role_ids),
    ping_role_ids: asSnowflakeList(raw.ping_role_ids),
    permissions: asPermissions(raw.permissions),
    ping_staff_roles: raw.ping_staff_roles !== false,
    claim_enabled: raw.claim_enabled !== false,
    claim_lock: raw.claim_lock === true,
    buttons: asButtons(raw.buttons),
    open_message: asText(raw.open_message),
    close_message: asText(raw.close_message),
    name_format:
      typeof raw.name_format === 'string' && raw.name_format
        ? raw.name_format
        : TICKET_DEFAULT_NAME_FORMAT,
    max_open_per_user:
      typeof raw.max_open_per_user === 'number' && Number.isFinite(raw.max_open_per_user)
        ? raw.max_open_per_user
        : TICKET_DEFAULT_MAX_OPEN_PER_USER,
    enabled: raw.enabled !== false,
  }
}

export function normalizeTicketPanel(raw: Record<string, unknown>, existingIds: string[] = []): TicketPanel {
  const rawCategories = Array.isArray(raw.categories) ? raw.categories : []
  const categoryIds: string[] = []
  const categories = rawCategories.map((c) => {
    const category = normalizeTicketCategory((c ?? {}) as Record<string, unknown>, categoryIds)
    categoryIds.push(category.id)
    return category
  })

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newTicketId('p', existingIds),
    name: typeof raw.name === 'string' ? raw.name : '',
    channel_id: asSnowflake(raw.channel_id),
    // Bookkeeping du bot : lu, gardé, renvoyé tel quel.
    message_id: asSnowflake(raw.message_id),
    title: asText(raw.title),
    description: asText(raw.description),
    accent_color: asAccentColor(raw.accent_color),
    style: asOneOf<TicketPanelStyle>(raw.style, TICKET_PANEL_STYLES, 'buttons'),
    placeholder: asText(raw.placeholder),
    enabled: raw.enabled !== false,
    categories,
  }
}

export function normalizeTicketsConfig(raw: Record<string, unknown> | null | undefined): TicketsConfig {
  const rawPanels = Array.isArray(raw?.panels) ? (raw?.panels as unknown[]) : []
  const panelIds: string[] = []
  const panels = rawPanels.map((p) => {
    const panel = normalizeTicketPanel((p ?? {}) as Record<string, unknown>, panelIds)
    panelIds.push(panel.id)
    return panel
  })
  return { panels, enabled: raw?.enabled === true }
}

// ─── Création ─────────────────────────────────────────────────────────────────

export function createTicketPanel(name: string, existing: readonly TicketPanel[]): TicketPanel {
  return {
    id: newTicketId('p', existing.map((p) => p.id)),
    name,
    channel_id: null,
    message_id: null,
    title: null,
    description: null,
    accent_color: null,
    style: 'buttons',
    placeholder: null,
    enabled: true,
    categories: [],
  }
}

export function createTicketCategory(name: string, existingIds: readonly string[]): TicketCategory {
  return {
    id: newTicketId('c', existingIds),
    name,
    emoji: null,
    description: null,
    button_style: 'secondary',
    discord_category_id: null,
    allowed_role_ids: [],
    denied_role_ids: [],
    ping_role_ids: [],
    permissions: {},
    ping_staff_roles: true,
    claim_enabled: true,
    claim_lock: false,
    // `null` = les défauts du bot, ce que veut un admin qui n'a rien demandé.
    buttons: null,
    open_message: null,
    close_message: null,
    name_format: TICKET_DEFAULT_NAME_FORMAT,
    max_open_per_user: TICKET_DEFAULT_MAX_OPEN_PER_USER,
    enabled: true,
  }
}

// ─── Sérialisation ────────────────────────────────────────────────────────────

/**
 * `admin` implique les 8 autres permissions : on n'envoie que `["admin"]`, et
 * un rôle sans aucune permission est retiré de l'objet — le bot ferait pareil,
 * autant que le rechargement ne surprenne personne.
 */
export function serializePermissions(
  permissions: Record<string, TicketPermission[]>
): Record<string, TicketPermission[]> {
  const out: Record<string, TicketPermission[]> = {}
  for (const [roleId, perms] of Object.entries(permissions)) {
    if (perms.includes('admin')) {
      out[String(roleId)] = ['admin']
      continue
    }
    const kept = perms.filter((p) => TICKET_PERMISSIONS.includes(p))
    if (kept.length > 0) out[String(roleId)] = kept
  }
  return out
}

/**
 * Corps du `PUT` : l'objet **entier**, jamais un diff. `enabled` à la racine est
 * calculé côté serveur — l'envoyer n'a aucun effet, on l'omet.
 */
export function serializeTicketsConfig(panels: readonly TicketPanel[]): { panels: TicketPanel[] } {
  return {
    panels: panels.map((panel) => ({
      id: panel.id,
      name: panel.name.trim(),
      channel_id: panel.channel_id,
      // Round-trip : ne jamais l'inventer ni le vider pour « forcer un repost »
      // (le bot republie de toute façon, on perdrait juste la trace de l'ancien
      // message, qui resterait orphelin dans le salon).
      message_id: panel.message_id,
      title: panel.title,
      description: panel.description,
      accent_color: panel.accent_color,
      style: panel.style,
      // `placeholder` ne veut rien dire hors du style `select`.
      placeholder: panel.style === 'select' ? panel.placeholder : null,
      enabled: panel.enabled,
      categories: panel.categories.map((category) => ({
        ...category,
        name: category.name.trim(),
        permissions: serializePermissions(category.permissions),
        // `description` n'est rendue que par un menu déroulant, mais on la
        // conserve : repasser le panneau en `select` la retrouve.
      })),
    })),
  }
}

// ─── Couleur d'accent ─────────────────────────────────────────────────────────

/** Couleur du panneau quand `accent_color` vaut `null` (blurple Discord). */
export const TICKET_DEFAULT_ACCENT = 0x5865f2

/** `5793266` → `#5865F2`. `null` → la couleur que le bot applique par défaut. */
export function accentToHex(color: number | null): string {
  return `#${(color ?? TICKET_DEFAULT_ACCENT).toString(16).padStart(6, '0').toUpperCase()}`
}

/** `#5865F2` → `5793266`. `null` si le hex est invalide (champ laissé tel quel). */
export function hexToAccent(hex: string): number | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  return match ? parseInt(match[1], 16) : null
}

// ─── État du module ───────────────────────────────────────────────────────────

/**
 * Le module tourne dès qu'un panneau activé est rattaché à un salon. `enabled`
 * est calculé côté serveur, mais la vue d'ensemble ne dispose que de la config
 * brute stockée en base.
 */
export function isTicketsActive(config: TicketsConfig | Record<string, unknown> | null | undefined): boolean {
  if (!config) return false
  const panels = (config as TicketsConfig).panels
  if (!Array.isArray(panels)) return false
  return panels.some((p) => p?.enabled !== false && Boolean(p?.channel_id))
}

// ─── Filtrage des sélecteurs ──────────────────────────────────────────────────

/** Salons où un panneau peut être publié : texte ou annonces, comme le backend. */
export function panelChannels(channels: Channel[]): Channel[] {
  return channels.filter(
    (c) => c.type === CHANNEL_TYPES.TEXT || c.type === CHANNEL_TYPES.ANNOUNCEMENT
  )
}

/** Catégories Discord (type 4) — destination des salons de tickets. */
export function discordCategories(channels: Channel[]): Channel[] {
  return channels
    .filter((c) => c.type === CHANNEL_TYPES.CATEGORY)
    .sort((a, b) => a.position - b.position)
}

// ─── Quotas ───────────────────────────────────────────────────────────────────

/**
 * Plafond effectif d'un panneau : le quota module **et** le plafond Discord du
 * style choisi. Les deux viennent de `/limits` — les valeurs en dur ne servent
 * que si la route n'a pas répondu. À recalculer à chaque changement de `style`.
 */
export function panelCategoryCap(limits: TicketsLimits | null, style: TicketPanelStyle): number {
  const discord = limits?.discord_max_categories_per_panel?.[style] ?? TICKET_DISCORD_CATEGORY_CAPS[style]
  const module = limits?.max_categories_per_panel ?? Number.POSITIVE_INFINITY
  return Math.min(module, discord)
}

export function canAddPanel(panels: readonly TicketPanel[], limits: TicketsLimits | null): boolean {
  if (!limits) return true
  return panels.length < limits.max_panels
}

export function canAddCategory(panel: TicketPanel, limits: TicketsLimits | null): boolean {
  return panel.categories.length < panelCategoryCap(limits, panel.style)
}

// ─── Validation côté formulaire ───────────────────────────────────────────────

/** Clé de champ — sert à rattacher une erreur à l'input qui la porte. */
export function panelFieldKey(panelId: string, field: string): string {
  return `p:${panelId}.${field}`
}

export function categoryFieldKey(panelId: string, categoryId: string, field: string): string {
  return `p:${panelId}.c:${categoryId}.${field}`
}

export interface TicketsIssue {
  /** Champ concerné, `null` quand le problème ne se rattache à aucun input. */
  field: string | null
  /** Clé i18n du message. */
  key: string
  params?: Record<string, unknown>
}

const V = 'modules.tickets.validation.'

interface ValidationContext {
  limits: TicketsLimits | null
  channels: Channel[]
}

/**
 * Rejoue les règles de l'API avant l'appel : le 422 est le filet, pas l'UX.
 * Rien n'est *requis* pour enregistrer — un panneau sans salon ou une catégorie
 * sans catégorie Discord est un brouillon valide. Seuls les refus certains sont
 * remontés.
 */
export function validateTicketsConfig(
  panels: readonly TicketPanel[],
  { limits, channels }: ValidationContext
): TicketsIssue[] {
  const issues: TicketsIssue[] = []
  const L = TICKET_TEXT_LIMITS

  if (limits && panels.length > limits.max_panels) {
    issues.push({
      field: null,
      key: `${V}tooManyPanels`,
      params: { count: panels.length, max: limits.max_panels },
    })
  }

  const seenPanelIds = new Set<string>()
  const seenCategoryIds = new Set<string>()

  for (const panel of panels) {
    const pf = (field: string) => panelFieldKey(panel.id, field)

    if (seenPanelIds.has(panel.id)) {
      issues.push({ field: pf('id'), key: `${V}duplicatePanelId`, params: { id: panel.id } })
    }
    seenPanelIds.add(panel.id)

    if (!panel.name.trim()) issues.push({ field: pf('name'), key: `${V}panelNameRequired` })
    if (panel.name.length > L.name)
      issues.push({ field: pf('name'), key: `${V}tooLong`, params: { max: L.name } })
    if ((panel.title?.length ?? 0) > L.title)
      issues.push({ field: pf('title'), key: `${V}tooLong`, params: { max: L.title } })
    if ((panel.description?.length ?? 0) > L.description)
      issues.push({ field: pf('description'), key: `${V}tooLong`, params: { max: L.description } })
    if (panel.style === 'select' && (panel.placeholder?.length ?? 0) > L.placeholder)
      issues.push({ field: pf('placeholder'), key: `${V}tooLong`, params: { max: L.placeholder } })
    if (panel.accent_color !== null && (panel.accent_color < 0 || panel.accent_color > 0xffffff))
      issues.push({ field: pf('accent_color'), key: `${V}accentColorRange` })

    // Salon : le backend refuse un salon inconnu ou d'un autre type. Le contrôle
    // est sauté quand la liste des salons n'a pas pu être chargée.
    if (panel.channel_id && channels.length > 0) {
      const channel = channels.find((c) => c.id === panel.channel_id)
      if (!channel) {
        issues.push({ field: pf('channel_id'), key: `${V}unknownChannel` })
      } else if (channel.type !== CHANNEL_TYPES.TEXT && channel.type !== CHANNEL_TYPES.ANNOUNCEMENT) {
        issues.push({ field: pf('channel_id'), key: `${V}notATextChannel` })
      }
    }

    const cap = panelCategoryCap(limits, panel.style)
    if (panel.categories.length > cap) {
      issues.push({
        field: pf('categories'),
        key: `${V}tooManyCategories`,
        params: { name: panel.name || panel.id, count: panel.categories.length, max: cap },
      })
    }

    for (const category of panel.categories) {
      const cf = (field: string) => categoryFieldKey(panel.id, category.id, field)

      if (seenCategoryIds.has(category.id)) {
        issues.push({ field: cf('id'), key: `${V}duplicateCategoryId`, params: { id: category.id } })
      }
      seenCategoryIds.add(category.id)

      if (!category.name.trim()) issues.push({ field: cf('name'), key: `${V}categoryNameRequired` })
      if (category.name.length > L.name)
        issues.push({ field: cf('name'), key: `${V}tooLong`, params: { max: L.name } })
      if ((category.emoji?.length ?? 0) > L.emoji)
        issues.push({ field: cf('emoji'), key: `${V}tooLong`, params: { max: L.emoji } })
      if ((category.description?.length ?? 0) > L.categoryDescription)
        issues.push({
          field: cf('description'),
          key: `${V}tooLong`,
          params: { max: L.categoryDescription },
        })
      if ((category.open_message?.length ?? 0) > L.message)
        issues.push({ field: cf('open_message'), key: `${V}tooLong`, params: { max: L.message } })
      if ((category.close_message?.length ?? 0) > L.message)
        issues.push({ field: cf('close_message'), key: `${V}tooLong`, params: { max: L.message } })
      if (category.name_format.length > L.nameFormat)
        issues.push({ field: cf('name_format'), key: `${V}tooLong`, params: { max: L.nameFormat } })
      if (
        category.max_open_per_user < TICKET_OPEN_PER_USER.min ||
        category.max_open_per_user > TICKET_OPEN_PER_USER.max
      )
        issues.push({
          field: cf('max_open_per_user'),
          key: `${V}maxOpenRange`,
          params: { min: TICKET_OPEN_PER_USER.min, max: TICKET_OPEN_PER_USER.max },
        })

      if (category.discord_category_id && channels.length > 0) {
        const parent = channels.find((c) => c.id === category.discord_category_id)
        if (!parent) {
          issues.push({ field: cf('discord_category_id'), key: `${V}unknownDiscordCategory` })
        } else if (parent.type !== CHANNEL_TYPES.CATEGORY) {
          issues.push({ field: cf('discord_category_id'), key: `${V}notADiscordCategory` })
        }
      }
    }
  }

  return issues
}

/** Regroupe les problèmes par champ — un champ ne montre que le premier. */
export function issuesByField(issues: readonly TicketsIssue[]): Map<string, TicketsIssue> {
  const map = new Map<string, TicketsIssue>()
  for (const issue of issues) {
    if (issue.field && !map.has(issue.field)) map.set(issue.field, issue)
  }
  return map
}

// ─── Erreurs de l'API ─────────────────────────────────────────────────────────

export interface TicketsApiErrors {
  /** Erreurs rattachées à un champ (`field` → message du backend). */
  fields: Record<string, string>
  /** Messages qui ne se rattachent à aucun champ — à afficher en bandeau. */
  global: string[]
}

/**
 * Le champ `error` a **trois formes** :
 * - un tableau Pydantic (`loc: ["panels", 0, "categories", 1, "name"]`) → on
 *   remonte au panneau/à la catégorie **envoyés** pour retrouver leurs ids ;
 * - une chaîne (quota dépassé, salon invalide, permission manquante) → bandeau,
 *   elle nomme le panneau mais pas le champ ;
 * - `{"error": "Validation error", "detail": [...]}` sur les query params, qui
 *   ne concerne que les vues en lecture.
 */
export function mapTicketsApiError(
  error: ApiError,
  sentPanels: readonly TicketPanel[]
): TicketsApiErrors {
  const fields: Record<string, string> = {}
  const global: string[] = []

  const issues: ApiValidationIssue[] = error.validationIssues
  if (issues.length === 0) {
    global.push(error.message)
    return { fields, global }
  }

  for (const issue of issues) {
    const loc = (issue.loc ?? []).filter((part) => part !== 'body' && part !== 'config')
    const panelsIdx = loc.indexOf('panels')
    const panelIndex = panelsIdx >= 0 ? loc[panelsIdx + 1] : undefined
    const panel = typeof panelIndex === 'number' ? sentPanels[panelIndex] : undefined

    if (!panel) {
      global.push(issue.msg)
      continue
    }

    const catIdx = loc.indexOf('categories')
    const categoryIndex = catIdx >= 0 ? loc[catIdx + 1] : undefined
    const category =
      typeof categoryIndex === 'number' ? panel.categories[categoryIndex] : undefined

    const field = String(loc[loc.length - 1] ?? '')
    if (category) {
      fields[categoryFieldKey(panel.id, category.id, field)] = issue.msg
    } else {
      fields[panelFieldKey(panel.id, field)] = issue.msg
    }
  }

  return { fields, global }
}

/** `true` quand une sauvegarde est déjà en vol côté backend (verrou par serveur). */
export function isSaveConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409
}

// ─── Accusé du bot (`_apply`) ─────────────────────────────────────────────────

export type TicketsApplyLevel = 'success' | 'info' | 'warning' | 'error'

export interface TicketsApplyFeedback {
  level: TicketsApplyLevel
  /** Clé i18n du message principal. */
  key: string
  params?: Record<string, unknown>
  /** Détails affichés en plus (permissions manquantes…). */
  problems: { key: string; params?: Record<string, unknown> }[]
  /**
   * `true` quand rejouer la sauvegarde ferait publier les panneaux deux fois.
   * La tâche est dans le stream : le bot l'exécutera à son retour.
   */
  doNotRetry?: boolean
}

const A = 'modules.tickets.apply.'

/**
 * Traduit l'accusé du **bot** (pas du backend). `panels_failed > 0` est le seul
 * signal qu'un panneau est resté invisible dans Discord malgré un `200` : il ne
 * doit jamais être noyé dans un toast vert.
 */
export function ticketsApplyFeedback(apply?: TicketsApply | null): TicketsApplyFeedback {
  if (!apply) return { level: 'success', key: `${A}savedOnly`, problems: [] }

  if (apply.ok === false) {
    if (apply.error === 'bot_timeout') {
      // Enregistré, la tâche reste en file. Surtout pas de « Réessayer » : ça
      // republierait les panneaux une deuxième fois.
      return { level: 'info', key: `${A}pending`, problems: [], doNotRetry: true }
    }
    if (apply.error === 'task_transport_unavailable') {
      return { level: 'error', key: `${A}transportUnavailable`, problems: [] }
    }
    return {
      level: 'error',
      key: `${A}notApplied`,
      params: { error: apply.error ?? 'unknown' },
      problems: [],
    }
  }

  const problems: TicketsApplyFeedback['problems'] = []
  if (apply.hook_error) problems.push({ key: `${A}hookError` })

  const failed = apply.panels_failed ?? 0
  if (failed > 0) {
    return {
      level: 'warning',
      key: `${A}panelsFailed`,
      params: { count: failed },
      problems,
    }
  }

  if (apply.action === 'deleted') {
    return {
      level: 'success',
      key: `${A}deleted`,
      params: { count: apply.panels_deleted ?? 0 },
      problems,
    }
  }

  if (problems.length > 0) {
    return { level: 'warning', key: `${A}appliedWithProblems`, problems }
  }

  return {
    level: 'success',
    key: `${A}applied`,
    params: { count: apply.panels_posted ?? apply.panels ?? 0 },
    problems,
  }
}

// ─── Vues en lecture seule ────────────────────────────────────────────────────

export type TicketState = 'closed' | 'escalated' | 'claimed' | 'open'

/**
 * État affichable d'un ticket. La pastille de couleur du nom de salon Discord
 * (🔴🟢🟣⚫) est **dérivée** côté bot, jamais stockée : on la déduit ici des
 * mêmes champs plutôt que de parser un nom de salon.
 */
export function ticketState(ticket: Ticket): TicketState {
  if (ticket.status === 'closed') return 'closed'
  if (ticket.escalated) return 'escalated'
  if (ticket.claimed_by) return 'claimed'
  return 'open'
}

/** Un ticket dont la catégorie a disparu de la config : le bot n'y peut plus rien. */
export function isOrphanTicket(ticket: Ticket): boolean {
  return ticket.category === null
}

/** Tickets **ouverts** rattachés à une catégorie — garde-fou avant suppression. */
export function openTicketsForCategory(tickets: readonly Ticket[], categoryId: string): Ticket[] {
  return tickets.filter((ticket) => ticket.category_id === categoryId && ticket.status === 'open')
}

/** `7412` → `2 h 3 min`, dans la langue courante. Les secondes ne servent à rien ici. */
export function formatDuration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds)) return null
  const total = Math.max(Math.round(seconds), 0)
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}min`
  return `${minutes}min`
}
