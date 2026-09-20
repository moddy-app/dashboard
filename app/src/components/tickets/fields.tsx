import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  InfoIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
import { ChannelPicker, RoleMultiPicker } from "@/components/discord-pickers"
import { cn } from "@/lib/utils"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field as UiField,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import type { Channel, Role } from "@/types/api"
import type { TicketsApplyFeedback, TicketsApplyLevel } from "@/lib/tickets"

// Briques partagées par les écrans du module Tickets. Les snowflakes restent
// des chaînes de bout en bout : aucun `Number()` ici non plus.

/** Sentinelle du sélecteur : Radix Select refuse une valeur vide. */
export const NONE = "__none__"

// ─── Champ ────────────────────────────────────────────────────────────────────

/**
 * Enveloppe le `Field` de shadcn pour garder deux choses propres au module :
 * le `hint` aligné à droite du libellé (compteur de caractères, quota) et
 * l'ancre `id`, qui permet à la page de faire défiler jusqu'au premier champ
 * fautif après un 422.
 *
 * Contrairement à l'ancienne version, **description et erreur cohabitent** :
 * faire disparaître l'aide au moment précis où l'on se trompe est le pire
 * moment pour la retirer.
 */
export function Field({
  label,
  description,
  error,
  hint,
  fieldId,
  children,
}: {
  label: string
  description?: ReactNode
  error?: string
  /** Compteur de caractères, quota… affiché à droite du libellé. */
  hint?: ReactNode
  /** Ancre de défilement (voir `panelFieldKey` / `categoryFieldKey`). */
  fieldId?: string
  children: ReactNode
}) {
  return (
    <UiField id={fieldId} data-invalid={error ? true : undefined} className="scroll-mt-24">
      <div className="flex items-center justify-between gap-2">
        <FieldLabel className="text-sm font-medium">{label}</FieldLabel>
        {hint && <span className="text-xs tabular-nums text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {description && <FieldDescription>{description}</FieldDescription>}
      {error && <FieldError>{error}</FieldError>}
    </UiField>
  )
}

/**
 * Interrupteur avec libellé et description — le motif « un réglage par ligne »
 * du module. C'est le `Field` horizontal de shadcn, pas une carte maison.
 */
export function ToggleField({
  label,
  description,
  checked,
  icon,
  children,
}: {
  label: string
  description?: ReactNode
  checked?: boolean
  icon?: ReactNode
  /** L'interrupteur lui-même (`Switch`), passé par l'appelant. */
  children: ReactNode
}) {
  return (
    // `data-checked` est posé ici, à la main : Radix ne l'expose pas (il n'écrit
    // que `data-state` sur l'interrupteur), et c'est le conteneur — pas
    // l'interrupteur — qu'on veut souligner quand le réglage est actif.
    <UiField
      orientation="horizontal"
      data-checked={checked ? "true" : "false"}
      className="rounded-lg border p-3.5 transition-colors data-[checked=true]:border-primary/30"
    >
      {icon && <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <FieldLabel className="text-sm font-medium">{label}</FieldLabel>
        {description && <FieldDescription>{description}</FieldDescription>}
      </div>
      {children}
    </UiField>
  )
}

// ─── Sélecteurs ───────────────────────────────────────────────────────────────

/**
 * Compatibilité : `ChannelSelect` n'est plus qu'un nom d'emprunt pour le
 * sélecteur commun du dashboard (`ChannelPicker`), qui sait chercher. Les
 * appelants historiques passent encore `emptyLabel` et `prefix` — le premier
 * est rendu par le sélecteur lui-même, le second n'a plus lieu d'être (le type
 * de salon est dit par son icône).
 */
export function ChannelSelect({
  value,
  channels,
  onChange,
  placeholder,
  clearLabel,
  invalid = false,
  disabled,
}: {
  value: string | null
  channels: Channel[]
  onChange: (value: string | null) => void
  placeholder: string
  emptyLabel?: string
  /** Option de remise à zéro — un panneau sans salon est un brouillon valide. */
  clearLabel: string
  prefix?: string
  invalid?: boolean
  disabled?: boolean
}) {
  return (
    <ChannelPicker
      value={value}
      channels={channels}
      onChange={onChange}
      placeholder={placeholder}
      clearLabel={clearLabel}
      invalid={invalid}
      disabled={disabled}
    />
  )
}

// `RoleDot` vit avec les sélecteurs communs : une seule définition dans le dépôt.
export { RoleDot } from "@/components/discord-pickers"

/**
 * Liste de rôles éditable (chips + ajout). Sert aux trois listes d'une
 * catégorie : `allowed_role_ids`, `denied_role_ids` et `ping_role_ids`.
 */
/**
 * Compatibilité : `RoleChips` délègue au sélecteur de rôles commun du
 * dashboard, qui sait chercher parmi plusieurs dizaines de rôles.
 */
export function RoleChips({
  value,
  roles,
  onChange,
  addLabel,
  emptyLabel,
  tone = "neutral",
}: {
  value: string[]
  roles: Role[]
  onChange: (value: string[]) => void
  addLabel: string
  emptyLabel: string
  tone?: "neutral" | "danger"
}) {
  return (
    <RoleMultiPicker
      value={value}
      roles={roles}
      onChange={onChange}
      addLabel={addLabel}
      emptyLabel={emptyLabel}
      tone={tone}
    />
  )
}

// ─── Encarts ──────────────────────────────────────────────────────────────────

const NOTICE_TONE: Record<
  TicketsApplyLevel,
  { box: string; icon: string; Icon: typeof InfoIcon }
> = {
  success: {
    box: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40",
    icon: "text-emerald-600 dark:text-emerald-400",
    Icon: CheckCircle2Icon,
  },
  info: {
    box: "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40",
    icon: "text-sky-600 dark:text-sky-400",
    Icon: InfoIcon,
  },
  warning: {
    box: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
    icon: "text-amber-600 dark:text-amber-400",
    Icon: TriangleAlertIcon,
  },
  error: {
    box: "border-destructive/30 bg-destructive/5",
    icon: "text-destructive",
    Icon: AlertCircleIcon,
  },
}

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
  const { t } = useTranslation()
  const { Icon, box, icon } = NOTICE_TONE[level]

  return (
    <Alert className={cn(box, onDismiss && "pr-12")}>
      <Icon className={icon} />
      <AlertTitle>{title}</AlertTitle>
      {children && <AlertDescription>{children}</AlertDescription>}
      {action && <div className="col-start-2 mt-2">{action}</div>}
      {onDismiss && (
        <AlertAction>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onDismiss}
            aria-label={t("common.dismiss")}
          >
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
        <ul className="flex list-disc flex-col gap-0.5 pl-4">
          {feedback.problems.map((p) => (
            <li key={p.key}>{t(p.key, p.params)}</li>
          ))}
        </ul>
      )}
    </Notice>
  )
}
