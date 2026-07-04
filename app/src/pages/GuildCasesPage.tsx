import { useTranslation } from "react-i18next"
import { ShieldAlertIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorPage } from "@/components/error-state"
import { useGuildContext } from "@/contexts/GuildContext"
import { canModerateCases } from "@/lib/cases"
import { CasesBrowser } from "@/components/cases/cases-browser"

export function GuildCasesPage() {
  const { t } = useTranslation()
  const { user, selectedGuildId, guildDetail, isLoadingGuild, guildError, refreshGuildData } =
    useGuildContext()

  if (isLoadingGuild) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (guildError) {
    return <ErrorPage error={guildError} onRetry={refreshGuildData} />
  }

  if (!selectedGuildId) return null

  const header = (
    <div className="flex items-center gap-4">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-950">
        <ShieldAlertIcon className="size-5 text-orange-500" />
      </div>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold leading-none">{t("cases.guild.title")}</h1>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {t("cases.guild.description", { guild: guildDetail?.name ?? "" })}
        </p>
      </div>
    </div>
  )

  return (
    <CasesBrowser
      header={header}
      baseFilters={{ scope_type: "discord_guild", scope_id: selectedGuildId }}
      canModerate={canModerateCases(user)}
      showSubject
      backLabel={t("cases.guild.title")}
      emptyTitle={t("cases.guild.emptyTitle")}
      emptyDescription={t("cases.guild.emptyDescription")}
    />
  )
}
