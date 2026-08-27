import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  ArrowUpRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshCwIcon,
  TicketIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useUserProfile } from "@/hooks/useProfile"
import { logger } from "@/lib/logger"
import { cn } from "@/lib/utils"
import { formatDuration, ticketState } from "@/lib/tickets"
import type { TicketState } from "@/lib/tickets"
import { getTickets, getTicketStats } from "@/services/tickets"
import type { Ticket, TicketPanel, TicketStats, TicketStatus } from "@/types/api"
import { NONE } from "@/components/tickets/fields"

// Vues sur la table `tickets`, qui appartient au bot : **strictement en
// lecture**. Aucune écriture n'existe côté API — pas de « fermer le ticket
// depuis le dashboard », donc aucun bouton d'action ici.

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
}: {
  guildId: string
  panels: TicketPanel[]
}) {
  const { t } = useTranslation()

  const [stats, setStats] = useState<TicketStats | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [status, setStatus] = useState<TicketStatus | null>("open")
  const [categoryId, setCategoryId] = useState<string | null>(null)
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
      const [list, statsData] = await Promise.all([
        getTickets(guildId, {
          status: status ?? undefined,
          category_id: categoryId ?? undefined,
          limit: PAGE_SIZE,
          offset,
        }),
        getTicketStats(guildId),
      ])
      setTickets(list.tickets)
      setTotal(list.total)
      setStats(statsData)
    } catch (e) {
      logger.error("module:tickets", "Ticket list failed", e)
      setError(e instanceof Error ? e.message : "Failed to load tickets")
    } finally {
      setIsLoading(false)
    }
  }, [guildId, status, categoryId, offset])

  useEffect(() => {
    load()
  }, [load])

  const page = Math.floor(offset / PAGE_SIZE) + 1
  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1)

  return (
    <div className="flex flex-col gap-5">
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

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={status ?? NONE}
          onValueChange={(v) => {
            setStatus(v === NONE ? null : (v as TicketStatus))
            setOffset(0)
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{t("modules.tickets.filters.allStatuses")}</SelectItem>
            <SelectItem value="open">{t("modules.tickets.filters.open")}</SelectItem>
            <SelectItem value="closed">{t("modules.tickets.filters.closed")}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={categoryId ?? NONE}
          onValueChange={(v) => {
            setCategoryId(v === NONE ? null : v)
            setOffset(0)
          }}
        >
          <SelectTrigger className="w-60">
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

        <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
          <RefreshCwIcon className={cn("size-4", isLoading && "animate-spin")} />
          {t("modules.tickets.filters.refresh")}
        </Button>
      </div>

      {/* Liste */}
      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </p>
      ) : isLoading && tickets.length === 0 ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center">
          <TicketIcon className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("modules.tickets.list.empty")}</p>
        </div>
      ) : (
        <div className="divide-y rounded-xl border">
          {tickets.map((ticket) => (
            <TicketRow key={ticket.id} ticket={ticket} />
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

function TicketRow({ ticket }: { ticket: Ticket }) {
  const { t, i18n } = useTranslation()
  const owner = useUserProfile(ticket.owner_id)
  const claimer = useUserProfile(ticket.claimed_by)
  const state = ticketState(ticket)

  const opened = new Date(ticket.opened_at).toLocaleString(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  })

  return (
    <div className="flex items-center gap-3 p-3">
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
        <Badge variant={state === "closed" ? "secondary" : "outline"}>
          {t(`modules.tickets.states.${state}`)}
        </Badge>
      </div>
    </div>
  )
}
