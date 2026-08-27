import { cn } from '@/lib/utils'
import {
  effectSlug,
  fontSlug,
  nameStyleVars,
  type NameEffectSlug,
  type NameFontSlug,
} from '@/lib/discord-name-styles'

/**
 * Rend un pseudo avec le moteur de rendu Discord (CSS + polices extraits du
 * build web). Portage direct de `NameStylePreview.jsx` du kit d'intégration :
 * un conteneur `.dns-name` qui porte les variables et les classes d'état, un
 * `.dns-text` qui porte l'effet et la police.
 *
 * ⚠️ Contraintes du CSS Discord, à respecter partout où ce composant est posé :
 *
 *   - **Ne pas mettre `overflow: hidden` sur un ancêtre.** Les effets débordent
 *     volontairement de leur boîte (halo du néon, ombre décalée du pop, contour
 *     du cartoon) au moyen de marges négatives. Un ancêtre qui découpe rogne
 *     l'effet en plein milieu du mot.
 *   - **`data-dns-text` doit être identique au texte du span** : `toon` et
 *     `pop` dupliquent le texte dans un `::before` via `attr()`.
 *   - L'animation vient de `.dns-animated` (+ `.dns-loop`) posées sur le
 *     conteneur, et cible `> *` : le span doit rester enfant **direct**.
 */

interface NameStylePreviewProps {
  /** Texte affiché — alimente aussi `data-dns-text`. */
  name: string
  font: NameFontSlug
  effect: NameEffectSlug
  /** Couleurs en `#RRGGBB` : une seule, ou deux pour le dégradé. */
  colors: string[]
  /** Joue l'animation de l'effet (néon, cartoon, pop). */
  animated?: boolean
  /** Boucle l'animation — Discord ne boucle que dans ses aperçus. */
  loop?: boolean
  /** Autorise le retour à la ligne (variante « profil » de Discord). */
  wrap?: boolean
  /**
   * Rend la police seule, sans effet ni couleur : le texte hérite alors de la
   * couleur de son conteneur. C'est le cas « aucune couleur choisie », où
   * Discord affiche le pseudo dans la couleur de texte par défaut.
   */
  plain?: boolean
  className?: string
}

export function NameStylePreview({
  name,
  font,
  effect,
  colors,
  animated = true,
  loop = true,
  wrap = false,
  plain = false,
  className,
}: NameStylePreviewProps) {
  if (plain) {
    return <span className={cn(`dns-font-${font}`, className)}>{name}</span>
  }

  return (
    <div
      className={cn(
        'dns-name',
        'dns-on',
        animated && 'dns-animated',
        animated && loop && 'dns-loop',
        wrap && 'dns-block',
        className
      )}
      style={nameStyleVars(colors, effect, { wrap })}
    >
      <span className={`dns-text dns--${effect} dns-font-${font}`} data-dns-text={name}>
        {name}
      </span>
    </div>
  )
}

interface NameStyleFromIdsProps extends Omit<NameStylePreviewProps, 'font' | 'effect'> {
  fontId: number | null
  effectId: number | null
  /** `limits.gradient_effect_id` — seul identifiant d'effet confirmé par l'API. */
  gradientEffectId?: number
}

/** Variante pilotée par les identifiants de l'API plutôt que par les slugs. */
export function NameStyleFromIds({
  fontId,
  effectId,
  gradientEffectId,
  ...rest
}: NameStyleFromIdsProps) {
  return (
    <NameStylePreview
      {...rest}
      font={fontSlug(fontId)}
      effect={effectSlug(effectId, gradientEffectId)}
    />
  )
}
