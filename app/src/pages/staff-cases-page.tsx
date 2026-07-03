import * as React from "react"
import { useNavigate, useParams } from "react-router-dom"
import { PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CaseDetailView } from "@/components/cases/case-detail-view"
import { CasesScreen } from "@/components/cases/cases-screen"
import { CreateCaseDialog } from "@/components/cases/create-case-dialog"
import { useCasesMeta } from "@/hooks/useCasesMeta"
import { useViewer } from "@/hooks/useViewer"

export function StaffCasesPage() {
  const navigate = useNavigate()
  const viewer = useViewer()
  const { meta } = useCasesMeta()
  const [createOpen, setCreateOpen] = React.useState(false)

  return (
    <>
      <CasesScreen
        title="Cases"
        description="Recherche transversale sur l'ensemble du réseau Moddy."
        actions={
          viewer.isModerator && meta ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <PlusIcon />
              Nouvelle case
            </Button>
          ) : undefined
        }
        baseQuery={{}}
        filterFields={["status", "type", "action", "subject", "scope"]}
        buildTo={(c) => `/staff/cases/${c.reference}`}
        showSubject
        showScope
        emptyTitle="Aucune case"
        emptyHint="Aucune case ne correspond à ces filtres."
      />

      {meta && (
        <CreateCaseDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          meta={meta}
          onCreated={(created) => navigate(`/staff/cases/${created.reference}`)}
        />
      )}
    </>
  )
}

export function StaffCaseDetailPage() {
  const { reference } = useParams()
  return (
    <CaseDetailView
      identifier={reference!}
      backTo="/staff/cases"
      backLabel="Cases"
    />
  )
}
