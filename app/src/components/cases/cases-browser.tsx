import { useCallback, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCasesMeta } from "@/hooks/useCasesMeta"
import type { CaseFilters, CaseType, SubjectType, ScopeType } from "@/types/cases"
import { CaseList } from "./case-list"
import { CaseDetailView } from "./case-detail"
import { CreateCaseDialog } from "./create-case-dialog"

interface CasesBrowserProps {
  /** Filtres définissant le périmètre affiché. */
  baseFilters: CaseFilters
  /** Staff modérateur → droits d'écriture dans le détail. */
  canModerate: boolean
  /** Affiche le bouton « nouveau case » (staff modérateur). */
  canCreate?: boolean
  /** Affiche la colonne sujet dans la liste (false pour la vue personnelle). */
  showSubject?: boolean
  /** Affiche le type de case (false quand il est évident — ex. vue serveur). */
  showType?: boolean
  /** En-tête affiché au-dessus de la liste (titre + description de la page). */
  header?: React.ReactNode
  backLabel?: string
  emptyTitle?: string
  emptyDescription?: string
  /** Verrouille le type de case créable (ex. « global » pour le panel staff). */
  lockCaseType?: "global" | "network"
  createDefaults?: Partial<{
    case_type: CaseType
    subject_type: SubjectType
    subject_id: string
    scope_type: ScopeType
    scope_id: string
  }>
}

export function CasesBrowser({
  baseFilters,
  canModerate,
  canCreate = false,
  showSubject = true,
  showType = false,
  header,
  backLabel,
  emptyTitle,
  emptyDescription,
  lockCaseType,
  createDefaults,
}: CasesBrowserProps) {
  const { t } = useTranslation()
  const { meta } = useCasesMeta()
  const [searchParams, setSearchParams] = useSearchParams()
  const [createOpen, setCreateOpen] = useState(false)

  // La case ouverte vit dans l'URL (?case=REF) → visible dans le fil d'Ariane
  // et partageable, sans changer de route (les 3 vues restent unifiées).
  const selected = searchParams.get("case")

  const setSelected = useCallback(
    (ref: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (ref) next.set("case", ref)
          else next.delete("case")
          return next
        },
        { replace: false }
      )
    },
    [setSearchParams]
  )

  if (selected) {
    return (
      <CaseDetailView
        identifier={selected}
        canModerate={canModerate}
        backLabel={backLabel}
        onBack={() => setSelected(null)}
        showSubject={showSubject}
        showType={showType}
        showScope={!baseFilters.scope_id}
      />
    )
  }

  const createButton =
    canCreate && meta ? (
      <Button size="sm" className="shrink-0" onClick={() => setCreateOpen(true)}>
        <PlusIcon className="size-4" />
        <span className="hidden sm:inline">{t("cases.create.new")}</span>
      </Button>
    ) : undefined

  return (
    <div className="flex flex-col gap-6">
      {header}
      <CaseList
        baseFilters={baseFilters}
        onOpen={setSelected}
        showSubject={showSubject}
        showType={showType}
        canModerate={canModerate}
        toolbarExtra={createButton}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
      />
      {meta && (
        <CreateCaseDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          meta={meta}
          defaults={createDefaults}
          lockCaseType={lockCaseType}
          onCreated={(created) => setSelected(created.reference)}
        />
      )}
    </div>
  )
}
