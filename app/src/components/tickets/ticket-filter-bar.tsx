import { useTranslation } from "react-i18next"
import type { TicketStatus } from "@/types/api"
import {
  AddFilterMenu,
  FilterChipShell,
  FilterOptionList,
  ResolvedName,
} from "./filter-primitives"
import {
  TICKET_FILTER_META,
  hasTicketFilterValue,
  type TicketFilterKey,
  type TicketFilterValues,
} from "./ticket-filters"

// Barre de filtres du fil ticket + archives fusionné, sur le même modèle en
// chips que `case-filter-bar.tsx`. Toute la mécanique (popover, ouverture
// différée, retrait d'un chip fermé sans valeur) vit dans
// `filter-primitives.tsx` — ici il ne reste que ce qui est propre aux tickets :
// quels filtres existent et comment s'éditent leurs valeurs.
//
// `availableKeys` dépend de `status` côté appelant — `panel` n'a de sens que
// pour les tickets vivants, `staff`/`number` que pour les archives (voir
// `ticket-filters.ts`). Ce composant reste ignorant de cette règle, il affiche
// simplement ce qu'on lui donne le droit de proposer.

const TEXT_KEYS: TicketFilterKey[] = ["owner", "staff", "number"]

export interface TicketCategoryOption {
  id: string
  name: string
  panelName: string
}

export interface TicketPanelOption {
  id: string
  name: string
}

function ChipValue({
  filterKey,
  values,
  categories,
  panels,
}: {
  filterKey: TicketFilterKey
  values: TicketFilterValues
  categories: TicketCategoryOption[]
  panels: TicketPanelOption[]
}) {
  const { t } = useTranslation()
  switch (filterKey) {
    case "status":
      return values.status ? <>{t(`modules.tickets.filters.${values.status}`)}</> : null
    case "category": {
      const category = categories.find((c) => c.id === values.category)
      return category ? <>{category.name || category.id}</> : null
    }
    case "owner":
      return values.owner ? <ResolvedName id={values.owner} /> : null
    case "staff":
      return values.staff ? <ResolvedName id={values.staff} /> : null
    case "panel": {
      const panel = panels.find((p) => p.id === values.panel)
      return panel ? <>{panel.name || panel.id}</> : null
    }
    case "number":
      return values.number ? <>#{values.number}</> : null
  }
}

function TicketFilterChip({
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
  categories: TicketCategoryOption[]
  panels: TicketPanelOption[]
  autoOpen: boolean
  onChange: (patch: TicketFilterValues) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const meta = TICKET_FILTER_META[filterKey]
  const isText = TEXT_KEYS.includes(filterKey)
  const currentText =
    filterKey === "owner" ? values.owner : filterKey === "staff" ? values.staff : values.number

  return (
    <FilterChipShell
      icon={meta.icon}
      label={t(meta.labelKey)}
      filled={hasTicketFilterValue(filterKey, values)}
      valueNode={
        <ChipValue
          filterKey={filterKey}
          values={values}
          categories={categories}
          panels={panels}
        />
      }
      autoOpen={autoOpen}
      onRemove={onRemove}
      text={
        isText
          ? {
              value: currentText ?? "",
              numeric: filterKey === "number",
              placeholder: t(
                filterKey === "owner"
                  ? "modules.tickets.filters.ownerPlaceholder"
                  : filterKey === "staff"
                    ? "modules.tickets.filters.staffPlaceholder"
                    : "modules.tickets.filters.numberPlaceholder"
              ),
              onCommit: (value) =>
                onChange(
                  filterKey === "owner"
                    ? { owner: value }
                    : filterKey === "staff"
                      ? { staff: value }
                      : { number: value }
                ),
            }
          : undefined
      }
    >
      {(close) => {
        if (filterKey === "status") {
          return (
            <FilterOptionList
              options={(["open", "closed"] as TicketStatus[]).map((status) => ({
                value: status,
                label: t(`modules.tickets.filters.${status}`),
                dotClassName: status === "open" ? "bg-emerald-500" : "bg-muted-foreground/50",
              }))}
              value={values.status}
              emptyLabel=""
              onSelect={(value) => {
                onChange({ status: value as TicketStatus })
                close()
              }}
            />
          )
        }
        if (filterKey === "category") {
          return (
            <FilterOptionList
              options={categories.map((category) => ({
                value: category.id,
                label: category.name || category.id,
                sublabel: category.panelName,
              }))}
              value={values.category}
              emptyLabel={t("modules.tickets.filters.noCategory")}
              onSelect={(value) => {
                onChange({ category: value })
                close()
              }}
            />
          )
        }
        return (
          <FilterOptionList
            options={panels.map((panel) => ({ value: panel.id, label: panel.name || panel.id }))}
            value={values.panel}
            emptyLabel={t("modules.tickets.filters.noPanel")}
            onSelect={(value) => {
              onChange({ panel: value })
              close()
            }}
          />
        )
      }}
    </FilterChipShell>
  )
}

/** Menu « ajouter un filtre » des tickets — sert aussi de bouton de barre d'outils. */
export function TicketAddFilterMenu({
  keys,
  onAdd,
  children,
}: {
  keys: TicketFilterKey[]
  onAdd: (key: TicketFilterKey) => void
  children?: React.ReactNode
}) {
  return (
    <AddFilterMenu keys={keys} meta={TICKET_FILTER_META} onAdd={onAdd}>
      {children}
    </AddFilterMenu>
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
  /** `false` quand la barre d'outils porte déjà un bouton « Filtres ». */
  showAddButton = true,
}: {
  activeKeys: TicketFilterKey[]
  values: TicketFilterValues
  categories: TicketCategoryOption[]
  panels: TicketPanelOption[]
  /** Filtres proposables dans ce contexte (dépend du statut — voir `ticket-filters.ts`). */
  availableKeys: TicketFilterKey[]
  /** Filtre fraîchement ajouté dont il faut ouvrir l'éditeur. */
  pendingKey: TicketFilterKey | null
  onChange: (patch: TicketFilterValues) => void
  onRemove: (key: TicketFilterKey) => void
  onAdd: (key: TicketFilterKey) => void
  showAddButton?: boolean
}) {
  const addableKeys = availableKeys.filter((k) => !activeKeys.includes(k))

  if (activeKeys.length === 0 && !showAddButton) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {activeKeys.map((key) => (
        <TicketFilterChip
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
      {showAddButton && addableKeys.length > 0 && (
        <TicketAddFilterMenu keys={addableKeys} onAdd={onAdd} />
      )}
    </div>
  )
}
