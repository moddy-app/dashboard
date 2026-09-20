import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  ChevronsUpDownIcon,
  FolderIcon,
  HashIcon,
  MegaphoneIcon,
  MessagesSquareIcon,
  PlusIcon,
  Volume2Icon,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { CHANNEL_TYPES, roleColorToHex } from "@/types/api"
import type { Role } from "@/types/api"

/**
 * Forme minimale attendue d'un salon : les appelants passent aussi bien un
 * `Channel` complet qu'une liste déjà réduite à l'essentiel. Sans `type`,
 * l'icône retombe sur celle d'un salon texte.
 */
export interface PickerChannel {
  id: string
  name: string
  type?: number
}

// Sélecteurs de salon et de rôle **communs à tout le dashboard**.
//
// Un serveur Discord aligne couramment plusieurs centaines de salons et
// plusieurs dizaines de rôles : un `Select` y oblige à faire défiler une liste
// sans recherche. D'où un `Popover` + `Command` — la même mécanique que la
// palette ⌘K — partout où l'on choisit un salon ou un rôle.

const DEFAULT_ROLE_COLOR = "#99aab5"

/** Pastille de couleur d'un rôle Discord — la couleur vient du serveur. */
export function RoleDot({ color }: { color: string }) {
  return (
    <span
      className="size-2 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  )
}

/** Un salon d'annonces, un vocal, un fil et une catégorie ne se lisent pas pareil. */
export function ChannelIcon({ type, className }: { type: number; className?: string }) {
  if (type === CHANNEL_TYPES.ANNOUNCEMENT) return <MegaphoneIcon className={className} />
  if (type === CHANNEL_TYPES.CATEGORY) return <FolderIcon className={className} />
  if (type === CHANNEL_TYPES.VOICE || type === CHANNEL_TYPES.STAGE)
    return <Volume2Icon className={className} />
  if (
    type === CHANNEL_TYPES.PUBLIC_THREAD ||
    type === CHANNEL_TYPES.PRIVATE_THREAD ||
    type === CHANNEL_TYPES.ANNOUNCEMENT_THREAD
  )
    return <MessagesSquareIcon className={className} />
  return <HashIcon className={className} />
}

// ─── Salon ────────────────────────────────────────────────────────────────────

interface ChannelPickerProps {
  value: string | null
  channels: PickerChannel[]
  onChange: (value: string | null) => void
  placeholder: string
  /**
   * Libellé de l'option de remise à zéro. Absent : le champ ne se vide pas —
   * à réserver aux réglages où « aucun salon » n'a pas de sens.
   */
  clearLabel?: string
  invalid?: boolean
  disabled?: boolean
  className?: string
}

export function ChannelPicker({
  value,
  channels,
  onChange,
  placeholder,
  clearLabel,
  invalid,
  disabled,
  className,
}: ChannelPickerProps) {
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
          disabled={disabled}
          aria-invalid={invalid || undefined}
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
            {/* Salon supprimé ou d'un autre type : on montre son id plutôt que
                de retomber silencieusement sur le placeholder. */}
            {selected?.name ?? value ?? placeholder}
          </span>
        </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-64 p-0">
        <Command>
          <CommandInput placeholder={t("pickers.searchChannel")} />
          <CommandList>
            <CommandEmpty>{t("pickers.noChannel")}</CommandEmpty>
            <CommandGroup>
              {clearLabel && (
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
              )}
              {channels.map((channel) => (
                <CommandItem
                  key={channel.id}
                  value={`${channel.name} ${channel.id}`}
                  onSelect={() => {
                    onChange(channel.id)
                    setOpen(false)
                  }}
                >
                  <ChannelIcon
                    type={channel.type ?? CHANNEL_TYPES.TEXT}
                    className="size-4 text-muted-foreground"
                  />
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

// ─── Rôle unique ──────────────────────────────────────────────────────────────

interface RolePickerProps {
  value: string | null
  roles: Role[]
  onChange: (value: string | null) => void
  placeholder: string
  clearLabel?: string
  /**
   * Rôles proposés mais non sélectionnables. La valeur rendue est la raison,
   * affichée à droite de l'option ; `""` désactive sans rien afficher, `null`
   * laisse l'option sélectionnable.
   */
  isDisabled?: (role: Role) => string | null
  invalid?: boolean
  disabled?: boolean
  className?: string
}

export function RolePicker({
  value,
  roles,
  onChange,
  placeholder,
  clearLabel,
  isDisabled,
  invalid,
  disabled,
  className,
}: RolePickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const selected = value ? roles.find((r) => r.id === value) : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="flex min-w-0 items-center gap-2">
          {selected && <RoleDot color={roleColorToHex(selected.color)} />}
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {selected?.name ?? value ?? placeholder}
          </span>
        </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-64 p-0">
        <Command>
          <CommandInput placeholder={t("pickers.searchRole")} />
          <CommandList>
            <CommandEmpty>{t("pickers.noRole")}</CommandEmpty>
            <CommandGroup>
              {clearLabel && (
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
              )}
              {roles.map((role) => {
                const reason = isDisabled?.(role) ?? null
                return (
                  <CommandItem
                    key={role.id}
                    value={`${role.name} ${role.id}`}
                    disabled={reason !== null}
                    title={reason || undefined}
                    onSelect={() => {
                      if (reason !== null) return
                      onChange(role.id)
                      setOpen(false)
                    }}
                  >
                    <RoleDot color={roleColorToHex(role.color)} />
                    <span className="truncate">{role.name}</span>
                    {reason ? (
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {reason}
                      </span>
                    ) : null}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ─── Rôles multiples ──────────────────────────────────────────────────────────

interface RoleMultiPickerProps {
  value: string[]
  roles: Role[]
  onChange: (value: string[]) => void
  addLabel: string
  /** Affiché quand aucun rôle n'est choisi et qu'il n'y en a aucun à proposer. */
  emptyLabel?: string
  tone?: "neutral" | "danger"
  disabled?: boolean
}

export function RoleMultiPicker({
  value,
  roles,
  onChange,
  addLabel,
  emptyLabel,
  tone = "neutral",
  disabled,
}: RoleMultiPickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const available = useMemo(() => roles.filter((r) => !value.includes(r.id)), [roles, value])

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((id) => {
        const role = roles.find((r) => r.id === id)
        // La couleur d'un rôle appartient au serveur Discord : elle ne peut pas
        // venir d'un token du thème, d'où le style inline.
        const color = role ? roleColorToHex(role.color) : DEFAULT_ROLE_COLOR
        return (
          <Badge
            key={id}
            variant="outline"
            className={cn("gap-1.5 py-1 pr-1 pl-2.5", tone === "danger" && "border-destructive/40")}
          >
            <RoleDot color={tone === "danger" ? DEFAULT_ROLE_COLOR : color} />
            <span className="max-w-40 truncate">{role?.name ?? id}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={disabled}
              aria-label={t("pickers.removeRole", { name: role?.name ?? id })}
              className="hover:bg-transparent hover:opacity-70"
              onClick={() => onChange(value.filter((r) => r !== id))}
            >
              <XIcon />
            </Button>
          </Badge>
        )
      })}

      {available.length > 0 ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              className="h-7 gap-1 px-2 text-muted-foreground"
            >
              <PlusIcon data-icon="inline-start" />
              {addLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-0">
            <Command>
              <CommandInput placeholder={t("pickers.searchRole")} />
              <CommandList>
                <CommandEmpty>{t("pickers.noRole")}</CommandEmpty>
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
                      <RoleDot color={roleColorToHex(role.color)} />
                      <span className="truncate">{role.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      ) : (
        value.length === 0 &&
        emptyLabel && <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  )
}

// ─── Choix générique avec recherche ───────────────────────────────────────────

export interface PickerOption {
  id: string
  label: string
  /** Couleur Discord (rôle) — pastille à gauche de l'option. */
  color?: string
  /** Type de salon Discord, pour l'icône. Absent : pas d'icône. */
  channelType?: number
}

/**
 * Choix unique dans une liste hétérogène (salons *et* rôles, par exemple les
 * exemptions d'un module). Rendu comme un bouton « ajouter » : la valeur
 * choisie part dans une liste de chips, le sélecteur ne garde rien.
 */
export function OptionPicker({
  options,
  onSelect,
  addLabel,
  searchPlaceholder,
  emptyLabel,
  disabled,
  className,
}: {
  options: PickerOption[]
  onSelect: (id: string) => void
  addLabel: string
  searchPlaceholder?: string
  emptyLabel?: string
  disabled?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn("w-full justify-between font-normal sm:w-72", className)}
        >
          <span className="truncate text-muted-foreground">{addLabel}</span>
          <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-64 p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder ?? t("pickers.search")} />
          <CommandList>
            <CommandEmpty>{emptyLabel ?? t("pickers.noResult")}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={`${option.label} ${option.id}`}
                  onSelect={() => {
                    onSelect(option.id)
                    setOpen(false)
                  }}
                >
                  {option.color ? (
                    <RoleDot color={option.color} />
                  ) : option.channelType !== undefined ? (
                    <ChannelIcon
                      type={option.channelType}
                      className="size-4 text-muted-foreground"
                    />
                  ) : null}
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
