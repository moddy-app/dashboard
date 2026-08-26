import { api } from '@/lib/auth'
import { isSafeNotificationUrl } from '@/lib/notifications'
import type {
  NotificationAuthor,
  NotificationContent,
  NotificationDeliveryStatus,
  NotificationItem,
  NotificationKind,
  NotificationPage,
  NotificationReportBlock,
  NotificationSource,
} from '@/types/notifications'

// Lecture seule, de bout en bout : le dashboard n'écrit dans aucune des tables
// du système de notifications. L'API sert du contenu déjà **résolu** — pas de
// gabarit, pas de substitution à faire ici — mais on reste défensif sur la
// forme exacte : une énumération inconnue doit dégrader, jamais planter.

const KINDS: NotificationKind[] = ['official', 'service', 'guild', 'service_guild']
const AUTHORS: NotificationAuthor[] = ['moddy', 'guild', 'staff']
const STATUSES: NotificationDeliveryStatus[] = ['pending', 'sent', 'failed', 'skipped']
const REPORT_BLOCKS: NotificationReportBlock[] = ['moddy_authored', 'official_guild']

function oneOf<T extends string>(value: unknown, allowed: T[]): T | null {
  return typeof value === 'string' && (allowed as string[]).includes(value) ? (value as T) : null
}

function str(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

function normalizeContent(raw: unknown): NotificationContent {
  const c = (raw ?? {}) as Record<string, unknown>
  const sections = Array.isArray(c.sections) ? c.sections : []
  const links = Array.isArray(c.links) ? c.links : []

  return {
    title: String(c.title ?? ''),
    body: String(c.body ?? ''),
    sections: sections
      .map((s) => ({
        title: String((s as Record<string, unknown>)?.title ?? ''),
        body: String((s as Record<string, unknown>)?.body ?? ''),
      }))
      .filter((s) => s.title || s.body),
    links: links
      .map((l) => ({
        label: String((l as Record<string, unknown>)?.label ?? ''),
        url: String((l as Record<string, unknown>)?.url ?? ''),
      }))
      // Défense en profondeur : l'API filtre déjà sur `https://` (§3 du guide).
      .filter((l) => isSafeNotificationUrl(l.url)),
    footer: str(c.footer),
    icon_url: str(c.icon_url),
    accent_color: str(c.accent_color),
    template_id: str(c.template_id),
  }
}

function normalizeSource(raw: unknown): NotificationSource | null {
  // `null` seulement quand `kind = 'official'` — Moddy institution n'a
  // personne d'autre à nommer.
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  return {
    service_id: str(s.service_id),
    service_label: str(s.service_label),
    guild_id: str(s.guild_id),
    guild_name: str(s.guild_name),
    guild_icon: str(s.guild_icon),
    verified: Boolean(s.verified),
    official: Boolean(s.official),
    guild_url: str(s.guild_url),
  }
}

export function normalizeNotification(raw: unknown): NotificationItem | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const id = str(row.id)
  if (!id) return null

  const delivery = (row.delivery ?? {}) as Record<string, unknown>
  const discord = delivery.discord as Record<string, unknown> | undefined

  return {
    id,
    created_at: str(row.created_at) ?? new Date(0).toISOString(),
    locale: str(row.locale),
    // Une valeur d'énumération inconnue dégrade plutôt que de casser le rendu
    // (le bot peut livrer de nouveaux kinds/services sans coordonner l'API).
    kind: oneOf(row.kind, KINDS) ?? 'service',
    author: oneOf(row.author, AUTHORS) ?? 'moddy',
    reportable: row.reportable === true,
    report_block: oneOf(row.report_block, REPORT_BLOCKS),
    source: normalizeSource(row.source),
    content: normalizeContent(row.content),
    delivery: discord
      ? { discord: { status: oneOf(discord.status, STATUSES) ?? 'pending', message_id: str(discord.message_id) } }
      : {},
  }
}

function normalizePage(raw: unknown): NotificationPage {
  const body = (raw ?? {}) as Record<string, unknown>
  const items = Array.isArray(body.items) ? body.items : []
  return {
    items: items.map(normalizeNotification).filter((n): n is NotificationItem => n !== null),
    next: str(body.next),
  }
}

export interface NotificationQuery {
  limit?: number
  /** Curseur opaque reçu dans `next` — jamais construit à la main, jamais un OFFSET. */
  before?: string | null
}

function buildQuery({ limit = 25, before }: NotificationQuery): string {
  const params = new URLSearchParams({ limit: String(limit) })
  if (before) params.set('before', before)
  return `?${params.toString()}`
}

/** Ma boîte de réception. */
export async function getNotifications(query: NotificationQuery = {}): Promise<NotificationPage> {
  return normalizePage(await api(`/notifications${buildQuery(query)}`))
}

/**
 * Une notification précise — je dois en être le destinataire, ou administrer
 * le serveur visé. Un `404` couvre les deux cas où je ne peux pas la voir
 * (elle n'existe pas / elle n'est pas à moi) : ne jamais essayer de les
 * distinguer côté UI (§5 du guide).
 */
export async function getNotification(id: string): Promise<NotificationItem | null> {
  return normalizeNotification(await api(`/notifications/${encodeURIComponent(id)}`))
}

/** Ce qu'un serveur a envoyé à travers Moddy (ses propres mots). */
export async function getGuildNotifications(
  guildId: string,
  query: NotificationQuery & { service?: string } = {}
): Promise<NotificationPage> {
  const qs = buildQuery(query)
  const withService = query.service
    ? `${qs}&service=${encodeURIComponent(query.service)}`
    : qs
  return normalizePage(await api(`/guilds/${encodeURIComponent(guildId)}/notifications${withService}`))
}

/** Ce que Moddy a adressé à ce serveur (avis, annonces). */
export async function getGuildNotificationsInbox(
  guildId: string,
  query: NotificationQuery = {}
): Promise<NotificationPage> {
  return normalizePage(
    await api(`/guilds/${encodeURIComponent(guildId)}/notifications/inbox${buildQuery(query)}`)
  )
}
