import { Link } from "react-router-dom"
import { LockIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { relativeTime } from "@/lib/cases-format"
import type { CaseListItem } from "@/services/cases-types"
import { ActionDots, CaseStatusGlyph, CaseTypeBadge } from "./case-badges"
import { SubjectInline } from "./actor"

export function CaseRow({
  case_,
  to,
  showSubject = true,
  showScope = false,
}: {
  case_: CaseListItem
  to: string
  showSubject?: boolean
  showScope?: boolean
}) {
  return (
    <Link
      to={to}
      className={cn(
        "group flex h-[52px] items-center gap-3 border-b border-border px-3 sm:px-4",
        "transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
      )}
    >
      <CaseStatusGlyph status={case_.status} hasActive={case_.has_active} />

      <span className="hidden w-[68px] shrink-0 font-mono text-xs text-muted-foreground sm:inline">
        {case_.reference}
      </span>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm font-medium text-foreground">
          {case_.reason || "Sans motif"}
        </span>
        {case_.status_locked && (
          <LockIcon className="size-3 shrink-0 text-muted-foreground" />
        )}
      </div>

      <div className="hidden shrink-0 items-center gap-2 md:flex">
        <ActionDots actions={case_.actions} />
      </div>

      <div className="hidden shrink-0 lg:block">
        <CaseTypeBadge type={case_.type} />
      </div>

      {showScope && case_.scope_type === "discord_guild" && case_.scope_id && (
        <div className="hidden shrink-0 xl:block">
          <SubjectInline
            subjectType="discord_guild"
            subjectId={case_.scope_id}
            className="max-w-[140px]"
          />
        </div>
      )}

      {showSubject && (
        <div className="hidden w-[150px] shrink-0 justify-end sm:flex">
          <SubjectInline
            subjectType={case_.subject_type}
            subjectId={case_.subject_id}
            className="max-w-full [&_span]:truncate"
          />
        </div>
      )}

      <span className="w-[64px] shrink-0 text-right text-xs text-muted-foreground tabular-nums">
        {relativeTime(case_.created_at)}
      </span>
    </Link>
  )
}
