import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import {
  ArrowUpRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshCwIcon,
  StarIcon,
  ThumbsDownIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { NONE, Notice } from "@/components/tickets/fields"
import { useUserProfile } from "@/hooks/useProfile"
import { cn } from "@/lib/utils"
import { logger } from "@/lib/logger"
import { isNegativeScore } from "@/lib/transcripts"
import { getTicketRatings, getTicketRatingsSummary } from "@/services/tickets"
import { TICKET_RATING_TRIGGERS, TICKET_SCORE_KEYS } from "@/types/transcripts"
import type {
  TicketRating,
  TicketRatingTrigger,
  TicketRatingsSummary,
  TicketStaffRating,
} from "@/types/transcripts"
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
const WINDOWS = [7, 30, 90, 365] as const

export function RatingsPanel({ guildId, panels }: { guildId: string; panels: TicketPanel[] }) {
  const { t } = useTranslation()

  const [days, setDays] = useState<number>(30)
  const [summary, setSummary] = useState<TicketRatingsSummary | null>(null)
  const [ratings, setRatings] = useState<TicketRating[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [trigger, setTrigger] = useState<TicketRatingTrigger | null>(null)
  const [negativeOnly, setNegativeOnly] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const categories = useMemo(
    () => panels.flatMap((p) => p.categories.map((c) => ({ ...c, panelName: p.name }))),
    [panels]
  )

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [summaryData, list] = await Promise.all([
        getTicketRatingsSummary(guildId, days),
        getTicketRatings(guildId, {
          days,
          category_id: categoryId ?? undefined,
          trigger: trigger ?? undefined,
          // `max_score=2` est la vue qui compte : les tickets mal vécus.
          max_score: negativeOnly ? 2 : undefined,
          limit: PAGE_SIZE,
          offset,
        }),
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
  }, [guildId, days, categoryId, trigger, negativeOnly, offset])

  useEffect(() => {
    load()
  }, [load])

  const page = Math.floor(offset / PAGE_SIZE) + 1
  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1)

  return (
    <div className="flex flex-col gap-5">
      {/* Fenêtre d'observation + rafraîchissement */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select
          value={String(days)}
          onValueChange={(v) => {
            setDays(Number(v))
            setOffset(0)
          }}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WINDOWS.map((value) => (
              <SelectItem key={value} value={String(value)}>
                {t("modules.tickets.ratings.window", { days: value })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
          <RefreshCwIcon data-icon="inline-start" className={cn(isLoading && "animate-spin")} />
          {t("modules.tickets.filters.refresh")}
        </Button>
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
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <h3 className="mr-auto text-sm font-semibold">
            {t("modules.tickets.ratings.listTitle")}
          </h3>

          <Button
            variant={negativeOnly ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setNegativeOnly((v) => !v)
              setOffset(0)
            }}
          >
            <ThumbsDownIcon data-icon="inline-start" />
            {t("modules.tickets.ratings.negativeOnly")}
          </Button>

          <Select
            value={trigger ?? NONE}
            onValueChange={(v) => {
              setTrigger(v === NONE ? null : (v as TicketRatingTrigger))
              setOffset(0)
            }}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder={t("modules.tickets.ratings.allTriggers")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("modules.tickets.ratings.allTriggers")}</SelectItem>
              {TICKET_RATING_TRIGGERS.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`modules.tickets.ratings.triggers.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={categoryId ?? NONE}
            onValueChange={(v) => {
              setCategoryId(v === NONE ? null : v)
              setOffset(0)
            }}
          >
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder={t("modules.tickets.filters.allCategories")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("modules.tickets.filters.allCategories")}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.panelName} · {c.name || c.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading && ratings.length === 0 ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ) : ratings.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center">
            <StarIcon className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {t("modules.tickets.ratings.empty")}
            </p>
          </div>
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
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center">
        <StarIcon className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium">{t("modules.tickets.ratings.noneTitle")}</p>
        <p className="max-w-md text-xs text-muted-foreground">
          {t("modules.tickets.ratings.noneDescription")}
        </p>
      </div>
    )
  }

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
          {average === null ? "—" : average.toLocaleString(i18n.language, {
            maximumFractionDigits: 2,
          })}
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

  return (
    <TableRow>
      <TableCell className="max-w-[12rem] truncate font-medium">
        <span className="flex items-center gap-2">
          <span className="truncate">{profile.data?.display_name ?? row.staff_id}</span>
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
  const staff = useUserProfile(rating.rated_staff_id)

  return (
    <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
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
          <p className="mt-1.5 text-sm leading-relaxed wrap-break-word">“{rating.comment}”</p>
        )}

        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <span>
            {/* `null` = « personne en particulier », une réponse réelle — pas
                une donnée manquante. */}
            {rating.rated_staff_id
              ? t("modules.tickets.ratings.aboutStaff", {
                  name: staff.data?.display_name ?? rating.rated_staff_id,
                })
              : t("modules.tickets.ratings.noStaff")}
          </span>
          <span aria-hidden>·</span>
          <span>{t(`modules.tickets.ratings.triggers.${rating.trigger}`)}</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">
            {new Date(rating.created_at).toLocaleDateString(i18n.language, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </p>
      </div>

      {/* `transcript_key: null` = l'archive a été purgée par la rétention : la
          note lui survit, le lien disparaît. */}
      {rating.transcript_key && (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => navigate(`/transcripts/${rating.transcript_key}`)}
        >
          {t("modules.tickets.ratings.openTranscript")}
          <ArrowUpRightIcon data-icon="inline-end" />
        </Button>
      )}
    </div>
  )
}
