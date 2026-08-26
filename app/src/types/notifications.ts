// Système de notifications centralisé de Moddy.
//
// Contrairement au bot (qui stocke un *gabarit* — voir docs/NOTIFICATIONS.md
// côté bot), l'API servie au dashboard rend déjà tout : `content` n'a plus
// d'accolades `{like_this}`, `icon_url` est une URL CDN, `accent_color` un hex
// CSS. Le dashboard ne fait **aucune** substitution — il affiche.
//
// Tout est en lecture seule : le bot écrit les notifications, l'API les rend.

/** Quel type d'acteur est derrière le message. */
export type NotificationKind = 'official' | 'service' | 'guild' | 'service_guild'

/** Qui a réellement écrit les mots — décide de la « signalabilité ». */
export type NotificationAuthor = 'moddy' | 'guild' | 'staff'

/** `skipped` = volontairement non tenté (pas d'adresse, opt-out) — pas une erreur. */
export type NotificationDeliveryStatus = 'pending' | 'sent' | 'failed' | 'skipped'

/** Les deux seules raisons documentées pour lesquelles signaler n'a pas de sens. */
export type NotificationReportBlock = 'moddy_authored' | 'official_guild'

// ─── Le contenu, déjà résolu ─────────────────────────────────────────────────

export interface NotificationSection {
  title: string
  body: string
}

export interface NotificationLink {
  label: string
  url: string
}

export interface NotificationContent {
  title: string
  /** Markdown Discord — peut porter `<@id>`, `<#id>`, `<t:…:R>` (§3 du guide). */
  body: string
  sections: NotificationSection[]
  links: NotificationLink[]
  footer: string | null
  /** URL CDN déjà construite par l'API, ou `null`. */
  icon_url: string | null
  /** Couleur CSS `#RRGGBB` déjà résolue par l'API, ou `null` = accent par défaut. */
  accent_color: string | null
  template_id: string | null
}

// ─── L'origine ───────────────────────────────────────────────────────────────

/**
 * `null` quand `kind = 'official'` (Moddy en tant qu'institution) — aucune
 * ligne d'origine à afficher. Sinon soit un serveur, soit un service Moddy.
 */
export interface NotificationSource {
  service_id: string | null
  service_label: string | null
  guild_id: string | null
  guild_name: string | null
  /** Hash d'icône Discord — passe par `getGuildIconUrl()`, pas une URL toute faite. */
  guild_icon: string | null
  verified: boolean
  official: boolean
  /** `https://discord.com/channels/<guild_id>`, déjà construite par l'API. */
  guild_url: string | null
}

// ─── La livraison ────────────────────────────────────────────────────────────

export interface NotificationDelivery {
  status: NotificationDeliveryStatus
  message_id?: string | null
}

// ─── La notification telle que l'API la sert ─────────────────────────────────

export interface NotificationItem {
  id: string
  /** ISO-8601 UTC. */
  created_at: string
  /** La locale dans laquelle le message a été **rendu** — pas celle du lecteur. */
  locale: string | null
  kind: NotificationKind
  author: NotificationAuthor
  /** Gelé à l'envoi : ne jamais le recalculer, ni l'élargir. */
  reportable: boolean
  /** Pourquoi signaler n'aurait pas de sens, quand `reportable` est faux. */
  report_block: NotificationReportBlock | null
  /** `null` uniquement quand `kind = 'official'`. */
  source: NotificationSource | null
  content: NotificationContent
  /** Optionnel — présent seulement quand le bot a une ligne Discord à montrer. */
  delivery: { discord?: NotificationDelivery }
}

export interface NotificationPage {
  items: NotificationItem[]
  /** Curseur keyset opaque, à repasser tel quel dans `?before=`. `null` = dernière page. */
  next: string | null
}
