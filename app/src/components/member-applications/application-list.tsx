import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DiscordIcon,
  InboxIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ErrorPage } from "@/components/error-state"
import { ApplicationDetailSheet } from "@/components/member-applications/application-detail"
import { ApplicationStatusBadge } from "@/components/member-applications/application-status-badge"
import { getAvatarUrl } from "@/lib/auth"
import { relativeTime } from "@/lib/cases"
import { logger } from "@/lib/logger"
import { applicantName } from "@/lib/member-applications"
import { listApplications } from "@/services/member-applications"
import { APPLICATION_STATUSES } from "@/types/member-applications"
import type { Application, ApplicationStatus } from "@/types/member-applications"

// Consultation **en lecture seule** : aucune route ne permet de décider d'une
// candidature, tout se tranche dans Discord. Pas de temps réel non plus — on
// recharge à l'ouverture, au clic sur « Actualiser », et toutes les 45 s sur
// le filtre « En attente » quand l'onglet est visible.
//
// Données personnelles : rien n'est mis en cache au-delà de l'état React.

const PAGE_SIZE = 50
const POLL_MS = 45_000

type Filter = ApplicationStatus | "all"

export function ApplicationList({
  guildId,
  onChanged,
}: {
  guildId: string
  /** Appelé après chaque rechargement réussi — la page rafraîchit ses stats. */
  onChanged?: () => void
}) {
  const { t, i18n } = useTranslation()
  const [filter, setFilter] = useState<Filter>("SUBMITTED")
  const [items, setItems] = useState<Application[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Application | null>(null)
  // Dernière requête lancée : une réponse plus ancienne (filtre changé entre-
  // temps) est ignorée plutôt que d'écraser la liste courante.
  const requestSeq = useRef(0)
  const onChangedRef = useRef(onChanged)
  useEffect(() => {
    onChangedRef.current = onChanged
  }, [onChanged])

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      const seq = ++requestSeq.current
      if (mode === "initial") setIsLoading(true)
      else setIsRefreshing(true)
      try {
        const page = await listApplications(guildId, {
          status: filter === "all" ? null : filter,
          limit: PAGE_SIZE,
          offset: 0,
        })
        if (seq !== requestSeq.current) return
        setItems(page.applications)
        setTotal(page.total)
        setError(null)
        onChangedRef.current?.()
      } catch (e) {
        if (seq !== requestSeq.current) return
        logger.error("module:member_applications", "List failed", e)
        setError(e instanceof Error ? e.message : "Failed to load applications")
      } finally {
        if (seq === requestSeq.current) {
          setIsLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [guildId, filter]
  )

  useEffect(() => {
    void load("initial")
  }, [load])

  // Sondage borné : seulement « En attente », seulement onglet visible.
  useEffect(() => {
    if (filter !== "SUBMITTED") return
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load("refresh")
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [filter, load])

  const loadMore = useCallback(async () => {
    const seq = requestSeq.current
    setIsLoadingMore(true)
    try {
      const page = await listApplications(guildId, {
        status: filter === "all" ? null : filter,
        limit: PAGE_SIZE,
        offset: items.length,
      })
      if (seq !== requestSeq.current) return
      // Une candidature arrivée entre deux pages décale l'offset : on écarte
      // les doublons par `request_id`.
      setItems((prev) => {
        const known = new Set(prev.map((a) => a.request_id))
        return [...prev, ...page.applications.filter((a) => !known.has(a.request_id))]
      })
      setTotal(page.total)
    } catch (e) {
      logger.error("module:member_applications", "Load more failed", e)
      setError(e instanceof Error ? e.message : "Failed to load applications")
    } finally {
      setIsLoadingMore(false)
    }
  }, [guildId, filter, items.length])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Groupe segmenté : il défile sur mobile plutôt que de passer à la
            ligne, ce qui casserait ses coins arrondis. */}
        <div className="max-w-full overflow-x-auto">
          <ToggleGroup
            type="single"
            variant="outline"
            value={filter}
            // Radix renvoie `""` quand on recliquerait sur l'élément actif :
            // on garde le filtre courant plutôt que de tout désélectionner.
            onValueChange={(v) => v && setFilter(v as Filter)}
            aria-label={t("modules.member_applications.list.filterLabel")}
          >
            {APPLICATION_STATUSES.map((status) => (
              <ToggleGroupItem key={status} value={status} className="px-3">
                {t(`modules.member_applications.statusFilter.${status}`)}
              </ToggleGroupItem>
            ))}
            <ToggleGroupItem value="all" className="px-3">
              {t("modules.member_applications.statusFilter.all")}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load("refresh")}
          disabled={isLoading || isRefreshing}
        >
          {isRefreshing ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} data-icon="inline-start" />
          )}
          {t("modules.member_applications.list.refresh")}
        </Button>
      </div>

      {error && items.length === 0 ? (
        <ErrorPage error={error} onRetry={() => void load("initial")} />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={InboxIcon} strokeWidth={2} />
            </EmptyMedia>
            <EmptyTitle>{t(`modules.member_applications.list.empty.${filter}`)}</EmptyTitle>
            <EmptyDescription>{t("modules.member_applications.list.emptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <ItemGroup className="gap-2">
            {items.map((application) => (
              <ApplicationRow
                key={application.request_id}
                application={application}
                locale={i18n.language}
                onOpen={() => setSelected(application)}
              />
            ))}
          </ItemGroup>
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {t("modules.member_applications.list.count", { shown: items.length, total })}
            </p>
            {items.length < total && (
              <Button variant="outline" size="sm" onClick={() => void loadMore()} disabled={isLoadingMore}>
                {isLoadingMore && <Spinner data-icon="inline-start" />}
                {t("modules.member_applications.list.loadMore")}
              </Button>
            )}
          </div>
        </>
      )}

      <ApplicationDetailSheet
        guildId={guildId}
        application={selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  )
}

function ApplicationRow({
  application,
  locale,
  onOpen,
}: {
  application: Application
  locale: string
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const name = applicantName(application)
  const date = application.submitted_at ?? application.created_at
  const pendingWithoutCard = application.status === "SUBMITTED" && !application.message_id

  return (
    <Item variant="outline" size="sm" asChild>
      <button type="button" onClick={onOpen} className="cursor-pointer text-left hover:bg-muted/50">
        <ItemMedia>
          <Avatar className="size-9">
            <AvatarImage
              src={getAvatarUrl(application.user_id, application.user?.avatar ?? null)}
              alt={t("common.avatarAlt", { name })}
            />
            <AvatarFallback>{name.slice(0, 2)}</AvatarFallback>
          </Avatar>
        </ItemMedia>
        <ItemContent className="min-w-0">
          <ItemTitle className="max-w-full truncate">{name}</ItemTitle>
          <ItemDescription>
            {t("modules.member_applications.list.submitted", { when: relativeTime(date, locale) })}
            {application.status === "REJECTED" && application.rejection_reason && (
              <> · {application.rejection_reason}</>
            )}
          </ItemDescription>
        </ItemContent>
        <ItemActions className="flex-wrap justify-end">
          {pendingWithoutCard && (
            <Badge variant="outline">{t("modules.member_applications.detail.cardPendingShort")}</Badge>
          )}
          {application.decided_in === "discord" && (
            <Badge variant="secondary">
              <HugeiconsIcon icon={DiscordIcon} strokeWidth={2} data-icon="inline-start" />
              {t("modules.member_applications.decidedInDiscord")}
            </Badge>
          )}
          <ApplicationStatusBadge status={application.status} />
        </ItemActions>
      </button>
    </Item>
  )
}
