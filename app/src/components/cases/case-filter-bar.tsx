import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  ChevronDownIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { ACTION_META, actionTone, FILTER_ACCENT_CHIP } from "@/lib/cases"
import { useUserProfile } from "@/hooks/useProfile"
import type { CaseStatus, SanctionAction } from "@/types/cases"
import {
  FILTER_META,
  hasValue,
  DATE_PRESETS,
  datePresetRange,
  type CaseFilterValues,
  type DatePreset,
  type FilterKey,
} from "./case-filters"

// ─── Résolution de nom (sujet / auteur) ───────────────────────────────────────

function ResolvedName({ id }: { id: string }) {
  const { data } = useUserProfile(id)
  return <>{data?.display_name ?? id}</>
}

// ─── Éditeurs par type de filtre ──────────────────────────────────────────────

function IdEditor({
  value,
  onChange,
  onSubmit,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  placeholder: string
}) {
  return (
    <Input
      autoFocus
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSubmit()
      }}
      placeholder={placeholder}
      className="h-8 font-mono text-xs"
    />
  )
}

function StatusEditor({
  value,
  onChange,
}: {
  value: CaseStatus | undefined
  onChange: (v: CaseStatus) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1">
      {(["open", "closed"] as CaseStatus[]).map((s) => (
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
              s === "open" ? "bg-green-500" : "bg-muted-foreground/50"
            )}
          />
          {t(`cases.status.${s}`)}
        </button>
      ))}
    </div>
  )
}

function ActionEditor({
  actions,
  value,
  onChange,
}: {
  actions: SanctionAction[]
  value: SanctionAction | undefined
  onChange: (v: SanctionAction) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1">
      {actions.map((a) => {
        const Icon = ACTION_META[a].icon
        const tone = actionTone(a)
        return (
          <button
            key={a}
            type="button"
            onClick={() => onChange(a)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
              value === a ? "bg-accent text-accent-foreground" : "hover:bg-muted"
            )}
          >
            <Icon className={cn("size-3.5", tone.text)} />
            {t(`cases.action.${a}`)}
          </button>
        )
      })}
    </div>
  )
}

/** Date ISO → valeur d'input `date` (yyyy-mm-dd). */
function isoToDate(iso: string | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10)
}

function DateEditor({
  since,
  until,
  preset,
  onChange,
  onPreset,
}: {
  since: string | undefined
  until: string | undefined
  preset: DatePreset | undefined
  onChange: (patch: { since?: string; until?: string; datePreset?: DatePreset }) => void
  onPreset: (p: DatePreset) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        {DATE_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPreset(p)}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
              preset === p ? "bg-accent text-accent-foreground" : "hover:bg-muted"
            )}
          >
            {t(`cases.filters.datePreset.${p}`)}
          </button>
        ))}
      </div>
      <div className="mt-1 border-t pt-2">
        <p className="mb-1 px-1 text-xs font-medium text-muted-foreground">{t("cases.filters.custom")}</p>
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t("cases.filters.dateFrom")}
            <input
              type="date"
              value={isoToDate(since)}
              onChange={(e) =>
                onChange({
                  since: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                  datePreset: undefined,
                })
              }
              className="h-8 rounded-md border border-input bg-input/30 px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t("cases.filters.dateTo")}
            <input
              type="date"
              value={isoToDate(until)}
              onChange={(e) => {
                const v = e.target.value
                onChange({
                  until: v ? new Date(`${v}T23:59:59`).toISOString() : undefined,
                  datePreset: undefined,
                })
              }}
              className="h-8 rounded-md border border-input bg-input/30 px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </label>
        </div>
      </div>
    </div>
  )
}

// ─── Valeur affichée dans le chip ─────────────────────────────────────────────

function ChipValue({ filterKey, values }: { filterKey: FilterKey; values: CaseFilterValues }) {
  const { t, i18n } = useTranslation()
  switch (filterKey) {
    case "subject":
      return values.subject ? <ResolvedName id={values.subject} /> : null
    case "issuer":
      return values.issuer ? <ResolvedName id={values.issuer} /> : null
    case "status":
      return values.status ? <>{t(`cases.status.${values.status}`)}</> : null
    case "action":
      return values.action ? <>{t(`cases.action.${values.action}`)}</> : null
    case "date": {
      if (values.datePreset) return <>{t(`cases.filters.datePreset.${values.datePreset}`)}</>
      const fmt = (iso?: string) =>
        iso ? new Date(iso).toLocaleDateString(i18n.language, { day: "2-digit", month: "short" }) : "…"
      if (!values.since && !values.until) return null
      return <>{`${fmt(values.since)} – ${fmt(values.until)}`}</>
    }
  }
}

// ─── Chip individuel (label bleu + popover d'édition) ─────────────────────────

function FilterChip({
  filterKey,
  values,
  actions,
  autoOpen,
  onChange,
  onRemove,
}: {
  filterKey: FilterKey
  values: CaseFilterValues
  actions: SanctionAction[]
  autoOpen: boolean
  onChange: (patch: CaseFilterValues) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(autoOpen)
  const meta = FILTER_META[filterKey]
  const Icon = meta.icon
  const filled = hasValue(filterKey, values)
  const isId = filterKey === "subject" || filterKey === "issuer"

  // Brouillon local pour les filtres ID : évite toute lecture de state périmé à
  // la fermeture (commit synchrone du texte saisi).
  const currentId = filterKey === "subject" ? values.subject : filterKey === "issuer" ? values.issuer : ""
  const [idDraft, setIdDraft] = useState(currentId ?? "")

  const handleOpenChange = (o: boolean) => {
    if (o) {
      setIdDraft(currentId ?? "")
      setOpen(true)
      return
    }
    setOpen(false)
    if (isId) {
      const v = idDraft.trim()
      if (v) onChange(filterKey === "subject" ? { subject: v } : { issuer: v })
      else onRemove()
    } else if (!hasValue(filterKey, values)) {
      // Fermeture sans valeur → on retire le filtre (règle « rien configuré = supprimé »).
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
          <span className="font-semibold">{t(meta.labelKey)}</span>
          {filled && (
            <>
              <span className="font-semibold">:</span>
              <span className="max-w-[10rem] truncate font-normal">
                <ChipValue filterKey={filterKey} values={values} />
              </span>
            </>
          )}
          <ChevronDownIcon className="size-3.5 shrink-0 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <div className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
          <Icon className="size-3.5" />
          {t(meta.labelKey)}
        </div>
        {isId && (
          <IdEditor
            value={idDraft}
            onChange={setIdDraft}
            onSubmit={() => handleOpenChange(false)}
            placeholder={t("cases.filters.idPlaceholder")}
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
        {filterKey === "action" && (
          <ActionEditor
            actions={actions}
            value={values.action}
            onChange={(v) => {
              onChange({ action: v })
              setOpen(false)
            }}
          />
        )}
        {filterKey === "date" && (
          <DateEditor
            since={values.since}
            until={values.until}
            preset={values.datePreset}
            onChange={onChange}
            onPreset={(p) => {
              onChange({ ...datePresetRange(p), datePreset: p })
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

// ─── Menu « ajouter un filtre » (liste des filtres non utilisés) ──────────────

export function AddFilterMenu({
  addableKeys,
  onAdd,
  children,
}: {
  addableKeys: FilterKey[]
  onAdd: (key: FilterKey) => void
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        {addableKeys.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">{t("cases.filters.allUsed")}</div>
        ) : (
          addableKeys.map((key) => {
            const Icon = FILTER_META[key].icon
            return (
              <DropdownMenuItem key={key} onSelect={() => onAdd(key)}>
                <Icon className="size-4" />
                {t(FILTER_META[key].labelKey)}
              </DropdownMenuItem>
            )
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─── Rangée de chips ──────────────────────────────────────────────────────────

export function CaseFilterChips({
  activeKeys,
  values,
  availableKeys,
  actions,
  pendingKey,
  onChange,
  onRemove,
  onAdd,
  onPendingHandled,
}: {
  activeKeys: FilterKey[]
  values: CaseFilterValues
  availableKeys: FilterKey[]
  actions: SanctionAction[]
  /** Filtre fraîchement ajouté dont il faut ouvrir l'éditeur. */
  pendingKey: FilterKey | null
  onChange: (patch: CaseFilterValues) => void
  onRemove: (key: FilterKey) => void
  onAdd: (key: FilterKey) => void
  onPendingHandled: () => void
}) {
  const { t } = useTranslation()
  const addableKeys = availableKeys.filter((k) => !activeKeys.includes(k))

  // Évite de ré-ouvrir en boucle : on consomme le pending au premier rendu.
  const handledRef = useRef<FilterKey | null>(null)
  useEffect(() => {
    if (pendingKey && handledRef.current !== pendingKey) {
      handledRef.current = pendingKey
      onPendingHandled()
    }
  }, [pendingKey, onPendingHandled])

  if (activeKeys.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {activeKeys.map((key) => (
        <FilterChip
          key={key}
          filterKey={key}
          values={values}
          actions={actions}
          autoOpen={pendingKey === key}
          onChange={onChange}
          onRemove={() => onRemove(key)}
        />
      ))}
      {addableKeys.length > 0 && (
        <AddFilterMenu addableKeys={addableKeys} onAdd={onAdd}>
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <PlusIcon className="size-3.5" />
            {t("cases.filters.add")}
          </button>
        </AddFilterMenu>
      )}
    </div>
  )
}
