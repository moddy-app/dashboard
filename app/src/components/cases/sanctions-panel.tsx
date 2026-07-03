import * as React from "react"
import { CalendarClockIcon, InfinityIcon, RotateCcwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  ACTION_LABEL,
  formatDateTime,
  formatRemaining,
} from "@/lib/cases-format"
import type { CaseDetail, Sanction } from "@/services/cases-types"
import { ActorInline } from "./actor"
import { ACTION_ICON, SanctionStatusBadge } from "./case-badges"
import { RevokeSanctionDialog } from "./revoke-sanction-dialog"

export function SanctionsPanel({
  identifier,
  sanctions,
  canModerate,
  onDone,
}: {
  identifier: string
  sanctions: Sanction[]
  canModerate: boolean
  onDone: (updated: CaseDetail) => void
}) {
  const [target, setTarget] = React.useState<Sanction | null>(null)
  const [open, setOpen] = React.useState(false)

  if (sanctions.length === 0) return null

  // Actives d'abord, puis par date décroissante.
  const ordered = [...sanctions].sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1
    if (a.status !== "active" && b.status === "active") return 1
    return b.created_at.localeCompare(a.created_at)
  })

  return (
    <div className="space-y-2">
      {ordered.map((s) => (
        <SanctionCard
          key={s.id}
          sanction={s}
          canModerate={canModerate}
          onRevoke={() => {
            setTarget(s)
            setOpen(true)
          }}
        />
      ))}

      <RevokeSanctionDialog
        open={open}
        onOpenChange={setOpen}
        identifier={identifier}
        sanction={target}
        onDone={onDone}
      />
    </div>
  )
}

function SanctionCard({
  sanction,
  canModerate,
  onRevoke,
}: {
  sanction: Sanction
  canModerate: boolean
  onRevoke: () => void
}) {
  const Icon = ACTION_ICON[sanction.action]
  const isActive = sanction.status === "active"

  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition-colors",
        isActive ? "border-border bg-card" : "border-border/60 bg-muted/30"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className={cn(
              "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
              isActive
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">
                {ACTION_LABEL[sanction.action]}
              </span>
              <SanctionStatusBadge status={sanction.status} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                {sanction.expires_at ? (
                  <>
                    <CalendarClockIcon className="size-3" />
                    {isActive
                      ? `Expire dans ${formatRemaining(sanction.expires_at)}`
                      : `Expiration : ${formatDateTime(sanction.expires_at)}`}
                  </>
                ) : (
                  <>
                    <InfinityIcon className="size-3" />
                    Permanent
                  </>
                )}
              </span>
              <span className="inline-flex items-center gap-1">
                par
                <ActorInline
                  type={sanction.issued_by_type}
                  id={sanction.issued_by_id}
                />
              </span>
            </div>
          </div>
        </div>

        {canModerate && isActive && (
          <Button variant="outline" size="sm" onClick={onRevoke}>
            <RotateCcwIcon />
            Révoquer
          </Button>
        )}
      </div>

      {sanction.note && (
        <p className="mt-2.5 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-foreground">
          {sanction.note}
        </p>
      )}

      {sanction.status === "revoked" && sanction.revoked_at && (
        <p className="mt-2 text-xs text-muted-foreground">
          Révoquée le {formatDateTime(sanction.revoked_at)}
          {sanction.revoked_by_id && (
            <>
              {" "}
              par{" "}
              <ActorInline
                type={sanction.revoked_by_type}
                id={sanction.revoked_by_id}
                className="text-xs"
              />
            </>
          )}
        </p>
      )}
    </div>
  )
}
