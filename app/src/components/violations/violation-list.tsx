import { useTranslation } from "react-i18next"
import { ChevronRightIcon, ShieldCheckIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { cn } from "@/lib/utils"
import { absoluteTime, relativeTime } from "@/lib/cases"
import { LEVEL_TONE, formatDeadline } from "@/lib/sanctions"
import type { ViolationGroup } from "@/types/violations"
import { EntityRef, type EntityKind } from "@/components/cases/entity-ref"
import { ActionBadge, LevelBadge, ReferenceChip } from "./violation-badges"

// ─── Carte d'infraction ───────────────────────────────────────────────────────

/**
 * Une carte = un `group_id`. Une infraction peut viser le compte ET ses serveurs
 * à la fois : les afficher séparément donnerait l'impression de plusieurs
 * sanctions distinctes.
 */
export function ViolationCard({
  group,
  onOpen,
}: {
  group: ViolationGroup
  onOpen: (groupId: string) => void
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const tone = LEVEL_TONE[group.level]
  const Icon = tone.icon

  // Les actions révoquées / expirées restent affichées, mais barrées.
  const inactive = group.actions.filter((a) => !group.active_actions.includes(a))
  const deadline = formatDeadline(group.enforcement?.deadline, locale)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(group.group_id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen(group.group_id)
        }
      }}
      className={cn(
        "group flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none",
        !group.active && "opacity-70 hover:opacity-100"
      )}
    >
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          group.active ? tone.bg : "bg-muted"
        )}
      >
        <Icon className={cn("size-4", group.active ? tone.text : "text-muted-foreground")} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{group.reason}</p>
          {group.active ? (
            <LevelBadge level={group.level} />
          ) : (
            <span className="rounded-md border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {t("violations.list.resolved")}
            </span>
          )}
        </div>

        {/* Sujets visés — compte et/ou serveurs */}
        {group.subjects.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {group.subjects.map((subject) => (
              <EntityRef
                key={`${subject.subject_type}:${subject.subject_id}`}
                kind={subject.subject_type as EntityKind}
                id={subject.subject_id}
                variant="inline"
              />
            ))}
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {group.active_actions.map((action) => (
            <ActionBadge key={`a-${action}`} action={action} />
          ))}
          {inactive.map((action) => (
            <ActionBadge key={`i-${action}`} action={action} muted />
          ))}
          {group.references.map((reference) => (
            <ReferenceChip key={reference} reference={reference} />
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span title={absoluteTime(group.created_at, locale)}>
            {t("violations.list.openedAgo", { time: relativeTime(group.created_at, locale) })}
          </span>
          {group.case_count > 1 && (
            <span>{t("violations.list.caseCount", { count: group.case_count })}</span>
          )}
          {group.enforcement?.status === "pending" && deadline && (
            <span className="font-medium text-red-600 dark:text-red-400">
              {t("violations.list.deadline", { date: deadline })}
            </span>
          )}
          {group.enforcement?.status === "halted" && (
            <span className="font-medium text-sky-600 dark:text-sky-400">
              {t("violations.enforcement.title.halted")}
            </span>
          )}
        </div>
      </div>

      <ChevronRightIcon className="mt-2 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  )
}

// ─── Liste ────────────────────────────────────────────────────────────────────

export function ViolationList({
  groups,
  loading,
  onOpen,
  emptyTitle,
  emptyDescription,
  className,
}: {
  groups: ViolationGroup[]
  loading: boolean
  onOpen: (groupId: string) => void
  emptyTitle?: string
  emptyDescription?: string
  className?: string
}) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <Empty className={cn("border border-dashed", className)}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldCheckIcon />
          </EmptyMedia>
          <EmptyTitle>{emptyTitle ?? t("violations.list.emptyTitle")}</EmptyTitle>
          <EmptyDescription>
            {emptyDescription ?? t("violations.list.emptyDescription")}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {groups.map((group) => (
        <ViolationCard key={group.group_id} group={group} onOpen={onOpen} />
      ))}
    </div>
  )
}
