import * as React from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ChevronDownIcon, CloseIcon } from "@/components/icons"
import { cn } from "@/lib/utils"

// Coque commune des sélecteurs : un déclencheur qui a l'apparence d'un
// `SelectTrigger`, un `Popover` aussi large que lui. Le contenu (Command,
// onglets…) est fourni par chaque sélecteur.

const FIELD_CLASS =
  "rounded-4xl border border-input bg-input/30 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 disabled:cursor-not-allowed disabled:opacity-50"

export interface PickerShellProps {
  id?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  disabled?: boolean
  invalid?: boolean
  /** Libellé accessible de secours quand aucun `<label for>` ne pointe sur `id`. */
  ariaLabel?: string
  contentClassName?: string
  children: React.ReactNode
}

interface SinglePickerShellProps extends PickerShellProps {
  /** Contenu du déclencheur (valeur choisie ou placeholder). */
  display: React.ReactNode
  className?: string
}

/** Sélecteur à valeur unique : le déclencheur est un seul bouton. */
export function SinglePickerShell({
  id,
  open,
  onOpenChange,
  disabled,
  invalid,
  ariaLabel,
  contentClassName,
  display,
  className,
  children,
}: SinglePickerShellProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(
            FIELD_CLASS,
            "flex h-9 w-full items-center justify-between gap-1.5 px-3 py-2 text-left",
            className
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">{display}</span>
          <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          "w-(--radix-popover-trigger-width) min-w-64 gap-0 p-0",
          contentClassName
        )}
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}

export interface PickerChip {
  key: string
  label: string
  icon?: React.ReactNode
  /** Valeur introuvable (supprimée) : rendue en atténué. */
  muted?: boolean
}

interface MultiPickerShellProps extends PickerShellProps {
  chips: PickerChip[]
  placeholder: string
  onRemove: (key: string) => void
  /** Au-delà, un « +N » remplace les choix restants. */
  maxVisible?: number
}

/**
 * Sélecteur multiple : les choix sont des `Badge` retirables **dans** le
 * déclencheur. Un bouton ne peut pas en contenir d'autres : le vrai bouton
 * (ouverture) est posé sous la rangée de badges, qui reste cliquable par-dessus.
 */
export function MultiPickerShell({
  id,
  open,
  onOpenChange,
  disabled,
  invalid,
  ariaLabel,
  contentClassName,
  chips,
  placeholder,
  onRemove,
  maxVisible = 3,
  children,
}: MultiPickerShellProps) {
  const { t } = useTranslation()
  const shown = chips.slice(0, maxVisible)
  const hidden = chips.length - shown.length

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <div
        className={cn(
          FIELD_CLASS,
          "relative flex min-h-9 w-full flex-wrap items-center gap-1.5 py-1 pr-9 pl-3",
          disabled && "opacity-50",
          invalid && "border-destructive ring-[3px] ring-destructive/20"
        )}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            aria-label={ariaLabel}
            disabled={disabled}
            className="absolute inset-0 flex items-center justify-end rounded-4xl pr-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed"
          >
            <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        {chips.length === 0 && (
          <span className="pointer-events-none relative truncate text-muted-foreground">
            {placeholder}
          </span>
        )}
        {shown.map((chip) => (
          <Badge
            key={chip.key}
            variant="secondary"
            className={cn("relative max-w-48 gap-1 pr-0.5", chip.muted && "text-muted-foreground")}
          >
            {chip.icon}
            <span className="truncate">{chip.label}</span>
            <button
              type="button"
              disabled={disabled}
              aria-label={t("pickers.remove", { name: chip.label })}
              onClick={() => onRemove(chip.key)}
              className="flex size-4 shrink-0 items-center justify-center rounded-full outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none"
            >
              <CloseIcon className="size-3" />
            </button>
          </Badge>
        ))}
        {hidden > 0 && (
          <Badge variant="outline" className="pointer-events-none relative">
            {t("pickers.more", { count: hidden })}
          </Badge>
        )}
      </div>
      <PopoverContent
        align="start"
        // Le déclencheur est le bouton absolu : sa largeur = celle du champ.
        className={cn(
          "w-(--radix-popover-trigger-width) min-w-64 gap-0 p-0",
          contentClassName
        )}
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}
