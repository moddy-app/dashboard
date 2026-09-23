import * as React from "react"
import { useTranslation } from "react-i18next"
import { HugeiconsIcon } from "@hugeicons/react"
import { AlertCircleIcon } from "@hugeicons/core-free-icons"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { roleColorToHex } from "@/types/api"
import type { Channel, Role } from "@/types/api"

// Sélecteurs partagés par les formulaires de modules. Les snowflakes restent
// des chaînes : une valeur enregistrée qui n'existe plus (salon supprimé, rôle
// effacé) reste **visible** plutôt que de retomber silencieusement sur le vide.

/** Sentinelle : Radix Select refuse une valeur vide. */
const NONE = "__none__"

interface ChannelPickerProps {
  id?: string
  value: string | null
  channels: Channel[]
  onChange: (value: string | null) => void
  placeholder: string
  /** Option de remise à zéro — absente quand le salon est obligatoire. */
  clearLabel?: string
  invalid?: boolean
  disabled?: boolean
}

export function ChannelPicker({
  id,
  value,
  channels,
  onChange,
  placeholder,
  clearLabel,
  invalid,
  disabled,
}: ChannelPickerProps) {
  const { t } = useTranslation()
  const known = value !== null && channels.some((c) => c.id === value)

  return (
    <Select
      value={value ?? (clearLabel ? NONE : "")}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className="w-full" aria-invalid={invalid || undefined}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper">
        {clearLabel && (
          <SelectGroup>
            <SelectItem value={NONE}>{clearLabel}</SelectItem>
          </SelectGroup>
        )}
        <SelectGroup>
          {channels.length === 0 && (
            <SelectLabel className="flex items-center gap-2">
              <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="size-4" />
              {t("modules.noChannels")}
            </SelectLabel>
          )}
          {channels.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              # {c.name}
            </SelectItem>
          ))}
          {value && !known && (
            <SelectItem value={value} disabled>
              # {value}
            </SelectItem>
          )}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

interface RoleMultiPickerProps {
  id?: string
  value: string[]
  roles: Role[]
  onChange: (value: string[]) => void
  /** Au-delà, les rôles non choisis sont désactivés. */
  max: number
  placeholder: string
  invalid?: boolean
  disabled?: boolean
}

/**
 * Multi-sélection de rôles : `Combobox multiple` + chips, la composition
 * shadcn. Les items sont des ids (chaînes) ; le libellé sert au filtrage.
 */
export function RoleMultiPicker({
  id,
  value,
  roles,
  onChange,
  max,
  placeholder,
  invalid,
  disabled,
}: RoleMultiPickerProps) {
  const { t } = useTranslation()
  const anchor = useComboboxAnchor()
  const byId = React.useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles])
  // Un rôle supprimé reste dans la liste des items : sans ça sa puce
  // disparaîtrait et l'admin ne pourrait plus le retirer.
  const items = React.useMemo(
    () => [...roles.map((r) => r.id), ...value.filter((v) => !byId.has(v))],
    [roles, value, byId]
  )
  const label = React.useCallback((roleId: string) => byId.get(roleId)?.name ?? roleId, [byId])
  const isFull = value.length >= max

  return (
    <Combobox
      multiple
      autoHighlight
      items={items}
      value={value}
      onValueChange={(next: string[]) => onChange(next.slice(0, max))}
      itemToStringLabel={label}
      disabled={disabled}
    >
      <ComboboxChips ref={anchor} className="w-full">
        <ComboboxValue>
          {(values: string[]) => (
            <React.Fragment>
              {values.map((roleId) => {
                const role = byId.get(roleId)
                return (
                  <ComboboxChip key={roleId}>
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: role ? roleColorToHex(role.color) : undefined }}
                    />
                    @{label(roleId)}
                  </ComboboxChip>
                )
              })}
              <ComboboxChipsInput
                id={id}
                aria-invalid={invalid || undefined}
                placeholder={values.length === 0 ? placeholder : undefined}
                disabled={disabled || isFull}
              />
            </React.Fragment>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>{t("modules.rolePicker.empty")}</ComboboxEmpty>
        <ComboboxList>
          {(roleId: string) => {
            const role = byId.get(roleId)
            return (
              <ComboboxItem
                key={roleId}
                value={roleId}
                disabled={!role || (isFull && !value.includes(roleId))}
              >
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: role ? roleColorToHex(role.color) : undefined }}
                />
                <span className="truncate">{label(roleId)}</span>
              </ComboboxItem>
            )
          }}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
