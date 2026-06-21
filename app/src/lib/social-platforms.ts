import type { SocialPlatform } from '@/types/api'

// ─── Métadonnées par plateforme ────────────────────────────────────────────────
// Source : docs Social Notifications (couleurs de marque, capacités, placeholders).

export interface PlatformMeta {
  /** Couleur de marque (hex) — utilisée comme valeur par défaut du picker (embed_color null). */
  brandColor: string
  /** Le module supporte le toggle "afficher l'avatar" pour cette plateforme. */
  supportsAvatar: boolean
  /** Le module supporte le toggle "afficher le média" pour cette plateforme. */
  supportsMedia: boolean
  /** Plateforme désactivée côté backend (ex: Instagram réservé). */
  disabled: boolean
  /** Placeholders disponibles dans l'éditeur de message pour cette plateforme. */
  placeholders: string[]
}

/** Tous les placeholders connus (utilisés pour le cheat-sheet et la coloration). */
export const ALL_PLACEHOLDERS = [
  '{author}',
  '{title}',
  '{url}',
  '{link}',
  '{platform}',
  '{timestamp}',
] as const

export const PLATFORM_META: Record<SocialPlatform, PlatformMeta> = {
  youtube: {
    brandColor: '#FF0000',
    supportsAvatar: true,
    supportsMedia: true,
    disabled: false,
    placeholders: ['{author}', '{title}', '{url}', '{link}', '{platform}', '{timestamp}'],
  },
  twitch: {
    brandColor: '#9146FF',
    supportsAvatar: true,
    supportsMedia: true,
    disabled: false,
    placeholders: ['{author}', '{title}', '{url}', '{link}', '{platform}', '{timestamp}'],
  },
  bluesky: {
    brandColor: '#1185FE',
    supportsAvatar: true,
    supportsMedia: false,
    disabled: false,
    placeholders: ['{author}', '{url}', '{link}', '{platform}', '{timestamp}'],
  },
  rss: {
    brandColor: '#EE802F',
    supportsAvatar: false,
    supportsMedia: false,
    disabled: false,
    placeholders: ['{title}', '{url}', '{link}', '{platform}', '{timestamp}'],
  },
  instagram: {
    brandColor: '#E1306C',
    supportsAvatar: true,
    supportsMedia: true,
    disabled: true,
    placeholders: ['{author}', '{title}', '{url}', '{link}', '{platform}', '{timestamp}'],
  },
}

/** Ordre d'affichage des plateformes (instagram en dernier car désactivée). */
export const PLATFORM_ORDER: SocialPlatform[] = ['youtube', 'twitch', 'bluesky', 'rss', 'instagram']

// ─── Messages par défaut ─────────────────────────────────────────────────────────
// Template appliqué par le bot quand `message` est vide/null. Affiché comme
// placeholder (rendu enrichi mais grisé) dans l'éditeur de message.

export const DEFAULT_MESSAGES: Record<SocialPlatform, string> = {
  youtube:
    "## <:youtube:1515511923066671185> New video!\n{author} just posted a new video on {platform}: « {title} »\n{url}\n-# <t:{timestamp}:R>",
  bluesky:
    "## <:bluesky:1515511920235516024> New post!\n{author} just posted on {platform}.\n{url}\n-# <t:{timestamp}:R>",
  twitch:
    "## <:twitch:1515511921938399343> Live now!\n{author} is now live on {platform}: « {title} »\n{url}\n-# <t:{timestamp}:R>",
  rss:
    "## <:rss:1515511923951534160> New article!\nA new article was published: « {title} »\n{url}\n-# <t:{timestamp}:R>",
  instagram:
    "## <:instagram:0> New post!\n{author} just posted on {platform}.\n{url}\n-# <t:{timestamp}:R>",
}

// ─── Conversion couleur ─────────────────────────────────────────────────────────

/** `#FF0000` → `16711680`. */
export function hexToInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}

/** `16711680` → `#ff0000`. */
export function intToHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}
