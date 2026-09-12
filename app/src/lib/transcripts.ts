import { ApiError } from '@/lib/auth'
import { TICKET_SCORE_KEYS } from '@/types/transcripts'
import type {
  TicketRating,
  TicketScoreKey,
  TranscriptAttachment,
  TranscriptAuthor,
  TranscriptComponent,
  TranscriptDetail,
  TranscriptEmbed,
  TranscriptMessage,
  TranscriptSummary,
} from '@/types/transcripts'

// Helpers des archives de tickets.
//
// Le backend a déjà tout fait : décompression, décodage, ids en chaînes, dates
// en ISO 8601 UTC, messages du plus ancien au plus récent. Ce qui reste ici,
// c'est **de la lecture** : normaliser ce qui peut manquer, grouper pour le
// rendu, et nommer les choses dans la langue du lecteur.

// ─── Normalisation ────────────────────────────────────────────────────────────

const str = (v: unknown): string | null =>
  v === null || v === undefined || v === '' ? null : String(v)

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

function normalizeAuthor(raw: Record<string, unknown>): TranscriptAuthor {
  return {
    author_id: String(raw.author_id ?? ''),
    username: typeof raw.username === 'string' ? raw.username : '',
    display_name: str(raw.display_name),
    avatar_url: str(raw.avatar_url),
    is_bot: raw.is_bot === true,
  }
}

const obj = (v: unknown): Record<string, unknown> | null =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null

const num = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * L'URL d'un média Discord arrive tantôt en chaîne, tantôt dans un objet
 * (`{url, proxy_url}`) : on accepte les deux plutôt que d'afficher un trou.
 */
function mediaUrl(value: unknown): string | null {
  if (typeof value === 'string') return value || null
  const record = obj(value)
  if (!record) return null
  return str(record.url) ?? str(record.proxy_url)
}

function normalizeEmbed(raw: Record<string, unknown>): TranscriptEmbed {
  const author = obj(raw.author)
  const footer = obj(raw.footer)

  return {
    title: str(raw.title),
    description: str(raw.description),
    url: str(raw.url),
    color: num(raw.color),
    timestamp: str(raw.timestamp),
    author: author
      ? {
          name: typeof author.name === 'string' ? author.name : '',
          url: str(author.url),
          icon_url: str(author.icon_url) ?? str(author.proxy_icon_url),
        }
      : null,
    footer: footer
      ? {
          text: typeof footer.text === 'string' ? footer.text : '',
          icon_url: str(footer.icon_url) ?? str(footer.proxy_icon_url),
        }
      : null,
    image: mediaUrl(raw.image),
    thumbnail: mediaUrl(raw.thumbnail),
    fields: list(raw.fields).map((f) => {
      const field = (f ?? {}) as Record<string, unknown>
      return {
        name: typeof field.name === 'string' ? field.name : '',
        value: typeof field.value === 'string' ? field.value : '',
        inline: field.inline === true,
      }
    }),
  }
}

// Types numériques de Discord — ils ne vivent qu'ici, jamais dans un composant.
const BUTTON_STYLES: Record<number, Extract<TranscriptComponent, { kind: 'button' }>['style']> = {
  1: 'primary',
  2: 'secondary',
  3: 'success',
  4: 'danger',
  5: 'link',
  6: 'premium',
}

/**
 * Un émoji de composant, rendu dans **la syntaxe de Discord** : un émoji custom
 * ressort en `<:nom:id>` / `<a:nom:id>` pour que l'affichage aille chercher son
 * image sur le CDN, un émoji Unicode reste son glyphe.
 */
function emojiLabel(value: unknown): string | null {
  const emoji = obj(value)
  if (!emoji) return null
  const name = str(emoji.name)
  if (!name) return null
  const id = str(emoji.id)
  if (!id) return name
  return `<${emoji.animated === true ? 'a' : ''}:${name}:${id}>`
}

/**
 * Un composant Discord → une forme nommée. Un type inconnu n'est pas jeté : il
 * ressort en `unsupported`, de sorte qu'une archive écrite par un bot plus
 * récent que ce dashboard montre qu'il manquait quelque chose au lieu d'afficher
 * un message vide.
 */
function normalizeComponent(raw: unknown): TranscriptComponent {
  const c = obj(raw)
  if (!c) return { kind: 'unsupported', type: -1 }
  const type = Number(c.type)
  const children = () => list(c.components).map(normalizeComponent)

  switch (type) {
    case 1:
      return { kind: 'row', components: children() }
    case 2:
      return {
        kind: 'button',
        label: str(c.label),
        style: BUTTON_STYLES[Number(c.style)] ?? 'secondary',
        url: str(c.url),
        emoji: emojiLabel(c.emoji),
        disabled: c.disabled === true,
      }
    case 3:
    case 5:
    case 6:
    case 7:
    case 8:
      return {
        kind: 'select',
        placeholder: str(c.placeholder),
        options: list(c.options).map((o) => {
          const option = (o ?? {}) as Record<string, unknown>
          return {
            label: typeof option.label === 'string' ? option.label : '',
            description: str(option.description),
          }
        }),
      }
    case 9: {
      const accessory = c.accessory ? normalizeComponent(c.accessory) : null
      return { kind: 'section', content: children(), accessory }
    }
    case 10:
      return { kind: 'text', content: typeof c.content === 'string' ? c.content : '' }
    case 11:
      return {
        kind: 'thumbnail',
        url: mediaUrl(c.media),
        description: str(c.description),
        spoiler: c.spoiler === true,
      }
    case 12:
      return {
        kind: 'gallery',
        items: list(c.items).map((i) => {
          const item = (i ?? {}) as Record<string, unknown>
          return {
            url: mediaUrl(item.media),
            description: str(item.description),
            spoiler: item.spoiler === true,
          }
        }),
      }
    case 13:
      return {
        kind: 'file',
        url: mediaUrl(c.file),
        filename: str(c.name) ?? str((obj(c.file) ?? {}).filename),
        size: num((obj(c.file) ?? {}).size),
        spoiler: c.spoiler === true,
      }
    case 14:
      return {
        kind: 'separator',
        // `divider` est vrai par défaut chez Discord.
        divider: c.divider !== false,
        spacing: Number(c.spacing) === 2 ? 'large' : 'small',
      }
    case 17:
      return {
        kind: 'container',
        accent_color: num(c.accent_color),
        spoiler: c.spoiler === true,
        components: children(),
      }
    default:
      return { kind: 'unsupported', type }
  }
}

function normalizeMessage(raw: Record<string, unknown>): TranscriptMessage {
  return {
    id: String(raw.id ?? ''),
    author_id: String(raw.author_id ?? ''),
    created_at: String(raw.created_at ?? ''),
    content: str(raw.content),
    edited_at: str(raw.edited_at),
    attachments: list(raw.attachments).map((a) => {
      const attachment = (a ?? {}) as Record<string, unknown>
      const size = Number(attachment.size)
      return {
        filename: typeof attachment.filename === 'string' ? attachment.filename : '',
        url: str(attachment.url),
        size: Number.isFinite(size) ? size : null,
        content_type: str(attachment.content_type),
      }
    }),
    embeds: list(raw.embeds).map((e) => normalizeEmbed((e ?? {}) as Record<string, unknown>)),
    components: list(raw.components).map(normalizeComponent),
    stickers: list(raw.stickers ?? raw.sticker_items).map((s) => {
      const sticker = (s ?? {}) as Record<string, unknown>
      return {
        name: typeof sticker.name === 'string' ? sticker.name : '',
        url: mediaUrl(sticker.url) ?? mediaUrl(sticker),
      }
    }),
    pinned: raw.pinned === true,
    reactions: list(raw.reactions).map((r) => {
      const reaction = (r ?? {}) as Record<string, unknown>
      const count = Number(reaction.count)
      return {
        emoji: typeof reaction.emoji === 'string' ? reaction.emoji : '?',
        count: Number.isFinite(count) ? count : 0,
      }
    }),
    reply_to: str(raw.reply_to),
    system_type: str(raw.system_type),
  }
}

function normalizeRating(raw: unknown): TicketRating | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const score = Number(r.score)
  return {
    id: Number(r.id ?? 0),
    ticket_number: Number(r.ticket_number ?? 0),
    category_id: str(r.category_id),
    category_name: str(r.category_name),
    channel_id: str(r.channel_id),
    transcript_key: str(r.transcript_key),
    rated_staff_id: str(r.rated_staff_id),
    rated_by: str(r.rated_by),
    score: Number.isFinite(score) ? score : 0,
    score_key: asScoreKey(r.score_key, score),
    comment: str(r.comment),
    trigger: (r.trigger as TicketRating['trigger']) ?? 'self_close',
    created_at: String(r.created_at ?? ''),
  }
}

function normalizeMeta(raw: Record<string, unknown>) {
  const count = Number(raw.message_count)
  const size = Number(raw.payload_size)
  return {
    key: String(raw.key ?? ''),
    guild_id: String(raw.guild_id ?? ''),
    channel_id: str(raw.channel_id),
    ticket_number: Number(raw.ticket_number ?? 0),
    panel_id: str(raw.panel_id),
    category_id: str(raw.category_id),
    category_name: str(raw.category_name),
    owner_id: String(raw.owner_id ?? ''),
    participants: list(raw.participants).map(String),
    claimed_by: str(raw.claimed_by),
    closed_by: str(raw.closed_by),
    close_reason: str(raw.close_reason),
    opened_at: String(raw.opened_at ?? ''),
    closed_at: String(raw.closed_at ?? ''),
    message_count: Number.isFinite(count) ? count : 0,
    truncated: raw.truncated === true,
    payload_size: Number.isFinite(size) ? size : 0,
  }
}

export function normalizeTranscriptSummary(raw: Record<string, unknown>): TranscriptSummary {
  const category = (typeof raw.category === 'object' && raw.category !== null
    ? (raw.category as Record<string, unknown>)
    : null)
  const rating = normalizeRating(raw.rating)

  return {
    ...normalizeMeta(raw),
    category: category
      ? {
          name: typeof category.name === 'string' ? category.name : '',
          panel_id: str(category.panel_id),
          panel_name: str(category.panel_name),
        }
      : null,
    speakers: list(raw.speakers).map((s) => normalizeAuthor((s ?? {}) as Record<string, unknown>)),
    rating: rating
      ? {
          score: rating.score,
          score_key: rating.score_key,
          comment: rating.comment,
          created_at: rating.created_at,
        }
      : null,
  }
}

export function normalizeTranscriptDetail(raw: Record<string, unknown>): TranscriptDetail {
  const viewer = (typeof raw.viewer === 'object' && raw.viewer !== null
    ? (raw.viewer as Record<string, unknown>)
    : {}) as Record<string, unknown>

  const detail: TranscriptDetail = {
    ...normalizeMeta(raw),
    viewer: { is_staff: viewer.is_staff === true, is_owner: viewer.is_owner === true },
    authors: list(raw.authors).map((a) => normalizeAuthor((a ?? {}) as Record<string, unknown>)),
    version: Number(raw.version ?? 1),
    messages: list(raw.messages).map((m) => normalizeMessage((m ?? {}) as Record<string, unknown>)),
    has_staff_thread: raw.has_staff_thread === true,
    staff_thread_withheld: raw.staff_thread_withheld === true,
    rating: normalizeRating(raw.rating),
  }

  // La clé est **absente** pour un lecteur non-staff : on ne la matérialise pas
  // en tableau vide, sans quoi « il n'y a rien dedans » et « je n'y ai pas
  // droit » deviendraient indiscernables à l'affichage.
  if (Array.isArray(raw.staff_thread)) {
    detail.staff_thread = raw.staff_thread.map((m) =>
      normalizeMessage((m ?? {}) as Record<string, unknown>)
    )
  }

  return detail
}

// ─── Notes ────────────────────────────────────────────────────────────────────

/**
 * L'appréciation servie par l'API, avec repli sur le score. Une énumération
 * inconnue (une sixième appréciation ajoutée par le bot) ne doit jamais faire
 * afficher un code nu : on retombe sur la position du score.
 */
export function asScoreKey(value: unknown, score: number): TicketScoreKey {
  if (typeof value === 'string' && (TICKET_SCORE_KEYS as readonly string[]).includes(value)) {
    return value as TicketScoreKey
  }
  const index = Math.min(Math.max(Math.round(score), 1), TICKET_SCORE_KEYS.length) - 1
  return TICKET_SCORE_KEYS[index] ?? 'fair'
}

/** Une note est « négative » à partir de ≤ 2 — c'est la définition de l'API. */
export function isNegativeScore(score: number): boolean {
  return score <= 2
}

// ─── Mise en forme ────────────────────────────────────────────────────────────

/** `1584` → `1,5 ko`. Taille **décompressée** : c'est ce que pèse la conversation. */
export function formatBytes(bytes: number, locale: string): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  return `${value.toLocaleString(locale, {
    maximumFractionDigits: exponent === 0 ? 0 : 1,
  })} ${units[exponent]}`
}

/** Durée d'un ticket, de l'ouverture à la fermeture. */
export function transcriptDurationSeconds(transcript: {
  opened_at: string
  closed_at: string
}): number | null {
  const opened = Date.parse(transcript.opened_at)
  const closed = Date.parse(transcript.closed_at)
  if (!Number.isFinite(opened) || !Number.isFinite(closed)) return null
  return Math.max((closed - opened) / 1000, 0)
}

/** Nom affiché d'un auteur — l'instantané pris à la fermeture, jamais un lookup. */
export function authorName(author: TranscriptAuthor | undefined, fallbackId: string): string {
  if (!author) return fallbackId
  return author.display_name || author.username || fallbackId
}

export function authorInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  return trimmed.slice(0, 2).toUpperCase()
}

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|avif|bmp)$/i

/** Une pièce jointe qu'on peut prévisualiser — le reste reste une référence. */
export function isImageAttachment(attachment: TranscriptAttachment): boolean {
  if (attachment.content_type?.startsWith('image/')) return true
  return IMAGE_EXTENSIONS.test(attachment.filename)
}

// ─── Regroupement pour le rendu ───────────────────────────────────────────────

export interface TranscriptDayBlock {
  kind: 'day'
  /** Clé stable pour React — la date au format ISO court. */
  id: string
  date: Date
}

export interface TranscriptMessageBlock {
  kind: 'group'
  id: string
  authorId: string
  messages: TranscriptMessage[]
}

export interface TranscriptSystemBlock {
  kind: 'system'
  id: string
  message: TranscriptMessage
}

export type TranscriptBlock = TranscriptDayBlock | TranscriptMessageBlock | TranscriptSystemBlock

/** Deux messages du même auteur restent groupés en deçà de ce délai. */
const GROUP_WINDOW_MS = 7 * 60 * 1000

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

/**
 * Découpe la conversation en blocs affichables : séparateur de journée,
 * message système isolé, et groupes de messages consécutifs d'un même auteur.
 * Le regroupement suit la règle de Discord — même auteur, moins de 7 minutes
 * d'écart, pas de changement de jour.
 */
export function groupTranscriptMessages(messages: readonly TranscriptMessage[]): TranscriptBlock[] {
  const blocks: TranscriptBlock[] = []
  let currentDay: string | null = null
  let current: TranscriptMessageBlock | null = null

  for (const message of messages) {
    const date = new Date(message.created_at)
    const validDate = !Number.isNaN(date.getTime())
    const key = validDate ? dayKey(date) : 'unknown'

    if (key !== currentDay) {
      currentDay = key
      current = null
      if (validDate) blocks.push({ kind: 'day', id: `day-${key}`, date })
    }

    // Un message système n'appartient à personne : il coupe le groupe en cours.
    if (message.system_type) {
      current = null
      blocks.push({ kind: 'system', id: `sys-${message.id}`, message })
      continue
    }

    const previous = current?.messages[current.messages.length - 1]
    const gap =
      previous && validDate ? date.getTime() - new Date(previous.created_at).getTime() : Infinity

    // Une réponse commence toujours un nouveau groupe : sans son en-tête, la
    // citation au-dessus flotterait sans auteur.
    if (
      current &&
      current.authorId === message.author_id &&
      gap < GROUP_WINDOW_MS &&
      !message.reply_to
    ) {
      current.messages.push(message)
      continue
    }

    current = {
      kind: 'group',
      id: `grp-${message.id}`,
      authorId: message.author_id,
      messages: [message],
    }
    blocks.push(current)
  }

  return blocks
}

/** Tout le texte porté par un arbre de composants — sert à la recherche. */
export function componentText(components: readonly TranscriptComponent[]): string {
  const parts: string[] = []
  const walk = (component: TranscriptComponent) => {
    switch (component.kind) {
      case 'text':
        parts.push(component.content)
        break
      case 'button':
        if (component.label) parts.push(component.label)
        break
      case 'select':
        if (component.placeholder) parts.push(component.placeholder)
        parts.push(...component.options.map((o) => o.label))
        break
      case 'file':
        if (component.filename) parts.push(component.filename)
        break
      case 'section':
        component.content.forEach(walk)
        if (component.accessory) walk(component.accessory)
        break
      case 'container':
      case 'row':
        component.components.forEach(walk)
        break
      default:
        break
    }
  }
  components.forEach(walk)
  return parts.join('\n')
}

/**
 * Recherche plein texte dans une conversation. Elle regarde **tout ce qui est
 * lisible à l'écran** — texte, auteur, fichiers, embeds et composants V2 —
 * parce qu'un message de bot n'a souvent aucun `content`.
 */
export function transcriptSearchMatches(
  message: TranscriptMessage,
  authorLabel: string,
  query: string
): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return false
  if (message.content?.toLowerCase().includes(needle)) return true
  if (authorLabel.toLowerCase().includes(needle)) return true
  if (message.attachments.some((a) => a.filename.toLowerCase().includes(needle))) return true
  if (componentText(message.components).toLowerCase().includes(needle)) return true
  return message.embeds.some(
    (e) =>
      e.title?.toLowerCase().includes(needle) ||
      e.description?.toLowerCase().includes(needle) ||
      e.fields.some(
        (f) => f.name.toLowerCase().includes(needle) || f.value.toLowerCase().includes(needle)
      )
  )
}

/** `0x5865F2` → `#5865F2`. Couleur d'accent d'un embed ou d'un conteneur V2. */
export function discordColorToHex(color: number | null): string | null {
  if (color === null || !Number.isFinite(color)) return null
  return `#${Math.max(0, Math.trunc(color)).toString(16).padStart(6, '0')}`
}

// ─── Erreurs ──────────────────────────────────────────────────────────────────

export type TranscriptErrorKind = 'notFound' | 'unrenderable' | 'suspended' | 'unknown'

/**
 * Le `404` de `/transcripts/{key}` est **volontairement indistinguable** : clé
 * inconnue, clé mal formée, ou lecteur non autorisé. Confirmer qu'une clé
 * existe est déjà une fuite — donc « archive introuvable ou lien expiré »,
 * **jamais** « vous n'avez pas accès ».
 *
 * Le `422` est l'autre cas : l'archive existe et le lecteur y a droit, mais son
 * corps n'est pas rendable (codec inconnu, schéma plus récent, données
 * corrompues). Ce n'est pas un problème de droits, et ce n'est pas à rejouer.
 */
export function transcriptErrorKind(error: unknown): TranscriptErrorKind {
  if (!(error instanceof ApiError)) return 'unknown'
  if (error.status === 404) return 'notFound'
  if (error.status === 422) return 'unrenderable'
  if (error.status === 403) return 'suspended'
  return 'unknown'
}

/** L'URL partageable d'une archive — celle que le bot donne dans Discord. */
export function transcriptUrl(key: string): string {
  const origin = typeof window === 'undefined' ? 'https://dashboard.moddy.app' : window.location.origin
  return `${origin}/transcripts/${key}`
}
