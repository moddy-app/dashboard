import { useTranslation } from "react-i18next"
import { CircleDotIcon, CheckCircle2Icon, ShieldCheckIcon } from "lucide-react"
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
import type { ViolationGroup } from "@/types/violations"
import { EntityRef, type EntityKind } from "@/components/cases/entity-ref"
import { LevelPill, ClosedPill } from "./violation-badges"

// ─── Séparateur (point) ───────────────────────────────────────────────────────
// Repris à l'identique de `case-list.tsx` : les deux listes se lisent pareil.

function Dot() {
  return <span className="size-1 shrink-0 rounded-full bg-current opacity-40" />
}

// ─── Ligne ────────────────────────────────────────────────────────────────────

/**
 * Une ligne = un `group_id`, jamais un dossier isolé. Une même infraction peut
 * viser le compte ET ses serveurs ; les afficher séparément donnerait
 * l'impression de plusieurs sanctions distinctes.
 *
 * La structure est celle de `CaseRow` : pastille d'état, titre, ligne de méta
 * ponctuée de points, puis chips et date à droite.
 */
function ViolationRow({
  group,
  onOpen,
}: {
  group: ViolationGroup
  onOpen: (groupId: string) => void
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language

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
      className="group flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:px-4"
    >
      {/* Indicateur d'état */}
      <span
        className="shrink-0"
        title={group.active ? t("violations.list.activeTitle") : t("violations.list.resolved")}
      >
        {group.active ? (
          <CircleDotIcon className="size-4 text-red-500" />
        ) : (
          <CheckCircle2Icon className="size-4 text-muted-foreground/60" />
        )}
      </span>

      {/* Corps */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{group.reason}</p>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          {group.references.length > 0 && (
            <span className="shrink-0">
              {t("violations.reference", { refs: group.references.join(", ") })}
            </span>
          )}
          {/* Le séparateur vit dans le même conteneur que les sujets : sorti,
              il laissait un point orphelin sur mobile, où les sujets sont
              masqués faute de place. */}
          {group.subjects.length > 0 && (
            <span className="hidden min-w-0 items-center gap-1.5 sm:inline-flex">
              <Dot />
              {group.subjects.slice(0, 2).map((subject) => (
                <EntityRef
                  key={`${subject.subject_type}:${subject.subject_id}`}
                  kind={subject.subject_type as EntityKind}
                  id={subject.subject_id}
                  variant="inline"
                />
              ))}
            </span>
          )}
        </div>
      </div>

      {/* État + date. Pas de chips de mesure ici : le niveau les résume déjà
          (« Suspendu » = une suspension), et deux étiquettes de formes
          différentes qui disent la même chose ne font que du bruit. Le détail
          par sujet vit dans la vue détail. */}
      <div className="flex shrink-0 items-center gap-3">
        {group.active ? <LevelPill level={group.level} /> : <ClosedPill />}
        <span
          className="w-14 text-right text-xs tabular-nums text-muted-foreground"
          title={absoluteTime(group.created_at, locale)}
        >
          {relativeTime(group.created_at, locale)}
        </span>
      </div>
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
      <div className={cn("flex flex-col divide-y rounded-xl border", className)}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="size-4 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-3 w-10" />
          </div>
        ))}
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <Empty className={cn("rounded-xl border border-dashed", className)}>
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
    <div
      className={cn(
        "flex flex-col divide-y overflow-hidden rounded-xl border",
        className
      )}
    >
      {groups.map((group) => (
        <ViolationRow key={group.group_id} group={group} onOpen={onOpen} />
      ))}
    </div>
  )
}
