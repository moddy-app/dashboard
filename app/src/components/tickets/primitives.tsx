import type { ReactNode } from "react"
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

// Briques communes aux trois niveaux du module Tickets (module → panneau →
// catégorie). Aucune n'encadre son contenu : la hiérarchie se lit au titrage et
// à l'espacement, pas à l'empilement de bordures.

// ─── Titre d'écran ────────────────────────────────────────────────────────────

/**
 * En-tête d'un niveau. `onBack` donne le chemin de retour — c'est lui qui rend
 * la profondeur lisible quand on est dans une catégorie d'un panneau.
 */
export function ScreenHeader({
  back,
  onBack,
  title,
  description,
  actions,
}: {
  back?: string
  onBack?: () => void
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      {back && onBack && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="-ml-2 h-7 w-fit gap-1 px-2 text-muted-foreground"
        >
          <ChevronLeftIcon data-icon="inline-start" />
          {back}
        </Button>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

/**
 * Bloc thématique d'un écran : un titre, éventuellement une phrase, du contenu.
 * Une carte par bloc — c'est elle qui donne sa largeur et son assise au
 * formulaire, plutôt que du texte flottant sur une page vide.
 */
export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {actions && <CardAction>{actions}</CardAction>}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">{children}</CardContent>
    </Card>
  )
}

/**
 * Sous-bloc titré — pour l'intérieur d'une modale, où une carte serait lourde.
 *
 * Le titre est volontairement **plus gros que les libellés de champ** : quand
 * les deux ont la même taille et la même graisse, on ne voit plus ce qui est
 * une section et ce qui est un champ, et l'écran se lit comme une liste plate.
 * Le filet au-dessus fait le reste du travail de séparation.
 */
export function Subsection({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 border-t pt-7 first:border-t-0 first:pt-0",
        className
      )}
    >
      <div>
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  )
}

// ─── Interrupteur ─────────────────────────────────────────────────────────────

export function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <Field orientation="horizontal" data-disabled={disabled || undefined}>
      <FieldContent>
        <FieldLabel className="font-normal">{label}</FieldLabel>
        {description && <FieldDescription>{description}</FieldDescription>}
      </FieldContent>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </Field>
  )
}

// ─── Lignes de liste ──────────────────────────────────────────────────────────

/**
 * Conteneur de lignes. Le cadre est à la charge de l'appelant : dans une carte,
 * les lignes s'étendent bord à bord (`-mx-6 border-y`) plutôt que d'empiler un
 * second cadre — deux cadres emboîtés pour la même chose se lisent comme une
 * erreur de mise en page.
 */
export function List({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("divide-y", className)}>{children}</div>
}

/**
 * Ligne qui descend d'un niveau. Tout est cliquable sauf les contrôles posés en
 * `trailing` (un interrupteur ne doit pas ouvrir l'écran suivant).
 */
export function NavRow({
  icon,
  title,
  subtitle,
  trailing,
  onClick,
}: {
  icon?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  trailing?: ReactNode
  onClick: () => void
}) {
  return (
    <div className="group flex items-center gap-3 pr-4 transition-colors hover:bg-accent/40">
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-6 text-left"
      >
        {icon && (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-sm">
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 truncate text-sm font-medium">{title}</span>
          {subtitle && (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{subtitle}</span>
          )}
        </span>
      </button>
      {trailing}
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/60" />
    </div>
  )
}

// ─── Choix segmenté ───────────────────────────────────────────────────────────

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  /** Couleur Discord de l'option (style de bouton) — pastille à gauche. */
  dot?: string
}

/**
 * Deux à quatre choix exclusifs. L'état sélectionné de `ToggleGroup` seul est
 * un simple fond gris clair : à côté d'une option survolée, on ne sait plus
 * laquelle est active. La coche le dit sans ambiguïté.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: readonly SegmentedOption<T>[]
  className?: string
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={value}
      // Radix rend `""` quand on reclique l'option active : on ignore, un choix
      // exclusif ne se désélectionne pas.
      onValueChange={(next) => next && onChange(next as T)}
      className={cn("w-fit", className)}
    >
      {options.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value} className="flex-none gap-2 px-3">
          {value === option.value ? (
            <CheckIcon />
          ) : (
            option.dot && (
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: option.dot }}
              />
            )
          )}
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
