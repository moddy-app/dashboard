import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { ErrorPage } from "@/components/error-state"
import { ModuleHeader } from "@/components/module/module-header"
import { Skeleton } from "@/components/ui/skeleton"

interface ModulePageProps {
  moduleId: string
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  /** Slot d'actions de l'en-tête (ex. `<ModuleStateControl />`). */
  actions?: ReactNode
  children: ReactNode
}

/**
 * Châssis commun des pages de module : conteneur, en-tête (icône, titre,
 * statut, actions), squelette de chargement et état d'erreur. Le conteneur du
 * dashboard est déjà fluide et paddé : pas de `max-w` ni de `p-*` ici (les
 * pages actuelles n'en ont pas), mais la marge basse laisse place à la barre
 * d'enregistrement flottante.
 */
export function ModulePage({ moduleId, loading, error, onRetry, actions, children }: ModulePageProps) {
  const { t } = useTranslation()

  if (error) {
    return <ErrorPage error={error} onRetry={onRetry} />
  }

  return (
    <div className="flex w-full flex-col gap-6 pb-24">
      <ModuleHeader moduleId={moduleId} actions={actions} />
      {loading ? (
        <div className="flex flex-col gap-4" role="status" aria-label={t("modules.loading")}>
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      ) : (
        children
      )}
    </div>
  )
}
