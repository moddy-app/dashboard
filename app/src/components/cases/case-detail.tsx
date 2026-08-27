import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  ChevronLeftIcon,
  PlusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  LockIcon,
  UnlockIcon,
  LoaderIcon,
  CopyIcon,
  UserIcon,
  UserCogIcon,
  ShieldIcon,
  CalendarIcon,
  LayersIcon,
  CheckIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Textarea } from "@/components/ui/textarea"
import { ErrorState } from "@/components/error-state"
import { ApiError } from "@/lib/auth"
import { handleSaveError } from "@/lib/handle-error"
import { absoluteTime, relativeTime, copyText } from "@/lib/cases"
import { cn } from "@/lib/utils"
import { useCasesMeta } from "@/hooks/useCasesMeta"
import {
  getCase,
  addNote,
  addSanction,
  revokeSanction,
  patchCase,
} from "@/services/cases"
import type { CaseDetail, SanctionCreateInput } from "@/types/cases"
import { CaseReference, CaseStatusPill, CaseTypeBadge } from "./case-badges"
import { EntityRef, type EntityKind } from "./entity-ref"
import { CaseTimeline } from "./case-timeline"
import { CaseComposer } from "./case-composer"
import { CaseEvidenceSection } from "./case-evidence"
import { SanctionsPanel } from "./sanctions-panel"
import { AppealsPanel } from "./appeals-panel"
import { AddSanctionDialog } from "./add-sanction-dialog"

interface CaseDetailViewProps {
  identifier: string
  onBack: () => void
  backLabel?: string
  /** L'utilisateur est-il staff modérateur (droit d'écriture) ? */
  canModerate: boolean
  /** Masque le sujet quand il est évident (vue personnelle). */
  showSubject?: boolean
  /** Masque le type quand il est évident (vue serveur). */
  showType?: boolean
  /** Masque la portée quand elle est évidente (vue serveur). */
  showScope?: boolean
}

// ─── Bouton « copier » (icône + tooltip) ──────────────────────────────────────

function CopyButton({ value, label }: { value: string; label?: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() =>
            copyText(value).then((ok) => {
              if (!ok) return
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1500)
            })
          }
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {copied ? (
            <CheckIcon className="size-3.5 animate-in zoom-in-50 text-emerald-500 duration-200" />
          ) : (
            <CopyIcon className="size-3.5" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>{copied ? t("cases.detail.copied") : (label ?? t("cases.detail.copy"))}</TooltipContent>
    </Tooltip>
  )
}

// ─── Ligne de propriété (typographie normalisée) ──────────────────────────────

function PropRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof ShieldIcon
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

// ─── Valeur d'identité (sujet / auteur / portée — format unifié) ──────────────

function IdentityValue({ kind, id }: { kind: EntityKind; id: string | null | undefined }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <EntityRef kind={kind} id={id} variant="block" />
      {id && <CopyButton value={id} label={t("cases.detail.copyId")} />}
    </div>
  )
}

// ─── Carte latérale (sans séparateurs internes) ───────────────────────────────

function Panel({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

// ─── Vue détail ───────────────────────────────────────────────────────────────

export function CaseDetailView({
  identifier,
  onBack,
  backLabel,
  canModerate,
  showSubject = true,
  showType = true,
  showScope = true,
}: CaseDetailViewProps) {
  const { t, i18n } = useTranslation()
  const { meta } = useCasesMeta()
  const [data, setData] = useState<CaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [reasonDraft, setReasonDraft] = useState("")
  const [statusBusy, setStatusBusy] = useState(false)
  const [editBusy, setEditBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await getCase(identifier))
    } catch (e) {
      if (e instanceof ApiError) setError(e.message)
      else setError(e instanceof Error ? e.message : "Failed to load case")
    } finally {
      setLoading(false)
    }
  }, [identifier])

  useEffect(() => {
    load()
  }, [load])

  // Écriture autorisée : staff modérateur. Le back-end reste l'autorité (403).
  const writable = !!data && canModerate
  const allowedActions = data && meta ? meta.case_type_actions[data.type] ?? [] : []
  const canSanction = writable && allowedActions.length > 0

  const handleAddComment = async (content: string) => {
    if (!data) return
    try {
      const updated = await addNote(data.reference, content)
      setData(updated)
    } catch (e) {
      handleSaveError(e, { title: t("cases.composer.error") })
      throw e
    }
  }

  const handleAddSanction = async (input: SanctionCreateInput) => {
    if (!data) return
    try {
      const updated = await addSanction(data.reference, input)
      setData(updated)
      toast.success(t("cases.addSanction.success"))
    } catch (e) {
      handleSaveError(e, { title: t("cases.addSanction.error") })
      throw e
    }
  }

  const handleRevoke = async (sanctionId: string, note?: string) => {
    if (!data) return
    try {
      const updated = await revokeSanction(data.reference, sanctionId, note)
      setData(updated)
      toast.success(t("cases.sanctions.revokeSuccess"))
    } catch (e) {
      handleSaveError(e, { title: t("cases.sanctions.revokeError") })
      throw e
    }
  }

  const handleToggleStatus = async () => {
    if (!data) return
    setStatusBusy(true)
    try {
      const next = data.status === "open" ? "closed" : "open"
      const updated = await patchCase(data.reference, { status: next })
      setData(updated)
      toast.success(next === "closed" ? t("cases.detail.closedSuccess") : t("cases.detail.reopenedSuccess"))
    } catch (e) {
      handleSaveError(e, { title: t("cases.detail.statusError") })
    } finally {
      setStatusBusy(false)
    }
  }

  const handleSaveReason = async () => {
    if (!data || !reasonDraft.trim()) return
    setEditBusy(true)
    try {
      const updated = await patchCase(data.reference, { reason: reasonDraft.trim() })
      setData(updated)
      setEditOpen(false)
      toast.success(t("cases.detail.reasonSaved"))
    } catch (e) {
      handleSaveError(e, { title: t("cases.detail.reasonError") })
    } finally {
      setEditBusy(false)
    }
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────

  const backButton = (
    <Button variant="ghost" size="sm" className="-ml-2 shrink-0" onClick={onBack}>
      <ChevronLeftIcon className="size-4" />
      {backLabel ?? t("cases.detail.back")}
    </Button>
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        {/* Même structure d'en-tête que la vue chargée (§ ci-dessous) : le bouton
            retour garde une position stable au lieu de sauter au chargement. */}
        <div className="flex flex-wrap items-center gap-2">
          {backButton}
        </div>
        <div className="flex flex-col-reverse gap-6 lg:flex-row lg:items-start">
          <div className="flex-1 space-y-4">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
          <div className="flex flex-col gap-4 lg:w-80 shrink-0">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          {backButton}
        </div>
        <div className="flex flex-1 items-center justify-center py-16">
          <ErrorState error={error} onRetry={load} />
        </div>
      </div>
    )
  }

  const scopeIsGuild = data.scope_type === "discord_guild"

  return (
    <div className="flex flex-col gap-5">
      {/* En-tête */}
      <div className="flex flex-wrap items-center gap-2">
        {backButton}
        <div className="mx-1 h-4 w-px bg-border" />
        <span className="inline-flex items-center gap-0.5">
          <CaseReference reference={data.reference} className="text-sm" />
          <CopyButton value={data.reference} label={t("cases.detail.copyReference")} />
        </span>
        <CaseStatusPill status={data.status} locked={data.status_locked} />
      </div>

      {/* Titre — pleine largeur (façon issue) : toujours en premier, y compris sur mobile */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold leading-snug wrap-break-word sm:text-xl">{data.reason}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {showType && <CaseTypeBadge type={data.type} />}
            <span title={absoluteTime(data.created_at, i18n.language)}>
              {t("cases.detail.openedOn", { date: absoluteTime(data.created_at, i18n.language) })}
            </span>
          </div>
        </div>
        {writable && (
          <div className="flex shrink-0 items-center gap-2">
            {canSanction && (
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <PlusIcon className="size-4" />
                <span className="hidden sm:inline">{t("cases.detail.addSanction")}</span>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="size-8">
                  <MoreHorizontalIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setReasonDraft(data.reason)
                    setEditOpen(true)
                  }}
                >
                  <PencilIcon className="size-4" />
                  {t("cases.detail.editReason")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleToggleStatus} disabled={statusBusy}>
                  {data.status === "open" ? (
                    <>
                      <LockIcon className="size-4" />
                      {t("cases.detail.close")}
                    </>
                  ) : (
                    <>
                      <UnlockIcon className="size-4" />
                      {t("cases.detail.reopen")}
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Sur mobile (flex-col-reverse) : détails/sanctions/appels au-dessus des preuves
          et de l'activité. Sur desktop : deux colonnes (contenu à gauche, aside à droite). */}
      <div className="flex flex-col-reverse gap-6 lg:flex-row lg:items-start">
        {/* ── Colonne principale ─────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {/* Preuves (hors activité) */}
          <CaseEvidenceSection caseRef={data.reference} events={data.events} />

          {/* Activité */}
          <section>
            <h2 className="mb-3 text-sm font-semibold">{t("cases.detail.activity")}</h2>
            <CaseTimeline events={data.events} caseType={data.type} />

            {writable && (
              <div className="mt-4">
                <CaseComposer onSubmit={handleAddComment} />
              </div>
            )}
          </section>
        </div>

        {/* ── Colonne latérale ───────────────────────────────────────────── */}
        <aside className="flex shrink-0 flex-col gap-4 lg:sticky lg:top-4 lg:w-80 lg:self-start">
          {/* Détails */}
          <Panel title={t("cases.detail.details")}>
            <div className="flex flex-col gap-3.5">
              {showSubject && (
                <PropRow icon={UserIcon} label={t("cases.detail.subject")}>
                  <IdentityValue kind={data.subject_type as EntityKind} id={data.subject_id} />
                </PropRow>
              )}
              <PropRow icon={UserCogIcon} label={t("cases.detail.issuer")}>
                <IdentityValue kind={data.issuer_type as EntityKind} id={data.issuer_id} />
              </PropRow>
              {showScope && (
                <PropRow icon={ShieldIcon} label={t("cases.detail.scope")}>
                  {scopeIsGuild && data.scope_id ? (
                    <IdentityValue kind="discord_guild" id={data.scope_id} />
                  ) : (
                    <span>{t(`cases.scopeType.${data.scope_type}`)}</span>
                  )}
                </PropRow>
              )}
              {data.group_id && (
                <PropRow icon={LayersIcon} label={t("cases.detail.group")}>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                      {data.group_id}
                    </span>
                    <CopyButton value={data.group_id} label={t("cases.detail.copyId")} />
                  </div>
                </PropRow>
              )}
              <PropRow icon={CalendarIcon} label={t("cases.detail.dates")}>
                <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                  <span title={absoluteTime(data.created_at, i18n.language)}>
                    {t("cases.detail.created", { date: relativeTime(data.created_at, i18n.language) })}
                  </span>
                  <span title={absoluteTime(data.updated_at, i18n.language)}>
                    {t("cases.detail.updated", { date: relativeTime(data.updated_at, i18n.language) })}
                  </span>
                </div>
              </PropRow>
            </div>
          </Panel>

          {/* Sanctions */}
          <Panel
            title={t("cases.detail.sanctions")}
            action={
              canSanction ? (
                <Button variant="ghost" size="icon" className="size-6" onClick={() => setAddOpen(true)}>
                  <PlusIcon className="size-3.5" />
                </Button>
              ) : undefined
            }
          >
            <SanctionsPanel
              sanctions={data.sanctions}
              canWrite={writable}
              onRevoke={handleRevoke}
              caseType={data.type}
            />
          </Panel>

          {/* Appels */}
          {data.appeals.length > 0 && (
            <Panel title={t("cases.detail.appeals")}>
              <AppealsPanel appeals={data.appeals} />
            </Panel>
          )}
        </aside>
      </div>

      {/* Dialog ajout de sanction */}
      <AddSanctionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        allowedActions={allowedActions}
        onSubmit={handleAddSanction}
      />

      {/* Dialog édition de la raison */}
      <Dialog open={editOpen} onOpenChange={(o) => !editBusy && setEditOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("cases.detail.editReason")}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={reasonDraft}
            onChange={(e) => setReasonDraft(e.target.value)}
            maxLength={2000}
            rows={4}
            className={cn("resize-none")}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editBusy}>
              {t("cases.cancel")}
            </Button>
            <Button onClick={handleSaveReason} disabled={editBusy || !reasonDraft.trim()}>
              {editBusy && <LoaderIcon className="size-4 animate-spin mr-1.5" />}
              {t("cases.detail.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
