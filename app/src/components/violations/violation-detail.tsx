import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  ChevronLeftIcon,
  ExternalLinkIcon,
  FileTextIcon,
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
import { APPEAL_URL } from "@/lib/sanctions"
import { ApiError } from "@/lib/auth"
import { getViolation } from "@/services/violations"
import { logger } from "@/lib/logger"
import type { ViolationCase, ViolationDetail } from "@/types/violations"
import {
  ClosedPill,
  EnforcementNotice,
  ExpiryLabel,
  GlobalActionChip,
  LevelPill,
  MeasureStatus,
  ReferenceText,
} from "./violation-badges"

// ─── Ce qui s'applique à un sujet ─────────────────────────────────────────────

/**
 * Un bloc par sujet visé : qui, puis les mesures qui le frappent. C'est la
 * seule fois où le détail par sujet apparaît — l'en-tête donne le résumé, ce
 * bloc donne la précision, rien n'est dit deux fois.
 */
function SubjectBlock({ item }: { item: ViolationCase }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <EntityRef kind={item.subject_type as EntityKind} id={item.subject_id} variant="inline" />
        <ReferenceText references={[item.reference]} />
      </div>

      <div className="flex flex-col gap-2">
        {item.sanctions.map((sanction, index) => (
          <div
            key={sanction.id ?? `${sanction.action}-${index}`}
            className={cn(
              "flex flex-wrap items-center gap-x-2.5 gap-y-1",
              sanction.status !== "active" && "opacity-60"
            )}
          >
            <GlobalActionChip action={sanction.action} muted={sanction.status !== "active"} />
            <MeasureStatus status={sanction.status} />
            <ExpiryLabel
              expiresAt={sanction.expires_at}
              className="text-xs text-muted-foreground"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Vue détail ───────────────────────────────────────────────────────────────

/**
 * Reprend la grammaire de `CaseDetailView` — barre de retour, référence et
 * pastille d'état, puis le motif en titre pleine largeur.
 *
 * Une différence assumée : **une seule colonne**. L'aside de `case-detail`
 * porte l'auteur, la portée, le groupe, les sanctions et les appels ; une
 * infraction n'a que ses sujets et ses mesures, déjà affichés au centre. Un
 * aside n'y aurait recopié que ce qui est en dessous.
 */
export function ViolationDetailView({
  groupId,
  onBack,
  backLabel,
}: {
  groupId: string
  onBack: () => void
  backLabel?: string
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
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

  const backButton = (
    <Button variant="ghost" size="sm" className="-ml-2 shrink-0" onClick={onBack}>
      <ChevronLeftIcon className="size-4" />
      {backLabel ?? t("violations.detail.back")}
    </Button>
  )

  if (loading) {
    return (
      <div className="flex max-w-3xl flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">{backButton}</div>
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    )
  }

  if (notFound || !detail) {
    return (
      <div className="flex max-w-3xl flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">{backButton}</div>
        <Empty className="rounded-xl border border-dashed">
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

  const appealUrl = detail.appeal_url || APPEAL_URL
  const references = detail.cases.map((c) => c.reference)
  const headline = detail.cases[0]?.reason ?? t(`violations.level.${detail.level}`)
  const openedAt = detail.cases[0]?.created_at ?? null

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      {/* En-tête */}
      <div className="flex flex-wrap items-center gap-2">
        {backButton}
        <div className="mx-1 h-4 w-px bg-border" />
        <ReferenceText references={references} />
        {detail.active ? <LevelPill level={detail.level} /> : <ClosedPill />}
      </div>

      {/* Titre — le motif retenu, en toutes lettres */}
      <div className="min-w-0">
        <h1 className="wrap-break-word text-lg font-semibold leading-snug sm:text-xl">
          {headline}
        </h1>
        {openedAt && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t("violations.detail.openedOn", { date: absoluteTime(openedAt, locale) })}
          </p>
        )}
      </div>

      {/* Ce qui va se passer — jamais sur une infraction close. */}
      {detail.enforcement && (
        <EnforcementNotice
          enforcement={detail.enforcement}
          appealUrl={appealUrl}
          active={detail.active}
          showAppeal={false}
        />
      )}

      {/* Ce qui s'applique, sujet par sujet */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">{t("violations.detail.applies")}</h2>
        <div className="flex flex-col divide-y rounded-xl border bg-card">
          {detail.cases.map((item) => (
            <div key={item.id ?? item.reference} className="p-4">
              <SubjectBlock item={item} />
            </div>
          ))}
        </div>
      </section>

      {/* Recours — il n'existe aucun endpoint d'appel : on renvoie au support. */}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">{t("violations.detail.appealTitle")}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {t("violations.detail.appealDescription")}
        </p>
        <Button asChild size="sm" className="mt-3 w-fit">
          <a href={appealUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLinkIcon className="size-4" />
            {t("violations.appeal")}
          </a>
        </Button>
      </section>
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
