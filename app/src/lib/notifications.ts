import { formatDiscordTimestamps } from '@/lib/welcome-dm'
import type {
  NotificationContent,
  NotificationItem,
  NotificationLink,
  NotificationSection,
  NotificationTemplate,
} from '@/types/notifications'

// Rendu d'une notification. **Doit correspondre au bot caractère pour
// caractère** : un membre du staff qui compare le DM Discord et la carte du
// dashboard ne doit pas trouver deux messages différents.
//
// Toutes les fonctions de ce fichier sont pures (les vecteurs de test du guide
// d'intégration §18 s'y appliquent tels quels).

// ─── Substitution des placeholders (§5) ──────────────────────────────────────

const PLACEHOLDER = /\{([a-zA-Z0-9_]+)\}/g
/** Version non globale : `test()` sur une regex globale déplacerait `lastIndex`. */
const HAS_PLACEHOLDER = /\{[a-zA-Z0-9_]+\}/

/**
 * Sémantique de `str()` en Python : le bot rend le message avec Python, il faut
 * s'aligner. `True` et non `"true"`, `None` → chaîne vide. Aujourd'hui tous les
 * appelants passent des chaînes, mais `variables` est du JSONB — le jour où
 * quelqu'un passe un booléen, une divergence silencieuse s'installerait.
 */
function pythonStr(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  return String(value)
}

/**
 * Remplace `{cle}` par sa variable. Trois règles à ne pas assouplir :
 * - clé **absente** → le placeholder reste **visible**, accolades comprises
 *   (c'est comme ça qu'un gabarit cassé se remarque) ;
 * - valeur `null` → chaîne vide ;
 * - pas de récursion, et jamais de moteur de template qui jette sur une
 *   accolade orpheline — ce texte est arbitraire.
 */
export function substitute(
  text: string | null | undefined,
  variables: Record<string, unknown> | null | undefined
): string {
  if (!text) return ''
  if (!variables || Object.keys(variables).length === 0) return text
  return text.replace(PLACEHOLDER, (whole, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(variables, key)) return whole
    return pythonStr(variables[key])
  })
}

// ─── Émojis custom Discord ───────────────────────────────────────────────────

const CUSTOM_EMOJI = /<a?:[a-zA-Z0-9_]+:\d+>/g
/** Capture le drapeau animé et l'id, pour construire l'URL CDN. */
const CUSTOM_EMOJI_PARTS = /^<(a)?:[a-zA-Z0-9_]+:(\d+)>$/

/**
 * `<:done:123>` est du bruit littéral hors de Discord. On retire l'émoji puis
 * on écrase les suites d'espaces qu'il laisse derrière lui. Les emojis Unicode
 * (drapeaux…) ne sont pas concernés.
 */
export function stripCustomEmojis(text: string | null | undefined): string {
  return (text ?? '').replace(CUSTOM_EMOJI, '').replace(/[ \t]{2,}/g, ' ').trim()
}

/** `<a:spin:456>` → URL CDN. `null` si ce n'est pas un émoji custom. */
export function customEmojiUrl(icon: string | null | undefined): string | null {
  if (!icon) return null
  const match = CUSTOM_EMOJI_PARTS.exec(icon.trim())
  if (!match) return null
  const [, animated, id] = match
  return `https://cdn.discordapp.com/emojis/${id}.webp?size=48${animated ? '&animated=true' : ''}`
}

// ─── Couleur d'accent ────────────────────────────────────────────────────────

/** Entier décimal → `#RRGGBB`. `5793266` → `#5865F2`. `null` = accent par défaut. */
export function accentColorToHex(color: number | null | undefined): string | null {
  if (color === null || color === undefined || !Number.isFinite(color)) return null
  const clamped = Math.max(0, Math.min(0xffffff, Math.trunc(color)))
  return `#${clamped.toString(16).toUpperCase().padStart(6, '0')}`
}

// ─── Liens ───────────────────────────────────────────────────────────────────

/**
 * Les URL viennent du même endroit que le texte : d'un admin de serveur. On
 * n'accepte que `https://` — et un gabarit cassé peut laisser un
 * `https://…/{guild_id}` non substitué, qu'on écarte aussi.
 */
export function isSafeNotificationUrl(url: string | null | undefined): boolean {
  if (!url) return false
  if (HAS_PLACEHOLDER.test(url)) return false
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

// ─── Rendu complet ───────────────────────────────────────────────────────────

/**
 * Applique la substitution à `title`, `body`, chaque section, chaque lien et
 * `footer` — **jamais** à `icon`, `accent_color` ni `template_id`.
 */
export function renderTemplate(
  template: NotificationTemplate | null | undefined,
  variables: Record<string, unknown> | null | undefined
): NotificationContent {
  const payload = template ?? {}

  const sections: NotificationSection[] = (payload.sections ?? [])
    .map((section) => ({
      title: substitute(section?.title, variables),
      body: substitute(section?.body, variables),
    }))
    .filter((section) => section.title || section.body)

  const links: NotificationLink[] = (payload.links ?? [])
    .map((link) => ({
      label: substitute(link?.label, variables),
      url: substitute(link?.url, variables),
    }))
    .filter((link) => isSafeNotificationUrl(link.url))

  const footer = substitute(payload.footer, variables)

  return {
    title: substitute(payload.title, variables),
    body: substitute(payload.body, variables),
    icon_url: customEmojiUrl(payload.icon),
    accent_color: accentColorToHex(payload.accent_color),
    sections,
    links,
    footer: footer || null,
    template_id: payload.template_id ?? null,
  }
}

// ─── Origine (§6.4) ──────────────────────────────────────────────────────────

export type NotificationOrigin =
  | { type: 'guild'; guildId: string; name: string | null; icon: string | null; verified: boolean }
  | { type: 'service'; serviceId: string | null }
  | { type: 'none' }

/**
 * Ce qu'il faut nommer sous le message, pour que le dashboard et Discord
 * racontent la même chose. `official` = Moddy en tant qu'institution : personne
 * d'autre à citer.
 */
export function notificationOrigin(item: NotificationItem): NotificationOrigin {
  if (item.kind === 'official') return { type: 'none' }
  const source = item.source ?? { service_id: null }
  if (source.guild_id) {
    return {
      type: 'guild',
      guildId: String(source.guild_id),
      name: source.guild_name ?? null,
      icon: source.guild_icon ?? null,
      verified: Boolean(source.verified || source.official),
    }
  }
  if (source.service_id) return { type: 'service', serviceId: source.service_id }
  return { type: 'none' }
}

/** Lien vers le serveur d'origine, comme dans la ligne d'attribution du bot. */
export function guildLink(guildId: string): string {
  return `https://discord.com/channels/${guildId}`
}

// ─── Signalement ─────────────────────────────────────────────────────────────

/**
 * `reportable` est **gelé** à l'envoi : on ne le recalcule pas, et on ne rend
 * jamais une notification plus signalable qu'elle ne l'a été enregistrée.
 * Une notification `official` ne l'est jamais, quoi que dise la colonne.
 *
 * ⚠️ Le déclencheur n'existe pas encore côté bot (déposer un signalement publie
 * aussi le panneau de revue Discord et le journalise) : c'est une information
 * qu'on **affiche**, pas une action qu'on peut offrir.
 */
export function isReportable(item: NotificationItem): boolean {
  return item.kind !== 'official' && item.reportable === true
}

// ─── Syntaxe propre à Discord (§6.1) ─────────────────────────────────────────

export interface DiscordSyntaxLabels {
  /** Mention d'un utilisateur qu'on ne sait pas résoudre. */
  user: string
  role: string
  channel: string
}

/**
 * Le corps d'un message est du markdown Discord, et il peut porter de la
 * syntaxe que seul le client Discord sait rendre : `<@123>`, `<@&123>`,
 * `<#123>`, `<t:1700000000:R>`. Hors de Discord elle doit **dégrader en texte**,
 * jamais s'afficher brute.
 *
 * Une seule mention est résolue : celle du lecteur (`selfId`) — c'est la seule
 * identité qu'on ait sous la main, et c'est de très loin la plus fréquente (un
 * message de bienvenue s'adresse à la personne qui le lit). Le reste tombe sur
 * un libellé générique.
 *
 * `now` est passé en paramètre : la fonction est appelée pendant le rendu, un
 * `Date.now()` interne la rendrait impure.
 */
export function degradeDiscordSyntax(
  text: string,
  options: {
    locale: string
    now: number
    labels: DiscordSyntaxLabels
    selfId?: string | null
    selfName?: string | null
  }
): string {
  const { locale, now, labels, selfId, selfName } = options
  return formatDiscordTimestamps(text, locale, now)
    .replace(/<@!?(\d{15,25})>/g, (_raw, id: string) =>
      selfId && id === selfId && selfName ? `@${selfName}` : `@${labels.user}`
    )
    .replace(/<@&\d{15,25}>/g, `@${labels.role}`)
    .replace(/<#\d{15,25}>/g, `#${labels.channel}`)
}
