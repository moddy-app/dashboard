// Système de notifications centralisé de Moddy.
//
// Une notification est **une ligne** partagée par toutes les surfaces (DM
// Discord, mail, dashboard) : un uuid, un *template* et les variables
// substituées pour ce destinataire précis. Le contenu stocké côté bot est
// toujours un gabarit (`{user}`, `{server}`…) : ce que le dashboard affiche est
// sa version **résolue** (voir `src/lib/notifications.ts`).
//
// Rien ici n'est écrit par le dashboard : les quatre tables appartiennent au
// bot, le back-end ne fait que lire et livrer la moitié non-Discord.

/** Quel type d'acteur est derrière le message. */
export type NotificationKind = 'official' | 'service' | 'guild' | 'service_guild'

/** Qui a réellement écrit les mots — décide de la « signalabilité ». */
export type NotificationAuthor = 'moddy' | 'guild' | 'staff'

export type NotificationPlatform = 'discord' | 'email' | 'dashboard'

/** `skipped` = volontairement non tenté (pas d'adresse, opt-out) — pas une erreur. */
export type NotificationDeliveryStatus = 'pending' | 'sent' | 'failed' | 'skipped'

/** Les deux seules raisons pour lesquelles le bot refuse un signalement. */
export type NotificationReportBlock = 'moddy_authored' | 'official_guild'

// ─── Le template brut (notification_contents.payload) ────────────────────────

export interface NotificationTemplateSection {
  title?: string | null
  body?: string | null
}

export interface NotificationTemplateLink {
  label?: string | null
  url?: string | null
}

/**
 * Les huit clés du payload uniforme. Toutes sont nullables mais **jamais
 * absentes** côté bot ; on les type quand même optionnelles, un payload plus
 * ancien ne doit pas casser le rendu.
 *
 * ⚠️ Ce contenu est un **gabarit** : ses chaînes portent encore les
 * `{placeholders}`. Ne jamais l'afficher tel quel.
 */
export interface NotificationTemplate {
  title?: string | null
  body?: string | null
  sections?: NotificationTemplateSection[] | null
  links?: NotificationTemplateLink[] | null
  footer?: string | null
  /** Émoji custom Discord (`<:name:id>`) — inutilisable hors de Discord. */
  icon?: string | null
  /** Entier décimal (5793266), pas une chaîne CSS. */
  accent_color?: number | null
  /** Id stable de l'origine du texte (`welcome_dm.wdm_a1b2`) — clé d'analytics. */
  template_id?: string | null
}

// ─── Le contenu résolu (ce que l'écran affiche) ──────────────────────────────

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
  body: string
  /** URL CDN de l'émoji custom, ou `null` — jamais le `<:name:id>` brut. */
  icon_url: string | null
  /** Couleur CSS `#RRGGBB` dérivée de l'entier, ou `null` = accent par défaut. */
  accent_color: string | null
  sections: NotificationSection[]
  links: NotificationLink[]
  footer: string | null
  template_id: string | null
}

// ─── L'origine (§6.4 du guide d'intégration) ─────────────────────────────────

/**
 * D'où vient le message. Trois cas d'affichage, dans cet ordre :
 * serveur (nom + icône + coche) → service Moddy (libellé) → rien du tout
 * quand `kind = 'official'` (Moddy institution n'a pas de tiers à nommer).
 */
export interface NotificationSource {
  /** Id du registre de services (§3.5). Liste **ouverte** : un id inconnu se
   *  dégrade en libellé générique, jamais en erreur. */
  service_id: string | null
  /** Libellé servi par l'API — prioritaire sur nos propres traductions. */
  service_label?: string | null
  guild_id?: string | null
  guild_name?: string | null
  /** Hash d'icône Discord ou URL complète. */
  guild_icon?: string | null
  /** Le serveur porte VERIFIED / VERIFIED_ORG / PARTNER. */
  verified?: boolean
  /** Le serveur est un serveur officiel Moddy. */
  official?: boolean
}

// ─── La livraison ────────────────────────────────────────────────────────────

export interface NotificationDelivery {
  status: NotificationDeliveryStatus
  /** Discord uniquement, chaîne (snowflake). */
  message_id?: string | null
  error?: string | null
  updated_at?: string | null
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
  /** Pourquoi le signalement est refusé, quand il l'est. */
  report_block?: NotificationReportBlock | null
  source: NotificationSource
  /** Contenu **résolu**, jamais le gabarit. */
  content: NotificationContent
  delivery: Partial<Record<NotificationPlatform, NotificationDelivery>>
}

export interface NotificationPage {
  items: NotificationItem[]
  /** Curseur keyset `"<created_at>,<uuid>"` — jamais d'OFFSET. */
  next: string | null
}
