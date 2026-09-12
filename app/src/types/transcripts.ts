// Archives de tickets et notes de satisfaction.
//
// Trois tables appartiennent au **bot** (`ticket_transcripts`,
// `ticket_transcript_authors`, `ticket_ratings`) : le backend ne les écrit
// jamais, il n'existe aucun endpoint de création, d'édition ou de suppression.
// Tout ce qui suit est donc **strictement en lecture**, et la seule façon de
// borner le stockage d'un serveur est `settings.transcript_retention_days`.

// ─── Notes ────────────────────────────────────────────────────────────────────

/**
 * Les cinq appréciations proposées par la fenêtre du bot. La personne n'a
 * **jamais vu de chiffre** : on rend l'adjectif depuis *nos* traductions, jamais
 * un `n/5`. `score` ne sert qu'à trier et à calculer.
 */
export const TICKET_SCORE_KEYS = ['very_bad', 'poor', 'fair', 'good', 'excellent'] as const
export type TicketScoreKey = (typeof TICKET_SCORE_KEYS)[number]

/**
 * D'où vient la note : l'équipe a proposé la fermeture et la personne a accepté,
 * elle a fermé elle-même, ou elle y est revenue depuis le DM — parfois des jours
 * plus tard.
 */
export const TICKET_RATING_TRIGGERS = ['close_request', 'self_close', 'dm_button'] as const
export type TicketRatingTrigger = (typeof TICKET_RATING_TRIGGERS)[number]

/** Note jointe à une archive (forme courte, servie avec le listing). */
export interface TranscriptRatingSummary {
  score: number
  score_key: TicketScoreKey
  comment: string | null
  created_at: string
}

/** Note complète — la table `ticket_ratings` telle que servie par l'API. */
export interface TicketRating extends TranscriptRatingSummary {
  id: number
  ticket_number: number
  category_id: string | null
  category_name: string | null
  channel_id: string | null
  /** `null` = l'archive a été purgée par la rétention ; la note lui survit. */
  transcript_key: string | null
  /** `null` = « personne en particulier » — une réponse réelle, pas un trou. */
  rated_staff_id: string | null
  rated_by: string | null
  trigger: TicketRatingTrigger
}

export interface TicketRatingsResponse {
  guild_id: string
  ratings: TicketRating[]
  total: number
  limit: number
  offset: number
}

export interface TicketRatingsFilters {
  rated_staff_id?: string
  category_id?: string
  trigger?: TicketRatingTrigger
  /** `2` sert la vue qui compte : les tickets mal vécus. */
  max_score?: number
  days?: number
  limit?: number
  offset?: number
}

export interface TicketStaffRating {
  staff_id: string
  ratings: number
  /** `null` quand `ratings` vaut 0 — pas un zéro. */
  average: number | null
  /** Notes ≤ 2. */
  negative: number
  /**
   * Vient des **archives**, pas de la table `tickets` : un ticket fermé dont le
   * salon a été rangé compte quand même dans le travail de son agent. D'où des
   * lignes `ratings: 0, handled > 0`, à ne surtout pas masquer.
   */
  handled: number
  /** Moins de 3 avis — à signaler, jamais à classer. */
  low_sample: boolean
}

export interface TicketRatingsSummary {
  guild_id: string
  window_days: number
  /** L'énumération servie par l'API, pour ne pas la coder en dur côté front. */
  score_keys: Record<string, TicketScoreKey>
  /** Garde les notes sans agent désigné : « personne en particulier » compte. */
  guild: {
    ratings: number
    average: number | null
    negative: number
    distribution: Record<string, number>
  }
  /**
   * Exclut les notes sans agent, et arrive **classé par volume, jamais par
   * moyenne** : un unique 5/5 ne doit pas devancer cinquante tickets. Ne pas
   * re-trier côté front.
   */
  by_staff: TicketStaffRating[]
}

// ─── Archives ─────────────────────────────────────────────────────────────────

/**
 * Instantané d'un auteur pris **à la fermeture** : la personne a pu changer de
 * pseudo, d'avatar, ou quitter le serveur. On rend ce qui est stocké, pas un
 * profil Discord relu en direct — c'est à ça que la conversation ressemblait.
 */
export interface TranscriptAuthor {
  author_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  is_bot: boolean
}

/** Catégorie **actuelle** de la config, `null` si elle n'existe plus. */
export interface TranscriptCategoryRef {
  name: string
  panel_id: string | null
  panel_name: string | null
}

/** Métadonnées communes au listing et au corps d'une archive. */
export interface TranscriptMeta {
  /** UUID — le **seul élément secret** du lien, sensible au partage. */
  key: string
  guild_id: string
  channel_id: string | null
  ticket_number: number
  panel_id: string | null
  category_id: string | null
  /** Instantané pris à la fermeture. */
  category_name: string | null
  owner_id: string
  participants: string[]
  claimed_by: string | null
  closed_by: string | null
  close_reason: string | null
  opened_at: string
  closed_at: string
  message_count: number
  /** `true` = plus de 20 000 messages : le **début est réellement perdu**. */
  truncated: boolean
  /** Taille **décompressée**, en octets. */
  payload_size: number
}

/** Une ligne du listing : une par **fermeture**, pas par salon. */
export interface TranscriptSummary extends TranscriptMeta {
  /** Catégorie actuelle — `null` = supprimée depuis la fermeture. */
  category: TranscriptCategoryRef | null
  /** Qui a parlé, sans décompresser un octet. */
  speakers: TranscriptAuthor[]
  rating: TranscriptRatingSummary | null
}

/** Réglages servis **avec** la liste, pour qu'un vide s'explique. */
export interface TranscriptListSettings {
  transcripts_enabled: boolean
  transcript_retention_days: number
  rating_enabled: boolean
}

export interface TranscriptListResponse {
  guild_id: string
  settings: TranscriptListSettings
  transcripts: TranscriptSummary[]
  total: number
  limit: number
  offset: number
}

export interface TranscriptListFilters {
  category_id?: string
  owner_id?: string
  /** L'agent du ticket au sens du bot : `COALESCE(claimed_by, closed_by)`. */
  staff_id?: string
  ticket_number?: number
  limit?: number
  offset?: number
}

// ─── Corps d'une archive ──────────────────────────────────────────────────────

/**
 * Pièce jointe : une **référence**, pas un fichier. `url` est le CDN de Discord,
 * elle expire et personne ne la re-signe. Le nom et la taille, eux, restent
 * valides — c'est ce qu'on affiche quand le lien casse.
 */
export interface TranscriptAttachment {
  filename: string
  url: string | null
  size: number | null
  content_type: string | null
}

export interface TranscriptEmbedField {
  name: string
  value: string
  /** Discord met trois champs `inline` par ligne — on rend la même grille. */
  inline: boolean
}

export interface TranscriptEmbedAuthor {
  name: string
  url: string | null
  icon_url: string | null
}

export interface TranscriptEmbedFooter {
  text: string
  icon_url: string | null
}

/**
 * L'API ne garantit que `title`, `description`, `url` et `fields`, mais une
 * archive écrite par le bot peut porter tout ce que Discord stocke. On lit donc
 * la forme complète, en tolérant l'absence de chaque morceau : un embed n'est
 * pas un objet à champs fixes, c'est un assemblage de blocs optionnels.
 */
export interface TranscriptEmbed {
  title: string | null
  description: string | null
  url: string | null
  /** Entier Discord (barre d'accent). `null` = la couleur par défaut du client. */
  color: number | null
  timestamp: string | null
  author: TranscriptEmbedAuthor | null
  footer: TranscriptEmbedFooter | null
  image: string | null
  thumbnail: string | null
  fields: TranscriptEmbedField[]
}

// ─── Components V2 ────────────────────────────────────────────────────────────
//
// Un message du bot n'est plus fait d'embeds mais de **composants** : conteneurs
// à barre d'accent, blocs de texte, sections avec accessoire, galeries média,
// séparateurs, fichiers, boutons. On les normalise en une forme nommée — les
// types numériques de Discord n'ont rien à faire dans un composant React — et un
// type inconnu dégrade en bloc « composant non pris en charge » plutôt que de
// disparaître en silence.

export type TranscriptComponent =
  | { kind: 'text'; content: string }
  | { kind: 'section'; content: TranscriptComponent[]; accessory: TranscriptComponent | null }
  | { kind: 'thumbnail'; url: string | null; description: string | null; spoiler: boolean }
  | { kind: 'gallery'; items: { url: string | null; description: string | null; spoiler: boolean }[] }
  | { kind: 'file'; url: string | null; filename: string | null; size: number | null; spoiler: boolean }
  | { kind: 'separator'; divider: boolean; spacing: 'small' | 'large' }
  | { kind: 'container'; accent_color: number | null; spoiler: boolean; components: TranscriptComponent[] }
  | { kind: 'row'; components: TranscriptComponent[] }
  | {
      kind: 'button'
      label: string | null
      style: 'primary' | 'secondary' | 'success' | 'danger' | 'link' | 'premium'
      url: string | null
      emoji: string | null
      disabled: boolean
    }
  | { kind: 'select'; placeholder: string | null; options: { label: string; description: string | null }[] }
  | { kind: 'unsupported'; type: number }

export interface TranscriptReaction {
  emoji: string
  count: number
}

/** Autocollant Discord — rendu en image, avec son nom en repli. */
export interface TranscriptSticker {
  name: string
  url: string | null
}

export interface TranscriptMessage {
  id: string
  /** Se joint à `authors[].author_id`. */
  author_id: string
  created_at: string
  /** `null` quand le message ne portait pas de texte (image seule, embed…). */
  content: string | null
  edited_at: string | null
  attachments: TranscriptAttachment[]
  embeds: TranscriptEmbed[]
  /** Components V2 — vide sur un message écrit par un humain. */
  components: TranscriptComponent[]
  stickers: TranscriptSticker[]
  reactions: TranscriptReaction[]
  /** `true` quand le message a été épinglé dans le salon. */
  pinned: boolean
  /** Id du message auquel il répond. */
  reply_to: string | null
  /** `pin_add`, `thread_created`… sinon `null`. */
  system_type: string | null
}

export interface TranscriptViewer {
  is_staff: boolean
  is_owner: boolean
}

/**
 * Le corps décodé d'une archive. Le backend décompresse (`zstd` **et** `zlib`),
 * refuse un corps de version inconnue, rend les ids en chaînes et les dates en
 * ISO 8601 UTC. `messages` est ordonné du plus ancien au plus récent.
 *
 * ⚠️ `category` n'existe **pas** ici (la config n'est pas résolue sur cette
 * route) : son absence ne veut pas dire « catégorie supprimée ».
 */
export interface TranscriptDetail extends TranscriptMeta {
  viewer: TranscriptViewer
  authors: TranscriptAuthor[]
  version: number
  messages: TranscriptMessage[]
  has_staff_thread: boolean
  /** `true` = il existait un thread privé, mais le lecteur n'y a pas droit. */
  staff_thread_withheld: boolean
  /**
   * Présent **uniquement** si `viewer.is_staff`. Ne jamais le fusionner dans
   * `messages` : ce serait livrer à un membre la conversation que l'équipe a eue
   * à son sujet.
   */
  staff_thread?: TranscriptMessage[]
  rating: TicketRating | null
}
