import {
  MAX_WELCOME_MESSAGES,
  WELCOME_DEFAULT_ACCENT,
  type WelcomeChannelConfig,
  type WelcomeMessage,
} from "@/types/api"

// Helpers du module Welcome Messages (welcome_channel, config v2).
//
// La config est une liste de messages indépendants (un par salon). Chaque
// action de l'UI réécrit la liste complète via PUT/PATCH — il n'existe pas
// d'endpoint par entrée.

/**
 * Placeholders substitués littéralement par le bot (aide-mémoire UI + coloration
 * dans l'éditeur). Tokens `{…}` bruts, comme pour Social Notifications : c'est
 * sur eux que `RichTextEditor` fait correspondre le surlignage. `{timestamp}`
 * rend des secondes Unix — l'aide sous l'éditeur suggère `<t:{timestamp}:R>`.
 */
export const WELCOME_PLACEHOLDERS = [
  "{server}",
  "{user}",
  "{display_name}",
  "{username}",
  "{member_count}",
  "{timestamp}",
] as const

/**
 * Génère un identifiant `wm_xxxxxxxx` (8 hex minuscules). Un nouvel id est tiré
 * pour chaque entrée créée — jamais de réutilisation, même après suppression.
 */
export function generateWelcomeId(existing: readonly WelcomeMessage[] = []): string {
  const taken = new Set(existing.map((m) => m.id))
  for (let attempt = 0; attempt < 20; attempt++) {
    const bytes = new Uint8Array(4)
    crypto.getRandomValues(bytes)
    const id = `wm_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`
    if (!taken.has(id)) return id
  }
  // Collision 20 fois de suite sur 2^32 : impossible en pratique, mais on ne
  // renvoie jamais un id déjà pris (le backend renverrait 422).
  throw new Error("Could not generate a unique welcome message id")
}

/** `#5865F2` → `5793266`. Renvoie `null` si le hex est invalide. */
export function accentHexToInt(hex: string): number | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  return parseInt(match[1], 16)
}

/** `5793266` → `#5865F2`. `null` → couleur par défaut du bot. */
export function accentIntToHex(color: number | null): string {
  const value = color ?? WELCOME_DEFAULT_ACCENT
  return `#${value.toString(16).padStart(6, "0").toUpperCase()}`
}

/** Normalise une config potentiellement absente ou incomplète. */
export function readWelcomeConfig(
  config: WelcomeChannelConfig | undefined | null
): WelcomeMessage[] {
  if (!config || !Array.isArray(config.messages)) return []
  return config.messages.map((m) => ({
    ...m,
    // Les snowflakes restent des chaînes de bout en bout.
    channel_id: String(m.channel_id),
    created_by: m.created_by != null ? String(m.created_by) : null,
  }))
}

/** Corps envoyé au backend — jamais de clé `enabled` à la racine. */
export function buildWelcomeConfig(messages: WelcomeMessage[]): WelcomeChannelConfig {
  return { version: 2, messages }
}

/**
 * Le module est « actif » dès qu'au moins un message est activé et rattaché à
 * un salon. Il n'y a pas d'interrupteur global côté API.
 */
export function isWelcomeActive(
  config: WelcomeChannelConfig | undefined | null
): boolean {
  return readWelcomeConfig(config).some((m) => m.enabled && Boolean(m.channel_id))
}

export function canAddWelcomeMessage(messages: readonly WelcomeMessage[]): boolean {
  return messages.length < MAX_WELCOME_MESSAGES
}
