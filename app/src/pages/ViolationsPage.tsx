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
import { FILTER_ACCENT_CHIP } from "@/lib/cases"
import { LEVEL_TONE, TERMS_URL } from "@/lib/sanctions"
import { ViolationList } from "@/components/violations/violation-list"
import { ViolationDetailView } from "@/components/violations/violation-detail"
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

  const tone = LEVEL_TONE[user.level]

  return (
    <div className="flex flex-col gap-6">
      {/* En-tête : ce que la page montre, et sur quelles règles elle repose. */}
      <div>
        <h1 className="text-xl font-semibold leading-none">{t("violations.title")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
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

      {/* État du compte : l'échelle et ce que le niveau courant change,
          dans un seul bloc. Deux encarts qui disaient la même chose n'en
          font plus qu'un. */}
      <div className="flex flex-col gap-5 rounded-xl border bg-card p-5">
        {/* Bornée : au-delà, les quatre paliers s'éloignent au point qu'on ne
            lit plus une progression mais quatre étiquettes isolées. Le reste
            du bloc, lui, suit la largeur du contenu comme partout ailleurs. */}
        <SanctionScale level={user.level} className="max-w-xl" />
        <div className="border-t pt-4">
          <p className={cn("text-sm font-semibold", user.level !== "none" && tone.text)}>
            {t(`violations.status.${user.level}.title`)}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t(`violations.status.${user.level}.description`)}
          </p>
        </div>
      </div>

      {/* Filtres + liste */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 flex-wrap items-center gap-1.5">
            {SCOPES.map((value) => {
              const isActive = scope === value
              return (
                <Button
                  key={value}
                  size="sm"
                  variant="outline"
                  className={cn("h-7 rounded-full px-3 text-xs", isActive && FILTER_ACCENT_CHIP)}
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
                className="size-9 shrink-0"
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
    </div>
  )
}
