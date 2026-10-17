import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { AlertCircleIcon, InfoIcon, TriangleAlertIcon, XIcon } from "@/components/icons"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field as FieldRoot,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import type { TicketsApplyFeedback, TicketsApplyLevel } from "@/lib/tickets"

// Briques partagées par les écrans du module Tickets. Les snowflakes restent
// des chaînes de bout en bout : aucun `Number()` ici non plus.

/** Sentinelle du sélecteur : Radix Select refuse une valeur vide. */
export const NONE = "__none__"

// ─── Champ ────────────────────────────────────────────────────────────────────

export function Field({
  label,
  description,
  error,
  hint,
  children,
}: {
  label: string
  description?: string
  error?: string
  /** Compteur de caractères, quota… affiché à droite du libellé. */
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <FieldRoot data-invalid={error ? true : undefined}>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel>{label}</FieldLabel>
        {hint && <span className="text-xs text-muted-foreground tabular-nums">{hint}</span>}
      </div>
      {children}
      {error ? (
        <FieldError>{error}</FieldError>
      ) : (
        description && <FieldDescription>{description}</FieldDescription>
      )}
    </FieldRoot>
  )
}

// ─── Encarts ──────────────────────────────────────────────────────────────────

const NOTICE_ICONS = {
  success: InfoIcon,
  info: InfoIcon,
  warning: TriangleAlertIcon,
  error: AlertCircleIcon,
} as const

export function Notice({
  level,
  title,
  children,
  action,
  onDismiss,
}: {
  level: TicketsApplyLevel
  title: string
  children?: ReactNode
  action?: ReactNode
  onDismiss?: () => void
}) {
  const Icon = NOTICE_ICONS[level]
  return (
    <Alert variant={level === "error" ? "destructive" : "default"}>
      <Icon />
      <AlertTitle>{title}</AlertTitle>
      {(children || action) && (
        <AlertDescription>
          {children}
          {action && <div className="mt-2">{action}</div>}
        </AlertDescription>
      )}
      {onDismiss && (
        <AlertAction>
          <Button type="button" variant="ghost" size="icon-xs" onClick={onDismiss}>
            <XIcon />
          </Button>
        </AlertAction>
      )}
    </Alert>
  )
}

/**
 * Résultat de la dernière écriture. Reste à l'écran : un toast se rate, et
 * « le panneau n'a pas pu être publié » ne doit pas disparaître au bout de 4 s.
 */
export function ApplyNotice({
  feedback,
  onDismiss,
}: {
  feedback: TicketsApplyFeedback
  onDismiss: () => void
}) {
  const { t } = useTranslation()
  return (
    <Notice level={feedback.level} title={t(feedback.key, feedback.params)} onDismiss={onDismiss}>
      {feedback.problems.length > 0 && (
        <ul className="list-disc pl-4">
          {feedback.problems.map((p) => (
            <li key={p.key}>{t(p.key, p.params)}</li>
          ))}
        </ul>
      )}
    </Notice>
  )
}
