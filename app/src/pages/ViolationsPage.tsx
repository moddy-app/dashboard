import { useCallback, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { RefreshCwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { usePageTitle } from "@/hooks/usePageTitle"
import { useSanctions } from "@/contexts/SanctionContext"
import { useGuildContext } from "@/contexts/GuildContext"
import { cn } from "@/lib/utils"
import { FILTER_ACCENT_BUTTON, FILTER_ACCENT_CHIP } from "@/lib/cases"
import { TERMS_URL } from "@/lib/sanctions"
import { ViolationList } from "@/components/violations/violation-list"
import { ViolationDetailView } from "@/components/violations/violation-detail"
import { SanctionNotice } from "@/components/violations/sanction-banner"
import { SanctionScale } from "@/components/violations/sanction-scale"

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
  // reprise telle quelle par le fil d'Ariane — même mécanique que ?case=REF.
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
        return groups.filter((g) => g.subjects.some((s) => s.subject_type === "discord_user"))
      case "guilds":
        return groups.filter((g) => g.subjects.some((s) => s.subject_type === "discord_guild"))
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

  return (
    <div className="flex flex-col gap-6">
      {/* En-tête : ce que la page montre, et de quoi il est question. */}
      <div>
        <h1 className="text-xl font-semibold leading-none">{t("violations.title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {t("violations.description")}{" "}
          <a
            href={TERMS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline underline-offset-2"
          >
            {t("violations.termsLink")}
          </a>
        </p>
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

      {/* Où le compte se situe — la même échelle que l'écran de suspension. */}
      <div className="rounded-xl border bg-card p-4">
        <p className="mb-4 text-sm font-semibold">{t("violations.scaleTitle")}</p>
        <SanctionScale level={user.level} />
      </div>

      {/* Barre d'outils — filtres à gauche, rafraîchissement à droite, comme la
          liste des dossiers de modération. */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 flex-wrap items-center gap-1.5">
            {SCOPES.map((value) => {
              const active = scope === value
              return (
                <Button
                  key={value}
                  size="sm"
                  variant="outline"
                  className={cn("h-7 rounded-full px-3 text-xs", active && FILTER_ACCENT_CHIP)}
                  onClick={() => setParam("scope", value === "all" ? null : value)}
                >
                  {t(`violations.scope.${value}`)}
                </Button>
              )
            })}
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label={t("violations.refresh")}
                onClick={handleRefresh}
                disabled={refreshing || groupsLoading}
                className={cn("size-9 shrink-0", refreshing && FILTER_ACCENT_BUTTON)}
              >
                <RefreshCwIcon className={cn("size-4", refreshing && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("violations.refresh")}</TooltipContent>
          </Tooltip>
        </div>

        <ViolationList
          groups={filtered}
          loading={groupsLoading}
          onOpen={(groupId) => setParam("group", groupId)}
        />
      </div>

      <p className="text-xs text-muted-foreground">{t("violations.cacheNote")}</p>
    </div>
  )
}
