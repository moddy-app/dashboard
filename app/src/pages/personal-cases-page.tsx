import { CasesScreen } from "@/components/cases/cases-screen"
import { CaseDetailView } from "@/components/cases/case-detail-view"
import { useParams } from "react-router-dom"
import { useViewer } from "@/hooks/useViewer"

export function PersonalCasesPage() {
  const viewer = useViewer()
  const id = viewer.discordId ?? ""

  return (
    <CasesScreen
      title="Mes sanctions"
      description="Toutes vos cases, tous serveurs réunis."
      baseQuery={{ subject_type: "discord_user", subject_id: id }}
      filterFields={["status", "action"]}
      buildTo={(c) => `/me/${c.reference}`}
      showSubject={false}
      showScope
      emptyTitle="Aucune sanction"
      emptyHint="Vous n'avez aucune case à votre encontre. Tout est en ordre."
    />
  )
}

export function PersonalCaseDetailPage() {
  const { reference } = useParams()
  return <CaseDetailView identifier={reference!} backTo="/me" backLabel="Mes sanctions" />
}
