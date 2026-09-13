import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  ArchiveIcon,
  ArrowUpRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  MessageSquareIcon,
  RefreshCwIcon,
  ScissorsIcon,
  StarIcon,
  TicketIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useUserProfile } from "@/hooks/useProfile"
import { logger } from "@/lib/logger"
import { cn } from "@/lib/utils"
import { authorName, formatBytes, transcriptDurationSeconds } from "@/lib/transcripts"
import { formatDuration, ticketState } from "@/lib/tickets"
import type { TicketState } from "@/lib/tickets"
import { getTickets, getTicketStats, getTicketTranscripts } from "@/services/tickets"
import type { Ticket, TicketPanel, TicketsSettings, TicketStats } from "@/types/api"
import type { TranscriptSummary } from "@/types/transcripts"
import { Notice } from "@/components/tickets/fields"
import { TicketFilterChips } from "@/components/tickets/ticket-filter-bar"
import {
  ARCHIVE_ONLY_FILTER_KEYS,
  COMMON_FILTER_KEYS,
  LIVE_ONLY_FILTER_KEYS,
  ticketFilterValuesToApi,
  ticketFilterValuesToTranscriptApi,
  type TicketFilterKey,
  type TicketFilterValues,
} from "@/components/tickets/ticket-filters"

// Vues sur les tickets, **strictement en lecture** : aucune écriture n'existe
// côté API pour la table `tickets` ni pour les archives, donc aucun bouton
// d'action ici.
//
// Tickets et archives sont **fusionnés** dans un seul onglet : filtrer sur
// « fermé » bascule la liste sur les archives (`GET /tickets/transcripts`) et
// un clic navigue **directement** sur la transcription — plus de round-trip.
// Sans ce filtre, la liste reste sur les tickets vivants (`GET /tickets`) :
// un ticket fermé y apparaît quand même (mélangé aux ouverts), son clic
// cherche alors sa transcription la plus récente par `ticket_number` (seule
// clé commune aux deux tables) avant de naviguer.
//
// Les deux tables n'exposent pas les mêmes filtres : `panel_id` n'existe que
// côté vivant, `staff_id`/`ticket_number` que côté archives — d'où
// `LIVE_ONLY_FILTER_KEYS` / `ARCHIVE_ONLY_FILTER_KEYS`, jamais mélangés dans
// un même appel.

const PAGE_SIZE = 25

const STATE_TONE: Record<TicketState, string> = {
  open: "bg-emerald-500",
  claimed: "bg-sky-500",
  escalated: "bg-purple-500",
  closed: "bg-muted-foreground/50",
}

export function TicketExplorer({
  guildId,
  panels,
  settings,
}: {
  guildId: string
  panels: TicketPanel[]
  settings: TicketsSettings
}) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  const [stats, setStats] = useState<TicketStats | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [transcripts, setTranscripts] = useState<TranscriptSummary[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [activeKeys, setActiveKeys] = useState<TicketFilterKey[]>([])
  const [values, setValues] = useState<TicketFilterValues>({})
  const [pendingKey, setPendingKey] = useState<TicketFilterKey | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** Ticket dont l'archive est en cours de résolution (clic en attente). */
  const [resolvingId, setResolvingId] = useState<number | null>(null)

  // Filtrer sur « fermé » bascule la source de données sur les archives : elles
  // seules connaissent `staff_id`/`ticket_number`, et un clic y navigue direct
  // (la ligne porte déjà la clé de la transcription).
  const useArchives = values.status === "closed"

  const categories = useMemo(
    () => panels.flatMap((p) => p.categories.map((c) => ({ ...c, panelName: p.name }))),
    [panels]
  )
  const panelOptions = useMemo(() => panels.map((p) => ({ id: p.id, name: p.name })), [panels])

  const availableKeys = useMemo(
    () => [...COMMON_FILTER_KEYS, ...(useArchives ? ARCHIVE_ONLY_FILTER_KEYS : LIVE_ONLY_FILTER_KEYS)],
    [useArchives]
  )

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      if (useArchives) {
        const filters = ticketFilterValuesToTranscriptApi(values)
        const result = await getTicketTranscripts(guildId, { ...filters, limit: PAGE_SIZE, offset })
        setTranscripts(result.transcripts)
        setTotal(result.total)
      } else {
        const filters = ticketFilterValuesToApi(values)
        const result = await getTickets(guildId, { ...filters, limit: PAGE_SIZE, offset })
        setTickets(result.tickets)
        setTotal(result.total)
      }
      setStats(await getTicketStats(guildId))
    } catch (e) {
      logger.error("module:tickets", "Ticket list failed", e)
      setError(e instanceof Error ? e.message : "Failed to load tickets")
    } finally {
      setIsLoading(false)
    }
  }, [guildId, values, offset, useArchives])

  useEffect(() => {
    load()
  }, [load])

  const addFilter = (key: TicketFilterKey) => {
    setActiveKeys((prev) => [...prev, key])
    setPendingKey(key)
  }

  const removeFilter = useCallback((key: TicketFilterKey) => {
    setActiveKeys((prev) => prev.filter((k) => k !== key))
    setValues((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setOffset(0)
  }, [])

  const changeFilter = (patch: TicketFilterValues) => {
    setValues((prev) => ({ ...prev, ...patch }))
    setOffset(0)
  }

  // Passer de « fermé » à autre chose (ou le retirer) rend `staff`/`number`
  // inertes — les tickets vivants ne les comprennent pas — et symétriquement
  // pour `panel` côté archives. On les retire plutôt que de laisser un chip
  // actif qui ne filtre plus rien en silence.
  useEffect(() => {
    const stale = activeKeys.filter((k) => !availableKeys.includes(k))
    if (stale.length === 0) return
    for (const key of stale) removeFilter(key)
  }, [activeKeys, availableKeys, removeFilter])

  /**
   * Un ticket **fermé** rencontré côté vivant (aucun filtre « fermé » actif,
   * juste un ticket qui l'est parmi d'autres) n'a pas de bouton « voir
   * l'archive » séparé : le clic cherche directement sa transcription la plus
   * récente (`ticket_number` est la seule clé commune aux deux tables) et
   * navigue dessus. Si rien n'existe — archivage désactivé, rétention déjà
   * passée — on le dit plutôt que de naviguer vers un `404` générique.
   */
  const openTranscript = useCallback(
    async (ticket: Ticket) => {
      if (resolvingId !== null) return
      setResolvingId(ticket.id)
      try {
        const result = await getTicketTranscripts(guildId, {
          ticket_number: ticket.number,
          limit: 1,
        })
        const transcript = result.transcripts[0]
        if (!transcript) {
          toast.info(t("modules.tickets.list.noArchiveTitle"), {
            description: settings.transcripts_enabled
              ? t("modules.tickets.list.noArchiveDescription")
              : t("modules.tickets.transcripts.disabledDescription"),
          })
          return
        }
        navigate(`/transcripts/${transcript.key}`)
      } catch (e) {
        logger.error("module:tickets", "Transcript lookup failed", e)
        toast.error(t("modules.tickets.list.noArchiveTitle"))
      } finally {
        setResolvingId(null)
      }
    },
    [guildId, navigate, resolvingId, settings.transcripts_enabled, t]
  )

  const page = Math.floor(offset / PAGE_SIZE) + 1
  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1)
  const isEmpty = useArchives ? transcripts.length === 0 : tickets.length === 0

  return (
    <div className="flex flex-col gap-5">
      {/* Les réglages expliquent un vide : sans eux, « aucune archive » ne dit
          pas si c'est parce qu'on n'archive plus, ou parce que la rétention
          est déjà passée. */}
      {!settings.transcripts_enabled && (
        <Notice level="warning" title={t("modules.tickets.transcripts.disabledTitle")}>
          {t("modules.tickets.transcripts.disabledDescription")}
        </Notice>
      )}
      {settings.transcripts_enabled && settings.transcript_retention_days > 0 && (
        <Notice level="info" title={t("modules.tickets.transcripts.retentionTitle")}>
          {t("modules.tickets.transcripts.retentionDescription", {
            days: settings.transcript_retention_days,
          })}
        </Notice>
      )}

      {/* Compteurs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label={t("modules.tickets.stats.total")} value={stats?.total} />
        <StatTile label={t("modules.tickets.stats.open")} value={stats?.open} />
        <StatTile label={t("modules.tickets.stats.closed")} value={stats?.closed} />
        <StatTile label={t("modules.tickets.stats.claimed")} value={stats?.claimed} />
        <StatTile label={t("modules.tickets.stats.escalated")} value={stats?.escalated} />
        <StatTile
          label={t("modules.tickets.stats.avgResolution")}
          // `null` tant qu'aucun ticket n'a été fermé — un « 0 » serait faux.
          text={formatDuration(stats?.avg_resolution_seconds ?? null) ?? "—"}
        />
      </div>

      {/* Filtres — chips bleus façon `cases`, un seul système de filtre pour
          tout le dashboard. */}
      <div className="flex flex-wrap items-center gap-2">
        <TicketFilterChips
          activeKeys={activeKeys}
          values={values}
          categories={categories}
          panels={panelOptions}
          availableKeys={availableKeys}
          pendingKey={pendingKey}
          onChange={changeFilter}
          onRemove={removeFilter}
          onAdd={addFilter}
        />
        <Button variant="outline" size="sm" onClick={load} disabled={isLoading} className="ml-auto">
          <RefreshCwIcon className={cn("size-4", isLoading && "animate-spin")} />
          {t("modules.tickets.filters.refresh")}
        </Button>
      </div>

      {/* Liste */}
      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </p>
      ) : isLoading && isEmpty ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center">
          {useArchives ? (
            <ArchiveIcon className="size-6 text-muted-foreground" />
          ) : (
            <TicketIcon className="size-6 text-muted-foreground" />
          )}
          <p className="text-sm text-muted-foreground">
            {t(useArchives ? "modules.tickets.list.emptyArchives" : "modules.tickets.list.empty")}
          </p>
        </div>
      ) : (
        <div className="divide-y rounded-xl border">
          {useArchives
            ? transcripts.map((transcript) => (
                <TranscriptRow
                  key={transcript.key}
                  transcript={transcript}
                  locale={i18n.language}
                  onOpen={() => navigate(`/transcripts/${transcript.key}`)}
                />
              ))
            : tickets.map((ticket) => (
                <TicketRow
                  key={ticket.id}
                  ticket={ticket}
                  resolving={resolvingId === ticket.id}
                  onOpenTranscript={() => openTranscript(ticket)}
                />
              ))}
        </div>
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground tabular-nums">
            {t("modules.tickets.list.pagination", { page, pages, total })}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0 || isLoading}
              onClick={() => setOffset(Math.max(offset - PAGE_SIZE, 0))}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + PAGE_SIZE >= total || isLoading}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatTile({
  label,
  value,
  text,
}: {
  label: string
  value?: number
  text?: string
}) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">
        {text ?? (value === undefined ? "—" : value)}
      </p>
    </div>
  )
}

function TicketRow({
  ticket,
  resolving,
  onOpenTranscript,
}: {
  ticket: Ticket
  resolving: boolean
  onOpenTranscript: () => void
}) {
  const { t, i18n } = useTranslation()
  const owner = useUserProfile(ticket.owner_id)
  const claimer = useUserProfile(ticket.claimed_by)
  const state = ticketState(ticket)
  const isClosed = state === "closed"

  const opened = new Date(ticket.opened_at).toLocaleString(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  })

  const content = (
    <>
      <span className={cn("size-2 shrink-0 rounded-full", STATE_TONE[state])} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm font-medium">
          {/* Le numéro est ce que citent les humains, pas le snowflake du salon. */}
          <span className="tabular-nums">#{ticket.number}</span>
          <span className="truncate font-normal text-muted-foreground">
            {owner.data?.display_name ?? ticket.owner_id}
          </span>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 truncate text-xs text-muted-foreground">
          {/* `category: null` = la catégorie a disparu de la config : le bot
              répond « catégorie disparue » à toute action dans ce ticket. */}
          {ticket.category ? (
            <>
              {ticket.category.panel_name} · {ticket.category.name}
            </>
          ) : (
            <Badge variant="secondary" className="text-amber-600 dark:text-amber-400">
              {t("modules.tickets.list.orphan")}
            </Badge>
          )}
          <span aria-hidden>·</span>
          {opened}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {ticket.close_requested_by && (
          <Badge variant="secondary">{t("modules.tickets.list.closeRequested")}</Badge>
        )}
        {ticket.claimed_by && (
          <Badge variant="secondary" className="gap-1">
            <ArrowUpRightIcon className="size-3" />
            {claimer.data?.display_name ?? ticket.claimed_by}
          </Badge>
        )}
        <Badge variant={isClosed ? "secondary" : "outline"}>
          {t(`modules.tickets.states.${state}`)}
        </Badge>
        {isClosed && (
          <span className="text-muted-foreground">
            {resolving ? <Loader2Icon className="size-4 animate-spin" /> : null}
          </span>
        )}
      </div>
    </>
  )

  // Seul un ticket **fermé** ouvre une transcription : un ticket ouvert n'en a
  // pas encore, la ligne reste donc simplement informative.
  if (!isClosed) {
    return <div className="flex items-center gap-3 p-3">{content}</div>
  }

  return (
    <button
      type="button"
      onClick={onOpenTranscript}
      disabled={resolving}
      className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50"
    >
      {content}
    </button>
  )
}

/** Ligne d'archive — mêmes informations que l'ancien onglet « Archives ». */
function TranscriptRow({
  transcript,
  locale,
  onOpen,
}: {
  transcript: TranscriptSummary
  locale: string
  onOpen: () => void
}) {
  const { t } = useTranslation()

  // L'auteur vient de l'instantané de l'archive, pas d'un profil relu en direct :
  // c'est le nom qu'il portait au moment de la fermeture.
  const owner = transcript.speakers.find((s) => s.author_id === transcript.owner_id)
  const duration = transcriptDurationSeconds(transcript)

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50"
    >
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
          <span className="tabular-nums">#{transcript.ticket_number}</span>
          <span className="truncate font-normal text-muted-foreground">
            {authorName(owner, transcript.owner_id)}
          </span>
          {transcript.truncated && (
            <Badge variant="secondary" className="gap-1 text-amber-600 dark:text-amber-400">
              <ScissorsIcon className="size-3" />
              {t("modules.tickets.transcripts.truncated")}
            </Badge>
          )}
        </p>

        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <span className="truncate">
            {transcript.category_name ?? t("modules.tickets.transcripts.noCategory")}
          </span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <MessageSquareIcon className="size-3" />
            {transcript.message_count}
          </span>
          {duration !== null && (
            <>
              <span aria-hidden>·</span>
              <span className="tabular-nums">{formatDuration(duration)}</span>
            </>
          )}
          <span aria-hidden className="hidden sm:inline">
            ·
          </span>
          <span className="hidden tabular-nums sm:inline">
            {formatBytes(transcript.payload_size, locale)}
          </span>
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        {transcript.rating && (
          // L'appréciation, jamais `n/5` : la personne n'a jamais vu de chiffre.
          <Badge variant="secondary" className="gap-1">
            <StarIcon className="size-3" />
            <span className="hidden sm:inline">
              {t(`modules.tickets.ratings.scores.${transcript.rating.score_key}`)}
            </span>
          </Badge>
        )}
        <span className="text-xs text-muted-foreground tabular-nums">
          {new Date(transcript.closed_at).toLocaleDateString(locale, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      </div>
    </button>
  )
}
