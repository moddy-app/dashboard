import {
  MAX_WELCOME_DMS,
  WELCOME_DM_DEFAULT_ACCENT,
  type WelcomeDmConfig,
  type WelcomeDmMessage,
} from "@/types/api"
import { accentHexToInt, accentIntToHex, generateMessageId } from "@/lib/welcome"

// Helpers du module Welcome DM (welcome_dm, config v2).
//
// Jumeau de `welcome_channel` à une différence structurelle près : le message
// part en DM, il n'y a donc **pas de `channel_id`**. Les constantes ne sont
// jamais partagées entre les deux modules (préfixe `wdm_` contre `wm_`, 3
// entrées contre 5) : seules les fonctions pures — conversion de couleur,
// tirage d'id — le sont, et elles reçoivent la constante en paramètre.
//
// La config est un objet unique qu'on remplace en entier : ajouter, éditer,
// supprimer ou mettre en pause réécrit toute la liste via PUT.

/**
 * Placeholders substitués **littéralement** par le bot au moment de l'envoi
 * (jamais un `format()`) : une accolade isolée est inoffensive et un token
 * inconnu reste visible dans le DM. `{timestamp}` rend des secondes Unix — à
 * envelopper (`<t:{timestamp}:R>`), l'aide sous l'éditeur le rappelle.
 */
export const WELCOME_DM_PLACEHOLDERS = [
  "{server}",
  "{user}",
  "{display_name}",
  "{username}",
  "{member_count}",
  "{timestamp}",
] as const

/** Longueur maximale d'un message, après `trim()` (au-delà : 422). */
export const WELCOME_DM_MESSAGE_MAX = 1500

/**
 * Génère un identifiant `wdm_xxxxxxxx` (8 hex minuscules). Tiré **une seule
 * fois**, à la création de l'entrée : le bot matche les entrées par `id` pour
 * les éditer depuis sa commande `/config`, un id régénéré ferait apparaître le
 * message comme neuf.
 */
export function generateWelcomeDmId(existing: readonly WelcomeDmMessage[] = []): string {
  return generateMessageId(
    "wdm_",
    existing.map((m) => m.id)
  )
}

/** `#5865F2` → `5793266`. Renvoie `null` si le hex est invalide. */
export function welcomeDmHexToInt(hex: string): number | null {
  return accentHexToInt(hex)
}

/** `5793266` → `#5865F2`. `null` → couleur par défaut du module. */
export function welcomeDmIntToHex(color: number | null): string {
  return accentIntToHex(color, WELCOME_DM_DEFAULT_ACCENT)
}

/**
 * Normalise une config potentiellement absente ou incomplète. Le backend migre
 * les anciennes configs v1 à la lecture : on reçoit toujours du v2 (l'entrée
 * migrée porte l'id `wdm_00000000`, qui est valide et doit être conservé).
 */
export function readWelcomeDmConfig(
  config: WelcomeDmConfig | undefined | null
): WelcomeDmMessage[] {
  if (!config || !Array.isArray(config.messages)) return []
  return config.messages.map((m) => ({
    ...m,
    // Snowflake : reste une chaîne de bout en bout.
    created_by: m.created_by != null ? String(m.created_by) : null,
  }))
}

/** Corps envoyé au backend — jamais de clé `enabled` à la racine. */
export function buildWelcomeDmConfig(messages: WelcomeDmMessage[]): WelcomeDmConfig {
  return { version: 2, messages }
}

/**
 * Le module est « actif » dès qu'au moins un message est activé. Il n'y a pas
 * d'interrupteur global côté API : l'état est dérivé des entrées.
 */
export function isWelcomeDmActive(config: WelcomeDmConfig | undefined | null): boolean {
  return readWelcomeDmConfig(config).some((m) => m.enabled)
}

export function canAddWelcomeDm(messages: readonly WelcomeDmMessage[]): boolean {
  return messages.length < MAX_WELCOME_DMS
}

/**
 * Aperçu : substitution littérale, exactement comme le bot. `split().join()`
 * plutôt qu'une `RegExp` — un `$&` dans une valeur ne doit pas être réinterprété,
 * et un token inconnu doit rester intact.
 */
export function renderWelcomeDmPreview(
  template: string,
  context: Record<string, string>
): string {
  return Object.entries(context).reduce(
    (out, [key, value]) => out.split(`{${key}}`).join(value),
    template
  )
}

/**
 * Rend les balises d'horodatage Discord (`<t:1755000000:R>`) en date lisible,
 * **pour l'aperçu seulement** — le bot envoie la balise telle quelle et c'est
 * le client Discord qui la met en forme. Sans ça, un `<t:{timestamp}:R>`
 * s'afficherait en brut dans l'aperçu alors que le membre verra « il y a
 * 2 minutes ».
 *
 * `now` est passé en paramètre (et non lu depuis `Date.now()`) : la fonction
 * est appelée pendant le rendu de l'aperçu, elle doit rester pure.
 */
export function formatDiscordTimestamps(text: string, locale: string, now: number): string {
  return text.replace(/<t:(\d{1,15})(?::([tTdDfFR]))?>/g, (raw, seconds: string, style?: string) => {
    const date = new Date(Number(seconds) * 1000)
    if (Number.isNaN(date.getTime())) return raw
    switch (style) {
      case "t":
        return date.toLocaleTimeString(locale, { timeStyle: "short" })
      case "T":
        return date.toLocaleTimeString(locale, { timeStyle: "medium" })
      case "d":
        return date.toLocaleDateString(locale, { dateStyle: "short" })
      case "D":
        return date.toLocaleDateString(locale, { dateStyle: "long" })
      case "R":
        return formatRelative(date.getTime() - now, locale)
      case "F":
        return date.toLocaleString(locale, { dateStyle: "full", timeStyle: "short" })
      default:
        return date.toLocaleString(locale, { dateStyle: "long", timeStyle: "short" })
    }
  })
}

/** Choisit l'unité comme Discord : « maintenant », « il y a 3 h », « demain ». */
function formatRelative(deltaMs: number, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  const seconds = Math.round(deltaMs / 1000)
  const abs = Math.abs(seconds)
  if (abs < 60) return rtf.format(seconds, "second")
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute")
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour")
  return rtf.format(Math.round(seconds / 86400), "day")
}
