import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  BotIcon,
  ImageIcon,
  FileIcon,
  MessageSquareQuoteIcon,
  ExternalLinkIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { relativeTime, absoluteTime } from "@/lib/cases"
import { getCaseEvidence } from "@/services/cases"
import { isMessageLink } from "@/types/cases"
import type {
  CaseEvent,
  CaseEvidence,
  EvidenceAttachment,
  EvidenceMessageLink,
} from "@/types/cases"

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null
}

/** Event `evidence` porteur d'un contexte automod (ni URL, ni lien de message). */
function isAutomodEvidence(e: CaseEvent): boolean {
  if (e.type !== "evidence") return false
  const p = e.payload ?? {}
  if (asString(p["url"]) || asString(p["kind"]) === "message_link") return false
  return true
}

// ─── Carte automod ─────────────────────────────────────────────────────────────

function AutomodCard({ event }: { event: CaseEvent }) {
  const { t, i18n } = useTranslation()
  const p = event.payload ?? {}
  const jumpUrl = asString(p["jump_url"])
  const extrait = asString(p["extrait"])
  const gravite = asString(p["gravite"])
  const categorie = asString(p["categorie"])
  const confiance = asString(p["confiance"])
  const compact = !extrait && !gravite && !categorie

  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50/60 px-3 py-2 text-xs dark:border-sky-900 dark:bg-sky-950/30">
        <BotIcon className="size-3.5 shrink-0 text-sky-500" />
        <span className="text-sky-700 dark:text-sky-300">{t("cases.timeline.evidenceLog")}</span>
        {jumpUrl && (
          <a
            href={jumpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-sky-600 hover:underline dark:text-sky-400"
          >
            {t("cases.timeline.viewMessage")}
            <ExternalLinkIcon className="size-3" />
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3 dark:border-sky-900 dark:bg-sky-950/30">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-sky-600 dark:text-sky-400">
        <BotIcon className="size-3.5" />
        {t("cases.timeline.evidenceAutomod")}
        <span
          className="ml-auto tabular-nums font-normal text-muted-foreground/70"
          title={absoluteTime(event.created_at, i18n.language)}
        >
          {relativeTime(event.created_at, i18n.language)}
        </span>
      </div>
      {extrait && (
        <p className="whitespace-pre-wrap wrap-break-word text-sm text-foreground/90">{extrait}</p>
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
      {jumpUrl && (
        <a
          href={jumpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs text-sky-600 hover:underline dark:text-sky-400"
        >
          {t("cases.timeline.viewMessage")}
          <ExternalLinkIcon className="size-3" />
        </a>
      )}
    </div>
  )
}

// ─── Carte lien de message ─────────────────────────────────────────────────────

function MessageLinkCard({ item }: { item: EvidenceMessageLink }) {
  const { t } = useTranslation()
  return (
    <div className="rounded-xl border p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <MessageSquareQuoteIcon className="size-3.5" />
        {item.message_author_name || t("cases.evidence.citedMessage")}
      </div>
      {item.content ? (
        <p className="whitespace-pre-wrap wrap-break-word text-sm text-foreground/90">{item.content}</p>
      ) : (
        <p className="text-sm italic text-muted-foreground">{t("cases.evidence.noContent")}</p>
      )}
      {item.attachments.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {item.attachments.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
              <img
                src={url}
                alt=""
                referrerPolicy="no-referrer"
                loading="lazy"
                className="aspect-square w-full rounded-lg border object-cover"
              />
            </a>
          ))}
        </div>
      )}
      <a
        href={item.jump_url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
      >
        {t("cases.evidence.viewOnDiscord")}
        <ExternalLinkIcon className="size-3" />
      </a>
    </div>
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
        {/* Galerie média */}
        {media.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {media.map((a) =>
              a.kind === "video" ? (
                <video
                  key={a.event_id}
                  src={a.url}
                  controls
                  className="aspect-square w-full rounded-lg border object-cover"
                />
              ) : (
                <a key={a.event_id} href={a.url} target="_blank" rel="noopener noreferrer" className="group relative block">
                  <img
                    src={a.url}
                    alt=""
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    className="aspect-square w-full rounded-lg border object-cover transition-opacity group-hover:opacity-90"
                  />
                  <span className="absolute right-1 top-1 rounded-md bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <ImageIcon className="size-3" />
                  </span>
                </a>
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
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
            )}
          >
            <FileIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{a.kind}</span>
            <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
          </a>
        ))}

        {/* Liens de message */}
        {messageLinks.map((m) => (
          <MessageLinkCard key={m.event_id} item={m} />
        ))}

        {/* Contexte automod */}
        {automodEvents.map((e) => (
          <AutomodCard key={e.id} event={e} />
        ))}
      </div>
    </section>
  )
}
