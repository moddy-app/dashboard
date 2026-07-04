import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  SearchIcon,
  CircleDotIcon,
  CheckCircle2Icon,
  LoaderIcon,
  RefreshCwIcon,
  ScaleIcon,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { getCases } from "@/services/cases"
import { relativeTime, absoluteTime } from "@/lib/cases"
import type { CaseFilters, CaseListItem, CaseStatus, SanctionAction } from "@/types/cases"
import { CaseReference, CaseTypeBadge, ActionChip } from "./case-badges"
import { EntityRef, type EntityKind } from "./entity-ref"

const PAGE_SIZE = 50

interface CaseListProps {
  /** Filtres de base définissant le périmètre (sujet, scope…) — non modifiables par l'UI. */
  baseFilters: CaseFilters
  onOpen: (reference: string) => void
  /** Affiche la colonne « sujet » (masquée dans la vue personnelle). */
  showSubject?: boolean
  /** Contenu additionnel dans la barre d'outils (ex. bouton « nouveau case »). */
  toolbarExtra?: React.ReactNode
  /** Message d'état vide personnalisé. */
  emptyTitle?: string
  emptyDescription?: string
}

// ─── Ligne (façon Linear) ────────────────────────────────────────────────────

function CaseRow({
  item,
  showSubject,
  onOpen,
}: {
  item: CaseListItem
  showSubject: boolean
  onOpen: (ref: string) => void
}) {
  const { t, i18n } = useTranslation()
  const open = item.status === "open"
  const uniqueActions = Array.from(new Set(item.actions)) as SanctionAction[]

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item.reference)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen(item.reference)
        }
      }}
      className="group flex items-center gap-3 px-3 py-2.5 sm:px-4 cursor-pointer transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:bg-muted/50"
    >
      {/* Indicateur de statut */}
      <span className="shrink-0" title={t(`cases.status.${item.status}`)}>
        {open ? (
          <CircleDotIcon className="size-4 text-green-500" />
        ) : (
          <CheckCircle2Icon className="size-4 text-muted-foreground/60" />
        )}
      </span>

      {/* Corps */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <p className="truncate text-sm font-medium">{item.reason}</p>
        </div>
        <div className="mt-0.5 flex items-center gap-2 min-w-0 text-xs text-muted-foreground">
          <CaseReference reference={item.reference} />
          <span className="text-muted-foreground/40">·</span>
          <CaseTypeBadge type={item.type} />
          {showSubject && (
            <>
              <span className="text-muted-foreground/40 hidden sm:inline">·</span>
              <span className="hidden min-w-0 sm:inline-flex">
                <EntityRef kind={item.subject_type as EntityKind} id={item.subject_id} variant="inline" />
              </span>
            </>
          )}
        </div>
      </div>

      {/* Actions + date */}
      <div className="flex shrink-0 items-center gap-2">
        <div className="hidden items-center gap-1 md:flex">
          {uniqueActions.slice(0, 3).map((a) => (
            <ActionChip key={a} action={a} size="xs" muted={!item.has_active} />
          ))}
        </div>
        <span
          className="w-14 text-right text-xs tabular-nums text-muted-foreground"
          title={absoluteTime(item.created_at, i18n.language)}
        >
          {relativeTime(item.created_at, i18n.language)}
        </span>
      </div>
    </div>
  )
}

// ─── Liste ─────────────────────────────────────────────────────────────────────

export function CaseList({
  baseFilters,
  onOpen,
  showSubject = true,
  toolbarExtra,
  emptyTitle,
  emptyDescription,
}: CaseListProps) {
  const { t } = useTranslation()
  const [items, setItems] = useState<CaseListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<CaseStatus | "all">("all")
  const [actionFilter, setActionFilter] = useState<SanctionAction | "all">("all")

  // Sérialise les filtres de base pour une dépendance stable.
  const baseKey = JSON.stringify(baseFilters)

  const buildFilters = useCallback(
    (offset: number): CaseFilters => ({
      ...baseFilters,
      ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      ...(actionFilter !== "all" ? { action: actionFilter } : {}),
      limit: PAGE_SIZE,
      offset,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseKey, statusFilter, actionFilter]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getCases(buildFilters(0))
      setItems(data)
      setHasMore(data.length === PAGE_SIZE)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load cases")
    } finally {
      setLoading(false)
    }
  }, [buildFilters])

  useEffect(() => {
    load()
  }, [load])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const data = await getCases(buildFilters(items.length))
      setItems((prev) => [...prev, ...data])
      setHasMore(data.length === PAGE_SIZE)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load cases")
    } finally {
      setLoadingMore(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (c) =>
        c.reference.toLowerCase().includes(q) ||
        c.reason.toLowerCase().includes(q) ||
        c.subject_id.includes(q)
    )
  }, [items, search])

  return (
    <div className="flex flex-col gap-4">
      {/* Barre d'outils */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("cases.list.searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CaseStatus | "all")}>
            <SelectTrigger className="w-[130px]" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("cases.list.statusAll")}</SelectItem>
              <SelectItem value="open">{t("cases.status.open")}</SelectItem>
              <SelectItem value="closed">{t("cases.status.closed")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as SanctionAction | "all")}>
            <SelectTrigger className="w-[130px]" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("cases.list.actionAll")}</SelectItem>
              {(["warn", "mute", "ban", "kick", "restrict", "revoke_access"] as SanctionAction[]).map((a) => (
                <SelectItem key={a} value={a}>
                  {t(`cases.action.${a}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {toolbarExtra}
        </div>
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="flex flex-col divide-y rounded-xl border">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="size-4 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-3 w-10" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCwIcon className="size-4 mr-1.5" />
            {t("errors.retry")}
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <Empty className="rounded-xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ScaleIcon />
            </EmptyMedia>
            <EmptyTitle>{emptyTitle ?? t("cases.list.emptyTitle")}</EmptyTitle>
            <EmptyDescription>{emptyDescription ?? t("cases.list.emptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col divide-y overflow-hidden rounded-xl border">
          {filtered.map((item) => (
            <CaseRow key={item.id} item={item} showSubject={showSubject} onOpen={onOpen} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && !search && hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
            {loadingMore && <LoaderIcon className="size-4 mr-1.5 animate-spin" />}
            {t("cases.list.loadMore")}
          </Button>
        </div>
      )}
    </div>
  )
}
