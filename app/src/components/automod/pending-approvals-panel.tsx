import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  InboxIcon,
  InformationCircleIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { ActionPlan } from "@/components/automod/action-plan"
import { actionLabel } from "@/lib/automod-labels"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
  ItemTitle,
} from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { UserChip } from "@/components/user-chip"
import { useAutomodCategoryLabel } from "@/hooks/useAutomodCategoryLabel"
import { absoluteTime, relativeTime } from "@/lib/cases"
import { logger } from "@/lib/logger"
import { pickLocalized } from "@/lib/automod"
import { listAutomodPendingApprovals } from "@/services/automod"
import type { AutomodCatalog, AutomodPendingApproval } from "@/types/api"

// Lecture seule : un modérateur décide sur la carte Discord, aucune route
// d'écriture n'existe. Le contenu du message supprimé n'est jamais exposé par
// l'API — on ne l'affiche donc pas (et on ne promet pas de le montrer).

type ApprovalStatus = "pending" | "approved" | "rejected" | "expired"

const STATUSES: readonly ApprovalStatus[] = ["pending", "approved", "rejected", "expired"]
const PAGE_SIZE = 50

interface AutomodPendingApprovalsPanelProps {
  guildId: string
  catalog: AutomodCatalog | null
}

export function AutomodPendingApprovalsPanel({ guildId, catalog }: AutomodPendingApprovalsPanelProps) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<ApprovalStatus>("pending")

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
        <AlertTitle>{t("modules.automod_ai.approvals.infoTitle")}</AlertTitle>
        <AlertDescription>{t("modules.automod_ai.approvals.infoDescription")}</AlertDescription>
      </Alert>

      <ToggleGroup
        type="single"
        variant="outline"
        value={status}
        onValueChange={(v) => v && setStatus(v as ApprovalStatus)}
        className="w-full sm:w-fit"
        aria-label={t("modules.automod_ai.approvals.statusLabel")}
      >
        {STATUSES.map((s) => (
          <ToggleGroupItem key={s} value={s}>
            {t(`modules.automod_ai.approvals.status.${s}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {/* Remonté à chaque changement de filtre : l'état de la liste repart de zéro. */}
      <ApprovalsList key={status} guildId={guildId} status={status} catalog={catalog} />
    </div>
  )
}

function ApprovalsList({
  guildId,
  status,
  catalog,
}: AutomodPendingApprovalsPanelProps & { status: ApprovalStatus }) {
  const { t, i18n } = useTranslation()
  const categoryLabel = useAutomodCategoryLabel(guildId)
  const [items, setItems] = useState<AutomodPendingApproval[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestSeq = useRef(0)

  const load = useCallback(async () => {
    const seq = ++requestSeq.current
    try {
      const page = await listAutomodPendingApprovals(guildId, { status, limit: PAGE_SIZE, offset: 0 })
      if (seq !== requestSeq.current) return
      setItems(page.approvals)
      setTotal(page.total)
      setError(null)
    } catch (e) {
      if (seq !== requestSeq.current) return
      logger.error("module:automod_ai", "Pending approvals failed", e)
      setError(e instanceof Error ? e.message : "Failed to load pending approvals")
    } finally {
      if (seq === requestSeq.current) {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    }
  }, [guildId, status])

  useEffect(() => {
    // `isLoading` démarre à true ; les setState du chargement sont asynchrones.
    const id = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(id)
  }, [load])

  const refresh = () => {
    setIsRefreshing(true)
    void load()
  }

  const retry = () => {
    setIsLoading(true)
    void load()
  }

  const loadMore = useCallback(async () => {
    const seq = requestSeq.current
    setIsLoadingMore(true)
    try {
      const page = await listAutomodPendingApprovals(guildId, {
        status,
        limit: PAGE_SIZE,
        offset: items.length,
      })
      if (seq !== requestSeq.current) return
      // Une demande traitée entre deux pages décale l'offset : doublons écartés.
      setItems((prev) => {
        const known = new Set(prev.map((a) => a.id))
        return [...prev, ...page.approvals.filter((a) => !known.has(a.id))]
      })
      setTotal(page.total)
    } catch (e) {
      logger.error("module:automod_ai", "Pending approvals load more failed", e)
      setError(e instanceof Error ? e.message : "Failed to load pending approvals")
    } finally {
      setIsLoadingMore(false)
    }
  }, [guildId, status, items.length])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading || isRefreshing}>
          {isRefreshing ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} data-icon="inline-start" />
          )}
          {t("modules.automod_ai.approvals.refresh")}
        </Button>
      </div>

      {error && items.length === 0 ? (
        <Alert variant="destructive">
          <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} />
          <AlertTitle>{t("modules.automod_ai.approvals.errorTitle")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <AlertAction>
            <Button variant="outline" size="sm" onClick={retry}>
              {t("modules.automod_ai.retry")}
            </Button>
          </AlertAction>
        </Alert>
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={InboxIcon} strokeWidth={2} />
            </EmptyMedia>
            <EmptyTitle>{t(`modules.automod_ai.approvals.emptyTitle.${status}`)}</EmptyTitle>
            <EmptyDescription>{t("modules.automod_ai.approvals.emptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <ItemGroup className="gap-2">
            {items.map((approval) => (
              <ApprovalRow
                key={approval.id}
                approval={approval}
                catalog={catalog}
                locale={i18n.language}
                categoryLabel={categoryLabel}
              />
            ))}
          </ItemGroup>
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {t("modules.automod_ai.approvals.count", { shown: items.length, total })}
            </p>
            {items.length < total && (
              <Button variant="outline" size="sm" onClick={() => void loadMore()} disabled={isLoadingMore}>
                {isLoadingMore && <Spinner data-icon="inline-start" />}
                {t("modules.automod_ai.approvals.loadMore")}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ApprovalRow({
  approval,
  catalog,
  locale,
  categoryLabel,
}: {
  approval: AutomodPendingApproval
  catalog: AutomodCatalog | null
  locale: string
  categoryLabel: (categorie: string | null) => string | null
}) {
  const { t } = useTranslation()
  const infraction = categoryLabel(approval.categorie) ?? t("modules.automod_ai.approvals.unknownInfraction")
  const gravity = approval.gravite
    ? pickLocalized(catalog?.gravities.find((g) => g.id === approval.gravite)?.name, locale) ||
      approval.gravite
    : null
  const known = ["pending", "approved", "rejected", "expired"].includes(approval.status)
  const result = approval.result
  const pending = approval.status === "pending"

  return (
    <Item variant="outline" size="sm">
      <ItemContent className="min-w-0">
        <ItemTitle className="max-w-full flex-wrap">
          <UserChip userId={approval.user_id} />
          <span className="text-muted-foreground">{infraction}</span>
          {gravity && <Badge variant="outline">{gravity}</Badge>}
        </ItemTitle>
        <ItemDescription className="line-clamp-none flex flex-col gap-1.5">
          <ActionPlan
            catalog={catalog}
            actions={approval.actions}
            timeoutSeconds={approval.timeout_seconds}
          />
          <span>
            <span title={absoluteTime(approval.created_at, locale)}>
              {t("modules.automod_ai.approvals.createdAt", {
                when: relativeTime(approval.created_at, locale),
              })}
            </span>
            {pending && approval.expires_at && (
              <>
                {" · "}
                <span title={absoluteTime(approval.expires_at, locale)}>
                  {t("modules.automod_ai.approvals.expiresAt", {
                    when: relativeTime(approval.expires_at, locale),
                  })}
                </span>
              </>
            )}
          </span>
          {approval.resolved_at && (
            <span className="inline-flex flex-wrap items-center gap-1">
              <span title={absoluteTime(approval.resolved_at, locale)}>
                {t("modules.automod_ai.approvals.resolvedAt", {
                  when: relativeTime(approval.resolved_at, locale),
                })}
              </span>
              {approval.resolved_by && (
                <>
                  {t("modules.automod_ai.approvals.resolvedBy")}
                  <UserChip userId={approval.resolved_by} />
                </>
              )}
            </span>
          )}
          {result && <ApprovalResult result={result} catalog={catalog} />}
        </ItemDescription>
      </ItemContent>
      <ItemActions className="flex-wrap justify-end">
        {approval.message_deleted && (
          <Badge variant="outline">{t("modules.automod_ai.approvals.messageDeleted")}</Badge>
        )}
        <Badge variant={approval.status === "rejected" ? "destructive" : "secondary"}>
          {known ? t(`modules.automod_ai.approvals.status.${approval.status}`) : approval.status}
        </Badge>
      </ItemActions>
    </Item>
  )
}

/** Verdict d'une demande traitée : actions appliquées, échecs, référence de la case (texte courant). */
function ApprovalResult({
  result,
  catalog,
}: {
  result: NonNullable<AutomodPendingApproval["result"]>
  catalog: AutomodCatalog | null
}) {
  const { t, i18n } = useTranslation()
  const label = (id: string) => actionLabel(catalog, id, i18n.language, t)
  return (
    <span className="flex flex-wrap items-center gap-1">
      {result.applied.length > 0 && (
        <>
          {t("modules.automod_ai.approvals.applied")}
          {result.applied.map((a) => (
            <Badge key={`ok-${a}`} variant="secondary">
              {label(a)}
            </Badge>
          ))}
        </>
      )}
      {result.failed.length > 0 && (
        <>
          {t("modules.automod_ai.approvals.failed")}
          {result.failed.map((a) => (
            <Badge key={`ko-${a}`} variant="destructive">
              {label(a)}
            </Badge>
          ))}
        </>
      )}
      {result.case_ref && (
        <span>{t("modules.automod_ai.approvals.caseRef", { ref: result.case_ref })}</span>
      )}
    </span>
  )
}
