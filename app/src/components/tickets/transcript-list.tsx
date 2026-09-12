import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import {
  ArchiveIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MessageSquareIcon,
  RefreshCwIcon,
  ScissorsIcon,
  SearchIcon,
  StarIcon,
  XIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { NONE, Notice } from "@/components/tickets/fields"
import { cn } from "@/lib/utils"
import { logger } from "@/lib/logger"
import { formatDuration } from "@/lib/tickets"
import { authorName, formatBytes, transcriptDurationSeconds } from "@/lib/transcripts"
import { getTicketTranscripts } from "@/services/tickets"
import type { TicketPanel } from "@/types/api"
import type { TranscriptListResponse, TranscriptSummary } from "@/types/transcripts"

// Liste des archives. **Une ligne par fermeture**, pas par salon : un ticket
// rouvert puis refermé apparaît deux fois, et les deux archives restent
// lisibles. Lecture seule de bout en bout — le bot est seul propriétaire des
// tables, il n'existe aucun endpoint d'écriture.

const PAGE_SIZE = 25

export function TranscriptList({
  guildId,
  panels,
}: {
  guildId: string
  panels: TicketPanel[]
}) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  const [data, setData] = useState<TranscriptListResponse | null>(null)
  const [offset, setOffset] = useState(0)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [ticketNumber, setTicketNumber] = useState("")
  const [userId, setUserId] = useState("")
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
      const number = Number(ticketNumber)
      setData(
        await getTicketTranscripts(guildId, {
          category_id: categoryId ?? undefined,
          // Un identifiant non numérique part en 400 côté API : on ne l'envoie
          // que s'il en a la forme.
          owner_id: /^\d+$/.test(userId) ? userId : undefined,
          ticket_number: Number.isFinite(number) && number > 0 ? number : undefined,
          limit: PAGE_SIZE,
          offset,
        })
      )
    } catch (e) {
      logger.error("module:tickets", "Transcript list failed", e)
      setError(e instanceof Error ? e.message : "Failed to load transcripts")
    } finally {
      setIsLoading(false)
    }
  }, [guildId, categoryId, userId, ticketNumber, offset])

  useEffect(() => {
    const timer = window.setTimeout(load, 250)
    return () => window.clearTimeout(timer)
  }, [load])

  const transcripts = data?.transcripts ?? []
  const total = data?.total ?? 0
  const page = Math.floor(offset / PAGE_SIZE) + 1
  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1)
  const hasFilters = Boolean(categoryId || ticketNumber || userId)

  const resetFilters = () => {
    setCategoryId(null)
    setTicketNumber("")
    setUserId("")
    setOffset(0)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Les réglages sont servis **avec** la liste pour qu'un vide s'explique :
          sans eux, « aucune archive » ne dirait pas si c'est parce qu'on
          n'archive plus, ou parce que la rétention est déjà passée. */}
      {data && !data.settings.transcripts_enabled && (
        <Notice level="warning" title={t("modules.tickets.transcripts.disabledTitle")}>
          {t("modules.tickets.transcripts.disabledDescription")}
        </Notice>
      )}
      {data?.settings.transcripts_enabled && data.settings.transcript_retention_days > 0 && (
        <Notice level="info" title={t("modules.tickets.transcripts.retentionTitle")}>
          {t("modules.tickets.transcripts.retentionDescription", {
            days: data.settings.transcript_retention_days,
          })}
        </Notice>
      )}

      {/* Filtres — ils s'empilent sur mobile, sur une ligne dès `sm`. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Select
          value={categoryId ?? NONE}
          onValueChange={(v) => {
            setCategoryId(v === NONE ? null : v)
            setOffset(0)
          }}
        >
          <SelectTrigger className="w-full sm:w-60">
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

        <Input
          value={ticketNumber}
          inputMode="numeric"
          onChange={(e) => {
            setTicketNumber(e.target.value.replace(/\D/g, ""))
            setOffset(0)
          }}
          placeholder={t("modules.tickets.transcripts.ticketNumber")}
          className="w-full sm:w-40"
        />

        <InputGroup className="w-full sm:w-56">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value.trim())
              setOffset(0)
            }}
            placeholder={t("modules.tickets.transcripts.ownerId")}
          />
        </InputGroup>

        <div className="flex items-center gap-2">
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <XIcon data-icon="inline-start" />
              {t("modules.tickets.transcripts.clearFilters")}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
            <RefreshCwIcon data-icon="inline-start" className={cn(isLoading && "animate-spin")} />
            {t("modules.tickets.filters.refresh")}
          </Button>
        </div>
      </div>

      {error ? (
        <Notice level="error" title={t("modules.tickets.transcripts.loadError")}>
          {error}
        </Notice>
      ) : isLoading && transcripts.length === 0 ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      ) : transcripts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center">
          <ArchiveIcon className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">{t("modules.tickets.transcripts.emptyTitle")}</p>
          <p className="max-w-md text-xs text-muted-foreground">
            {hasFilters
              ? t("modules.tickets.transcripts.emptyFiltered")
              : t("modules.tickets.transcripts.emptyDescription")}
          </p>
        </div>
      ) : (
        <div className="divide-y rounded-xl border">
          {transcripts.map((transcript) => (
            <TranscriptRow
              key={transcript.key}
              transcript={transcript}
              locale={i18n.language}
              onOpen={() => navigate(`/transcripts/${transcript.key}`)}
            />
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground tabular-nums">
            {t("modules.tickets.transcripts.pagination", { page, pages, total })}
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
  )
}

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

  // `category_name` est figé à la fermeture ; `category` est la catégorie
  // actuelle. Quand elles divergent, les deux comptent.
  const renamed =
    transcript.category && transcript.category.name !== transcript.category_name
  const deleted = !transcript.category && transcript.category_id

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
          {renamed && (
            <span className="truncate">
              · {t("modules.tickets.transcripts.renamed", { name: transcript.category!.name })}
            </span>
          )}
          {deleted && <span>· {t("modules.tickets.transcripts.categoryDeleted")}</span>}
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
