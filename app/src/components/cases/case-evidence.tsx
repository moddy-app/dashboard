import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  BotIcon,
  ImageIcon,
  VideoIcon,
  FileIcon,
  MessageSquareQuoteIcon,
  MessagesSquareIcon,
  ExternalLinkIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { relativeTime, absoluteTime } from "@/lib/cases"
import { getCaseEvidence } from "@/services/cases"
import { isMessageLink } from "@/types/cases"
import { ActionChip } from "./case-badges"
import { EntityRef, type EntityKind } from "./entity-ref"
import { AutomodContextDialog } from "./automod-context-dialog"
import type {
  CaseEvent,
  CaseEvidence,
  EvidenceAttachment,
  EvidenceMessageLink,
  SanctionAction,
} from "@/types/cases"
import { SANCTION_ACTIONS } from "@/types/cases"

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []
}

/** Timestamp epoch (secondes) → ISO, pour réutiliser relativeTime/absoluteTime. */
function epochToIso(sec: number | null): string | null {
  return sec ? new Date(sec * 1000).toISOString() : null
}

/** Event `evidence` porteur d'un contexte automod riche (payload.source === "automod"). */
function isAutomodEvidence(e: CaseEvent): boolean {
  return e.type === "evidence" && asString(e.payload?.["source"] ?? null) === "automod"
}

// ─── Carte commune (en-tête icône + titre + heure, pied optionnel) ────────────

function EvidenceCard({
  icon: Icon,
  iconClass,
  title,
  time,
  children,
  footer,
}: {
  icon: typeof BotIcon
  iconClass?: string
  title: React.ReactNode
  time: string | null
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const { i18n } = useTranslation()
  return (
    <div className="rounded-xl border p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className={cn("size-3.5 shrink-0", iconClass)} />
        <span className="min-w-0 truncate">{title}</span>
        {time && (
          <span
            className="ml-auto shrink-0 tabular-nums font-normal text-muted-foreground/70"
            title={absoluteTime(time, i18n.language)}
          >
            {relativeTime(time, i18n.language)}
          </span>
        )}
      </div>
      {children}
      {footer && <div className="mt-2 flex flex-wrap items-center gap-2">{footer}</div>}
    </div>
  )
}

function MetaBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      {children}
    </span>
  )
}

function ViewOnDiscordLink({ href }: { href: string }) {
  const { t } = useTranslation()
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
    >
      {t("cases.evidence.viewOnDiscord")}
      <ExternalLinkIcon className="size-3" />
    </a>
  )
}

// ─── Carte automod (payload riche) ────────────────────────────────────────────

function AutomodCard({ event }: { event: CaseEvent }) {
  const { t } = useTranslation()
  const [contextOpen, setContextOpen] = useState(false)
  const p = event.payload ?? {}
  const authorName = asString(p["author_name"])
  const jumpUrl = asString(p["jump_url"])
  const extrait = asString(p["extrait"]) ?? event.content
  const contextText = asString(p["context_text"])
  const raison = asString(p["raison"])
  const explication = asString(p["explication"])
  const categorie = asString(p["categorie"])
  const gravite = asString(p["gravite"])
  const confiance = asString(p["confiance"])
  const signalSource = asString(p["signal_source"])
  const score = asNumber(p["score_detecteur"])
  const actions = asStringArray(p["actions"])
  const time = epochToIso(asNumber(p["ts"])) ?? event.created_at

  const confidenceTone: Record<string, string> = {
    high: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400",
    low: "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400",
  }

  return (
    <EvidenceCard
      icon={BotIcon}
      iconClass="text-sky-500"
      title={authorName || t("cases.timeline.evidenceAutomod")}
      time={time}
    >
      {extrait ? (
        <p className="whitespace-pre-wrap wrap-break-word text-sm text-foreground/90">{extrait}</p>
      ) : (
        <p className="text-sm italic text-muted-foreground">{t("cases.evidence.noContent")}</p>
      )}

      {(categorie || gravite || confiance || signalSource || score !== null) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {categorie && <MetaBadge>{categorie}</MetaBadge>}
          {gravite && (
            <MetaBadge>
              {t("cases.timeline.severity")}: {gravite}
            </MetaBadge>
          )}
          {confiance && (
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                confidenceTone[confiance] ?? "bg-muted text-muted-foreground"
              )}
            >
              {t("cases.timeline.confidence")}: {confiance}
            </span>
          )}
          {signalSource && (
            <MetaBadge>
              {t("cases.evidence.signalSource")}: {signalSource}
            </MetaBadge>
          )}
          {score !== null && (
            <MetaBadge>
              {t("cases.evidence.detectorScore")}: {Math.round(score * 100)}%
            </MetaBadge>
          )}
        </div>
      )}

      {(raison || explication) && (
        <div className="mt-2 space-y-0.5 border-t pt-2 text-xs text-muted-foreground">
          {raison && (
            <p>
              <span className="font-medium text-foreground/70">{t("cases.evidence.reason")}: </span>
              {raison}
            </p>
          )}
          {explication && (
            <p>
              <span className="font-medium text-foreground/70">{t("cases.evidence.explanation")}: </span>
              {explication}
            </p>
          )}
        </div>
      )}

      {actions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {actions.map((a, i) =>
            (SANCTION_ACTIONS as readonly string[]).includes(a) ? (
              <ActionChip key={i} action={a as SanctionAction} size="xs" />
            ) : (
              <MetaBadge key={i}>{a}</MetaBadge>
            )
          )}
        </div>
      )}

      {(contextText || jumpUrl) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {contextText && (
            <button
              type="button"
              onClick={() => setContextOpen(true)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
            >
              <MessagesSquareIcon className="size-3" />
              {t("cases.evidence.viewContext")}
            </button>
          )}
          {jumpUrl && <ViewOnDiscordLink href={jumpUrl} />}
        </div>
      )}

      {contextText && (
        <AutomodContextDialog open={contextOpen} onOpenChange={setContextOpen} text={contextText} />
      )}
    </EvidenceCard>
  )
}

// ─── Carte lien de message (preuve ajoutée par un modérateur) ─────────────────

function MessageLinkCard({ item }: { item: EvidenceMessageLink }) {
  const { t } = useTranslation()
  const time = epochToIso(item.message_created_at) ?? item.created_at

  return (
    <EvidenceCard
      icon={MessageSquareQuoteIcon}
      title={item.message_author_name || t("cases.evidence.citedMessage")}
      time={time}
    >
      {item.content ? (
        <p className="whitespace-pre-wrap wrap-break-word text-sm text-foreground/90">{item.content}</p>
      ) : (
        <p className="text-sm italic text-muted-foreground">{t("cases.evidence.noContent")}</p>
      )}
      {item.attachments.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {item.attachments.map((url, i) => (
            <ScreenshotThumb key={i} url={url} />
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {item.author_id && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            {t("cases.evidence.addedBy")}
            <EntityRef kind={(item.author_type ?? "moddy_staff") as EntityKind} id={item.author_id} variant="inline" />
          </span>
        )}
        <ViewOnDiscordLink href={item.jump_url} />
      </div>
    </EvidenceCard>
  )
}

// ─── Vignette média (galerie) ──────────────────────────────────────────────────

function ScreenshotThumb({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block overflow-hidden rounded-xl border"
    >
      <img
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        loading="lazy"
        className="aspect-square w-full object-cover transition-transform duration-200 group-hover:scale-105"
      />
      <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
      <span className="absolute right-1 top-1 rounded-md bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
        <ImageIcon className="size-3" />
      </span>
    </a>
  )
}

// ─── Section ─────────────────────────────────────────────────────────────────

export function CaseEvidenceSection({ caseRef, events }: { caseRef: string; events: CaseEvent[] }) {
  const { t } = useTranslation()
  const [evidence, setEvidence] = useState<CaseEvidence[]>([])
  const [loaded, setLoaded] = useState(false)

  const automodEvents = events.filter(isAutomodEvidence)

  useEffect(() => {
    let active = true
    getCaseEvidence(caseRef)
      .then((data) => active && setEvidence(data))
      .catch(() => active && setEvidence([]))
      .finally(() => active && setLoaded(true))
    return () => {
      active = false
    }
  }, [caseRef])

  const attachments = evidence.filter((e): e is EvidenceAttachment => !isMessageLink(e))
  const messageLinks = evidence.filter(isMessageLink)
  const media = attachments.filter((a) => a.media)
  const files = attachments.filter((a) => !a.media)

  const count = automodEvents.length + evidence.length
  if (!loaded || count === 0) return null

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold">{t("cases.evidence.title")}</h2>
        <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
          {count}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {/* Galerie média (captures d'écran / vidéos jointes) */}
        {media.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {media.map((a) =>
              a.kind === "video" ? (
                <div key={a.event_id} className="relative overflow-hidden rounded-xl border">
                  <video src={a.url} controls className="aspect-square w-full object-cover" />
                  <span className="pointer-events-none absolute left-1 top-1 inline-flex items-center gap-1 rounded-md bg-black/50 px-1 py-0.5 text-[10px] text-white">
                    <VideoIcon className="size-2.5" />
                  </span>
                </div>
              ) : (
                <ScreenshotThumb key={a.event_id} url={a.url} />
              )
            )}
          </div>
        )}

        {/* Fichiers non-média */}
        {files.map((a) => (
          <a
            key={a.event_id}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
          >
            <FileIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{a.kind}</span>
            <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
          </a>
        ))}

        {/* Liens de message cité */}
        {messageLinks.map((m) => (
          <MessageLinkCard key={m.event_id} item={m} />
        ))}

        {/* Contexte automod (formaté comme un message cité) */}
        {automodEvents.map((e) => (
          <AutomodCard key={e.id} event={e} />
        ))}
      </div>
    </section>
  )
}
