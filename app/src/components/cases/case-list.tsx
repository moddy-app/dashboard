import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { AlertCircleIcon, InboxIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import type { CaseListItem } from "@/services/cases-types"
import { CaseRow } from "./case-row"

const ROW_HEIGHT = 52

type Props = {
  items: CaseListItem[]
  status: "loading" | "success" | "error"
  error: Error | null
  hasMore: boolean
  loadingMore: boolean
  loadMore: () => void
  buildTo: (item: CaseListItem) => string
  showSubject?: boolean
  showScope?: boolean
  emptyTitle?: string
  emptyHint?: string
}

export function CaseList({
  items,
  status,
  error,
  hasMore,
  loadingMore,
  loadMore,
  buildTo,
  showSubject = true,
  showScope = false,
  emptyTitle = "Aucune case",
  emptyHint = "Aucune case ne correspond à ces critères.",
}: Props) {
  const parentRef = React.useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  })

  // Déclenche le chargement de la page suivante à l'approche du bas.
  const onScroll = React.useCallback(() => {
    const el = parentRef.current
    if (!el || !hasMore || loadingMore) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < ROW_HEIGHT * 8) {
      loadMore()
    }
  }, [hasMore, loadingMore, loadMore])

  if (status === "loading") {
    return (
      <div className="flex-1 overflow-hidden">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex h-[52px] items-center gap-3 border-b border-border px-4"
          >
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 flex-1 max-w-[240px]" />
            <Skeleton className="ml-auto size-5 rounded-full" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    )
  }

  if (status === "error") {
    return (
      <EmptyState
        icon={<AlertCircleIcon className="size-6 text-destructive" />}
        title="Chargement impossible"
        hint={error?.message ?? "Une erreur est survenue."}
      />
    )
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<InboxIcon className="size-6 text-muted-foreground" />}
        title={emptyTitle}
        hint={emptyHint}
      />
    )
  }

  return (
    <div
      ref={parentRef}
      onScroll={onScroll}
      className="flex-1 overflow-auto overscroll-contain"
    >
      <div
        style={{ height: virtualizer.getTotalSize() }}
        className="relative w-full"
      >
        {virtualizer.getVirtualItems().map((row) => {
          const item = items[row.index]
          return (
            <div
              key={item.id}
              className="absolute top-0 left-0 w-full"
              style={{ transform: `translateY(${row.start}px)` }}
            >
              <CaseRow
                case_={item}
                to={buildTo(item)}
                showSubject={showSubject}
                showScope={showScope}
              />
            </div>
          )
        })}
      </div>
      {loadingMore && (
        <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
          <Spinner className="size-3.5" />
          Chargement…
        </div>
      )}
      {!hasMore && items.length > 20 && (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Fin des résultats · {items.length} cases
        </p>
      )}
    </div>
  )
}

function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode
  title: string
  hint: string
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div
        className={cn(
          "flex size-12 items-center justify-center rounded-full border border-border bg-muted/40"
        )}
      >
        {icon}
      </div>
      <p className="mt-4 text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p>
    </div>
  )
}

/** Bouton « charger plus » explicite (fallback hors virtualisation). */
export function LoadMoreButton({
  hasMore,
  loadingMore,
  loadMore,
}: {
  hasMore: boolean
  loadingMore: boolean
  loadMore: () => void
}) {
  if (!hasMore) return null
  return (
    <div className="flex justify-center py-3">
      <Button
        variant="outline"
        size="sm"
        onClick={loadMore}
        disabled={loadingMore}
      >
        {loadingMore && <Spinner className="size-3.5" />}
        Charger plus
      </Button>
    </div>
  )
}
