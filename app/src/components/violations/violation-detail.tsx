import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  CalendarIcon,
  ChevronLeftIcon,
  ExternalLinkIcon,
  FileTextIcon,
  LoaderIcon,
  ScaleIcon,
  UserIcon,
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
import { absoluteTime, relativeTime } from "@/lib/cases"
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
  ReferenceText,
} from "./violation-badges"

// ─── Briques de mise en page (identiques à `case-detail.tsx`) ─────────────────

function Panel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  )
}

function PropRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof UserIcon
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </span>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  )
}

// ─── Sanctions d'un dossier ───────────────────────────────────────────────────

/**
 * Ce que l'infraction a concrètement entraîné, sujet par sujet. Structure
 * calquée sur `SanctionsPanel` (cases) : médaillon d'action, libellé, statut,
 * puis échéance en méta.
 */
function SubjectSanctions({ item }: { item: ViolationCase }) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <EntityRef
          kind={item.subject_type as EntityKind}
          id={item.subject_id}
          variant="inline"
        />
        <ReferenceText references={[item.reference]} />
      </div>

      <div className="flex flex-col divide-y">
        {item.sanctions.map((sanction, index) => {
          const active = sanction.status === "active"
          return (
            <div
              key={sanction.id ?? `${sanction.action}-${index}`}
              className={cn(
                "flex flex-wrap items-center gap-2 py-2.5 first:pt-0 last:pb-0",
                !active && "opacity-70"
              )}
            >
              <GlobalActionChip action={sanction.action} muted={!active} />
              <span
                className={cn(
                  "text-xs font-medium",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {t(`violations.sanctionStatus.${sanction.status}`)}
              </span>
              <ExpiryLabel
                expiresAt={sanction.expires_at}
                className="ml-auto text-xs text-muted-foreground"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Vue détail ───────────────────────────────────────────────────────────────

/**
 * Même gabarit que `CaseDetailView` : barre de retour + référence + état, titre
 * pleine largeur, puis deux colonnes (ce qui s'applique à gauche, les
 * propriétés à droite). Une infraction n'est pas modifiable depuis le
 * dashboard — il n'y a donc ni composeur ni actions d'écriture.
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
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">{backButton}</div>
        <div className="flex flex-col-reverse gap-6 lg:flex-row lg:items-start">
          <div className="flex-1 space-y-4">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
          <div className="flex shrink-0 flex-col gap-4 lg:w-80">
            <Skeleton className="h-40 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (notFound || !detail) {
    return (
      <div className="flex flex-col gap-5">
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
  const inactive = detail.actions.filter((a) => !detail.active_actions.includes(a))
  const headline = detail.cases[0]?.reason ?? t(`violations.level.${detail.level}`)
  const openedAt = detail.cases[0]?.created_at ?? null

  return (
    <div className="flex flex-col gap-5">
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
          <p className="mt-2 text-xs text-muted-foreground">
            {t("violations.detail.openedOn", { date: absoluteTime(openedAt, locale) })}
          </p>
        )}
      </div>

      <div className="flex flex-col-reverse gap-6 lg:flex-row lg:items-start">
        {/* ── Ce qui s'applique ──────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {/* Conséquences à venir — jamais sur une infraction close. */}
          {detail.enforcement && (
            <EnforcementNotice
              enforcement={detail.enforcement}
              appealUrl={appealUrl}
              active={detail.active}
              showAppeal={false}
            />
          )}

          <section>
            <h2 className="mb-3 text-sm font-semibold">
              {t("violations.detail.applies")}
            </h2>
            <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
              {detail.cases.map((item, index) => (
                <div
                  key={item.id ?? item.reference}
                  className={cn(index > 0 && "border-t pt-4")}
                >
                  <SubjectSanctions item={item} />
                </div>
              ))}
            </div>
          </section>

          {/* Recours — il n'existe aucun endpoint d'appel : on renvoie au support. */}
          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold">{t("violations.detail.appealTitle")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
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

        {/* ── Propriétés ─────────────────────────────────────────────────── */}
        <aside className="flex shrink-0 flex-col gap-4 lg:sticky lg:top-4 lg:w-80 lg:self-start">
          <Panel title={t("violations.detail.details")}>
            <div className="flex flex-col gap-3.5">
              <PropRow icon={UserIcon} label={t("violations.detail.subjects")}>
                <div className="flex flex-col gap-1.5">
                  {detail.cases.map((item) => (
                    <EntityRef
                      key={`${item.subject_type}:${item.subject_id}`}
                      kind={item.subject_type as EntityKind}
                      id={item.subject_id}
                      variant="block"
                    />
                  ))}
                </div>
              </PropRow>

              <PropRow icon={ScaleIcon} label={t("violations.detail.measures")}>
                <div className="flex flex-wrap items-center gap-1.5">
                  {detail.active_actions.map((action) => (
                    <GlobalActionChip key={`a-${action}`} action={action} />
                  ))}
                  {inactive.map((action) => (
                    <GlobalActionChip key={`i-${action}`} action={action} muted />
                  ))}
                </div>
              </PropRow>

              {openedAt && (
                <PropRow icon={CalendarIcon} label={t("violations.detail.dates")}>
                  <span
                    className="text-xs text-muted-foreground"
                    title={absoluteTime(openedAt, locale)}
                  >
                    {t("violations.detail.created", { date: relativeTime(openedAt, locale) })}
                  </span>
                </PropRow>
              )}
            </div>
          </Panel>
        </aside>
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
