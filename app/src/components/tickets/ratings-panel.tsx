import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ListFilterIcon,
  RefreshCwIcon,
  StarIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Notice } from "@/components/tickets/fields"
import { Dot, ListRow, MiniAvatar, RelativeTime, RowAvatar } from "@/components/tickets/row-primitives"
import { ToolbarIconButton } from "@/components/tickets/filter-primitives"
import { RatingFilterChips, RatingAddFilterMenu } from "@/components/tickets/rating-filter-bar"
import {
  RATING_FILTER_KEYS,
  ratingFilterValuesToApi,
  ratingWindowDays,
  type RatingFilterKey,
  type RatingFilterValues,
} from "@/components/tickets/rating-filters"
import { useUserProfile } from "@/hooks/useProfile"
import { cn } from "@/lib/utils"
import { logger } from "@/lib/logger"
import { isNegativeScore } from "@/lib/transcripts"
import { getTicketRatings, getTicketRatingsSummary } from "@/services/tickets"
import { TICKET_SCORE_KEYS } from "@/types/transcripts"
import type { TicketRating, TicketRatingsSummary, TicketStaffRating } from "@/types/transcripts"
import type { TicketPanel } from "@/types/api"

// Notes de satisfaction. Trois règles de lecture, portées par le code plutôt que
// par la mémoire de celui qui relit :
//
// 1. **L'appréciation, jamais `n/5`** — la fenêtre du bot ne montre que cinq
//    adjectifs, localisés et améliorés d'une version à l'autre. On rend
//    `score_key` depuis *nos* traductions ; `score` ne sert qu'à trier.
// 2. **`by_staff` arrive classé par volume** : ne jamais re-trier par moyenne,
//    un unique 5/5 ne doit pas devancer cinquante tickets. `low_sample` se
//    signale, il ne classe pas.
// 3. **Une ligne `ratings: 0, handled > 0` reste affichée** : `handled` vient
//    des archives, pas de la table `tickets` — la masquer ferait disparaître le
//    travail de quelqu'un.

const PAGE_SIZE = 25

export function RatingsPanel({ guildId, panels }: { guildId: string; panels: TicketPanel[] }) {
  const { t } = useTranslation()

  const [summary, setSummary] = useState<TicketRatingsSummary | null>(null)
  const [ratings, setRatings] = useState<TicketRating[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [activeKeys, setActiveKeys] = useState<RatingFilterKey[]>([])
  const [values, setValues] = useState<RatingFilterValues>({})
  const [pendingKey, setPendingKey] = useState<RatingFilterKey | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const categories = useMemo(
    () => panels.flatMap((p) => p.categories.map((c) => ({ ...c, panelName: p.name }))),
    [panels]
  )

  // `window` pilote aussi le résumé du serveur (`getTicketRatingsSummary`) :
  // le changer doit recharger le résumé **et** la liste, d'où le seul
  // `useCallback` qui porte les deux appels.
  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const days = ratingWindowDays(values)
      const filters = ratingFilterValuesToApi(values)
      const [summaryData, list] = await Promise.all([
        getTicketRatingsSummary(guildId, days),
        getTicketRatings(guildId, { ...filters, limit: PAGE_SIZE, offset }),
      ])
      setSummary(summaryData)
      setRatings(list.ratings)
      setTotal(list.total)
    } catch (e) {
      logger.error("module:tickets", "Ratings failed", e)
      setError(e instanceof Error ? e.message : "Failed to load ratings")
    } finally {
      setIsLoading(false)
    }
  }, [guildId, values, offset])

  useEffect(() => {
    load()
  }, [load])

  const addFilter = (key: RatingFilterKey) => {
    setActiveKeys((prev) => [...prev, key])
    setPendingKey(key)
  }

  const removeFilter = useCallback((key: RatingFilterKey) => {
    setActiveKeys((prev) => prev.filter((k) => k !== key))
    setValues((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setOffset(0)
  }, [])

  const changeFilter = (patch: RatingFilterValues) => {
    setValues((prev) => ({ ...prev, ...patch }))
    setOffset(0)
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1
  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1)
  const addableKeys = RATING_FILTER_KEYS.filter((k) => !activeKeys.includes(k))

  return (
    <div className="flex flex-col gap-5">
      {/* Barre d'outils — même motif que `case-list.tsx` : rafraîchir + menu de
          filtres en boutons icône, puis la rangée de chips actifs. */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <ToolbarIconButton label={t("cases.toolbar.refresh")} onClick={load}>
            <RefreshCwIcon className={cn("size-4", isLoading && "animate-spin")} />
          </ToolbarIconButton>
          <RatingAddFilterMenu keys={addableKeys} onAdd={addFilter}>
            <span>
              <ToolbarIconButton
                label={t("cases.toolbar.filter")}
                active={activeKeys.length > 0}
              >
                <ListFilterIcon className="size-4" />
              </ToolbarIconButton>
            </span>
          </RatingAddFilterMenu>
        </div>
        <RatingFilterChips
          activeKeys={activeKeys}
          values={values}
          categories={categories}
          availableKeys={RATING_FILTER_KEYS}
          pendingKey={pendingKey}
          onChange={changeFilter}
          onRemove={removeFilter}
          onAdd={addFilter}
          showAddButton={false}
        />
      </div>

      {error && (
        <Notice level="error" title={t("modules.tickets.ratings.loadError")}>
          {error}
        </Notice>
      )}

      {isLoading && !summary ? (
        <Skeleton className="h-56 rounded-xl" />
      ) : (
        summary && <SummaryCard summary={summary} />
      )}

      {summary && summary.by_staff.length > 0 && <StaffTable rows={summary.by_staff} />}

      <Separator />

      {/* ── Notes détaillées ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{t("modules.tickets.ratings.listTitle")}</h3>

        {isLoading && ratings.length === 0 ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ) : ratings.length === 0 ? (
          <Empty className="rounded-xl border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <StarIcon />
              </EmptyMedia>
              <EmptyTitle>{t("modules.tickets.ratings.empty")}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="divide-y rounded-xl border">
            {ratings.map((rating) => (
              <RatingRow key={rating.id} rating={rating} />
            ))}
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground tabular-nums">
              {t("modules.tickets.ratings.pagination", { page, pages, total })}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                disabled={offset === 0 || isLoading}
                onClick={() => setOffset(Math.max(offset - PAGE_SIZE, 0))}
              >
                <ChevronLeftIcon />
                <span className="sr-only">{t("modules.tickets.transcripts.previousPage")}</span>
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={offset + PAGE_SIZE >= total || isLoading}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                <ChevronRightIcon />
                <span className="sr-only">{t("modules.tickets.transcripts.nextPage")}</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Résumé du serveur ────────────────────────────────────────────────────────

function SummaryCard({ summary }: { summary: TicketRatingsSummary }) {
  const { t, i18n } = useTranslation()
  const { ratings, average, negative, distribution } = summary.guild

  if (ratings === 0) {
    return (
      <Empty className="rounded-xl border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <StarIcon />
          </EmptyMedia>
          <EmptyTitle>{t("modules.tickets.ratings.noneTitle")}</EmptyTitle>
          <EmptyDescription>{t("modules.tickets.ratings.noneDescription")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  // Pas de `Card` ici : l'onglet en est déjà une, et son titre est déjà « Avis »
  // — un cadre dans un cadre avec le même mot deux fois.
  return (
    <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-3">
      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">{t("modules.tickets.ratings.count")}</p>
        <p className="text-2xl font-semibold tabular-nums">
          {ratings.toLocaleString(i18n.language)}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("modules.tickets.ratings.windowHint", { days: summary.window_days })}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">{t("modules.tickets.ratings.average")}</p>
        <p className="text-2xl font-semibold tabular-nums">
          {/* `null` quand personne n'a noté — un `0` se lirait comme « tout le
              monde déteste ». */}
          {average === null
            ? "—"
            : average.toLocaleString(i18n.language, { maximumFractionDigits: 2 })}
        </p>
        {negative > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {t("modules.tickets.ratings.negativeCount", { count: negative })}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-3 lg:col-span-1">
        {/* De la meilleure à la pire : c'est l'ordre dans lequel on lit une
            distribution de satisfaction. */}
        {[...TICKET_SCORE_KEYS].reverse().map((key, index) => {
          const score = TICKET_SCORE_KEYS.length - index
          const count = Number(distribution[String(score)] ?? 0)
          const share = ratings > 0 ? Math.round((count / ratings) * 100) : 0
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="w-24 shrink-0 truncate text-xs text-muted-foreground">
                {t(`modules.tickets.ratings.scores.${key}`)}
              </span>
              <Progress value={share} className="h-1.5 min-w-0 flex-1" />
              <span className="w-8 shrink-0 text-right text-xs tabular-nums">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Par agent ────────────────────────────────────────────────────────────────

function StaffTable({ rows }: { rows: TicketStaffRating[] }) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{t("modules.tickets.ratings.byStaff")}</h3>
      <p className="text-xs text-muted-foreground">{t("modules.tickets.ratings.byStaffHint")}</p>
      {/* Le tableau est la seule chose qui peut déborder : il défile pour lui
          seul, la page ne défile jamais horizontalement. */}
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("modules.tickets.ratings.staff")}</TableHead>
              <TableHead className="text-right">{t("modules.tickets.ratings.handled")}</TableHead>
              <TableHead className="text-right">{t("modules.tickets.ratings.count")}</TableHead>
              <TableHead className="text-right">{t("modules.tickets.ratings.average")}</TableHead>
              <TableHead className="text-right">
                {t("modules.tickets.ratings.negativeShort")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* `by_staff` arrive classé par volume — ne jamais le re-trier ici. */}
            {rows.map((row) => (
              <StaffRow key={row.staff_id} row={row} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function StaffRow({ row }: { row: TicketStaffRating }) {
  const { t, i18n } = useTranslation()
  const profile = useUserProfile(row.staff_id)
  const name = profile.data?.display_name ?? row.staff_id

  return (
    <TableRow>
      <TableCell className="max-w-[12rem] truncate font-medium">
        <span className="flex items-center gap-2">
          <MiniAvatar url={profile.data?.avatar_url} name={name} />
          <span className="truncate">{name}</span>
          {row.low_sample && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="gap-1">
                  <TriangleAlertIcon className="size-3" />
                  {t("modules.tickets.ratings.lowSample")}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>{t("modules.tickets.ratings.lowSampleHint")}</TooltipContent>
            </Tooltip>
          )}
        </span>
      </TableCell>
      {/* `handled` vient des archives, pas de la table `tickets` : une ligne
          `ratings: 0, handled > 0` reste affichée telle quelle. */}
      <TableCell className="text-right tabular-nums">{row.handled}</TableCell>
      <TableCell className="text-right tabular-nums">{row.ratings}</TableCell>
      <TableCell className="text-right tabular-nums">
        {row.average === null
          ? "—"
          : row.average.toLocaleString(i18n.language, { maximumFractionDigits: 2 })}
      </TableCell>
      <TableCell
        className={cn(
          "text-right tabular-nums",
          row.negative > 0 && "text-amber-600 dark:text-amber-400"
        )}
      >
        {row.negative}
      </TableCell>
    </TableRow>
  )
}

// ─── Une note ─────────────────────────────────────────────────────────────────

function RatingRow({ rating }: { rating: TicketRating }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  // `rated_staff_id: null` est « personne en particulier » — une vraie
  // réponse, pas une donnée manquante. `useUserProfile` accepte `null` et
  // retombe alors simplement sur un profil vide.
  const staff = useUserProfile(rating.rated_staff_id)
  const staffName = rating.rated_staff_id
    ? (staff.data?.display_name ?? rating.rated_staff_id)
    : t("modules.tickets.ratings.noStaff")

  // `transcript_key: null` = l'archive a été purgée par la rétention : la
  // note lui survit, la ligne n'est alors plus cliquable.
  const canOpen = !!rating.transcript_key
  const onOpen = canOpen ? () => navigate(`/transcripts/${rating.transcript_key}`) : undefined

  return (
    <ListRow onClick={onOpen}>
      <RowAvatar url={rating.rated_staff_id ? staff.data?.avatar_url : null} name={staffName} />

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
          <Badge
            variant="secondary"
            className={cn(
              "gap-1",
              isNegativeScore(rating.score) && "text-amber-600 dark:text-amber-400"
            )}
          >
            <StarIcon className="size-3" />
            {t(`modules.tickets.ratings.scores.${rating.score_key}`)}
          </Badge>
          <span className="tabular-nums text-muted-foreground">#{rating.ticket_number}</span>
          {rating.category_name && (
            <span className="truncate text-muted-foreground">{rating.category_name}</span>
          )}
        </p>

        {rating.comment && (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground wrap-break-word">
            “{rating.comment}”
          </p>
        )}

        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <span>
            {rating.rated_staff_id
              ? t("modules.tickets.ratings.aboutStaff", { name: staffName })
              : t("modules.tickets.ratings.noStaff")}
          </span>
          <Dot />
          <span>{t(`modules.tickets.ratings.triggers.${rating.trigger}`)}</span>
          <Dot />
          <RelativeTime iso={rating.created_at} locale={i18n.language} />
        </p>
      </div>

      {canOpen && (
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      )}
    </ListRow>
  )
}
