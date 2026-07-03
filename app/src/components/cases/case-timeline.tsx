import {
  ArrowRightIcon,
  CircleDotIcon,
  ExternalLinkIcon,
  FileWarningIcon,
  GavelIcon,
  LockIcon,
  MessageSquareIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  StickyNoteIcon,
  TimerOffIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  ACTION_LABEL,
  CASE_STATUS_LABEL,
  formatDateTime,
  relativeTime,
} from "@/lib/cases-format"
import type { CaseEvent, SanctionAction } from "@/services/cases-types"
import { ActorInline } from "./actor"

export function CaseTimeline({ events }: { events: CaseEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-10 text-center">
        <p className="text-sm text-muted-foreground">
          Aucune activité pour le moment.
        </p>
      </div>
    )
  }
  return (
    <ol className="relative space-y-1">
      {/* Rail vertical */}
      <span
        aria-hidden
        className="absolute top-3 bottom-3 left-[13px] w-px bg-border"
      />
      {events.map((event) => (
        <TimelineNode key={event.id} event={event} />
      ))}
    </ol>
  )
}

function TimelineNode({ event }: { event: CaseEvent }) {
  const isMessage = event.type === "comment" || event.type === "note"

  return (
    <li className="relative flex gap-3 pl-0">
      <NodeIcon event={event} />
      <div className="min-w-0 flex-1 pb-4">
        {isMessage ? (
          <MessageBody event={event} />
        ) : event.type === "evidence" ? (
          <EvidenceBody event={event} />
        ) : (
          <MarkerBody event={event} />
        )}
      </div>
    </li>
  )
}

function NodeIcon({ event }: { event: CaseEvent }) {
  const map: Record<
    CaseEvent["type"],
    { icon: typeof GavelIcon; className: string }
  > = {
    comment: { icon: MessageSquareIcon, className: "text-muted-foreground" },
    note: {
      icon: StickyNoteIcon,
      className: "text-amber-600 dark:text-amber-400",
    },
    evidence: {
      icon: FileWarningIcon,
      className: "text-violet-600 dark:text-violet-400",
    },
    sanction_added: { icon: GavelIcon, className: "text-destructive" },
    sanction_revoked: {
      icon: RotateCcwIcon,
      className: "text-emerald-600 dark:text-emerald-400",
    },
    sanction_expired: { icon: TimerOffIcon, className: "text-muted-foreground" },
    status_change: { icon: CircleDotIcon, className: "text-muted-foreground" },
  }
  const { icon: Icon, className } = map[event.type] ?? {
    icon: CircleDotIcon,
    className: "text-muted-foreground",
  }
  return (
    <span className="relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-background">
      <Icon className={cn("size-3.5", className)} />
    </span>
  )
}

function Meta({ event, label }: { event: CaseEvent; label?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
      <ActorInline type={event.author_type} id={event.author_id} />
      {label && <span className="text-muted-foreground">{label}</span>}
      <span
        className="text-xs text-muted-foreground"
        title={formatDateTime(event.created_at)}
      >
        · {relativeTime(event.created_at)}
      </span>
    </div>
  )
}

function MessageBody({ event }: { event: CaseEvent }) {
  const isNote = event.type === "note"
  const appeal = readAppealPayload(event.payload)
  return (
    <div className="pt-1">
      <Meta event={event} />
      <div
        className={cn(
          "mt-1.5 rounded-xl border px-3.5 py-2.5 text-sm whitespace-pre-wrap",
          isNote
            ? "border-amber-500/25 bg-amber-500/5"
            : "border-border bg-card"
        )}
      >
        {isNote && (
          <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
            <StickyNoteIcon className="size-3" />
            Note interne · visible par le staff uniquement
          </div>
        )}
        {appeal && (
          <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <GavelIcon className="size-3" />
            {appeal.kind === "appeal_opened"
              ? `Appel ouvert (${appeal.route ?? "?"})`
              : `Décision d'appel : ${appeal.status ?? "?"}${
                  appeal.new_action
                    ? ` → ${ACTION_LABEL[appeal.new_action as SanctionAction] ?? appeal.new_action}`
                    : ""
                }`}
          </div>
        )}
        <p className="text-foreground">{event.content || "—"}</p>
      </div>
    </div>
  )
}

function EvidenceBody({ event }: { event: CaseEvent }) {
  const p = (event.payload ?? {}) as Record<string, unknown>
  const isAutomod = p.source === "automod"
  const jump = typeof p.jump_url === "string" ? p.jump_url : null
  const extrait = typeof p.extrait === "string" ? p.extrait : null
  const gravite = p.gravite as string | undefined
  const categorie = p.categorie as string | undefined
  const confiance = p.confiance as string | undefined

  return (
    <div className="pt-1">
      <Meta event={event} label="a ajouté une preuve" />
      <div className="mt-1.5 rounded-xl border border-violet-500/25 bg-violet-500/5 px-3.5 py-2.5 text-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[11px] font-medium text-violet-600 dark:text-violet-300">
            <ShieldAlertIcon className="size-3" />
            {isAutomod ? "AutoMod" : "Preuve"}
          </span>
          {categorie && (
            <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {String(categorie)}
            </span>
          )}
          {gravite && (
            <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
              Gravité : {String(gravite)}
            </span>
          )}
          {confiance && (
            <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
              Confiance : {String(confiance)}
            </span>
          )}
        </div>
        {typeof p.raison === "string" && p.raison && (
          <p className="mt-2 text-foreground">{p.raison}</p>
        )}
        {extrait && (
          <blockquote className="mt-2 border-l-2 border-violet-500/40 pl-2.5 text-muted-foreground italic">
            {extrait}
          </blockquote>
        )}
        {jump && (
          <a
            href={jump}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Voir le message
            <ExternalLinkIcon className="size-3" />
          </a>
        )}
      </div>
    </div>
  )
}

function MarkerBody({ event }: { event: CaseEvent }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-1.5 text-sm">
      <ActorInline type={event.author_type} id={event.author_id} />
      <span className="text-muted-foreground">{markerLabel(event)}</span>
      <span
        className="text-xs text-muted-foreground"
        title={formatDateTime(event.created_at)}
      >
        · {relativeTime(event.created_at)}
      </span>
    </div>
  )
}

function markerLabel(event: CaseEvent): string {
  const p = (event.payload ?? {}) as Record<string, unknown>
  const action = p.action
    ? ACTION_LABEL[p.action as SanctionAction] ?? String(p.action)
    : ""
  switch (event.type) {
    case "sanction_added":
      return `a ajouté une sanction${action ? ` · ${action}` : ""}`
    case "sanction_revoked":
      return "a révoqué une sanction"
    case "sanction_expired":
      return `a expiré une sanction${action ? ` · ${action}` : ""}`
    case "status_change": {
      const from = p.from ? CASE_STATUS_LABEL[p.from as "open" | "closed"] : ""
      const to = p.to ? CASE_STATUS_LABEL[p.to as "open" | "closed"] : ""
      const trigger =
        typeof p.trigger === "string" && p.trigger !== "manual"
          ? ` (${p.trigger})`
          : ""
      return `a changé le statut${from && to ? ` : ${from} → ${to}` : ""}${trigger}`
    }
    default:
      return event.content ?? ""
  }
}

// Icônes réexportées pour le résumé de statut
export { ArrowRightIcon, LockIcon }

function readAppealPayload(payload: Record<string, unknown> | null) {
  if (!payload) return null
  const kind = payload.kind
  if (kind === "appeal_opened" || kind === "appeal_decision") {
    return payload as {
      kind: string
      route?: string
      status?: string
      new_action?: string
    }
  }
  return null
}
