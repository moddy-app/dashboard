import { useTranslation } from "react-i18next"
import { LockIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  actionAppearance,
  actionLabelKey,
  CASE_TYPE_TONE,
  ACTION_TONE,
} from "@/lib/cases"
import type {
  SanctionAction,
  CaseType,
  CaseStatus,
  SanctionStatus,
} from "@/types/cases"

// ─── Référence (code public 6 caractères) ────────────────────────────────────

export function CaseReference({
  reference,
  className,
}: {
  reference: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "font-mono text-xs font-medium tracking-wide text-muted-foreground tabular-nums",
        className
      )}
    >
      {reference}
    </span>
  )
}

// ─── Statut de case ───────────────────────────────────────────────────────────

export function CaseStatusPill({
  status,
  locked = false,
  className,
}: {
  status: CaseStatus
  locked?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const open = status === "open"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        open
          ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/50 dark:text-green-400"
          : "border-border bg-muted text-muted-foreground",
        className
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          open ? "bg-green-500" : "bg-muted-foreground/50"
        )}
      />
      {t(`cases.status.${status}`)}
      {locked && <LockIcon className="size-3 opacity-70" />}
    </span>
  )
}

// ─── Type de case ─────────────────────────────────────────────────────────────

export function CaseTypeBadge({
  type,
  className,
}: {
  type: CaseType
  className?: string
}) {
  const { t } = useTranslation()
  const tone = ACTION_TONE[CASE_TYPE_TONE[type]]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
        tone.border,
        tone.softBg,
        tone.text,
        className
      )}
    >
      {t(`cases.type.${type}`)}
    </span>
  )
}

// ─── Action de sanction (chip avec icône) ─────────────────────────────────────

export function ActionChip({
  action,
  size = "sm",
  muted = false,
  className,
  /**
   * Portée du dossier. Sur un dossier `global`/`network`, l'action prend le
   * vocabulaire des sanctions globales (« suspension » plutôt que « bannir ») —
   * c'est la même sanction que celle affichée sur `/violations`.
   */
  caseType,
}: {
  action: SanctionAction
  size?: "sm" | "xs"
  muted?: boolean
  className?: string
  caseType?: CaseType | null
}) {
  const { t } = useTranslation()
  // Ton + icône suivent la portée : sur un dossier global, une mesure prend
  // l'apparence de son niveau (cf. `actionAppearance`).
  const { tone, icon: Icon } = actionAppearance(action, caseType)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border font-medium",
        size === "xs" ? "px-1 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-[11px]",
        muted
          ? "border-border bg-muted text-muted-foreground"
          : cn(tone.border, tone.softBg, tone.text),
        className
      )}
    >
      <Icon className={size === "xs" ? "size-2.5" : "size-3"} />
      {t(actionLabelKey(action, caseType))}
    </span>
  )
}

// ─── Statut de sanction ───────────────────────────────────────────────────────

export function SanctionStatusBadge({ status }: { status: SanctionStatus }) {
  const { t } = useTranslation()
  if (status === "active")
    return (
      <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200 dark:bg-green-950/60 dark:text-green-400 dark:border-green-900">
        {t("cases.sanctionStatus.active")}
      </Badge>
    )
  if (status === "expired")
    return (
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
        {t("cases.sanctionStatus.expired")}
      </Badge>
    )
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground line-through decoration-1">
      {t("cases.sanctionStatus.revoked")}
    </Badge>
  )
}
