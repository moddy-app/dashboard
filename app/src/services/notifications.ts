import { api } from '@/lib/auth'
import { accentColorToHex, customEmojiUrl, isSafeNotificationUrl, renderTemplate } from '@/lib/notifications'
import type {
  NotificationAuthor,
  NotificationContent,
  NotificationDelivery,
  NotificationDeliveryStatus,
  NotificationItem,
  NotificationKind,
  NotificationPage,
  NotificationPlatform,
  NotificationReportBlock,
  NotificationSource,
  NotificationTemplate,
} from '@/types/notifications'

// Lecture seule, de bout en bout : le dashboard n'écrit dans aucune des quatre
// tables du système (le bot en est propriétaire) et ne peut pas non plus
// déposer un signalement — cette action publie aussi le panneau de revue
// Discord, elle passe forcément par le bot.

const KINDS: NotificationKind[] = ['official', 'service', 'guild', 'service_guild']
const AUTHORS: NotificationAuthor[] = ['moddy', 'guild', 'staff']
const STATUSES: NotificationDeliveryStatus[] = ['pending', 'sent', 'failed', 'skipped']
const PLATFORMS: NotificationPlatform[] = ['discord', 'email', 'dashboard']

// Une valeur d'énumération inconnue **n'est pas une erreur** : le bot livre de
// nouveaux expéditeurs sans coordonner un déploiement du back-end. On dégrade.
function oneOf<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === 'string' && (allowed as string[]).includes(value) ? (value as T) : fallback
}

function str(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

function normalizeDeliveries(raw: unknown): Partial<Record<NotificationPlatform, NotificationDelivery>> {
  const out: Partial<Record<NotificationPlatform, NotificationDelivery>> = {}

  const push = (platform: unknown, entry: Record<string, unknown>) => {
    const key = typeof platform === 'string' ? platform : ''
    if (!(PLATFORMS as string[]).includes(key)) return
    out[key as NotificationPlatform] = {
      status: oneOf(entry.status, STATUSES, 'pending'),
      message_id: str(entry.message_id),
      error: str(entry.error),
      updated_at: str(entry.updated_at),
    }
  }

  // Deux formes acceptées : la liste renvoyée par la requête d'hydratation
  // (§8.1) et l'objet indexé par plateforme de l'API suggérée (§12).
  if (Array.isArray(raw)) {
    raw.forEach((entry) => {
      if (entry && typeof entry === 'object') {
        const row = entry as Record<string, unknown>
        push(row.platform, row)
      }
    })
  } else if (raw && typeof raw === 'object') {
    Object.entries(raw as Record<string, unknown>).forEach(([platform, entry]) => {
      if (entry && typeof entry === 'object') push(platform, entry as Record<string, unknown>)
    })
  }
  return out
}

/**
 * Le contenu servi par l'API est censé être **résolu** (§12). Mais la requête
 * de lecture (§8.2) joint `notification_contents.payload`, qui est un
 * *gabarit* : si l'API le laisse passer tel quel, on applique nous-mêmes
 * l'algorithme de substitution plutôt que d'afficher des `{accolades}`.
 */
function normalizeContent(row: Record<string, unknown>): NotificationContent {
  const variables = (row.variables ?? {}) as Record<string, unknown>
  const content = row.content

  if (content && typeof content === 'object' && !Array.isArray(content)) {
    const c = content as Record<string, unknown>
    // Un contenu déjà résolu ne porte plus de variables : on ne re-substitue
    // pas (`substitute` n'est pas récursif, une valeur contenant `{x}` doit
    // rester telle quelle).
    const sections = Array.isArray(c.sections) ? c.sections : []
    const links = Array.isArray(c.links) ? c.links : []
    return {
      title: String(c.title ?? ''),
      body: String(c.body ?? ''),
      icon_url: str(c.icon_url) ?? customEmojiUrl(str(c.icon)),
      accent_color:
        typeof c.accent_color === 'number'
          ? accentColorToHex(c.accent_color)
          : str(c.accent_color),
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
        .filter((l) => isSafeNotificationUrl(l.url)),
      footer: str(c.footer),
      template_id: str(c.template_id),
    }
  }

  return renderTemplate((row.payload ?? null) as NotificationTemplate | null, variables)
}

function normalizeSource(row: Record<string, unknown>): NotificationSource {
  const raw = (row.source ?? {}) as Record<string, unknown>
  return {
    service_id: str(raw.service_id) ?? str(row.source_service),
    service_label: str(raw.service_label),
    guild_id: str(raw.guild_id) ?? str(row.source_guild_id),
    guild_name: str(raw.guild_name),
    guild_icon: str(raw.guild_icon),
    verified: Boolean(raw.verified),
    official: Boolean(raw.official),
  }
}

export function normalizeNotification(raw: unknown): NotificationItem | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const id = str(row.id)
  if (!id) return null

  const deliveries = normalizeDeliveries(row.delivery ?? row.deliveries)
  // Repli sur les colonnes aplaties de la requête d'inbox (§8.2).
  if (!deliveries.discord && typeof row.discord_status === 'string') {
    deliveries.discord = {
      status: oneOf(row.discord_status, STATUSES, 'pending'),
      message_id: str(row.message_id),
      error: str(row.error),
      updated_at: null,
    }
  }

  return {
    id,
    created_at: str(row.created_at) ?? new Date(0).toISOString(),
    locale: str(row.locale),
    kind: oneOf(row.kind, KINDS, 'service'),
    author: oneOf(row.author, AUTHORS, 'moddy'),
    reportable: row.reportable === true,
    report_block: (str(row.report_block) as NotificationReportBlock | null) ?? null,
    source: normalizeSource(row),
    content: normalizeContent(row),
    delivery: deliveries,
  }
}

function normalizePage(raw: unknown): NotificationPage {
  // L'API peut répondre `{items, next}` ou un tableau nu.
  const body = Array.isArray(raw) ? { items: raw, next: null } : ((raw ?? {}) as Record<string, unknown>)
  const items = Array.isArray(body.items) ? body.items : []
  const next = body.next
  return {
    items: items.map(normalizeNotification).filter((n): n is NotificationItem => n !== null),
    // `{before: "<date>,<uuid>"}` ou directement la chaîne de curseur.
    next:
      typeof next === 'string'
        ? next
        : next && typeof next === 'object'
          ? str((next as Record<string, unknown>).before)
          : null,
  }
}

export interface NotificationQuery {
  limit?: number
  /** Curseur keyset `"<created_at>,<uuid>"` — jamais un OFFSET. */
  before?: string | null
}

function buildQuery({ limit = 25, before }: NotificationQuery): string {
  const params = new URLSearchParams({ limit: String(limit) })
  if (before) params.set('before', before)
  return `?${params.toString()}`
}

/** Boîte de réception du compte connecté. Autorisée par identité, pas par uuid. */
export async function getNotifications(query: NotificationQuery = {}): Promise<NotificationPage> {
  return normalizePage(await api(`/notifications${buildQuery(query)}`))
}
