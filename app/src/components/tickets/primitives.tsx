import type { ReactNode } from "react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  FolderIcon,
  HashIcon,
  MegaphoneIcon,
  PlusIcon,
  XIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { CHANNEL_TYPES, roleColorToHex } from "@/types/api"
import type { Channel, Role } from "@/types/api"

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

/** Bloc thématique d'un écran : un titre, éventuellement une phrase, du contenu. */
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
    <section className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions}
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

/** Conteneur de lignes — la seule bordure d'un écran. */
export function List({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("divide-y overflow-hidden rounded-lg border", className)}>{children}</div>
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
    <div className="group flex items-center gap-3 bg-card pr-3 transition-colors hover:bg-accent/40">
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3 text-left"
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

// ─── Sélecteur de salon ───────────────────────────────────────────────────────

/** Un salon d'annonces, une catégorie et un salon texte ne se lisent pas pareil. */
function ChannelIcon({ type, className }: { type: number; className?: string }) {
  if (type === CHANNEL_TYPES.ANNOUNCEMENT) return <MegaphoneIcon className={className} />
  if (type === CHANNEL_TYPES.CATEGORY) return <FolderIcon className={className} />
  return <HashIcon className={className} />
}

/**
 * Salon ou catégorie Discord, avec recherche : un serveur peut en aligner
 * plusieurs centaines, un `Select` y devient inutilisable.
 */
export function ChannelPicker({
  value,
  channels,
  onChange,
  placeholder,
  clearLabel,
  invalid,
  className,
}: {
  value: string | null
  channels: Channel[]
  onChange: (value: string | null) => void
  placeholder: string
  /** Libellé de remise à zéro — « aucun salon » reste un état valide. */
  clearLabel: string
  invalid?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const selected = value ? channels.find((c) => c.id === value) : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-invalid={invalid}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="flex min-w-0 items-center gap-2">
            {value && (
              <ChannelIcon
                type={selected?.type ?? CHANNEL_TYPES.TEXT}
                className="size-4 shrink-0 text-muted-foreground"
              />
            )}
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {/* Salon supprimé ou d'un autre type : on montre l'id plutôt que
                  de retomber silencieusement sur le placeholder. */}
              {selected?.name ?? value ?? placeholder}
            </span>
          </span>
          <ChevronsUpDownIcon className="shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] min-w-64 p-0">
        <Command>
          <CommandInput placeholder={t("modules.tickets.pickers.searchChannel")} />
          <CommandList>
            <CommandEmpty>{t("modules.tickets.pickers.noChannel")}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={clearLabel}
                onSelect={() => {
                  onChange(null)
                  setOpen(false)
                }}
                className="text-muted-foreground"
              >
                {clearLabel}
              </CommandItem>
              {channels.map((channel) => (
                <CommandItem
                  key={channel.id}
                  value={`${channel.name} ${channel.id}`}
                  onSelect={() => {
                    onChange(channel.id)
                    setOpen(false)
                  }}
                >
                  <ChannelIcon type={channel.type} className="size-4 text-muted-foreground" />
                  <span className="truncate">{channel.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ─── Sélecteur de rôles ───────────────────────────────────────────────────────

export function RolePicker({
  value,
  roles,
  onChange,
  addLabel,
  tone = "neutral",
}: {
  value: string[]
  roles: Role[]
  onChange: (value: string[]) => void
  addLabel: string
  tone?: "neutral" | "danger"
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const available = useMemo(() => roles.filter((r) => !value.includes(r.id)), [roles, value])

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((id) => {
        const role = roles.find((r) => r.id === id)
        const color = role ? roleColorToHex(role.color) : "#99aab5"
        return (
          <Badge
            key={id}
            variant="outline"
            className={cn("gap-1 pr-1", tone === "danger" && "border-destructive/40")}
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: tone === "danger" ? undefined : color }}
            />
            <span className="max-w-40 truncate">{role?.name ?? id}</span>
            <button
              type="button"
              aria-label={t("modules.tickets.pickers.removeRole")}
              onClick={() => onChange(value.filter((r) => r !== id))}
              className="rounded-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <XIcon className="size-3" />
            </button>
          </Badge>
        )
      })}

      {available.length > 0 && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-muted-foreground">
              <PlusIcon data-icon="inline-start" />
              {addLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-0">
            <Command>
              <CommandInput placeholder={t("modules.tickets.pickers.searchRole")} />
              <CommandList>
                <CommandEmpty>{t("modules.tickets.pickers.noRole")}</CommandEmpty>
                <CommandGroup>
                  {available.map((role) => (
                    <CommandItem
                      key={role.id}
                      value={`${role.name} ${role.id}`}
                      onSelect={() => {
                        onChange([...value, role.id])
                        setOpen(false)
                      }}
                    >
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: roleColorToHex(role.color) }}
                      />
                      <span className="truncate">{role.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
