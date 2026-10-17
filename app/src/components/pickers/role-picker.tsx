import * as React from "react"
import { useTranslation } from "react-i18next"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useGuildContext } from "@/contexts/GuildContext"
import { MultiPickerShell, SinglePickerShell } from "@/components/pickers/picker-shell"
import { cn } from "@/lib/utils"
import { roleColorToHex } from "@/types/api"
import type { Role } from "@/types/api"

/** Pastille de couleur : la couleur d'un rôle est une donnée, d'où le style inline. */
function RoleDot({ role, className }: { role?: Role; className?: string }) {
  const hasColor = role !== undefined && role.color !== 0
  return (
    <span
      aria-hidden
      className={cn("size-2.5 shrink-0 rounded-full", !hasColor && "bg-muted-foreground/50", className)}
      style={hasColor ? { backgroundColor: roleColorToHex(role.color) } : undefined}
    />
  )
}

interface BaseRoleProps {
  /** Défaut : rôles du serveur sélectionné (`useGuildContext`). */
  roles?: Role[]
  /** Inclut les rôles gérés (intégrations, boosters). Défaut : non. */
  includeManaged?: boolean
  /** Raison pour laquelle un rôle n'est pas choisissable (`null` = choisissable). */
  disabledReason?: (role: Role) => string | null
  placeholder?: string
  disabled?: boolean
  id?: string
  "aria-invalid"?: boolean
}

function useSelectableRoles(roles: Role[] | undefined, includeManaged: boolean | undefined) {
  const ctx = useGuildContext()
  const all = roles ?? ctx.roles
  const guildId = ctx.selectedGuildId
  return React.useMemo(
    () => ({
      all,
      selectable: all
        .filter((r) => r.name !== "@everyone" && r.id !== guildId && (includeManaged || !r.managed))
        .sort((a, b) => b.position - a.position),
    }),
    [all, guildId, includeManaged]
  )
}

interface RoleListProps {
  roles: Role[]
  selected: string[]
  unknown: string[]
  onSelect: (id: string) => void
  onSelectUnknown: (id: string) => void
  isDisabled: (role: Role) => boolean
  disabledReason?: (role: Role) => string | null
  none?: { label: string; onSelect: () => void; checked: boolean }
}

function RoleList({
  roles,
  selected,
  unknown,
  onSelect,
  onSelectUnknown,
  isDisabled,
  disabledReason,
  none,
}: RoleListProps) {
  const { t } = useTranslation()
  return (
    <Command>
      <CommandInput placeholder={t("pickers.role.search")} />
      <CommandList>
        <CommandEmpty>{t("pickers.role.empty")}</CommandEmpty>
        {none && (
          <CommandGroup>
            <CommandItem
              value="__none__"
              keywords={[none.label]}
              data-checked={none.checked}
              onSelect={none.onSelect}
            >
              <span className="truncate text-muted-foreground">{none.label}</span>
            </CommandItem>
          </CommandGroup>
        )}
        {unknown.length > 0 && (
          <CommandGroup>
            {unknown.map((id) => (
              <CommandItem key={id} value={`unknown-${id}`} data-checked onSelect={() => onSelectUnknown(id)}>
                <RoleDot />
                <span className="truncate text-muted-foreground">{t("pickers.role.deleted")}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup>
          {roles.map((r) => {
            const reason = disabledReason?.(r) ?? null
            return (
              <CommandItem
                key={r.id}
                value={r.id}
                keywords={[r.name]}
                disabled={reason !== null || isDisabled(r)}
                data-checked={selected.includes(r.id)}
                onSelect={() => onSelect(r.id)}
              >
                <RoleDot role={r} />
                <span className="truncate">{r.name}</span>
                {reason && (
                  <span className="ml-auto truncate text-xs text-muted-foreground">{reason}</span>
                )}
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

export interface RolePickerProps extends BaseRoleProps {
  value: string | null
  onChange: (value: string | null) => void
  allowNone?: boolean
  noneLabel?: string
}

export function RolePicker({
  value,
  onChange,
  roles,
  includeManaged,
  disabledReason,
  allowNone,
  noneLabel,
  placeholder,
  disabled,
  id,
  "aria-invalid": invalid,
}: RolePickerProps) {
  const { t } = useTranslation()
  const { all, selectable } = useSelectableRoles(roles, includeManaged)
  const [open, setOpen] = React.useState(false)
  const current = value ? all.find((r) => r.id === value) : undefined
  const pick = (next: string | null) => {
    onChange(next)
    setOpen(false)
  }

  let display: React.ReactNode
  if (current) {
    display = (
      <>
        <RoleDot role={current} />
        <span className="truncate">{current.name}</span>
      </>
    )
  } else if (value) {
    display = <span className="truncate text-muted-foreground">{t("pickers.role.deleted")}</span>
  } else {
    display = (
      <span className="truncate text-muted-foreground">
        {noneLabel && allowNone ? noneLabel : (placeholder ?? t("pickers.role.placeholder"))}
      </span>
    )
  }

  return (
    <SinglePickerShell
      id={id}
      open={open}
      onOpenChange={setOpen}
      disabled={disabled}
      invalid={invalid}
      display={display}
    >
      <RoleList
        roles={selectable}
        selected={value ? [value] : []}
        unknown={value && !current ? [value] : []}
        onSelect={(next) => pick(next)}
        onSelectUnknown={() => pick(null)}
        isDisabled={() => false}
        disabledReason={disabledReason}
        none={
          allowNone
            ? {
                label: noneLabel ?? t("pickers.role.none"),
                checked: value === null,
                onSelect: () => pick(null),
              }
            : undefined
        }
      />
    </SinglePickerShell>
  )
}

export interface RoleMultiPickerProps extends BaseRoleProps {
  value: string[]
  onChange: (value: string[]) => void
  /** Au-delà, les rôles non choisis sont désactivés. */
  max?: number
}

export function RoleMultiPicker({
  value,
  onChange,
  roles,
  includeManaged,
  disabledReason,
  max,
  placeholder,
  disabled,
  id,
  "aria-invalid": invalid,
}: RoleMultiPickerProps) {
  const { t } = useTranslation()
  const { all, selectable } = useSelectableRoles(roles, includeManaged)
  const [open, setOpen] = React.useState(false)
  const byId = React.useMemo(() => new Map(all.map((r) => [r.id, r])), [all])
  const unknown = value.filter((v) => !byId.has(v))
  const isFull = max !== undefined && value.length >= max

  const toggle = (roleId: string) =>
    onChange(value.includes(roleId) ? value.filter((v) => v !== roleId) : [...value, roleId])

  const chips = value.map((roleId) => {
    const r = byId.get(roleId)
    return r
      ? { key: roleId, label: r.name, icon: <RoleDot role={r} className="size-2" /> }
      : { key: roleId, label: t("pickers.role.deleted"), muted: true }
  })

  return (
    <MultiPickerShell
      id={id}
      open={open}
      onOpenChange={setOpen}
      disabled={disabled}
      invalid={invalid}
      chips={chips}
      placeholder={placeholder ?? t("pickers.role.placeholderMulti")}
      onRemove={toggle}
    >
      <RoleList
        roles={selectable}
        selected={value}
        unknown={unknown}
        onSelect={toggle}
        onSelectUnknown={toggle}
        isDisabled={(r) => isFull && !value.includes(r.id)}
        disabledReason={disabledReason}
      />
    </MultiPickerShell>
  )
}
