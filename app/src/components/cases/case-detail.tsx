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
  ShieldIcon,
  TargetIcon,
  UserCogIcon,
  CalendarIcon,
  LayersIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { ErrorState } from "@/components/error-state"
import { ApiError } from "@/lib/auth"
import { handleSaveError } from "@/lib/handle-error"
import { absoluteTime } from "@/lib/cases"
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
import { SanctionsPanel } from "./sanctions-panel"
import { AppealsPanel } from "./appeals-panel"
import { AddSanctionDialog } from "./add-sanction-dialog"

interface CaseDetailViewProps {
  identifier: string
  onBack: () => void
  backLabel?: string
  /** L'utilisateur est-il staff modérateur (droit d'écriture) ? */
  canModerate: boolean
}

// ─── Ligne de propriété ───────────────────────────────────────────────────────

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
    <div className="flex items-start gap-2 py-2">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="mt-1 min-w-0 text-sm">{children}</div>
      </div>
    </div>
  )
}

// ─── Panneau (carte) latéral ──────────────────────────────────────────────────

function SidePanel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-3.5 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {action}
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  )
}

// ─── Vue détail ───────────────────────────────────────────────────────────────

export function CaseDetailView({ identifier, onBack, backLabel, canModerate }: CaseDetailViewProps) {
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
      <div className="flex flex-col gap-6">
        {backButton}
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
      <div className="flex flex-col gap-6">
        {backButton}
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
        <CaseReference reference={data.reference} className="text-sm" />
        <CaseStatusPill status={data.status} locked={data.status_locked} />
      </div>

      <div className="flex flex-col-reverse gap-6 lg:flex-row lg:items-start">
        {/* ── Colonne principale ─────────────────────────────────────────── */}
        <div className="min-w-0 flex-1">
          {/* Titre */}
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold leading-snug wrap-break-word">{data.reason}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <CaseTypeBadge type={data.type} />
                <span>·</span>
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
                    <DropdownMenuSeparator />
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

          {/* Activité */}
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-sm font-semibold">{t("cases.detail.activity")}</h2>
          </div>
          <CaseTimeline events={data.events} />

          {/* Composer (staff modérateur uniquement) */}
          {writable && (
            <div className="mt-5">
              <CaseComposer onSubmit={handleAddComment} />
            </div>
          )}
        </div>

        {/* ── Colonne latérale (propriétés) ──────────────────────────────── */}
        <div className="flex shrink-0 flex-col gap-4 lg:sticky lg:top-4 lg:w-80 lg:self-start">
          {/* Propriétés */}
          <div className="rounded-xl border bg-card px-3.5 py-1 divide-y">
            <PropRow icon={TargetIcon} label={t("cases.detail.subject")}>
              <EntityRef kind={data.subject_type as EntityKind} id={data.subject_id} variant="block" />
            </PropRow>
            <PropRow icon={ShieldIcon} label={t("cases.detail.scope")}>
              {scopeIsGuild && data.scope_id ? (
                <EntityRef kind="discord_guild" id={data.scope_id} variant="block" />
              ) : (
                <span className="text-sm">{t(`cases.scopeType.${data.scope_type}`)}</span>
              )}
            </PropRow>
            <PropRow icon={UserCogIcon} label={t("cases.detail.issuer")}>
              <EntityRef kind={data.issuer_type as EntityKind} id={data.issuer_id} variant="inline" />
            </PropRow>
            {data.group_id && (
              <PropRow icon={LayersIcon} label={t("cases.detail.group")}>
                <span className="font-mono text-xs text-muted-foreground wrap-break-word">{data.group_id}</span>
              </PropRow>
            )}
            <PropRow icon={CalendarIcon} label={t("cases.detail.dates")}>
              <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                <span>{t("cases.detail.created", { date: absoluteTime(data.created_at, i18n.language) })}</span>
                <span>{t("cases.detail.updated", { date: absoluteTime(data.updated_at, i18n.language) })}</span>
              </div>
            </PropRow>
          </div>

          {/* Sanctions */}
          <SidePanel
            title={t("cases.detail.sanctions")}
            action={
              canSanction ? (
                <Button variant="ghost" size="icon" className="size-6" onClick={() => setAddOpen(true)}>
                  <PlusIcon className="size-3.5" />
                </Button>
              ) : undefined
            }
          >
            <SanctionsPanel sanctions={data.sanctions} canWrite={writable} onRevoke={handleRevoke} />
          </SidePanel>

          {/* Appels */}
          {data.appeals.length > 0 && (
            <SidePanel title={t("cases.detail.appeals")}>
              <AppealsPanel appeals={data.appeals} />
            </SidePanel>
          )}
        </div>
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
            className="resize-none"
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
