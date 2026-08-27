import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  InfoIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { roleColorToHex } from "@/types/api"
import type { Channel, Role } from "@/types/api"
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
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium">{label}</label>
        {hint && <span className="text-xs text-muted-foreground tabular-nums">{hint}</span>}
      </div>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        description && <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  )
}

// ─── Sélecteurs ───────────────────────────────────────────────────────────────

export function ChannelSelect({
  value,
  channels,
  onChange,
  placeholder,
  emptyLabel,
  clearLabel,
  prefix = "# ",
}: {
  value: string | null
  channels: Channel[]
  onChange: (value: string | null) => void
  placeholder: string
  emptyLabel: string
  /** Option de remise à zéro — un panneau sans salon est un brouillon valide. */
  clearLabel: string
  prefix?: string
}) {
  const known = value !== null && channels.some((c) => c.id === value)

  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{clearLabel}</SelectItem>
        {channels.length === 0 && (
          <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
            <AlertCircleIcon className="size-4" />
            {emptyLabel}
          </div>
        )}
        {channels.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {prefix}
            {c.name}
          </SelectItem>
        ))}
        {/* Valeur enregistrée absente de la liste (salon supprimé, mauvais
            type) : gardée visible plutôt que de retomber sur le placeholder. */}
        {value && !known && (
          <SelectItem value={value} disabled>
            {prefix}
            {value}
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  )
}

/**
 * Liste de rôles éditable (chips + ajout). Sert aux trois listes d'une
 * catégorie : `allowed_role_ids`, `denied_role_ids` et `ping_role_ids`.
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
  const available = roles.filter((r) => !value.includes(r.id))

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((id) => {
            const role = roles.find((r) => r.id === id)
            const color = tone === "danger" ? undefined : role ? roleColorToHex(role.color) : "#99aab5"
            return (
              <span
                key={id}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium",
                  tone === "danger" && "border-destructive/40 text-destructive"
                )}
                style={tone === "danger" ? undefined : { borderColor: color, color }}
              >
                @{role?.name ?? id}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((r) => r !== id))}
                  className="ml-0.5 rounded-full transition-opacity hover:opacity-70"
                >
                  <XIcon className="size-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}
      {available.length > 0 ? (
        <Select value="" onValueChange={(roleId) => onChange([...value, roleId])}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={addLabel} />
          </SelectTrigger>
          <SelectContent>
            {available.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: roleColorToHex(role.color) }}
                  />
                  {role.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        value.length === 0 && <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  )
}

// ─── Encarts ──────────────────────────────────────────────────────────────────

const NOTICE_STYLES: Record<
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
  const { Icon, box, icon } = NOTICE_STYLES[level]
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border p-4", box)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", icon)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {children && (
          <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{children}</div>
        )}
        {action && <div className="mt-2">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/10"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
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
        <ul className="list-disc space-y-0.5 pl-4">
          {feedback.problems.map((p) => (
            <li key={p.key}>{t(p.key, p.params)}</li>
          ))}
        </ul>
      )}
    </Notice>
  )
}
