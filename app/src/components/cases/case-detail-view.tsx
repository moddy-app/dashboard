import * as React from "react"
import { Link } from "react-router-dom"
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  GavelIcon,
  LockIcon,
  PencilIcon,
  RotateCcwIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/toast"
import { formatDateTime, relativeTime } from "@/lib/cases-format"
import { addNote, patchCase } from "@/services/cases"
import type { ApiError, CaseDetail } from "@/services/cases-types"
import { useCaseDetail } from "@/hooks/useCaseDetail"
import { useCasesMeta } from "@/hooks/useCasesMeta"
import { useViewer } from "@/hooks/useViewer"
import { SubjectInline } from "./actor"
import { CaseStatusGlyph } from "./case-badges"
import { AddSanctionDialog } from "./add-sanction-dialog"
import { AppealsPanel } from "./appeals-panel"
import { CaseProperties } from "./case-properties"
import { CaseTimeline } from "./case-timeline"
import { EditReasonDialog } from "./edit-reason-dialog"
import { MessageComposer } from "./message-composer"
import { SanctionsPanel } from "./sanctions-panel"

const WRITABLE = new Set(["global", "network"])

export function CaseDetailView({
  identifier,
  backTo,
  backLabel = "Retour",
}: {
  identifier: string
  backTo: string
  backLabel?: string
}) {
  const { data, status, error, setData } = useCaseDetail(identifier)
  const { meta } = useCasesMeta()
  const viewer = useViewer()
  const { toast } = useToast()

  const [sanctionOpen, setSanctionOpen] = React.useState(false)
  const [reasonOpen, setReasonOpen] = React.useState(false)
  const [statusBusy, setStatusBusy] = React.useState(false)

  if (status === "loading") return <DetailSkeleton backTo={backTo} backLabel={backLabel} />

  if (status === "error" || !data) {
    const notFound = (error as ApiError | null)?.status === 404
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <div className="flex size-12 items-center justify-center rounded-full border border-border bg-muted/40">
          <GavelIcon className="size-6 text-muted-foreground" />
        </div>
        <p className="mt-4 text-sm font-medium">
          {notFound ? "Case introuvable" : "Chargement impossible"}
        </p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {notFound
            ? "Cette case n'existe pas ou n'est pas dans votre périmètre de visibilité."
            : error?.message}
        </p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to={backTo}>
            <ArrowLeftIcon />
            {backLabel}
          </Link>
        </Button>
      </div>
    )
  }

  const hasActive = data.sanctions.some((s) => s.status === "active")
  const canModerate =
    viewer.isModerator && WRITABLE.has(data.type)

  const applyUpdate = (updated: CaseDetail) => setData(updated)

  const toggleStatus = async () => {
    setStatusBusy(true)
    try {
      const next = data.status === "open" ? "closed" : "open"
      const updated = await patchCase(identifier, { status: next })
      toast({
        title: next === "closed" ? "Case fermée" : "Case rouverte",
        description: "Le statut est désormais verrouillé.",
        variant: "success",
      })
      applyUpdate(updated)
    } catch (err) {
      toast({
        title: "Action impossible",
        description: (err as ApiError).message,
        variant: "error",
      })
    } finally {
      setStatusBusy(false)
    }
  }

  const postComment = async (content: string) => {
    try {
      const updated = await addNote(identifier, content)
      applyUpdate(updated)
    } catch (err) {
      toast({
        title: "Envoi impossible",
        description: (err as ApiError).message,
        variant: "error",
      })
      throw err
    }
  }

  const copyRef = () => {
    navigator.clipboard?.writeText(data.reference)
    toast({ title: "Référence copiée", variant: "success" })
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Barre supérieure */}
      <header className="flex items-center gap-2 border-b border-border px-4 py-2.5 sm:px-6">
        <Button asChild variant="ghost" size="icon-sm">
          <Link to={backTo} aria-label={backLabel}>
            <ArrowLeftIcon />
          </Link>
        </Button>
        <CaseStatusGlyph status={data.status} hasActive={hasActive} />
        <button
          onClick={copyRef}
          className="group inline-flex items-center gap-1.5 font-mono text-sm text-muted-foreground hover:text-foreground"
        >
          {data.reference}
          <CopyIcon className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
        {data.status_locked && (
          <LockIcon className="size-3.5 text-muted-foreground" />
        )}

        {canModerate && (
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSanctionOpen(true)}
            >
              <GavelIcon />
              <span className="hidden sm:inline">Sanction</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Actions
                  <ChevronDownIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => setReasonOpen(true)}>
                  <PencilIcon />
                  Modifier le motif
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSanctionOpen(true)}>
                  <GavelIcon />
                  Ajouter une sanction
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={toggleStatus} disabled={statusBusy}>
                  {data.status === "open" ? (
                    <>
                      <CheckIcon />
                      Fermer la case
                    </>
                  ) : (
                    <>
                      <RotateCcwIcon />
                      Rouvrir la case
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </header>

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_288px] lg:gap-8">
          {/* Colonne principale */}
          <div className="min-w-0 space-y-8">
            <div>
              <div className="flex items-start gap-2">
                <h1 className="text-xl font-semibold leading-snug tracking-tight text-balance">
                  {data.reason || "Sans motif"}
                </h1>
                {canModerate && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="mt-1 shrink-0 text-muted-foreground"
                    onClick={() => setReasonOpen(true)}
                    aria-label="Modifier le motif"
                  >
                    <PencilIcon />
                  </Button>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span>Concerne</span>
                <SubjectInline
                  subjectType={data.subject_type}
                  subjectId={data.subject_id}
                />
                <span
                  className="text-xs"
                  title={formatDateTime(data.created_at)}
                >
                  · ouverte {relativeTime(data.created_at)}
                </span>
              </div>
            </div>

            {/* Propriétés — repliées dans le flux sur mobile */}
            <section className="lg:hidden">
              <div className="rounded-xl border border-border bg-card px-4">
                <CaseProperties case_={data} hasActive={hasActive} />
              </div>
            </section>

            {data.sanctions.length > 0 && (
              <Section title="Sanctions" count={data.sanctions.length}>
                <SanctionsPanel
                  identifier={identifier}
                  sanctions={data.sanctions}
                  canModerate={canModerate}
                  onDone={applyUpdate}
                />
              </Section>
            )}

            {data.appeals.length > 0 && (
              <Section title="Appels" count={data.appeals.length}>
                <AppealsPanel appeals={data.appeals} />
              </Section>
            )}

            <Section title="Activité">
              <CaseTimeline events={data.events} />
              {canModerate && (
                <div className="mt-4">
                  <MessageComposer onSubmit={postComment} />
                </div>
              )}
            </Section>
          </div>

          {/* Sidebar propriétés (desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-6">
              <h2 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Propriétés
              </h2>
              <div className="mt-2 rounded-xl border border-border bg-card px-4">
                <CaseProperties case_={data} hasActive={hasActive} />
              </div>
            </div>
          </aside>
        </div>
      </div>

      {meta && (
        <AddSanctionDialog
          open={sanctionOpen}
          onOpenChange={setSanctionOpen}
          identifier={identifier}
          caseType={data.type}
          meta={meta}
          onDone={applyUpdate}
        />
      )}
      <EditReasonDialog
        open={reasonOpen}
        onOpenChange={setReasonOpen}
        identifier={identifier}
        initialReason={data.reason}
        onDone={applyUpdate}
      />
    </div>
  )
}

function Section({
  title,
  count,
  children,
}: {
  title: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {title}
        {count != null && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {count}
          </span>
        )}
      </h2>
      {children}
    </section>
  )
}

function DetailSkeleton({
  backTo,
  backLabel,
}: {
  backTo: string
  backLabel: string
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-border px-4 py-2.5 sm:px-6">
        <Button asChild variant="ghost" size="icon-sm">
          <Link to={backTo} aria-label={backLabel}>
            <ArrowLeftIcon />
          </Link>
        </Button>
        <Skeleton className="h-4 w-16" />
      </header>
      <div className="mx-auto grid w-full max-w-5xl gap-8 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_288px]">
        <div className="space-y-6">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <Skeleton className="hidden h-64 w-full rounded-xl lg:block" />
      </div>
    </div>
  )
}
