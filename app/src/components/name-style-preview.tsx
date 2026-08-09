import { cn } from '@/lib/utils'
import {
  effectSlug,
  fontSlug,
  nameStyleVars,
  type NameEffectSlug,
  type NameFontSlug,
} from '@/lib/discord-name-styles'

interface NameStylePreviewProps {
  /** Texte affiché — c'est lui qui alimente aussi `data-dns-text`. */
  name: string
  font: NameFontSlug
  effect: NameEffectSlug
  /** Couleurs en `#RRGGBB` : 1 couleur, ou 2 pour le dégradé. */
  colors: string[]
  /** Joue l'animation de l'effet (néon, cartoon, pop). */
  animated?: boolean
  /** Boucle l'animation — utile en aperçu, Discord ne le fait que sur ses propres sélecteurs. */
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

/**
 * Rend un pseudo avec le vrai moteur de rendu Discord (CSS + polices extraits
 * du build web). Le style visuel entier vient de `discord-name-styles.css` :
 * ce composant ne fait que poser les classes et les variables CSS.
 */
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
        'dns-name dns-on',
        animated && 'dns-animated',
        animated && loop && 'dns-loop',
        wrap && 'dns-block',
        className
      )}
      style={nameStyleVars(colors, effect, { wrap })}
    >
      {/* `data-dns-text` alimente les ::before de `toon` et `pop` : il doit être
          strictement identique au contenu du span, sinon les deux calques se
          désalignent. */}
      <span
        className={`dns-text dns--${effect} dns-font-${font}`}
        data-dns-text={name}
      >
        {name}
      </span>
    </div>
  )
}

interface NameStyleFromIdsProps
  extends Omit<NameStylePreviewProps, 'font' | 'effect'> {
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
