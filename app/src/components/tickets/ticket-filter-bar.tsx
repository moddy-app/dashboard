import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDownIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { FILTER_ACCENT_CHIP } from "@/lib/cases"
import { useUserProfile } from "@/hooks/useProfile"
import type { TicketStatus } from "@/types/api"
import {
  TICKET_FILTER_META,
  hasTicketFilterValue,
  type TicketFilterKey,
  type TicketFilterValues,
} from "./ticket-filters"

// Barre de filtres du fil ticket + archives fusionné, sur le même modèle en
// chips que `case-filter-bar.tsx` : un chip bleu par filtre actif, popover
// d'édition au clic, retiré tout seul s'il se referme sans valeur.
//
// `availableKeys` dépend de `status` côté appelant — `panel` n'a de sens que
// pour les tickets vivants, `staff`/`number` que pour les archives (voir
// `ticket-filters.ts`). Ce composant reste ignorant de cette règle, il affiche
// simplement ce qu'on lui donne le droit de proposer.

function ResolvedName({ id }: { id: string }) {
  const { data } = useUserProfile(id)
  return <>{data?.display_name ?? id}</>
}

function TextEditor({
  value,
  onChange,
  onSubmit,
  placeholder,
  numeric = false,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  placeholder: string
  numeric?: boolean
}) {
  return (
    <Input
      autoFocus
      value={value}
      inputMode={numeric ? "numeric" : undefined}
      onChange={(e) => onChange(numeric ? e.target.value.replace(/\D/g, "") : e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSubmit()
      }}
      placeholder={placeholder}
      className={cn("h-8 text-xs", !numeric && "font-mono")}
    />
  )
}

function StatusEditor({
  value,
  onChange,
}: {
  value: TicketStatus | undefined
  onChange: (v: TicketStatus) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1">
      {(["open", "closed"] as TicketStatus[]).map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={cn(
            "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
            value === s ? "bg-accent text-accent-foreground" : "hover:bg-muted"
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              s === "open" ? "bg-emerald-500" : "bg-muted-foreground/50"
            )}
          />
          {t(`modules.tickets.filters.${s}`)}
        </button>
      ))}
    </div>
  )
}

function CategoryEditor({
  categories,
  value,
  onChange,
}: {
  categories: { id: string; name: string; panelName: string }[]
  value: string | undefined
  onChange: (v: string) => void
}) {
  const { t } = useTranslation()
  if (categories.length === 0) {
    return <p className="px-1 py-1 text-xs text-muted-foreground">{t("modules.tickets.filters.noCategory")}</p>
  }
  return (
    <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          className={cn(
            "flex flex-col items-start rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
            value === c.id ? "bg-accent text-accent-foreground" : "hover:bg-muted"
          )}
        >
          <span className="truncate">{c.name || c.id}</span>
          <span className="truncate text-[11px] text-muted-foreground">{c.panelName}</span>
        </button>
      ))}
    </div>
  )
}

function PanelEditor({
  panels,
  value,
  onChange,
}: {
  panels: { id: string; name: string }[]
  value: string | undefined
  onChange: (v: string) => void
}) {
  const { t } = useTranslation()
  if (panels.length === 0) {
    return <p className="px-1 py-1 text-xs text-muted-foreground">{t("modules.tickets.filters.noPanel")}</p>
  }
  return (
    <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
      {panels.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange(p.id)}
          className={cn(
            "truncate rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
            value === p.id ? "bg-accent text-accent-foreground" : "hover:bg-muted"
          )}
        >
          {p.name || p.id}
        </button>
      ))}
    </div>
  )
}

function ChipValue({
  filterKey,
  values,
  categories,
  panels,
}: {
  filterKey: TicketFilterKey
  values: TicketFilterValues
  categories: { id: string; name: string; panelName: string }[]
  panels: { id: string; name: string }[]
}) {
  const { t } = useTranslation()
  switch (filterKey) {
    case "status":
      return values.status ? <>{t(`modules.tickets.filters.${values.status}`)}</> : null
    case "category": {
      const c = categories.find((c) => c.id === values.category)
      return c ? <>{c.name || c.id}</> : null
    }
    case "owner":
      return values.owner ? <ResolvedName id={values.owner} /> : null
    case "staff":
      return values.staff ? <ResolvedName id={values.staff} /> : null
    case "panel": {
      const p = panels.find((p) => p.id === values.panel)
      return p ? <>{p.name || p.id}</> : null
    }
    case "number":
      return values.number ? <>#{values.number}</> : null
  }
}

function FilterChip({
  filterKey,
  values,
  categories,
  panels,
  autoOpen,
  onChange,
  onRemove,
}: {
  filterKey: TicketFilterKey
  values: TicketFilterValues
  categories: { id: string; name: string; panelName: string }[]
  panels: { id: string; name: string }[]
  autoOpen: boolean
  onChange: (patch: TicketFilterValues) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const meta = TICKET_FILTER_META[filterKey]
  const Icon = meta.icon
  const filled = hasTicketFilterValue(filterKey, values)
  const isText = filterKey === "owner" || filterKey === "staff" || filterKey === "number"
  const currentText =
    filterKey === "owner" ? values.owner : filterKey === "staff" ? values.staff : values.number

  // Ouverture différée à l'ajout : sinon le clic qui a sélectionné le filtre
  // dans le menu déroulant est capté par le popover comme un « clic extérieur »
  // et le referme aussitôt (→ retrait immédiat du chip).
  const openedAtRef = useRef(0)
  useEffect(() => {
    if (!autoOpen) return
    const id = setTimeout(() => {
      openedAtRef.current = Date.now()
      setOpen(true)
    }, 160)
    return () => clearTimeout(id)
  }, [autoOpen])

  const [draft, setDraft] = useState(currentText ?? "")

  const handleOpenChange = (o: boolean) => {
    if (o) {
      setDraft(currentText ?? "")
      openedAtRef.current = Date.now()
      setOpen(true)
      return
    }
    if (Date.now() - openedAtRef.current < 250) return
    setOpen(false)
    if (isText) {
      const v = draft.trim()
      if (v) {
        onChange(
          filterKey === "owner" ? { owner: v } : filterKey === "staff" ? { staff: v } : { number: v }
        )
      } else onRemove()
    } else if (!hasTicketFilterValue(filterKey, values)) {
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
            {t(meta.labelKey)}
            {filled && ":"}
          </span>
          {filled && (
            <span className="max-w-[10rem] truncate font-normal">
              <ChipValue filterKey={filterKey} values={values} categories={categories} panels={panels} />
            </span>
          )}
          <ChevronDownIcon className="size-3.5 shrink-0 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 gap-0 p-2">
        <div className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
          <Icon className="size-3.5" />
          {t(meta.labelKey)}
        </div>
        {isText && (
          <TextEditor
            value={draft}
            onChange={setDraft}
            onSubmit={() => handleOpenChange(false)}
            numeric={filterKey === "number"}
            placeholder={t(
              filterKey === "owner"
                ? "modules.tickets.filters.ownerPlaceholder"
                : filterKey === "staff"
                  ? "modules.tickets.filters.staffPlaceholder"
                  : "modules.tickets.filters.numberPlaceholder"
            )}
          />
        )}
        {filterKey === "status" && (
          <StatusEditor
            value={values.status}
            onChange={(v) => {
              onChange({ status: v })
              setOpen(false)
            }}
          />
        )}
        {filterKey === "category" && (
          <CategoryEditor
            categories={categories}
            value={values.category}
            onChange={(v) => {
              onChange({ category: v })
              setOpen(false)
            }}
          />
        )}
        {filterKey === "panel" && (
          <PanelEditor
            panels={panels}
            value={values.panel}
            onChange={(v) => {
              onChange({ panel: v })
              setOpen(false)
            }}
          />
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

export function TicketFilterChips({
  activeKeys,
  values,
  categories,
  panels,
  availableKeys,
  pendingKey,
  onChange,
  onRemove,
  onAdd,
}: {
  activeKeys: TicketFilterKey[]
  values: TicketFilterValues
  categories: { id: string; name: string; panelName: string }[]
  panels: { id: string; name: string }[]
  /** Filtres proposables dans ce contexte (dépend du statut — voir `ticket-filters.ts`). */
  availableKeys: TicketFilterKey[]
  /** Filtre fraîchement ajouté dont il faut ouvrir l'éditeur. */
  pendingKey: TicketFilterKey | null
  onChange: (patch: TicketFilterValues) => void
  onRemove: (key: TicketFilterKey) => void
  onAdd: (key: TicketFilterKey) => void
}) {
  const { t } = useTranslation()
  const addableKeys = availableKeys.filter((k) => !activeKeys.includes(k))

  return (
    <div className="flex flex-wrap items-center gap-2">
      {activeKeys.map((key) => (
        <FilterChip
          key={key}
          filterKey={key}
          values={values}
          categories={categories}
          panels={panels}
          autoOpen={pendingKey === key}
          onChange={onChange}
          onRemove={() => onRemove(key)}
        />
      ))}
      {addableKeys.length > 0 && (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <PlusIcon className="size-3.5" />
              {t("cases.filters.add")}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            {addableKeys.map((key) => {
              const Icon = TICKET_FILTER_META[key].icon
              return (
                <DropdownMenuItem key={key} onSelect={() => onAdd(key)}>
                  <Icon className="size-4" />
                  {t(TICKET_FILTER_META[key].labelKey)}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
