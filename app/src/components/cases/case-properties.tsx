import { CopyIcon, LockIcon } from "lucide-react"

import { useToast } from "@/components/ui/toast"
import {
  SCOPE_TYPE_LABEL,
  formatDateTime,
  relativeTime,
} from "@/lib/cases-format"
import type { CaseDetail } from "@/services/cases-types"
import { ActorInline, GuildInline, SubjectInline } from "./actor"
import { CaseStatusBadge, CaseTypeBadge } from "./case-badges"

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <span className="shrink-0 pt-0.5 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <div className="flex min-w-0 items-center justify-end text-right text-sm">
        {children}
      </div>
    </div>
  )
}

export function CaseProperties({
  case_,
  hasActive,
}: {
  case_: CaseDetail
  hasActive: boolean
}) {
  const { toast } = useToast()

  const copy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text)
    toast({ title: `${label} copié`, variant: "success" })
  }

  return (
    <div className="divide-y divide-border/60">
      <Row label="Statut">
        <div className="flex items-center gap-1.5">
          <CaseStatusBadge status={case_.status} hasActive={hasActive} />
          {case_.status_locked && (
            <span
              title="Statut verrouillé"
              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] text-muted-foreground"
            >
              <LockIcon className="size-3" />
              Verrouillé
            </span>
          )}
        </div>
      </Row>

      <Row label="Type">
        <CaseTypeBadge type={case_.type} />
      </Row>

      <Row label="Sujet">
        <SubjectInline
          subjectType={case_.subject_type}
          subjectId={case_.subject_id}
          className="max-w-[180px] [&_span]:truncate"
        />
      </Row>

      <Row label="Portée">
        {case_.scope_type === "discord_guild" && case_.scope_id ? (
          <GuildInline
            guildId={case_.scope_id}
            className="max-w-[180px] [&_span]:truncate"
          />
        ) : (
          <span className="text-muted-foreground">
            {SCOPE_TYPE_LABEL[case_.scope_type]}
          </span>
        )}
      </Row>

      <Row label="Émetteur">
        <ActorInline type={case_.issuer_type} id={case_.issuer_id} />
      </Row>

      {case_.group_id && (
        <Row label="Groupe">
          <button
            onClick={() => copy(case_.group_id!, "Groupe")}
            className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            {case_.group_id.slice(0, 8)}…
            <CopyIcon className="size-3" />
          </button>
        </Row>
      )}

      <Row label="Créée">
        <span className="text-muted-foreground" title={formatDateTime(case_.created_at)}>
          {relativeTime(case_.created_at)}
        </span>
      </Row>

      <Row label="Mise à jour">
        <span className="text-muted-foreground" title={formatDateTime(case_.updated_at)}>
          {relativeTime(case_.updated_at)}
        </span>
      </Row>
    </div>
  )
}
