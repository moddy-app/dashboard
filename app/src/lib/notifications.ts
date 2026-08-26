import { formatDiscordTimestamps } from '@/lib/welcome-dm'
import type { NotificationItem, NotificationSource } from '@/types/notifications'

// L'API sert du contenu déjà résolu (§3 du guide d'intégration dashboard) :
// aucune substitution à faire ici. Ce fichier ne gère plus que ce que l'API ne
// peut pas résoudre elle-même — la syntaxe propre au client Discord — et de
// petits helpers de présentation.

// ─── Syntaxe propre à Discord ────────────────────────────────────────────────

export interface DiscordSyntaxLabels {
  /** Mention d'un utilisateur qu'on ne sait pas résoudre. */
  user: string
  role: string
  channel: string
}

/**
 * `body`/`sections[].body` sont du markdown Discord et peuvent porter de la
 * syntaxe que seul le client Discord sait rendre : `<@123>`, `<@&123>`,
 * `<#123>`, `<t:1700000000:R>`. `DiscordMarkup` ne les comprend pas — sans ce
 * passage elles s'afficheraient brutes plutôt que comme un mot lisible.
 *
 * Une seule mention est résolue : celle du lecteur (`selfId`) — c'est la seule
 * identité qu'on ait sous la main, et c'est de très loin la plus fréquente (un
 * message de bienvenue s'adresse à la personne qui le lit). Le reste tombe sur
 * un libellé générique, traduit.
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

// ─── Liens ───────────────────────────────────────────────────────────────────

/**
 * L'API filtre déjà `links[].url` sur `https://` (§3 du guide) ; ce contrôle
 * est une seconde ligne de défense bon marché, pas la garantie principale.
 */
export function isSafeNotificationUrl(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

// ─── Origine ─────────────────────────────────────────────────────────────────

export type NotificationOrigin =
  | { type: 'guild'; source: NotificationSource }
  | { type: 'service'; source: NotificationSource }
  | { type: 'none' }

/**
 * `source` est `null` seulement quand `kind = 'official'` — Moddy en tant
 * qu'institution n'a personne d'autre à nommer. Sinon un serveur (avec sa
 * coche) prime sur un simple service.
 */
export function notificationOrigin(item: NotificationItem): NotificationOrigin {
  if (!item.source) return { type: 'none' }
  if (item.source.guild_id) return { type: 'guild', source: item.source }
  if (item.source.service_id) return { type: 'service', source: item.source }
  return { type: 'none' }
}

// ─── Signalement ─────────────────────────────────────────────────────────────

/**
 * ⚠️ Le dépôt d'un signalement doit aussi poster un panneau de revue Discord
 * côté bot — cette tâche n'existe pas encore. `reportable`/`report_block` ne
 * servent aujourd'hui qu'à expliquer l'absence de bouton, jamais à en activer
 * un : ne jamais rendre de bouton « Signaler » cliquable.
 */
export function reportBlockReasonKey(item: NotificationItem): string | null {
  if (!item.report_block) return null
  return `notifications.reportBlock.${item.report_block}`
}
