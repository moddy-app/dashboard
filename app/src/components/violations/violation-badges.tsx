import { useTranslation } from "react-i18next"
import { CheckIcon, CopyIcon, GavelIcon, HourglassIcon, PauseIcon } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { copyText } from "@/lib/cases"
import { LEVEL_TONE, formatDeadline, remainingParts } from "@/lib/sanctions"
import type {
  Enforcement,
  GlobalAction,
  SanctionLevel,
} from "@/types/violations"

// ─── Niveau ───────────────────────────────────────────────────────────────────

/**
 * Pastille de niveau. `warn` reste volontairement discret : un avertissement ne
 * bloque rien, il ne doit pas être crié comme une restriction.
 */
export function LevelBadge({
  level,
  size = "sm",
  className,
}: {
  level: SanctionLevel
  size?: "sm" | "xs"
  className?: string
}) {
  const { t } = useTranslation()
  const tone = LEVEL_TONE[level]
  const Icon = tone.icon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border font-medium",
        size === "xs" ? "px-1 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-[11px]",
        tone.border,
        tone.softBg,
        tone.text,
        className
      )}
    >
      <Icon className={size === "xs" ? "size-2.5" : "size-3"} />
      {t(`violations.level.${level}`)}
    </span>
  )
}

// ─── Action ───────────────────────────────────────────────────────────────────

export function ActionBadge({
  action,
  muted = false,
  className,
}: {
  action: GlobalAction
  muted?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
        muted
          ? "border-border bg-muted text-muted-foreground line-through decoration-1"
          : "border-border bg-muted/60 text-foreground",
        className
      )}
    >
      <GavelIcon className="size-3 opacity-70" />
      {t(`violations.action.${action}`)}
    </span>
  )
}

// ─── Référence (copiable) ─────────────────────────────────────────────────────

export function ReferenceChip({ reference }: { reference: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (await copyText(reference)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={t("violations.detail.copyReference")}
      className="group/ref inline-flex items-center gap-1 rounded-md border bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] font-medium tracking-wide text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {reference}
      {copied ? (
        <CheckIcon className="size-3 text-green-500" />
      ) : (
        <CopyIcon className="size-3 opacity-0 transition-opacity group-hover/ref:opacity-60" />
      )}
    </button>
  )
}

// ─── Compte à rebours ─────────────────────────────────────────────────────────

/**
 * Résumé du compte à rebours d'application des conséquences.
 * `premium` est mis en avant tant que `status = pending` : c'est ce qui mène à
 * une résiliation sans remboursement, donc ce qui pousse à faire appel à temps.
 */
export function EnforcementNotice({
  enforcement,
  appealUrl,
  className,
}: {
  enforcement: Enforcement
  appealUrl: string
  className?: string
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language

  if (enforcement.status === "cancelled") return null

  const deadline = formatDeadline(enforcement.deadline, locale)
  const executed = formatDeadline(enforcement.executed_at, locale)
  const left = remainingParts(enforcement.deadline)

  const pending = enforcement.status === "pending"
  const halted = enforcement.status === "halted"

  const tone = pending
    ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
    : halted
      ? "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40"
      : "border-border bg-muted/40"

  const Icon = pending ? HourglassIcon : halted ? PauseIcon : GavelIcon
  const iconTone = pending
    ? "text-red-500"
    : halted
      ? "text-sky-500"
      : "text-muted-foreground"

  const countdown =
    left &&
    (left.days > 0
      ? t("violations.enforcement.inDays", { days: left.days, hours: left.hours })
      : left.hours > 0
        ? t("violations.enforcement.inHours", { hours: left.hours, minutes: left.minutes })
        : t("violations.enforcement.inMinutes", { minutes: Math.max(left.minutes, 1) }))

  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border p-4", tone, className)}>
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 size-4 shrink-0", iconTone)} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {t(`violations.enforcement.title.${enforcement.status}`)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {pending && deadline
              ? t("violations.enforcement.pendingDescription", { date: deadline })
              : halted
                ? t("violations.enforcement.haltedDescription")
                : enforcement.status === "executed" && executed
                  ? t("violations.enforcement.executedDescription", { date: executed })
                  : t(`violations.enforcement.title.${enforcement.status}`)}
          </p>
          {pending && countdown && (
            <p className="mt-1 text-xs font-medium tabular-nums">{countdown}</p>
          )}
          {enforcement.premium && pending && (
            <p className="mt-2 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs text-violet-700 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-300">
              {t("violations.enforcement.premiumWarning")}
            </p>
          )}
        </div>
      </div>
      {pending && (
        <a
          href={appealUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 items-center justify-center self-start rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t("violations.appeal")}
        </a>
      )}
    </div>
  )
}
