import { useEffect } from 'react'

/**
 * Publie la hauteur du **viewport visuel** dans `--app-height`.
 *
 * `100vh` (et `h-screen`) mesure le viewport *de mise en page*, qui ne bouge
 * pas quand le clavier logiciel s'ouvre. Le châssis du dashboard reste donc
 * plus haut que ce qu'on voit, le navigateur fait défiler la page pour amener
 * le champ de saisie sous le clavier, et l'en-tête — fil d'Ariane et bouton de
 * sidebar — sort par le haut. C'est exactement ce qui se produit en écrivant à
 * Brocoli sur mobile : `sticky top-0` n'y peut rien, l'en-tête est collé à un
 * conteneur qui, lui, ne défile pas.
 *
 * En bornant le châssis à `visualViewport.height`, le document occupe
 * précisément la zone visible : il n'y a plus rien à faire défiler, donc plus
 * rien à pousser hors de l'écran.
 *
 * Le recalage `scrollTo(0, 0)` ne s'applique qu'à un viewport non zoomé
 * (`scale <= 1`) : sous les doigts d'un utilisateur qui a pincé pour zoomer, le
 * décalage est *voulu* et le corriger lui arracherait la page.
 */
export function useViewportHeight() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const apply = () => {
      document.documentElement.style.setProperty(
        '--app-height',
        `${Math.round(viewport.height)}px`
      )
      if (viewport.offsetTop > 0 && viewport.scale <= 1) window.scrollTo(0, 0)
    }

    apply()
    viewport.addEventListener('resize', apply)
    viewport.addEventListener('scroll', apply)
    return () => {
      viewport.removeEventListener('resize', apply)
      viewport.removeEventListener('scroll', apply)
      document.documentElement.style.removeProperty('--app-height')
    }
  }, [])
}
