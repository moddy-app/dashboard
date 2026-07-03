import { GavelIcon } from "lucide-react"

import {
  ACTION_LABEL,
  APPEAL_ROUTE_LABEL,
  formatDateTime,
} from "@/lib/cases-format"
import type { Appeal } from "@/services/cases-types"
import { ActorInline } from "./actor"
import { AppealStatusBadge } from "./case-badges"

export function AppealsPanel({ appeals }: { appeals: Appeal[] }) {
  if (appeals.length === 0) return null
  const ordered = [...appeals].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  )
  return (
    <div className="space-y-2.5">
      {ordered.map((appeal) => (
        <AppealCard key={appeal.id} appeal={appeal} />
      ))}
    </div>
  )
}

function AppealCard({ appeal }: { appeal: Appeal }) {
  // Champs internes présents => vue staff/mod (non caviardée).
  const hasInternal =
    appeal.decided_by_id != null || appeal.decision_note != null

  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <GavelIcon className="size-4 text-muted-foreground" />
          Appel · {APPEAL_ROUTE_LABEL[appeal.route]}
        </div>
        <AppealStatusBadge status={appeal.status} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>Action contestée : {ACTION_LABEL[appeal.action]}</span>
        {appeal.new_action && (
          <span>
            Nouvelle action : {ACTION_LABEL[appeal.new_action]}
          </span>
        )}
        <span>Ouvert le {formatDateTime(appeal.created_at)}</span>
      </div>

      {appeal.reason && (
        <blockquote className="mt-2.5 border-l-2 border-border pl-2.5 text-sm text-foreground">
          {appeal.reason}
        </blockquote>
      )}

      {appeal.decided_at && (
        <div className="mt-2.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-1.5">
            Décision le {formatDateTime(appeal.decided_at)}
            {hasInternal && appeal.decided_by_id && (
              <>
                {" "}
                par{" "}
                <ActorInline
                  type={appeal.decided_by_type ?? null}
                  id={appeal.decided_by_id}
                  className="text-xs"
                />
              </>
            )}
          </div>
          {hasInternal && appeal.decision_note && (
            <p className="mt-1 text-foreground">{appeal.decision_note}</p>
          )}
        </div>
      )}
    </div>
  )
}
