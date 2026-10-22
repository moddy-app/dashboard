import { useTranslation } from 'react-i18next'

/** Page de statut affichée quand l'API ne répond plus. */
export const API_DOWN_URL = 'https://moddy.app/down'

/**
 * Écran plein cadre affiché quand l'API est totalement injoignable : la page
 * `moddy.app/down` y est intégrée en iframe. `useAuth` relit `/auth/me` en
 * arrière-plan et l'écran disparaît de lui-même au retour de l'API.
 *
 * Rien d'autre ne s'affiche : ni bannières (montées par `DashboardPage`, absent
 * ici), ni toasts — le z-index maximal passe au-dessus de tout calque global.
 *
 * `sandbox` : le site a un script anti-iframe (`window.top.location.href = …`)
 * qui, entre origines différentes, a le droit de rediriger la page parente et
 * éjecterait tout le dashboard vers `moddy.app/down`. Sans
 * `allow-top-navigation`, cette redirection par script est bloquée ; seul un
 * clic de l'utilisateur sur un lien peut encore naviguer la page.
 */
export function ApiDownScreen() {
  const { t } = useTranslation()
  return (
    <iframe
      src={API_DOWN_URL}
      title={t('apiDown.title')}
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
      className="fixed inset-0 z-[2147483647] size-full border-0 bg-background"
    />
  )
}
