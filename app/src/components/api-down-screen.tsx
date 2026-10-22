import { useTranslation } from 'react-i18next'

/** Page de statut affichée quand l'API ne répond plus. */
export const API_DOWN_URL = 'https://moddy.app/down'

/**
 * Écran plein cadre affiché quand l'API est totalement injoignable : la page
 * `moddy.app/down` y est intégrée en iframe. `useAuth` relit `/auth/me` en
 * arrière-plan et l'écran disparaît de lui-même au retour de l'API.
 */
export function ApiDownScreen() {
  const { t } = useTranslation()
  return (
    <iframe
      src={API_DOWN_URL}
      title={t('apiDown.title')}
      className="fixed inset-0 size-full border-0 bg-background"
    />
  )
}
