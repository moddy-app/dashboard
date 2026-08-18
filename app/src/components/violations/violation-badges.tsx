import { useTranslation } from "react-i18next"
import { ClockIcon, HourglassIcon, InfinityIcon, PauseIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { ACTION_META } from "@/lib/cases"
import { ActionChip } from "@/components/cases/case-badges"
import { LEVEL_TONE, formatDeadline, remainingParts } from "@/lib/sanctions"
import type { Enforcement, GlobalAction, SanctionLevel } from "@/types/violations"

// ─── Niveau ───────────────────────────────────────────────────────────────────

/**
 * Pastille de niveau, calée sur `CaseStatusPill` : même forme, même graisse.
 * `warn` reste volontairement discret — un avertissement ne bloque rien, il ne
 * doit pas être crié comme une limitation.
 */
export function LevelPill({
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
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        size === "xs" ? "gap-1 px-1.5 py-0 text-[10px]" : "gap-1.5 px-2 py-0.5 text-xs",
        tone.border,
        tone.softBg,
        tone.text,
        className
      )}
    >
      <span className={cn("shrink-0 rounded-full", size === "xs" ? "size-1" : "size-1.5", tone.dot)} />
      {t(`violations.level.${level}`)}
    </span>
  )
}

/** Pastille des infractions closes — le pendant neutre de `LevelPill`. */
export function ClosedPill({
  size = "sm",
  className,
}: {
  size?: "sm" | "xs"
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-muted font-medium text-muted-foreground",
        size === "xs" ? "gap-1 px-1.5 py-0 text-[10px]" : "gap-1.5 px-2 py-0.5 text-xs",
        className
      )}
    >
      <span
        className={cn(
          "shrink-0 rounded-full bg-muted-foreground/50",
          size === "xs" ? "size-1" : "size-1.5"
        )}
      />
      {t("violations.list.resolved")}
    </span>
  )
}

/**
 * Le même point que `LevelPill`, sans libellé : dans le sélecteur de serveurs
 * une pastille complète déborderait. Le `title` porte le sens.
 */
export function LevelDot({ level, title }: { level: SanctionLevel; title?: string }) {
  return (
    <span
      title={title}
      className={cn("size-2 shrink-0 rounded-full", LEVEL_TONE[level].dot)}
    />
  )
}

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * Mesure d'une sanction globale. Ce n'est qu'`ActionChip` (cases) figée sur la
 * portée `global` : même composant, même icône, même ton — c'est `caseType` qui
 * choisit le libellé (« suspension » plutôt que « bannir »).
 */
export function GlobalActionChip({
  action,
  size = "sm",
  muted = false,
  className,
}: {
  action: GlobalAction
  size?: "sm" | "xs"
  muted?: boolean
  className?: string
}) {
  return (
    <ActionChip
      action={action}
      size={size}
      muted={muted}
      className={className}
      caseType="global"
    />
  )
}

// ─── Échéance ─────────────────────────────────────────────────────────────────

/** « Jusqu'au 17 août » ou « Définitive » — même formulation que `SanctionsPanel`. */
export function ExpiryLabel({
  expiresAt,
  className,
}: {
  expiresAt: string | null | undefined
  className?: string
}) {
  const { t, i18n } = useTranslation()
  const until = formatDeadline(expiresAt, i18n.language)
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {until ? (
        <>
          <ClockIcon className="size-3 shrink-0" />
          {t("violations.detail.until", { date: until })}
        </>
      ) : (
        <>
          <InfinityIcon className="size-3 shrink-0" />
          {t("violations.detail.permanent")}
        </>
      )}
    </span>
  )
}

// ─── Statut d'une mesure ──────────────────────────────────────────────────────

/**
 * « En vigueur » n'apporte rien : c'est l'état par défaut de tout ce qu'on
 * affiche. Seule une mesure levée ou expirée mérite d'être signalée — sinon
 * chaque ligne porterait une étiquette qui ne distingue rien.
 */
export function MeasureStatus({ status }: { status: "active" | "expired" | "revoked" }) {
  const { t } = useTranslation()
  if (status === "active") return null
  return (
    <span className="text-xs text-muted-foreground">
      {t(`violations.sanctionStatus.${status}`)}
    </span>
  )
}

// ─── Référence ────────────────────────────────────────────────────────────────

/**
 * Référence(s) de l'infraction, chacune dans son propre label. **Sans
 * préfixe** : le code se reconnaît seul, l'annoncer par « Réf. » ne fait
 * qu'allonger la ligne. Typographie courante et pas de bouton de copie — c'est
 * un numéro à citer au support, pas un identifiant qu'on manipule.
 */
export function ReferenceText({
  references,
  className,
}: {
  references: string[]
  className?: string
}) {
  if (references.length === 0) return null
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {references.map((reference) => (
        <span
          key={reference}
          className="inline-flex items-center rounded-md border bg-muted/50 px-1.5 py-0.5 text-[11px] font-medium tracking-wide text-muted-foreground"
        >
          {reference}
        </span>
      ))}
    </span>
  )
}

// ─── Compte à rebours ─────────────────────────────────────────────────────────

/**
 * Ce qui va se passer, et quand. Les conséquences d'une sanction (résiliation
 * de l'abonnement, départ du bot) ne tombent pas immédiatement : ce bloc
 * explique le délai qui reste pour se manifester.
 *
 * ⚠️ Il ne doit **jamais** s'afficher pour une infraction close : « un humain a
 * stoppé le compte à rebours » n'a aucun sens quand la sanction a été levée.
 * L'appelant passe `active` ; par sécurité, `cancelled` disparaît aussi.
 */
export function EnforcementNotice({
  enforcement,
  appealUrl,
  active = true,
  className,
  /** À passer à `false` quand un bloc d'appel suit — deux CTA identiques se nuisent. */
  showAppeal = true,
  /**
   * `card` : bloc autonome, encadré et teinté. `inline` : à l'intérieur d'un
   * panneau — un cadre dans un cadre n'ajoute qu'un rectangle, l'icône colorée
   * suffit à porter le ton.
   */
  variant = "card",
}: {
  enforcement: Enforcement
  appealUrl: string
  active?: boolean
  className?: string
  showAppeal?: boolean
  variant?: "card" | "inline"
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language

  if (!active || enforcement.status === "cancelled") return null

  const deadline = formatDeadline(enforcement.deadline, locale)
  const executed = formatDeadline(enforcement.executed_at, locale)
  const left = remainingParts(enforcement.deadline)

  const pending = enforcement.status === "pending"
  const halted = enforcement.status === "halted"

  const tone = pending
    ? LEVEL_TONE.suspended
    : halted
      ? LEVEL_TONE.none
      : LEVEL_TONE.warn

  const Icon = pending ? HourglassIcon : halted ? PauseIcon : ACTION_META.ban.icon

  const countdown =
    left &&
    (left.days > 0
      ? t("violations.enforcement.inDays", { days: left.days, hours: left.hours })
      : left.hours > 0
        ? t("violations.enforcement.inHours", { hours: left.hours, minutes: left.minutes })
        : t("violations.enforcement.inMinutes", { minutes: Math.max(left.minutes, 1) }))

  const body = pending
    ? deadline && t("violations.enforcement.pendingDescription", { date: deadline })
    : halted
      ? t("violations.enforcement.haltedDescription")
      : executed && t("violations.enforcement.executedDescription", { date: executed })

  return (
    <div
      className={cn(
        "flex items-start gap-3",
        variant === "card" ? cn("rounded-xl border p-4", tone.border, tone.softBg) : "pt-1",
        className
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", tone.text)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {t(`violations.enforcement.title.${enforcement.status}`)}
          {pending && countdown && (
            <span className="ml-2 text-xs font-medium tabular-nums text-muted-foreground">
              {countdown}
            </span>
          )}
        </p>
        {body && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>}
        {/* La résiliation sans remboursement est la conséquence la plus lourde :
            elle se dit dans la même phrase, pas dans une boîte de plus. */}
        {enforcement.premium && pending && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t("violations.enforcement.premiumWarning")}
          </p>
        )}
        {pending && showAppeal && (
          <a
            href={appealUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("violations.appeal")}
          </a>
        )}
      </div>
    </div>
  )
}
