import { useTranslation } from "react-i18next"
import { ScaleIcon } from "lucide-react"
import { usePageTitle } from "@/hooks/usePageTitle"
import { useGuildContext } from "@/contexts/GuildContext"
import { canModerateCases } from "@/lib/cases"
import { CasesBrowser } from "@/components/cases/cases-browser"

export function MyCasesPage() {
  const { t } = useTranslation()
  const { user } = useGuildContext()
  usePageTitle(t("cases.my.title"))

  const header = (
    <div className="flex items-center gap-4">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-950">
        <ScaleIcon className="size-5 text-orange-500" />
      </div>
      <div>
        <h1 className="text-xl font-semibold leading-none">{t("cases.my.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("cases.my.description")}</p>
      </div>
    </div>
  )

  return (
    <CasesBrowser
      header={header}
      baseFilters={{ subject_type: "discord_user", subject_id: user.user_id }}
      canModerate={canModerateCases(user)}
      showSubject={false}
      showType
      backLabel={t("cases.my.title")}
      emptyTitle={t("cases.my.emptyTitle")}
      emptyDescription={t("cases.my.emptyDescription")}
    />
  )
}
