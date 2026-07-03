import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { ACTION_LABEL } from "@/lib/cases-format"
import type { SanctionAction } from "@/services/cases-types"
import { ACTION_ICON } from "./case-badges"

export function LabeledField({
  label,
  htmlFor,
  hint,
  required,
  children,
  className,
}: {
  label: string
  htmlFor?: string
  hint?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function ActionSelect({
  value,
  onChange,
  options,
  id,
  placeholder = "Choisir une action",
}: {
  value: SanctionAction | ""
  onChange: (value: SanctionAction) => void
  options: SanctionAction[]
  id?: string
  placeholder?: string
}) {
  return (
    <Select
      value={value || undefined}
      onValueChange={(v) => onChange(v as SanctionAction)}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((action) => {
          const Icon = ACTION_ICON[action]
          return (
            <SelectItem key={action} value={action}>
              <Icon className="size-4 text-muted-foreground" />
              {ACTION_LABEL[action]}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

/** Champ datetime-local → renvoie une valeur ISO via onChange. */
export function ExpiryField({
  value,
  onChange,
  id,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  id?: string
  disabled?: boolean
}) {
  return (
    <Input
      id={id}
      type="datetime-local"
      value={value}
      disabled={disabled}
      min={toLocalInput(new Date())}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg"
    />
  )
}

export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function localInputToIso(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}
