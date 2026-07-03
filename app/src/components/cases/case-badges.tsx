import {
  BanIcon,
  KeyRoundIcon,
  LogOutIcon,
  type LucideIcon,
  ShieldMinusIcon,
  TriangleAlertIcon,
  VolumeXIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  ACTION_LABEL,
  ACTION_TONE,
  APPEAL_STATUS_LABEL,
  CASE_STATUS_LABEL,
  CASE_TYPE_LABEL,
  SANCTION_STATUS_LABEL,
  SANCTION_STATUS_TONE,
} from "@/lib/cases-format"
import type {
  AppealStatus,
  CaseStatus,
  CaseType,
  SanctionAction,
  SanctionStatus,
} from "@/services/cases-types"

export const ACTION_ICON: Record<SanctionAction, LucideIcon> = {
  warn: TriangleAlertIcon,
  mute: VolumeXIcon,
  ban: BanIcon,
  kick: LogOutIcon,
  restrict: ShieldMinusIcon,
  revoke_access: KeyRoundIcon,
}

/** Glyphe de statut de case, dans l'esprit Linear. */
export function CaseStatusGlyph({
  status,
  hasActive,
  className,
}: {
  status: CaseStatus
  hasActive?: boolean
  className?: string
}) {
  if (status === "closed") {
    return (
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center",
          className
        )}
        title={CASE_STATUS_LABEL.closed}
      >
        <svg viewBox="0 0 16 16" className="size-4 text-muted-foreground">
          <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M5.2 8.2l1.9 1.9 3.7-3.9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    )
  }
  // open
  const color = hasActive ? "text-emerald-500" : "text-amber-500"
  return (
    <span
      className={cn("flex size-4 shrink-0 items-center justify-center", className)}
      title={CASE_STATUS_LABEL.open}
    >
      <svg viewBox="0 0 16 16" className={cn("size-4", color)}>
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="8" cy="8" r="3" fill="currentColor" />
      </svg>
    </span>
  )
}

export function CaseTypeBadge({ type }: { type: CaseType }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
      {CASE_TYPE_LABEL[type]}
    </span>
  )
}

export function CaseStatusBadge({
  status,
  hasActive,
}: {
  status: CaseStatus
  hasActive?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium text-foreground">
      <CaseStatusGlyph status={status} hasActive={hasActive} className="size-3.5" />
      {CASE_STATUS_LABEL[status]}
    </span>
  )
}

export function ActionBadge({
  action,
  size = "sm",
  withIcon = true,
}: {
  action: SanctionAction
  size?: "sm" | "xs"
  withIcon?: boolean
}) {
  const tone = ACTION_TONE[action]
  const Icon = ACTION_ICON[action]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border font-medium",
        tone.bg,
        tone.text,
        tone.border,
        size === "xs" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs"
      )}
    >
      {withIcon && <Icon className={size === "xs" ? "size-3" : "size-3.5"} />}
      {ACTION_LABEL[action]}
    </span>
  )
}

export function SanctionStatusBadge({ status }: { status: SanctionStatus }) {
  const tone = SANCTION_STATUS_TONE[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tone.bg,
        tone.text,
        tone.border
      )}
    >
      <span className={cn("size-1.5 rounded-full", tone.dot)} />
      {SANCTION_STATUS_LABEL[status]}
    </span>
  )
}

const APPEAL_TONE: Record<AppealStatus, string> = {
  pending:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  accepted:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  refused: "bg-destructive/10 text-destructive border-destructive/20",
  transformed:
    "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  cancelled: "bg-muted text-muted-foreground border-border",
}

export function AppealStatusBadge({ status }: { status: AppealStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        APPEAL_TONE[status]
      )}
    >
      {APPEAL_STATUS_LABEL[status]}
    </span>
  )
}

/** Petit point coloré (action) pour la vue liste compacte. */
export function ActionDots({ actions }: { actions: SanctionAction[] }) {
  if (!actions.length) return null
  return (
    <span className="flex items-center -space-x-0.5">
      {actions.slice(0, 4).map((a) => (
        <span
          key={a}
          title={ACTION_LABEL[a]}
          className={cn(
            "size-2.5 rounded-full ring-2 ring-background",
            ACTION_TONE[a].dot
          )}
        />
      ))}
    </span>
  )
}
