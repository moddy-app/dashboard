import { ApiError } from '@/lib/auth'
import type {
  BotCustomizationConfig,
  BotCustomizationLimits,
  BotCustomizationState,
  BotCustomizationUpdate,
} from '@/types/api'

// ─── Couleurs ─────────────────────────────────────────────────────────────────

/** Couleur proposée par défaut quand l'utilisateur ajoute un slot vide. */
export const DEFAULT_STYLE_COLOR = '#5865F2'

const HEX_RE = /^#[0-9A-Fa-f]{6}$/

/** `16711680` → `#FF0000` (lecture : le backend renvoie toujours des entiers). */
export function intToHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`.toUpperCase()
}

export function isValidHex(value: string): boolean {
  return HEX_RE.test(value)
}

/** Tolère `ff0000` / `#ff0000` → `#FF0000` ; renvoie l'entrée telle quelle sinon. */
export function normalizeHex(value: string): string {
  const trimmed = value.trim()
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  return isValidHex(withHash) ? withHash.toUpperCase() : trimmed
}

// ─── Style du pseudo ──────────────────────────────────────────────────────────

/** Brouillon de style — couleurs en hex tant qu'on est côté formulaire. */
export interface StyleDraft {
  font_id: number | null
  effect_id: number | null
  colors: string[]
}

/**
 * Nombre de couleurs exigé par l'effet choisi :
 * - dégradé (`limits.gradient_effect_id`) → exactement 2
 * - tout autre effet → exactement 1
 * - sans effet → 0 ou 1 (`min` 0)
 *
 * Le backend applique les mêmes règles (`gradient_needs_two_colors`,
 * `effect_needs_color`) : on les rejoue ici pour éviter l'aller-retour.
 */
export function colorSlots(
  effectId: number | null,
  limits: BotCustomizationLimits
): { min: number; max: number } {
  if (effectId === null) return { min: 0, max: 1 }
  if (effectId === limits.gradient_effect_id) return { min: 2, max: 2 }
  return { min: 1, max: 1 }
}

/**
 * Ajuste la liste de couleurs au nombre de slots de l'effet : tronque le
 * surplus, complète avec la dernière couleur connue (ou la couleur par défaut).
 */
export function fitColors(colors: string[], slots: { min: number; max: number }): string[] {
  const next = colors.slice(0, slots.max)
  while (next.length < slots.min) {
    next.push(next[next.length - 1] ?? DEFAULT_STYLE_COLOR)
  }
  return next
}

/** Style tel que reçu → brouillon hex prêt pour le formulaire. */
export function styleToDraft(config: BotCustomizationConfig): StyleDraft {
  const style = config.style
  return {
    font_id: style?.font_id ?? null,
    effect_id: style?.effect_id ?? null,
    colors: (style?.colors ?? []).map(intToHex),
  }
}

/** Un style « vide » se réinitialise en envoyant `style: null`. */
export function isEmptyStyle(style: StyleDraft): boolean {
  return style.font_id === null && style.effect_id === null && style.colors.length === 0
}

// ─── Brouillon complet ────────────────────────────────────────────────────────

/**
 * État d'un champ image. `keep` = inchangé (clé absente du corps),
 * `clear` = réinitialisation (`null`), `file` = nouvelle image à uploader.
 * L'upload n'est fait qu'au moment du save : l'URL renvoyée par
 * `POST .../uploads` expire en 15 min, la garder plus longtemps exposerait à un
 * `image_download_failed`.
 */
export type ImageDraft =
  | { kind: 'keep' }
  | { kind: 'clear' }
  | { kind: 'file'; file: File; previewUrl: string }

export interface CustomizationDraft {
  nickname: string
  bio: string
  style: StyleDraft
  avatar: ImageDraft
  banner: ImageDraft
}

export function stateToDraft(state: BotCustomizationState): CustomizationDraft {
  return {
    nickname: state.config.nickname ?? '',
    bio: state.config.bio ?? '',
    style: styleToDraft(state.config),
    avatar: { kind: 'keep' },
    banner: { kind: 'keep' },
  }
}

function sameStyle(a: StyleDraft, b: StyleDraft): boolean {
  return (
    a.font_id === b.font_id &&
    a.effect_id === b.effect_id &&
    a.colors.length === b.colors.length &&
    a.colors.every((c, i) => c.toUpperCase() === b.colors[i].toUpperCase())
  )
}

/**
 * Diff du brouillon par rapport à l'état chargé. Seules les clés réellement
 * modifiées sont présentes : sérialiser tout le formulaire effacerait les
 * champs laissés vides (une clé à `null` réinitialise côté backend).
 *
 * Les images ne sont pas résolues ici (upload asynchrone) : `avatar`/`banner`
 * indiquent seulement l'intention, l'appelant remplit `avatar_url`/`banner_url`.
 */
export function diffDraft(
  state: BotCustomizationState,
  draft: CustomizationDraft
): {
  body: BotCustomizationUpdate
  uploadAvatar: File | null
  uploadBanner: File | null
} {
  const body: BotCustomizationUpdate = {}

  const nickname = draft.nickname.trim()
  if (nickname !== (state.config.nickname ?? '')) {
    body.nickname = nickname === '' ? null : nickname
  }

  const bio = draft.bio.trim()
  if (bio !== (state.config.bio ?? '')) {
    body.bio = bio === '' ? null : bio
  }

  const savedStyle = styleToDraft(state.config)
  if (!sameStyle(savedStyle, draft.style)) {
    body.style = isEmptyStyle(draft.style)
      ? null
      : {
          font_id: draft.style.font_id,
          effect_id: draft.style.effect_id,
          colors: draft.style.colors.map((c) => c.toUpperCase()),
        }
  }

  if (draft.avatar.kind === 'clear') body.avatar_url = null
  if (draft.banner.kind === 'clear') body.banner_url = null

  return {
    body,
    uploadAvatar: draft.avatar.kind === 'file' ? draft.avatar.file : null,
    uploadBanner: draft.banner.kind === 'file' ? draft.banner.file : null,
  }
}

/** `true` dès qu'il y a quelque chose à envoyer (sinon le PUT renvoie 422 `empty_update`). */
export function isDirty(state: BotCustomizationState, draft: CustomizationDraft): boolean {
  const { body, uploadAvatar, uploadBanner } = diffDraft(state, draft)
  return Object.keys(body).length > 0 || uploadAvatar !== null || uploadBanner !== null
}

// ─── Validation des images ────────────────────────────────────────────────────

export type ImageRejection =
  | { code: 'invalid_image_type' }
  | { code: 'image_too_large'; maxBytes: number }

/**
 * Contrôle local avant upload (retour immédiat). Le backend rejoue les mêmes
 * règles : un fichier accepté ici peut malgré tout être refusé côté serveur.
 */
export function validateImage(
  file: File,
  limits: BotCustomizationLimits
): ImageRejection | null {
  if (!limits.image_content_types.includes(file.type)) {
    return { code: 'invalid_image_type' }
  }
  if (file.size > limits.image_max_bytes) {
    return { code: 'image_too_large', maxBytes: limits.image_max_bytes }
  }
  return null
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

// ─── Erreurs ──────────────────────────────────────────────────────────────────

/** Codes renvoyés par le backend — ce sont aussi des clés i18n. */
export const BOT_CUSTOMIZATION_ERROR_CODES = [
  'premium_required',
  'missing_permissions',
  'guild_not_found',
  'rate_limited',
  'empty_update',
  'nickname_too_long',
  'bio_too_long',
  'invalid_color',
  'invalid_font',
  'invalid_effect',
  'gradient_needs_two_colors',
  'effect_needs_color',
  'invalid_image_type',
  'image_too_large',
  'invalid_config',
  'image_download_failed',
  'rejected_by_discord',
  'discord_error',
  'save_failed',
  'internal_error',
  'bot_timeout',
] as const

export type BotCustomizationErrorCode = (typeof BOT_CUSTOMIZATION_ERROR_CODES)[number]

/**
 * Extrait le code d'erreur (`{"error": "<code>"}`) d'une réponse d'échec.
 * `null` si l'erreur n'est pas une erreur API connue de ce module — l'appelant
 * retombe alors sur le message générique (le code nu ne doit jamais s'afficher).
 */
export function botCustomizationErrorCode(error: unknown): BotCustomizationErrorCode | null {
  if (!(error instanceof ApiError)) return null
  const raw = typeof error.detail === 'string' ? error.detail : null
  if (!raw) return null
  return BOT_CUSTOMIZATION_ERROR_CODES.includes(raw as BotCustomizationErrorCode)
    ? (raw as BotCustomizationErrorCode)
    : null
}

// ─── État du module ───────────────────────────────────────────────────────────

/**
 * Le module est « actif » dès qu'un champ est personnalisé — il n'a pas
 * d'interrupteur, et `config` vaut `{}` tant que rien n'a été appliqué.
 */
export function isBotCustomizationActive(config: BotCustomizationConfig | undefined): boolean {
  if (!config) return false
  const style = config.style
  const hasStyle =
    !!style &&
    (style.font_id !== null || style.effect_id !== null || (style.colors?.length ?? 0) > 0)
  return (
    Boolean(config.nickname || config.bio || config.avatar_hash || config.banner_hash) || hasStyle
  )
}
