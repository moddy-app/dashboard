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

// ─── Conversion couleur ─────────────────────────────────────────────────────────

/** `#FF0000` → `16711680`. */
export function hexToInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}

/** `16711680` → `#ff0000`. */
export function intToHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}
