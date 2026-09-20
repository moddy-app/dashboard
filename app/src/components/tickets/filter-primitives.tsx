import { useEffect, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDownIcon, PlusIcon, Trash2Icon, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { FILTER_ACCENT_BUTTON, FILTER_ACCENT_CHIP } from "@/lib/cases"
import { useUserProfile } from "@/hooks/useProfile"

// Mécanique commune des barres de filtres en chips — tickets, archives et avis.
// Elle vit ici plutôt que recopiée par écran parce qu'elle porte deux
// temporisations qu'on ne devine pas en relisant :
//
//   • 160 ms avant d'ouvrir un chip fraîchement ajouté. Sans ce délai, le clic
//     qui vient de sélectionner le filtre dans le menu déroulant est encore en
//     vol : le popover le reçoit comme un « clic extérieur », se referme, et le
//     chip se retire aussitôt.
//   • 250 ms de garde dans `handleOpenChange` pour la même raison, côté
//     fermeture.
//
// Les recopier une troisième fois, c'est les perdre à la première relecture.

/** Pseudo résolu depuis un identifiant Discord, avec repli sur l'identifiant. */
export function ResolvedName({ id }: { id: string }) {
  const { data } = useUserProfile(id)
  return <>{data?.display_name ?? id}</>
}

/** Une option d'un éditeur de filtre en liste. */
export interface FilterOption {
  value: string
  label: ReactNode
  /** Deuxième ligne (nom du panneau parent, précision…). */
  sublabel?: ReactNode
  /** Pastille de couleur à gauche — classe utilitaire, pas une valeur brute. */
  dotClassName?: string
}

/** Liste d'options d'un filtre — le motif de `case-filter-bar.tsx`. */
export function FilterOptionList({
  options,
  value,
  emptyLabel,
  onSelect,
}: {
  options: FilterOption[]
  value: string | undefined
  emptyLabel: string
  onSelect: (value: string) => void
}) {
  if (options.length === 0) {
    return <p className="px-1 py-1 text-xs text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onSelect(option.value)}
          className={cn(
            "flex flex-col items-start rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
            value === option.value ? "bg-accent text-accent-foreground" : "hover:bg-muted"
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {option.dotClassName && (
              <span className={cn("size-1.5 shrink-0 rounded-full", option.dotClassName)} />
            )}
            <span className="truncate">{option.label}</span>
          </span>
          {option.sublabel && (
            <span className="truncate text-[11px] text-muted-foreground">{option.sublabel}</span>
          )}
        </button>
      ))}
    </div>
  )
}

/**
 * Coquille d'un chip de filtre : le bouton bleu, son popover, et la règle
 * « un chip fermé sans valeur se retire tout seul ».
 *
 * Deux modes d'édition. `text` fait gérer un brouillon par la coquille, validé
 * à la fermeture ou sur Entrée ; sinon `children` reçoit une fonction de
 * fermeture et rend son propre éditeur.
 */
export function FilterChipShell({
  icon: Icon,
  label,
  valueNode,
  filled,
  autoOpen,
  text,
  onRemove,
  children,
}: {
  icon: LucideIcon
  label: string
  /** Valeur affichée dans le chip quand le filtre est renseigné. */
  valueNode?: ReactNode
  filled: boolean
  /** Filtre fraîchement ajouté : ouvrir son éditeur. */
  autoOpen: boolean
  text?: {
    value: string
    placeholder: string
    numeric?: boolean
    onCommit: (value: string) => void
  }
  onRemove: () => void
  children?: (close: () => void) => ReactNode
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(text?.value ?? "")
  const openedAtRef = useRef(0)

  useEffect(() => {
    if (!autoOpen) return
    const id = setTimeout(() => {
      openedAtRef.current = Date.now()
      setOpen(true)
    }, 160)
    return () => clearTimeout(id)
  }, [autoOpen])

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraft(text?.value ?? "")
      openedAtRef.current = Date.now()
      setOpen(true)
      return
    }
    if (Date.now() - openedAtRef.current < 250) return
    setOpen(false)
    if (text) {
      const trimmed = draft.trim()
      if (trimmed) text.onCommit(trimmed)
      else onRemove()
    } else if (!filled) {
      onRemove()
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
            FILTER_ACCENT_CHIP
          )}
        >
          <Icon className="size-3.5 shrink-0" />
          <span className="font-semibold">
            {label}
            {filled && ":"}
          </span>
          {filled && <span className="max-w-40 truncate font-normal">{valueNode}</span>}
          <ChevronDownIcon className="size-3.5 shrink-0 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 gap-0 p-2">
        <div className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
          <Icon className="size-3.5" />
          {label}
        </div>

        {text ? (
          <Input
            autoFocus
            value={draft}
            inputMode={text.numeric ? "numeric" : undefined}
            onChange={(e) =>
              setDraft(text.numeric ? e.target.value.replace(/\D/g, "") : e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") handleOpenChange(false)
            }}
            placeholder={text.placeholder}
            className={cn("h-8 text-xs", !text.numeric && "font-mono")}
          />
        ) : (
          children?.(() => setOpen(false))
        )}

        <button
          type="button"
          onClick={onRemove}
          className="mt-2 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10"
        >
          <Trash2Icon className="size-3.5" />
          {t("cases.filters.remove")}
        </button>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Menu « ajouter un filtre ». `children` sert de déclencheur quand la barre
 * d'outils veut un bouton icône (cf. `case-list.tsx`) ; sans lui, on rend le
 * petit bouton texte qui suit la rangée de chips.
 */
export function AddFilterMenu<K extends string>({
  keys,
  meta,
  onAdd,
  children,
}: {
  keys: K[]
  meta: Record<K, { icon: LucideIcon; labelKey: string }>
  onAdd: (key: K) => void
  children?: ReactNode
}) {
  const { t } = useTranslation()

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        {children ?? (
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <PlusIcon className="size-3.5" />
            {t("cases.filters.add")}
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        {keys.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">{t("cases.filters.allUsed")}</div>
        ) : (
          keys.map((key) => {
            const Icon = meta[key].icon
            return (
              <DropdownMenuItem key={key} onSelect={() => onAdd(key)}>
                <Icon className="size-4" />
                {t(meta[key].labelKey)}
              </DropdownMenuItem>
            )
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Bouton icône de barre d'outils — même rendu que `case-list.tsx`. */
export function ToolbarIconButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onClick}
          aria-label={label}
          className={cn("size-9 shrink-0", active && FILTER_ACCENT_BUTTON)}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
