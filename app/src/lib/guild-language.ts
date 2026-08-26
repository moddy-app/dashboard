import type { GuildLanguageSettings } from '@/types/api'

/**
 * Nature de l'explication à afficher sous le sélecteur.
 *
 * - `none` — le choix est explicite, il n'y a rien à expliquer
 * - `community` — `auto` sur un serveur Communauté : Moddy suit Discord
 * - `notCommunity` — `auto` hors Communauté : **avertissement**, Moddy parlera
 *   anglais. C'est le changement de comportement le plus visible de cette
 *   livraison : sans cette ligne, les admins concernés croiront à un bug
 * - `unknown` — Discord injoignable, on ne devine pas la langue effective
 */
export type LanguageNoticeKind = 'none' | 'community' | 'notCommunity' | 'unknown'

export function languageNotice(settings: GuildLanguageSettings): LanguageNoticeKind {
  if (settings.language !== 'auto') return 'none'
  if (settings.is_community === true) return 'community'
  if (settings.is_community === false) return 'notCommunity'
  return 'unknown'
}

/**
 * Le badge « langue effective » n'a de sens que sur `auto` : avec un choix
 * explicite il répète le sélecteur. `effective_language === null` (Discord
 * injoignable) le masque — afficher un repli reviendrait à deviner.
 */
export function showsEffectiveBadge(settings: GuildLanguageSettings): boolean {
  return settings.language === 'auto' && settings.effective_language !== null
}
