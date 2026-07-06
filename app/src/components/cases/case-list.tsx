import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  SearchIcon,
  CircleDotIcon,
  CheckCircle2Icon,
  LoaderIcon,
  RefreshCwIcon,
  ScaleIcon,
  ListFilterIcon,
  CheckSquareIcon,
  XIcon,
  CopyIcon,
  ArrowUpRightIcon,
  LockIcon,
  UnlockIcon,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { getCases, patchCase } from "@/services/cases"
import { relativeTime, absoluteTime, copyText, FILTER_ACCENT_BUTTON } from "@/lib/cases"
import { cn } from "@/lib/utils"
import { useCasesMeta } from "@/hooks/useCasesMeta"
import type { CaseFilters, CaseListItem, SanctionAction } from "@/types/cases"
import { SANCTION_ACTIONS } from "@/types/cases"
import { CaseReference, CaseTypeBadge, ActionChip } from "./case-badges"
import { EntityRef, type EntityKind } from "./entity-ref"
import { AddFilterMenu, CaseFilterChips } from "./case-filter-bar"
import {
  ALL_FILTER_KEYS,
  countFilters,
  filterValuesToApi,
  type CaseFilterValues,
  type FilterKey,
} from "./case-filters"

const PAGE_SIZE = 50

interface CaseListProps {
  /** Filtres de base définissant le périmètre (sujet, scope…) — non modifiables par l'UI. */
  baseFilters: CaseFilters
  onOpen: (reference: string) => void
  /** Affiche le sujet (masqué dans la vue personnelle). */
  showSubject?: boolean
  /** Affiche le type de case (utile seulement quand il n'est pas évident — ex. staff). */
  showType?: boolean
  /** Staff modérateur → active la sélection de masse et les actions rapides d'écriture. */
  canModerate?: boolean
  /** Contenu additionnel dans la barre d'outils (ex. bouton « nouveau case »). */
  toolbarExtra?: React.ReactNode
  emptyTitle?: string
  emptyDescription?: string
}

// ─── Séparateur (point) ────────────────────────────────────────────────────────

function Dot() {
  return <span className="size-1 shrink-0 rounded-full bg-current opacity-40" />
}

// ─── Ligne (façon Linear) ────────────────────────────────────────────────────

function CaseRow({
  item,
  showSubject,
  showType,
  massMode,
  selected,
  canModerate,
  onOpen,
  onToggleSelect,
  onCopyRef,
  onToggleStatus,
}: {
  item: CaseListItem
  showSubject: boolean
  showType: boolean
  massMode: boolean
  selected: boolean
  canModerate: boolean
  onOpen: (ref: string) => void
  onToggleSelect: (ref: string) => void
  onCopyRef: (ref: string) => void
  onToggleStatus: (item: CaseListItem) => void
}) {
  const { t, i18n } = useTranslation()
  const open = item.status === "open"
  const uniqueActions = Array.from(new Set(item.actions)) as SanctionAction[]

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          onClick={() => (massMode ? onToggleSelect(item.reference) : onOpen(item.reference))}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              if (massMode) onToggleSelect(item.reference)
              else onOpen(item.reference)
            }
          }}
          className={cn(
            "group flex items-center gap-3 px-3 py-2.5 sm:px-4 cursor-pointer transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:bg-muted/50",
            selected && "bg-blue-50/60 dark:bg-blue-950/30"
          )}
        >
          {massMode && (
            <span onClick={(e) => e.stopPropagation()} className="flex shrink-0 items-center">
              <Checkbox
                checked={selected}
                onCheckedChange={() => onToggleSelect(item.reference)}
                aria-label={t("cases.mass.selectOne")}
              />
            </span>
          )}

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
            <p className="truncate text-sm font-medium">{item.reason}</p>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CaseReference reference={item.reference} />
              {showType && (
                <>
                  <Dot />
                  <CaseTypeBadge type={item.type} />
                </>
              )}
              {showSubject && (
                <>
                  <Dot />
                  <span className="hidden min-w-0 sm:inline-flex">
                    <EntityRef
                      kind={item.subject_type as EntityKind}
                      id={item.subject_id}
                      variant="inline"
                    />
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
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => onOpen(item.reference)}>
          <ArrowUpRightIcon />
          {t("cases.row.openCase")}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onCopyRef(item.reference)}>
          <CopyIcon />
          {t("cases.row.copyReference")}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => copyText(item.subject_id).then(() => toast.success(t("cases.row.copied")))}>
          <CopyIcon />
          {t("cases.row.copySubjectId")}
        </ContextMenuItem>
        {canModerate && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => onToggleStatus(item)}>
              {open ? <LockIcon /> : <UnlockIcon />}
              {open ? t("cases.detail.close") : t("cases.detail.reopen")}
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

// ─── Bouton d'outil (icône + tooltip) ─────────────────────────────────────────

function ToolbarIconButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onClick}
          aria-label={label}
          className={cn("size-9 shrink-0", active && FILTER_ACCENT_BUTTON)}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

// ─── Liste ─────────────────────────────────────────────────────────────────────

export function CaseList({
  baseFilters,
  onOpen,
  showSubject = true,
  showType = false,
  canModerate = false,
  toolbarExtra,
  emptyTitle,
  emptyDescription,
}: CaseListProps) {
  const { t } = useTranslation()
  const { meta } = useCasesMeta()
  const [items, setItems] = useState<CaseListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  const [search, setSearch] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")

  // Filtres UI
  const [filterValues, setFilterValues] = useState<CaseFilterValues>({})
  const [activeKeys, setActiveKeys] = useState<FilterKey[]>([])
  const [pendingKey, setPendingKey] = useState<FilterKey | null>(null)

  // Sélection de masse (persiste à travers recherches/filtres)
  const [massMode, setMassMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkConfirm, setBulkConfirm] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)

  const actions = (meta?.enums.sanction_action ?? [...SANCTION_ACTIONS]) as SanctionAction[]

  // Filtres disponibles : on retire ceux déjà imposés par le périmètre.
  const availableKeys = useMemo(
    () => ALL_FILTER_KEYS.filter((k) => !(k === "subject" && baseFilters.subject_id)),
    [baseFilters.subject_id]
  )

  const baseKey = JSON.stringify(baseFilters)
  const filterKey = JSON.stringify(filterValues)

  // Debounce de la recherche texte (server-side via ?q=).
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(search.trim()), 350)
    return () => clearTimeout(id)
  }, [search])

  const buildFilters = useCallback(
    (offset: number): CaseFilters => ({
      ...baseFilters,
      ...filterValuesToApi(filterValues),
      ...(debouncedQ ? { q: debouncedQ } : {}),
      limit: PAGE_SIZE,
      offset,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseKey, filterKey, debouncedQ]
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

  const loadMore = useCallback(async () => {
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
  }, [buildFilters, items.length])

  // Scroll infini : sentinelle en bas de liste.
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || loading || loadingMore || !hasMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { rootMargin: "200px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loading, loadingMore, hasMore, loadMore])

  // ── Filtres ────────────────────────────────────────────────────────────────
  const addFilter = (key: FilterKey) => {
    if (!activeKeys.includes(key)) setActiveKeys((prev) => [...prev, key])
    setPendingKey(key)
  }
  const removeFilter = (key: FilterKey) => {
    setActiveKeys((prev) => prev.filter((k) => k !== key))
    setFilterValues((prev) => {
      const next = { ...prev }
      if (key === "subject") delete next.subject
      if (key === "issuer") delete next.issuer
      if (key === "status") delete next.status
      if (key === "action") delete next.action
      if (key === "date") {
        delete next.since
        delete next.until
      }
      return next
    })
  }
  const patchFilter = (patch: CaseFilterValues) =>
    setFilterValues((prev) => ({ ...prev, ...patch }))

  const filterCount = countFilters(filterValues, availableKeys)

  // ── Sélection de masse ───────────────────────────────────────────────────────
  const toggleSelect = (ref: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(ref)) next.delete(ref)
      else next.add(ref)
      return next
    })
  const clearSelection = () => setSelected(new Set())
  const exitMassMode = () => {
    setMassMode(false)
    clearSelection()
  }

  const runBulkStatus = async (status: "open" | "closed") => {
    const refs = Array.from(selected)
    setBulkBusy(true)
    const results = await Promise.allSettled(refs.map((ref) => patchCase(ref, { status })))
    const ok = results.filter((r) => r.status === "fulfilled").length
    setBulkBusy(false)
    setBulkConfirm(false)
    if (ok > 0) toast.success(t("cases.mass.done", { count: ok }))
    if (ok < refs.length) toast.error(t("cases.mass.partialError", { count: refs.length - ok }))
    clearSelection()
    load()
  }

  // Action rapide sur une case (context menu) — ouverture/fermeture.
  const quickToggleStatus = async (item: CaseListItem) => {
    const next = item.status === "open" ? "closed" : "open"
    try {
      await patchCase(item.reference, { status: next })
      setItems((prev) =>
        prev.map((c) => (c.id === item.id ? { ...c, status: next, status_locked: true } : c))
      )
      toast.success(next === "closed" ? t("cases.detail.closedSuccess") : t("cases.detail.reopenedSuccess"))
    } catch {
      toast.error(t("cases.detail.statusError"))
    }
  }

  const copyRef = (ref: string) => copyText(ref).then(() => toast.success(t("cases.row.copied")))

  return (
    <div className="flex flex-col gap-3">
      {/* Barre d'outils */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("cases.list.searchPlaceholder")}
            className="pl-9"
          />
        </div>

        <ToolbarIconButton label={t("cases.toolbar.refresh")} onClick={load}>
          <RefreshCwIcon className={cn("size-4", loading && "animate-spin")} />
        </ToolbarIconButton>

        <AddFilterMenu
          addableKeys={availableKeys.filter((k) => !activeKeys.includes(k))}
          onAdd={addFilter}
        >
          <span>
            <ToolbarIconButton label={t("cases.toolbar.filter")} active={filterCount > 0}>
              <ListFilterIcon className="size-4" />
            </ToolbarIconButton>
          </span>
        </AddFilterMenu>

        {canModerate && (
          <ToolbarIconButton
            label={t("cases.toolbar.massAction")}
            active={massMode}
            onClick={() => (massMode ? exitMassMode() : setMassMode(true))}
          >
            {massMode ? <XIcon className="size-4" /> : <CheckSquareIcon className="size-4" />}
          </ToolbarIconButton>
        )}

        {toolbarExtra}
      </div>

      {/* Rangée de filtres actifs */}
      <CaseFilterChips
        activeKeys={activeKeys}
        values={filterValues}
        availableKeys={availableKeys}
        actions={actions}
        pendingKey={pendingKey}
        onChange={patchFilter}
        onRemove={removeFilter}
        onAdd={addFilter}
        onPendingHandled={() => setPendingKey(null)}
      />

      {/* Barre d'action de masse */}
      {massMode && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">
            {t("cases.mass.selectedCount", { count: selected.size })}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {canModerate && (
              <>
                <Button variant="outline" size="sm" onClick={() => runBulkStatus("open")} disabled={bulkBusy}>
                  <UnlockIcon className="size-3.5" />
                  {t("cases.mass.reopen")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setBulkConfirm(true)}
                  disabled={bulkBusy}
                >
                  <LockIcon className="size-3.5" />
                  {t("cases.mass.close")}
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={clearSelection} disabled={bulkBusy}>
              {t("cases.mass.clear")}
            </Button>
          </div>
        </div>
      )}

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
      ) : items.length === 0 ? (
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
        <>
          <div className="flex flex-col divide-y overflow-hidden rounded-xl border">
            {items.map((item) => (
              <CaseRow
                key={item.id}
                item={item}
                showSubject={showSubject}
                showType={showType}
                massMode={massMode}
                selected={selected.has(item.reference)}
                canModerate={canModerate}
                onOpen={onOpen}
                onToggleSelect={toggleSelect}
                onCopyRef={copyRef}
                onToggleStatus={quickToggleStatus}
              />
            ))}
          </div>

          {/* Sentinelle de scroll infini + indicateur */}
          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-3">
              <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </>
      )}

      {/* Confirmation d'action destructive de masse */}
      <AlertDialog open={bulkConfirm} onOpenChange={(o) => !bulkBusy && setBulkConfirm(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cases.mass.confirmCloseTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("cases.mass.confirmCloseDescription", { count: selected.size })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>{t("cases.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                runBulkStatus("closed")
              }}
              disabled={bulkBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkBusy && <LoaderIcon className="size-4 animate-spin mr-1.5" />}
              {t("cases.mass.close")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
