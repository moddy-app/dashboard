import { useTranslation } from "react-i18next"
import { TICKET_RATING_TRIGGERS } from "@/types/transcripts"
import { AddFilterMenu, FilterChipShell, FilterOptionList, ResolvedName } from "./filter-primitives"
import {
  RATING_FILTER_META,
  RATING_WINDOWS,
  hasRatingFilterValue,
  type RatingFilterKey,
  type RatingFilterValues,
} from "./rating-filters"

// Barre de filtres de l'onglet Avis, sur le même modèle en chips que
// `ticket-filter-bar.tsx` — toute la mécanique (popover, ouverture différée,
// retrait d'un chip fermé sans valeur) vit dans `filter-primitives.tsx`, ici il
// ne reste que ce qui est propre aux avis.

export interface RatingCategoryOption {
  id: string
  name: string
  panelName: string
}

function ChipValue({
  filterKey,
  values,
  categories,
}: {
  filterKey: RatingFilterKey
  values: RatingFilterValues
  categories: RatingCategoryOption[]
}) {
  const { t } = useTranslation()
  switch (filterKey) {
    case "window":
      return values.window ? (
        <>{t("modules.tickets.ratings.window", { days: values.window })}</>
      ) : null
    case "score":
      return values.score ? <>{t("modules.tickets.ratings.negativeOnly")}</> : null
    case "trigger":
      return values.trigger ? (
        <>{t(`modules.tickets.ratings.triggers.${values.trigger}`)}</>
      ) : null
    case "category": {
      const category = categories.find((c) => c.id === values.category)
      return category ? <>{category.name || category.id}</> : null
    }
    case "staff":
      return values.staff ? <ResolvedName id={values.staff} /> : null
  }
}

function RatingFilterChip({
  filterKey,
  values,
  categories,
  autoOpen,
  onChange,
  onRemove,
}: {
  filterKey: RatingFilterKey
  values: RatingFilterValues
  categories: RatingCategoryOption[]
  autoOpen: boolean
  onChange: (patch: RatingFilterValues) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const meta = RATING_FILTER_META[filterKey]

  return (
    <FilterChipShell
      icon={meta.icon}
      label={t(meta.labelKey)}
      filled={hasRatingFilterValue(filterKey, values)}
      valueNode={<ChipValue filterKey={filterKey} values={values} categories={categories} />}
      autoOpen={autoOpen}
      onRemove={onRemove}
      text={
        filterKey === "staff"
          ? {
              value: values.staff ?? "",
              placeholder: t("modules.tickets.ratings.filters.staffPlaceholder"),
              onCommit: (value) => onChange({ staff: value }),
            }
          : undefined
      }
    >
      {(close) => {
        if (filterKey === "window") {
          return (
            <FilterOptionList
              options={RATING_WINDOWS.map((days) => ({
                value: String(days),
                label: t("modules.tickets.ratings.window", { days }),
              }))}
              value={values.window !== undefined ? String(values.window) : undefined}
              emptyLabel=""
              onSelect={(value) => {
                onChange({ window: Number(value) })
                close()
              }}
            />
          )
        }
        if (filterKey === "score") {
          // Seule valeur exploitable côté API aujourd'hui : « négatifs
          // seulement » (`max_score: 2`). Jamais de `n/5` — la personne qui
          // note n'a jamais vu de chiffre, et l'API ne filtre pas par
          // appréciation précise.
          return (
            <FilterOptionList
              options={[
                {
                  value: "negative",
                  label: t("modules.tickets.ratings.negativeOnly"),
                  dotClassName: "bg-amber-500",
                },
              ]}
              value={values.score}
              emptyLabel=""
              onSelect={() => {
                onChange({ score: "negative" })
                close()
              }}
            />
          )
        }
        if (filterKey === "trigger") {
          return (
            <FilterOptionList
              options={TICKET_RATING_TRIGGERS.map((value) => ({
                value,
                label: t(`modules.tickets.ratings.triggers.${value}`),
              }))}
              value={values.trigger}
              emptyLabel=""
              onSelect={(value) => {
                onChange({ trigger: value as RatingFilterValues["trigger"] })
                close()
              }}
            />
          )
        }
        // category
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
      }}
    </FilterChipShell>
  )
}

/** Menu « ajouter un filtre » des avis — sert aussi de bouton de barre d'outils. */
export function RatingAddFilterMenu({
  keys,
  onAdd,
  children,
}: {
  keys: RatingFilterKey[]
  onAdd: (key: RatingFilterKey) => void
  children?: React.ReactNode
}) {
  return (
    <AddFilterMenu keys={keys} meta={RATING_FILTER_META} onAdd={onAdd}>
      {children}
    </AddFilterMenu>
  )
}

export function RatingFilterChips({
  activeKeys,
  values,
  categories,
  availableKeys,
  pendingKey,
  onChange,
  onRemove,
  onAdd,
  /** `false` quand la barre d'outils porte déjà un bouton « Filtres ». */
  showAddButton = true,
}: {
  activeKeys: RatingFilterKey[]
  values: RatingFilterValues
  categories: RatingCategoryOption[]
  availableKeys: RatingFilterKey[]
  /** Filtre fraîchement ajouté dont il faut ouvrir l'éditeur. */
  pendingKey: RatingFilterKey | null
  onChange: (patch: RatingFilterValues) => void
  onRemove: (key: RatingFilterKey) => void
  onAdd: (key: RatingFilterKey) => void
  showAddButton?: boolean
}) {
  const addableKeys = availableKeys.filter((k) => !activeKeys.includes(k))

  if (activeKeys.length === 0 && !showAddButton) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {activeKeys.map((key) => (
        <RatingFilterChip
          key={key}
          filterKey={key}
          values={values}
          categories={categories}
          autoOpen={pendingKey === key}
          onChange={onChange}
          onRemove={() => onRemove(key)}
        />
      ))}
      {showAddButton && addableKeys.length > 0 && (
        <RatingAddFilterMenu keys={addableKeys} onAdd={onAdd} />
      )}
    </div>
  )
}
