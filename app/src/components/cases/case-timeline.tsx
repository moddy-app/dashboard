import { useTranslation } from "react-i18next"
import {
  PlusCircleIcon,
  MinusCircleIcon,
  TimerOffIcon,
  RefreshCwIcon,
  LockIcon,
  ShieldAlertIcon,
  MessageSquareIcon,
  BotIcon,
  GavelIcon,
} from "lucide-react"
import {
  Message,
  MessageContent,
  MessageHeader,
} from "@/components/ui/message"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import { cn } from "@/lib/utils"
import { relativeTime, absoluteTime, ACTION_META } from "@/lib/cases"
import type { CaseEvent, SanctionAction } from "@/types/cases"
import { EntityRef, type EntityKind } from "./entity-ref"

// ─── Helpers de payload (défensifs) ──────────────────────────────────────────

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null
}

function payloadAction(payload: Record<string, unknown> | null): SanctionAction | null {
  const a = payload && asString(payload["action"])
  return a && a in ACTION_META ? (a as SanctionAction) : null
}

// ─── Ligne « marker » (action, statut, appel) ─────────────────────────────────

function MarkerRow({
  icon: Icon,
  iconClass,
  children,
  time,
}: {
  icon: typeof PlusCircleIcon
  iconClass?: string
  children: React.ReactNode
  time: string
}) {
  const { i18n } = useTranslation()
  return (
    <Marker className="px-1">
      <MarkerIcon>
        <Icon className={cn("size-4", iconClass)} />
      </MarkerIcon>
      <MarkerContent className="flex flex-1 items-center gap-2">
        <span className="min-w-0 flex-1 wrap-break-word">{children}</span>
        <span
          className="shrink-0 text-xs tabular-nums text-muted-foreground/70"
          title={absoluteTime(time, i18n.language)}
        >
          {relativeTime(time, i18n.language)}
        </span>
      </MarkerContent>
    </Marker>
  )
}

// ─── Bulle de commentaire / note ──────────────────────────────────────────────

function CommentEvent({ event, isNote }: { event: CaseEvent; isNote: boolean }) {
  const { t, i18n } = useTranslation()
  return (
    <Message align="start" className="items-start">
      <MessageContent>
        <MessageHeader className="gap-2">
          <EntityRef
            kind={(event.author_type ?? "system") as EntityKind}
            id={event.author_id}
            variant="inline"
          />
          {isNote && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0 text-[10px] font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
              <LockIcon className="size-2.5" />
              {t("cases.timeline.internalNote")}
            </span>
          )}
          <span
            className="ml-auto text-xs tabular-nums text-muted-foreground/70"
            title={absoluteTime(event.created_at, i18n.language)}
          >
            {relativeTime(event.created_at, i18n.language)}
          </span>
        </MessageHeader>
        <Bubble variant={isNote ? "tinted" : "muted"} align="start" className="max-w-full">
          <BubbleContent
            className={cn(
              "whitespace-pre-wrap rounded-2xl",
              isNote && "bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
            )}
          >
            {event.content || <span className="italic text-muted-foreground">—</span>}
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  )
}

// ─── Carte de preuve automod ──────────────────────────────────────────────────

function EvidenceEvent({ event }: { event: CaseEvent }) {
  const { t, i18n } = useTranslation()
  const p = event.payload ?? {}
  const isAutomod = asString(p["source"]) === "automod"
  const jumpUrl = asString(p["jump_url"])
  const extrait = asString(p["extrait"]) ?? event.content
  const gravite = asString(p["gravite"])
  const categorie = asString(p["categorie"])
  const confiance = asString(p["confiance"])

  return (
    <Message align="start" className="items-start">
      <MessageContent>
        <MessageHeader className="gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 dark:text-sky-400">
            <BotIcon className="size-3.5" />
            {t("cases.timeline.evidenceAutomod")}
          </span>
          <span
            className="ml-auto text-xs tabular-nums text-muted-foreground/70"
            title={absoluteTime(event.created_at, i18n.language)}
          >
            {relativeTime(event.created_at, i18n.language)}
          </span>
        </MessageHeader>
        <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-3 dark:border-sky-900 dark:bg-sky-950/30">
          {extrait && (
            <p className="whitespace-pre-wrap wrap-break-word text-sm text-foreground/90">
              {extrait}
            </p>
          )}
          {(gravite || categorie || confiance) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {categorie && (
                <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-900/60 dark:text-sky-300">
                  {categorie}
                </span>
              )}
              {gravite && (
                <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-900/60 dark:text-sky-300">
                  {t("cases.timeline.severity")}: {gravite}
                </span>
              )}
              {confiance && (
                <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-900/60 dark:text-sky-300">
                  {t("cases.timeline.confidence")}: {confiance}
                </span>
              )}
            </div>
          )}
          {isAutomod && jumpUrl && (
            <a
              href={jumpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-sky-600 underline underline-offset-2 hover:text-sky-700 dark:text-sky-400"
            >
              {t("cases.timeline.viewMessage")}
            </a>
          )}
        </div>
      </MessageContent>
    </Message>
  )
}

// ─── Item unique ──────────────────────────────────────────────────────────────

function TimelineItem({ event }: { event: CaseEvent }) {
  const { t } = useTranslation()
  const kind = asString(event.payload?.["kind"] ?? null)

  // Trace d'appel (comment enrichi d'un payload appeal_*).
  if (event.type === "comment" && kind?.startsWith("appeal")) {
    const route = asString(event.payload?.["route"])
    const status = asString(event.payload?.["status"])
    if (kind === "appeal_opened") {
      return (
        <MarkerRow icon={GavelIcon} iconClass="text-violet-500" time={event.created_at}>
          {t("cases.timeline.appealOpened", {
            route: route ? t(`cases.appealRoute.${route}`) : "",
          })}
        </MarkerRow>
      )
    }
    return (
      <MarkerRow icon={GavelIcon} iconClass="text-violet-500" time={event.created_at}>
        {t("cases.timeline.appealDecision", {
          status: status ? t(`cases.appealStatus.${status}`) : "",
        })}
      </MarkerRow>
    )
  }

  switch (event.type) {
    case "comment":
      return <CommentEvent event={event} isNote={false} />
    case "note":
      return <CommentEvent event={event} isNote />
    case "evidence":
      return <EvidenceEvent event={event} />
    case "sanction_added": {
      const action = payloadAction(event.payload)
      return (
        <MarkerRow icon={PlusCircleIcon} iconClass="text-red-500" time={event.created_at}>
          {t("cases.timeline.sanctionAdded", {
            action: action ? t(`cases.action.${action}`) : t("cases.timeline.aSanction"),
          })}
        </MarkerRow>
      )
    }
    case "sanction_revoked":
      return (
        <MarkerRow icon={MinusCircleIcon} iconClass="text-emerald-500" time={event.created_at}>
          {t("cases.timeline.sanctionRevoked")}
        </MarkerRow>
      )
    case "sanction_expired": {
      const action = payloadAction(event.payload)
      return (
        <MarkerRow icon={TimerOffIcon} iconClass="text-muted-foreground" time={event.created_at}>
          {t("cases.timeline.sanctionExpired", {
            action: action ? t(`cases.action.${action}`) : t("cases.timeline.aSanction"),
          })}
        </MarkerRow>
      )
    }
    case "status_change": {
      const to = asString(event.payload?.["to"])
      const trigger = asString(event.payload?.["trigger"])
      const closed = to === "closed"
      return (
        <MarkerRow
          icon={closed ? LockIcon : RefreshCwIcon}
          iconClass={closed ? "text-muted-foreground" : "text-green-500"}
          time={event.created_at}
        >
          {t(`cases.timeline.status_${to ?? "change"}`, {
            trigger: trigger ? t(`cases.trigger.${trigger}`) : "",
            defaultValue: t("cases.timeline.statusChanged"),
          })}
        </MarkerRow>
      )
    }
    default:
      return (
        <MarkerRow icon={ShieldAlertIcon} time={event.created_at}>
          {event.content ?? event.type}
        </MarkerRow>
      )
  }
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

export function CaseTimeline({ events }: { events: CaseEvent[] }) {
  const { t } = useTranslation()

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-10 text-center">
        <MessageSquareIcon className="size-6 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">{t("cases.timeline.empty")}</p>
      </div>
    )
  }

  // Ordre chronologique garanti par l'API ; on sécurise malgré tout.
  const sorted = [...events].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  return (
    <div className="flex flex-col gap-4">
      {sorted.map((event) => (
        <TimelineItem key={event.id} event={event} />
      ))}
    </div>
  )
}
