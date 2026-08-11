import { useCallback, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { RefreshCwIcon, ShieldAlertIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { usePageTitle } from "@/hooks/usePageTitle"
import { useSanctions } from "@/contexts/SanctionContext"
import { useGuildContext } from "@/contexts/GuildContext"
import { cn } from "@/lib/utils"
import { FILTER_ACCENT_BUTTON } from "@/lib/cases"
import { LEVEL_TONE } from "@/lib/sanctions"
import { ViolationList } from "@/components/violations/violation-list"
import { ViolationDetailView } from "@/components/violations/violation-detail"
import { SanctionNotice } from "@/components/violations/sanction-banner"

type Scope = "all" | "active" | "user" | "guilds"

const SCOPES: Scope[] = ["all", "active", "user", "guilds"]

export function ViolationsPage() {
  const { t } = useTranslation()
  const { groups, groupsLoading, refresh, user } = useSanctions()
  const { selectedGuildId } = useGuildContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const [refreshing, setRefreshing] = useState(false)
  usePageTitle(t("violations.title"))

  // L'infraction ouverte vit dans l'URL (?group=<uuid>) : partageable et
  // reprise telle quelle par le fil d'Ariane.
  const selected = searchParams.get("group")
  const scope = (searchParams.get("scope") as Scope) ?? "all"

  const setParam = useCallback(
    (key: string, value: string | null) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      })
    },
    [setSearchParams]
  )

  const filtered = useMemo(() => {
    switch (scope) {
      case "active":
        return groups.filter((g) => g.active)
      case "user":
        return groups.filter((g) =>
          g.subjects.some((s) => s.subject_type === "discord_user")
        )
      case "guilds":
        return groups.filter((g) =>
          g.subjects.some((s) => s.subject_type === "discord_guild")
        )
      default:
        return groups
    }
  }, [groups, scope])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refresh(selectedGuildId)
    } finally {
      setRefreshing(false)
    }
  }

  if (selected) {
    return (
      <ViolationDetailView
        groupId={selected}
        onBack={() => setParam("group", null)}
        backLabel={t("violations.title")}
      />
    )
  }

  const tone = LEVEL_TONE[user.level]

  return (
    <div className="flex flex-col gap-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", tone.bg)}>
            <ShieldAlertIcon className={cn("size-5", tone.text)} />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-none">{t("violations.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("violations.description")}</p>
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing || groupsLoading}
            >
              <RefreshCwIcon className={cn("size-4", refreshing && "animate-spin")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("violations.refresh")}</TooltipContent>
        </Tooltip>
      </div>

      {/* État du compte — un `warn` informe, il ne verrouille rien. */}
      {user.level !== "none" && (
        <SanctionNotice
          level={user.level}
          status={user}
          title={t(`violations.status.${user.level}.title`)}
          description={t(`violations.status.${user.level}.description`)}
        />
      )}

      {/* Portées */}
      <div className="flex flex-wrap items-center gap-1.5">
        {SCOPES.map((value) => {
          const active = scope === value
          return (
            <Button
              key={value}
              size="sm"
              variant="outline"
              className={cn("h-7 rounded-full px-3 text-xs", active && FILTER_ACCENT_BUTTON)}
              onClick={() => setParam("scope", value === "all" ? null : value)}
            >
              {t(`violations.scope.${value}`)}
            </Button>
          )
        })}
      </div>

      <ViolationList
        groups={filtered}
        loading={groupsLoading}
        onOpen={(groupId) => setParam("group", groupId)}
      />

      <p className="text-xs text-muted-foreground">{t("violations.cacheNote")}</p>
    </div>
  )
}
