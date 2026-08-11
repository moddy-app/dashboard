import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  FileTextIcon,
  InfoIcon,
  LoaderIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { EntityRef, type EntityKind } from "@/components/cases/entity-ref"
import { cn } from "@/lib/utils"
import { absoluteTime } from "@/lib/cases"
import { APPEAL_URL, LEVEL_TONE, formatDeadline } from "@/lib/sanctions"
import { ApiError } from "@/lib/auth"
import { getViolation } from "@/services/violations"
import { logger } from "@/lib/logger"
import type { ViolationCase, ViolationDetail } from "@/types/violations"
import { ActionBadge, EnforcementNotice, LevelBadge, ReferenceChip } from "./violation-badges"

// ─── Panneau d'une case ───────────────────────────────────────────────────────

function CasePanel({ item }: { item: ViolationCase }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language

  return (
    <div className="rounded-xl border">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <ReferenceChip reference={item.reference} />
        <EntityRef
          kind={item.subject_type as EntityKind}
          id={item.subject_id}
          variant="inline"
        />
        <span className="ml-auto text-xs text-muted-foreground">
          {absoluteTime(item.created_at, locale)}
        </span>
      </div>

      <div className="flex flex-col gap-3 px-4 py-3">
        <p className="text-sm">{item.reason}</p>

        {item.sanctions.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {item.sanctions.map((sanction, index) => {
              const expires = formatDeadline(sanction.expires_at, locale)
              const active = sanction.status === "active"
              return (
                <div
                  key={sanction.id ?? `${sanction.action}-${index}`}
                  className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-2"
                >
                  <ActionBadge action={sanction.action} muted={!active} />
                  <span
                    className={cn(
                      "text-xs font-medium",
                      active ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {t(`violations.sanctionStatus.${sanction.status}`)}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {expires
                      ? t("violations.detail.until", { date: expires })
                      : t("violations.detail.permanent")}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Vue détail ───────────────────────────────────────────────────────────────

export function ViolationDetailView({
  groupId,
  onBack,
  backLabel,
}: {
  groupId: string
  onBack: () => void
  backLabel?: string
}) {
  const { t } = useTranslation()
  const [detail, setDetail] = useState<ViolationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setNotFound(false)
    try {
      setDetail(await getViolation(groupId))
    } catch (e) {
      // 404 volontairement indistinct : l'infraction n'existe pas *ou* ne nous
      // concerne pas — on ne fait pas la différence côté UI non plus.
      if (e instanceof ApiError && e.isNotFound) setNotFound(true)
      else logger.warn("sanctions", `Failed to load violation ${groupId}`, e)
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    void load()
  }, [load])

  const back = (
    <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={onBack}>
      <ArrowLeftIcon className="size-4" />
      {backLabel ?? t("violations.detail.back")}
    </Button>
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    )
  }

  if (notFound || !detail) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileTextIcon />
            </EmptyMedia>
            <EmptyTitle>{t("violations.detail.notFoundTitle")}</EmptyTitle>
            <EmptyDescription>{t("violations.detail.notFoundDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const tone = LEVEL_TONE[detail.level]
  const Icon = tone.icon
  const appealUrl = detail.appeal_url || APPEAL_URL
  const references = detail.cases.map((c) => c.reference)
  const inactive = detail.actions.filter((a) => !detail.active_actions.includes(a))
  const headline = detail.cases[0]?.reason ?? t(`violations.level.${detail.level}`)

  return (
    <div className="flex flex-col gap-6">
      {back}

      {/* En-tête */}
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            detail.active ? tone.bg : "bg-muted"
          )}
        >
          <Icon
            className={cn("size-5", detail.active ? tone.text : "text-muted-foreground")}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold leading-tight">{headline}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {detail.active ? (
              <LevelBadge level={detail.level} />
            ) : (
              <span className="rounded-md border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                {t("violations.list.resolved")}
              </span>
            )}
            {detail.active_actions.map((action) => (
              <ActionBadge key={`a-${action}`} action={action} />
            ))}
            {inactive.map((action) => (
              <ActionBadge key={`i-${action}`} action={action} muted />
            ))}
            {references.map((reference) => (
              <ReferenceChip key={reference} reference={reference} />
            ))}
          </div>
        </div>
      </div>

      {/* Compte à rebours */}
      {detail.enforcement && (
        <EnforcementNotice enforcement={detail.enforcement} appealUrl={appealUrl} />
      )}

      {/* Cases du groupe */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">
          {t("violations.detail.cases", { count: detail.cases.length })}
        </h2>
        {detail.cases.map((item) => (
          <CasePanel key={item.id ?? item.reference} item={item} />
        ))}
      </div>

      {/* Appel — aucun endpoint : on ne fait que rediriger vers le support */}
      <div className="flex flex-col gap-3 rounded-xl border p-4">
        <div className="flex items-start gap-3">
          <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{t("violations.detail.appealTitle")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("violations.detail.appealDescription")}
            </p>
          </div>
        </div>
        <Button asChild size="sm" className="w-fit">
          <a href={appealUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLinkIcon className="size-4" />
            {t("violations.appeal")}
          </a>
        </Button>
      </div>
    </div>
  )
}

/** Petit indicateur de chargement partagé (détail ouvert depuis une autre vue). */
export function ViolationDetailFallback() {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <LoaderIcon className="size-5 animate-spin text-muted-foreground" />
    </div>
  )
}
