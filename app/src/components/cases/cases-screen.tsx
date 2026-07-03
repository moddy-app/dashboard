import * as React from "react"

import { useCasesList } from "@/hooks/useCasesList"
import { useCasesMeta } from "@/hooks/useCasesMeta"
import type { CaseListItem, CasesQuery } from "@/services/cases-types"
import { CaseList } from "./case-list"
import { CaseFilters, type FilterField } from "./case-filters"

export function CasesScreen({
  title,
  description,
  headerExtra,
  actions,
  baseQuery,
  filterFields = ["status", "action"],
  buildTo,
  showSubject = true,
  showScope = false,
  emptyTitle,
  emptyHint,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  headerExtra?: React.ReactNode
  actions?: React.ReactNode
  baseQuery: CasesQuery
  filterFields?: FilterField[]
  buildTo: (item: CaseListItem) => string
  showSubject?: boolean
  showScope?: boolean
  emptyTitle?: string
  emptyHint?: string
}) {
  const [filters, setFilters] = React.useState<CasesQuery>({})
  const { meta } = useCasesMeta()

  // baseQuery figé (contraintes de périmètre) fusionné aux filtres UI.
  const baseKey = JSON.stringify(baseQuery)
  const query = React.useMemo<CasesQuery>(
    () => ({ ...baseQuery, ...filters }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseKey, filters]
  )

  const list = useCasesList(query)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {headerExtra}
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>

        {filterFields.length > 0 && (
          <CaseFilters
            className="mt-4"
            value={filters}
            onChange={setFilters}
            meta={meta}
            fields={filterFields}
          />
        )}
      </div>

      <CaseList
        items={list.items}
        status={list.status}
        error={list.error}
        hasMore={list.hasMore}
        loadingMore={list.loadingMore}
        loadMore={list.loadMore}
        buildTo={buildTo}
        showSubject={showSubject}
        showScope={showScope}
        emptyTitle={emptyTitle}
        emptyHint={emptyHint}
      />
    </div>
  )
}
