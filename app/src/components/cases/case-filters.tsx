import * as React from "react"
import { SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ACTION_LABEL,
  CASE_STATUS_LABEL,
  CASE_TYPE_LABEL,
} from "@/lib/cases-format"
import { cn } from "@/lib/utils"
import type { CasesMeta, CasesQuery } from "@/services/cases-types"

const ALL = "__all__"

export type FilterField =
  | "status"
  | "type"
  | "action"
  | "subject"
  | "scope"

export function CaseFilters({
  value,
  onChange,
  meta,
  fields,
  className,
}: {
  value: CasesQuery
  onChange: (next: CasesQuery) => void
  meta: CasesMeta | null
  fields: FilterField[]
  className?: string
}) {
  const [search, setSearch] = React.useState(value.subject_id ?? "")

  // Debounce de la recherche par ID sujet.
  React.useEffect(() => {
    const id = window.setTimeout(() => {
      const next = search.trim() || undefined
      if (next !== value.subject_id) onChange({ ...value, subject_id: next })
    }, 350)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const set = (patch: Partial<CasesQuery>) => onChange({ ...value, ...patch })

  const activeCount = [
    value.status,
    value.type,
    value.action,
    value.subject_id,
    value.scope_id,
  ].filter(Boolean).length

  const reset = () => {
    setSearch("")
    onChange({})
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {fields.includes("subject") && (
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ID de l'utilisateur ou serveur…"
            className="h-8 pl-8"
          />
        </div>
      )}

      {fields.includes("scope") && (
        <div className="relative min-w-[160px]">
          <SlidersHorizontalIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={value.scope_id ?? ""}
            onChange={(e) =>
              set({ scope_id: e.target.value.trim() || undefined })
            }
            placeholder="ID de portée…"
            className="h-8 pl-8"
          />
        </div>
      )}

      {fields.includes("status") && (
        <FilterSelect
          placeholder="Statut"
          value={value.status ?? ALL}
          onValueChange={(v) =>
            set({ status: v === ALL ? undefined : (v as CasesQuery["status"]) })
          }
          options={[
            { value: "open", label: CASE_STATUS_LABEL.open },
            { value: "closed", label: CASE_STATUS_LABEL.closed },
          ]}
        />
      )}

      {fields.includes("type") && (
        <FilterSelect
          placeholder="Type"
          value={value.type ?? ALL}
          onValueChange={(v) =>
            set({ type: v === ALL ? undefined : (v as CasesQuery["type"]) })
          }
          options={(meta?.enums.case_type ?? []).map((t) => ({
            value: t,
            label: CASE_TYPE_LABEL[t],
          }))}
        />
      )}

      {fields.includes("action") && (
        <FilterSelect
          placeholder="Action"
          value={value.action ?? ALL}
          onValueChange={(v) =>
            set({ action: v === ALL ? undefined : (v as CasesQuery["action"]) })
          }
          options={(meta?.enums.sanction_action ?? []).map((a) => ({
            value: a,
            label: ACTION_LABEL[a],
          }))}
        />
      )}

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={reset} className="h-8">
          <XIcon />
          Réinitialiser
        </Button>
      )}
    </div>
  )
}

function FilterSelect({
  placeholder,
  value,
  onValueChange,
  options,
}: {
  placeholder: string
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        size="sm"
        className={cn(
          "h-8 w-auto min-w-[120px] gap-1.5",
          value !== ALL && "border-primary/40 bg-primary/5 text-foreground"
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder} · Tous</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
