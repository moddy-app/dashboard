import { useCallback, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DownloadIcon,
  HashIcon,
  LinkIcon,
  LockIcon,
  MessageSquareIcon,
  PencilIcon,
  PinIcon,
  SearchIcon,
  StarIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Bubble, BubbleContent, BubbleReactions } from "@/components/ui/bubble"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
import { Message, MessageAvatar, MessageContent, MessageHeader } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DiscordMessageBody } from "@/components/tickets/discord-message"
import { Notice } from "@/components/tickets/fields"
import { cn } from "@/lib/utils"
import { formatDuration } from "@/lib/tickets"
import {
  authorInitials,
  authorName,
  formatBytes,
  groupTranscriptMessages,
  transcriptDurationSeconds,
  transcriptSearchMatches,
  transcriptUrl,
} from "@/lib/transcripts"
import type {
  TranscriptAuthor,
  TranscriptDetail,
  TranscriptMessage,
} from "@/types/transcripts"

// Lecteur d'archive.
//
// Quatre décisions portent l'écran :
//
// 1. **Le thread privé de l'équipe n'est jamais fusionné dans la conversation.**
//    Il n'arrive que si `viewer.is_staff`, et il vit dans son propre onglet.
//    Pour l'auteur du ticket, seul un bandeau discret dit qu'il a existé.
// 2. **`authors` est un instantané** pris à la fermeture — on rend ce qui est
//    stocké, jamais un profil Discord relu en direct. C'est à ça que la
//    conversation ressemblait.
// 3. **Une archive peut être énorme** (jusqu'à 20 000 messages) : on n'en monte
//    qu'une fenêtre, agrandie à la demande. `MessageScroller` conserve la
//    position quand on déplie vers le haut, et `content-visibility` fait le
//    reste sur ce qui est monté mais hors écran.
// 4. **Les liens de pièces jointes expirent.** Le nom et la taille survivent,
//    pas l'URL : le rendu le dit au lieu d'afficher une image cassée.

/** Blocs montés d'emblée ; le reste se déplie vers le haut, à la demande. */
const INITIAL_WINDOW = 120
const WINDOW_STEP = 200

export function TranscriptView({
  transcript,
  onBack,
  className,
}: {
  transcript: TranscriptDetail
  onBack?: () => void
  className?: string
}) {
  const { t, i18n } = useTranslation()
  const [query, setQuery] = useState("")
  const [copied, setCopied] = useState(false)

  const authors = useMemo(() => {
    const map = new Map<string, TranscriptAuthor>()
    for (const author of transcript.authors) map.set(author.author_id, author)
    return map
  }, [transcript.authors])

  const label = useCallback(
    (authorId: string) => authorName(authors.get(authorId), authorId),
    [authors]
  )

  const duration = transcriptDurationSeconds(transcript)

  const copyLink = async () => {
    const url = transcriptUrl(transcript.key)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, permission) : le lien
      // reste utile s'il est affiché, donc on le montre au lieu d'échouer.
      toast.info(url)
    }
  }

  const download = () => {
    const blob = new Blob([plainTextExport(transcript, label, i18n.language)], {
      type: "text/plain;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `ticket-${transcript.ticket_number}-${transcript.key.slice(0, 8)}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={cn("flex min-h-0 w-full flex-col gap-4", className)}>
      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {onBack && (
            <Button variant="ghost" size="icon-sm" onClick={onBack} className="mt-0.5 shrink-0">
              <ArrowLeftIcon />
              <span className="sr-only">{t("modules.tickets.transcript.back")}</span>
            </Button>
          )}
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-lg font-semibold leading-tight">
              <span className="tabular-nums">
                {t("modules.tickets.transcript.title", { number: transcript.ticket_number })}
              </span>
              {transcript.category_name && (
                <Badge variant="secondary" className="max-w-full truncate">
                  {transcript.category_name}
                </Badge>
              )}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("modules.tickets.transcript.closedOn", {
                date: formatDateTime(transcript.closed_at, i18n.language),
              })}
              {duration !== null && ` · ${formatDuration(duration)}`}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={copyLink}>
                {copied ? (
                  <CheckIcon data-icon="inline-start" />
                ) : (
                  <LinkIcon data-icon="inline-start" />
                )}
                <span className="hidden sm:inline">
                  {t("modules.tickets.transcript.copyLink")}
                </span>
              </Button>
            </TooltipTrigger>
            {/* La clé est le **seul élément secret** du lien : le dire ici évite
                qu'elle soit collée dans un salon public par inadvertance. */}
            <TooltipContent>{t("modules.tickets.transcript.copyLinkHint")}</TooltipContent>
          </Tooltip>
          <Button variant="outline" size="sm" onClick={download}>
            <DownloadIcon data-icon="inline-start" />
            <span className="hidden sm:inline">{t("modules.tickets.transcript.download")}</span>
          </Button>
        </div>
      </div>

      {/* ── Avertissements ───────────────────────────────────────────────── */}
      {/* Le début est **réellement perdu** : plus de 20 000 messages, seuls les
          plus récents ont été gardés. Le taire ferait lire une conversation
          amputée comme une conversation complète. */}
      {transcript.truncated && (
        <Notice level="warning" title={t("modules.tickets.transcript.truncatedTitle")}>
          {t("modules.tickets.transcript.truncatedDescription")}
        </Notice>
      )}

      {/* L'équipe a eu une conversation privée ; le lecteur n'y a pas droit. On
          le dit sobrement — le cacher ferait croire à une archive incomplète. */}
      {transcript.staff_thread_withheld && !transcript.staff_thread && (
        <Notice level="info" title={t("modules.tickets.transcript.staffThreadWithheldTitle")}>
          {t("modules.tickets.transcript.staffThreadWithheldDescription")}
        </Notice>
      )}

      {/* ── Détails (repliés sur mobile, colonne fixe sur grand écran) ───── */}
      <Collapsible className="lg:hidden">
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-between">
            {t("modules.tickets.transcript.details")}
            <ChevronDownIcon data-icon="inline-end" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <TranscriptAside transcript={transcript} label={label} />
        </CollapsibleContent>
      </Collapsible>

      <div className="flex min-h-0 flex-1 gap-6">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          {/* Recherche + onglets */}
          <Tabs defaultValue="conversation" className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <TabsList>
                <TabsTrigger value="conversation">
                  <MessageSquareIcon />
                  <span className="ml-1.5">{t("modules.tickets.transcript.conversation")}</span>
                </TabsTrigger>
                {/* Présent **uniquement** pour l'équipe : la clé `staff_thread`
                    est absente de la réponse pour tout autre lecteur. */}
                {transcript.staff_thread && (
                  <TabsTrigger value="staff">
                    <LockIcon />
                    <span className="ml-1.5">{t("modules.tickets.transcript.staffThread")}</span>
                  </TabsTrigger>
                )}
              </TabsList>

              {/* Sur un écran étroit, la recherche prend sa propre ligne :
                  coincée à côté des onglets, elle se réduisait à deux lettres. */}
              <InputGroup className="w-full min-w-0 sm:w-auto sm:max-w-xs sm:flex-1">
                <InputGroupAddon>
                  <SearchIcon />
                </InputGroupAddon>
                <InputGroupInput
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("modules.tickets.transcript.searchPlaceholder")}
                />
                {query && (
                  <InputGroupAddon align="inline-end">
                    <Button variant="ghost" size="icon-xs" onClick={() => setQuery("")}>
                      <XIcon />
                      <span className="sr-only">{t("modules.tickets.transcript.clearSearch")}</span>
                    </Button>
                  </InputGroupAddon>
                )}
              </InputGroup>
            </div>

            <TabsContent value="conversation" className="mt-3 flex min-h-0 flex-1 flex-col">
              <Thread
                messages={transcript.messages}
                transcript={transcript}
                authors={authors}
                label={label}
                query={query}
              />
            </TabsContent>

            {transcript.staff_thread && (
              <TabsContent value="staff" className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
                <Notice level="info" title={t("modules.tickets.transcript.staffThreadTitle")}>
                  {t("modules.tickets.transcript.staffThreadDescription")}
                </Notice>
                <Thread
                  messages={transcript.staff_thread}
                  transcript={transcript}
                  authors={authors}
                  label={label}
                  query={query}
                />
              </TabsContent>
            )}
          </Tabs>
        </div>

        <aside className="hidden w-72 shrink-0 lg:block xl:w-80">
          <TranscriptAside transcript={transcript} label={label} />
        </aside>
      </div>
    </div>
  )
}

// ─── Fil de conversation ──────────────────────────────────────────────────────

function Thread({
  messages,
  transcript,
  authors,
  label,
  query,
}: {
  messages: TranscriptMessage[]
  transcript: TranscriptDetail
  authors: Map<string, TranscriptAuthor>
  label: (authorId: string) => string
  query: string
}) {
  const { t } = useTranslation()
  const [window_, setWindow] = useState(INITIAL_WINDOW)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [matchIndex, setMatchIndex] = useState(0)

  const blocks = useMemo(() => groupTranscriptMessages(messages), [messages])

  // Les ids des messages qui répondent à la recherche, dans l'ordre du fil :
  // ils servent à la fois au surlignage et à la navigation de résultat en
  // résultat.
  const matches = useMemo(() => {
    if (!query.trim()) return []
    return messages
      .filter((m) => transcriptSearchMatches(m, label(m.author_id), query))
      .map((m) => m.id)
  }, [messages, query, label])

  const matchSet = useMemo(() => new Set(matches), [matches])

  const hidden = Math.max(blocks.length - window_, 0)
  // Une recherche porte sur **toute** la conversation : on déplie tout dès qu'il
  // y a des résultats, sinon un message trouvé resterait hors du DOM.
  const visible = query.trim() ? blocks : blocks.slice(hidden)

  const jumpTo = useCallback((messageId: string) => {
    const node = viewportRef.current?.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`)
    node?.scrollIntoView({ block: "center", behavior: "smooth" })
    node?.animate?.([{ opacity: 0.4 }, { opacity: 1 }], { duration: 600 })
  }, [])

  const goToMatch = (delta: number) => {
    if (matches.length === 0) return
    const next = (matchIndex + delta + matches.length) % matches.length
    setMatchIndex(next)
    jumpTo(matches[next])
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center">
        <MessageSquareIcon className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t("modules.tickets.transcript.noMessage")}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {query.trim() && (
        <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 text-xs">
          <span className="text-muted-foreground">
            {matches.length === 0
              ? t("modules.tickets.transcript.noMatch")
              : t("modules.tickets.transcript.matchCount", {
                  index: matchIndex + 1,
                  count: matches.length,
                })}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={matches.length === 0}
              onClick={() => goToMatch(-1)}
            >
              <ChevronUpIcon />
              <span className="sr-only">{t("modules.tickets.transcript.previousMatch")}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={matches.length === 0}
              onClick={() => goToMatch(1)}
            >
              <ChevronDownIcon />
              <span className="sr-only">{t("modules.tickets.transcript.nextMatch")}</span>
            </Button>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border bg-card">
        <MessageScrollerProvider defaultScrollPosition="end">
          <MessageScroller>
            <MessageScrollerViewport ref={viewportRef} className="px-3 py-4 sm:px-5">
              <MessageScrollerContent className="gap-4">
                {/* Fenêtre : le début d'une très longue conversation n'est monté
                    qu'à la demande. Le scroller garde la position au dépliage. */}
                {hidden > 0 && !query.trim() && (
                  <MessageScrollerItem messageId="load-more">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setWindow((w) => w + WINDOW_STEP)}
                      >
                        {t("modules.tickets.transcript.loadEarlier", { count: hidden })}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setWindow(blocks.length)}>
                        {t("modules.tickets.transcript.loadAll")}
                      </Button>
                    </div>
                  </MessageScrollerItem>
                )}

                {visible.map((block) => {
                  if (block.kind === "day") {
                    return (
                      <MessageScrollerItem key={block.id} messageId={block.id}>
                        <Marker variant="separator">
                          <MarkerContent>{formatDay(block.date)}</MarkerContent>
                        </Marker>
                      </MessageScrollerItem>
                    )
                  }

                  if (block.kind === "system") {
                    return (
                      <MessageScrollerItem key={block.id} messageId={block.id}>
                        <SystemRow message={block.message} label={label} />
                      </MessageScrollerItem>
                    )
                  }

                  return (
                    <MessageScrollerItem key={block.id} messageId={block.id}>
                      <MessageBlock
                        authorId={block.authorId}
                        messages={block.messages}
                        transcript={transcript}
                        author={authors.get(block.authorId)}
                        label={label}
                        matches={matchSet}
                        onJump={jumpTo}
                        allMessages={messages}
                      />
                    </MessageScrollerItem>
                  )
                })}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
      </div>
    </div>
  )
}

/** Un groupe de messages consécutifs d'un même auteur — l'unité visuelle. */
function MessageBlock({
  authorId,
  messages,
  transcript,
  author,
  label,
  matches,
  onJump,
  allMessages,
}: {
  authorId: string
  messages: TranscriptMessage[]
  transcript: TranscriptDetail
  author: TranscriptAuthor | undefined
  label: (authorId: string) => string
  matches: Set<string>
  onJump: (messageId: string) => void
  allMessages: TranscriptMessage[]
}) {
  const { t, i18n } = useTranslation()

  // Le côté droit est **celui du lecteur** : l'auteur du ticket s'y reconnaît,
  // l'équipe y retrouve ses propres réponses.
  const mine = transcript.viewer.is_owner
    ? authorId === transcript.owner_id
    : authorId !== transcript.owner_id
  const align = mine ? "end" : "start"
  const name = label(authorId)
  const isOwner = authorId === transcript.owner_id

  const role = author?.is_bot
    ? t("modules.tickets.transcript.roles.bot")
    : isOwner
      ? t("modules.tickets.transcript.roles.author")
      : t("modules.tickets.transcript.roles.staff")

  return (
    <Message align={align}>
      <MessageAvatar>
        <Avatar className="size-8">
          {author?.avatar_url && <AvatarImage src={author.avatar_url} alt="" />}
          <AvatarFallback>{authorInitials(name)}</AvatarFallback>
        </Avatar>
      </MessageAvatar>

      <MessageContent>
        <MessageHeader className="gap-2">
          <span className="truncate font-semibold text-foreground">{name}</span>
          <Badge variant="secondary" className="shrink-0">
            {role}
          </Badge>
          <span className="shrink-0 tabular-nums">
            {formatTime(messages[0].created_at, i18n.language)}
          </span>
        </MessageHeader>

        {messages.map((message) => (
          <Bubble
            key={message.id}
            align={align}
            // Un message qui n'est fait que de composants V2 ou d'embeds porte
            // déjà son propre cadre (conteneur à barre d'accent) : l'enfermer
            // dans une bulle ferait un cadre dans un cadre. Sinon, des tons
            // calmes — l'archive se lit longtemps — et une seule teinte pour
            // distinguer les deux côtés.
            variant={
              isSelfFramed(message)
                ? "ghost"
                : author?.is_bot
                  ? "outline"
                  : mine
                    ? "tinted"
                    : "muted"
            }
            data-message-id={message.id}
            className={cn(
              "max-w-full sm:max-w-[85%]",
              // Le cluster de réactions déborde sous la bulle : sans cette
              // marge il recouvrirait la ligne suivante.
              message.reactions.length > 0 && "mb-3",
              matches.has(message.id) && "rounded-3xl ring-2 ring-primary/60"
            )}
          >
            <BubbleContent className="flex flex-col gap-2">
              {message.reply_to && (
                <ReplyPreview
                  messageId={message.reply_to}
                  messages={allMessages}
                  label={label}
                  onJump={onJump}
                />
              )}

              <DiscordMessageBody message={message} />

              {(message.edited_at || message.pinned) && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  {message.edited_at && (
                    <span className="inline-flex items-center gap-1">
                      <PencilIcon className="size-3" />
                      {t("modules.tickets.transcript.edited")}
                    </span>
                  )}
                  {message.pinned && (
                    <span className="inline-flex items-center gap-1">
                      <PinIcon className="size-3" />
                      {t("modules.tickets.transcript.pinned")}
                    </span>
                  )}
                </p>
              )}
            </BubbleContent>

            {message.reactions.length > 0 && (
              <BubbleReactions side="bottom" align={align}>
                {message.reactions.map((reaction, index) => (
                  <Badge key={index} variant="secondary" className="gap-1">
                    <span aria-hidden>{reaction.emoji}</span>
                    <span className="tabular-nums">{reaction.count}</span>
                  </Badge>
                ))}
              </BubbleReactions>
            )}
          </Bubble>
        ))}
      </MessageContent>
    </Message>
  )
}

/**
 * Un message sans texte, fait uniquement de composants V2 ou d'embeds, porte
 * déjà son propre cadre : la bulle passerait en double encadrement.
 */
function isSelfFramed(message: TranscriptMessage): boolean {
  if (message.content) return false
  return message.components.length > 0 || message.embeds.length > 0
}

/**
 * Aperçu d'une citation : le markdown y serait illisible sur une seule ligne
 * tronquée (`**gras**`, `### titre`), on le retire plutôt que de le rendre.
 */
function plainPreview(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "…")
    .replace(/[*_~`>|]/g, "")
    .replace(/^#{1,3}\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** Citation du message auquel on répond — cliquable pour y sauter. */
function ReplyPreview({
  messageId,
  messages,
  label,
  onJump,
}: {
  messageId: string
  messages: TranscriptMessage[]
  label: (authorId: string) => string
  onJump: (messageId: string) => void
}) {
  const { t } = useTranslation()
  const target = messages.find((m) => m.id === messageId)

  // Le message cité peut être hors de l'archive (conversation tronquée, message
  // supprimé avant la fermeture) : on le dit plutôt que de rendre une citation
  // vide.
  if (!target) {
    return (
      <p className="border-l-2 pl-2 text-xs text-muted-foreground italic">
        {t("modules.tickets.transcript.replyUnavailable")}
      </p>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onJump(messageId)}
      className="flex min-w-0 items-baseline gap-1.5 border-l-2 pl-2 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <span className="shrink-0 font-medium">{label(target.author_id)}</span>
      <span className="truncate">
        {target.content
          ? plainPreview(target.content)
          : t("modules.tickets.transcript.noTextContent")}
      </span>
    </button>
  )
}

function SystemRow({
  message,
  label,
}: {
  message: TranscriptMessage
  label: (authorId: string) => string
}) {
  const { t, i18n } = useTranslation()
  const key = `modules.tickets.transcript.system.${message.system_type}`
  const known = i18n.exists(key)

  return (
    <Marker>
      <MarkerIcon>
        <HashIcon />
      </MarkerIcon>
      <MarkerContent className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
        {/* Un type système inconnu n'est pas masqué : on montre son identifiant
            plutôt que de faire disparaître une ligne de l'historique. */}
        <span>
          {known
            ? t(key, { user: label(message.author_id) })
            : t("modules.tickets.transcript.system.unknown", {
                user: label(message.author_id),
                type: message.system_type,
              })}
        </span>
        <span className="tabular-nums opacity-70">
          {formatTime(message.created_at, i18n.language)}
        </span>
      </MarkerContent>
    </Marker>
  )
}

// ─── Colonne de détails ───────────────────────────────────────────────────────

function TranscriptAside({
  transcript,
  label,
}: {
  transcript: TranscriptDetail
  label: (authorId: string) => string
}) {
  const { t, i18n } = useTranslation()
  const duration = transcriptDurationSeconds(transcript)
  const agent = transcript.claimed_by ?? transcript.closed_by

  return (
    <div className="flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex flex-col gap-3">
        <PropRow label={t("modules.tickets.transcript.props.author")} value={label(transcript.owner_id)} />
        {agent && (
          <PropRow
            label={t(
              transcript.claimed_by
                ? "modules.tickets.transcript.props.claimedBy"
                : "modules.tickets.transcript.props.closedBy"
            )}
            value={label(agent)}
          />
        )}
        {transcript.close_reason && (
          <PropRow
            label={t("modules.tickets.transcript.props.closeReason")}
            value={transcript.close_reason}
          />
        )}
        <PropRow
          label={t("modules.tickets.transcript.props.opened")}
          value={formatDateTime(transcript.opened_at, i18n.language)}
        />
        <PropRow
          label={t("modules.tickets.transcript.props.closed")}
          value={formatDateTime(transcript.closed_at, i18n.language)}
        />
        {duration !== null && (
          <PropRow
            label={t("modules.tickets.transcript.props.duration")}
            value={formatDuration(duration) ?? "—"}
          />
        )}
        <PropRow
          label={t("modules.tickets.transcript.props.messages")}
          value={transcript.message_count.toLocaleString(i18n.language)}
        />
        <PropRow
          label={t("modules.tickets.transcript.props.size")}
          value={formatBytes(transcript.payload_size, i18n.language)}
        />
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <UsersIcon className="size-3.5" />
          {t("modules.tickets.transcript.props.participants", {
            count: transcript.authors.length,
          })}
        </p>
        <div className="flex flex-col gap-1.5">
          {transcript.authors.map((author) => (
            <div key={author.author_id} className="flex min-w-0 items-center gap-2">
              <Avatar className="size-6">
                {author.avatar_url && <AvatarImage src={author.avatar_url} alt="" />}
                <AvatarFallback className="text-[10px]">
                  {authorInitials(authorName(author, author.author_id))}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-sm">{authorName(author, author.author_id)}</span>
              {author.is_bot && (
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {t("modules.tickets.transcript.roles.bot")}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </div>

      {transcript.rating && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <StarIcon className="size-3.5" />
              {t("modules.tickets.ratings.title")}
            </p>
            {/* L'appréciation, jamais `n/5` : la personne n'a vu que ces mots. */}
            <Badge variant="secondary" className="w-fit">
              {t(`modules.tickets.ratings.scores.${transcript.rating.score_key}`)}
            </Badge>
            {transcript.rating.comment && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                “{transcript.rating.comment}”
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {t(`modules.tickets.ratings.triggers.${transcript.rating.trigger}`)}
            </p>
          </div>
        </>
      )}
    </div>
  )
}

function PropRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm wrap-break-word">{value}</span>
    </div>
  )
}

// ─── Dates et export ──────────────────────────────────────────────────────────

function formatDateTime(value: string, locale: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })
}

function formatTime(value: string, locale: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
}

function formatDay(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

/**
 * Export texte — une archive lisible hors du dashboard, sans dépendance. Le
 * thread privé de l'équipe n'y figure que s'il a été servi (donc seulement pour
 * un lecteur staff) : l'export ne doit pas être une porte dérobée.
 */
function plainTextExport(
  transcript: TranscriptDetail,
  label: (authorId: string) => string,
  locale: string
): string {
  const lines: string[] = [
    `Ticket #${transcript.ticket_number}`,
    transcript.category_name ?? "",
    `${formatDateTime(transcript.opened_at, locale)} → ${formatDateTime(transcript.closed_at, locale)}`,
    "",
  ]

  const render = (messages: TranscriptMessage[]) => {
    for (const message of messages) {
      const time = formatDateTime(message.created_at, locale)
      const body = message.content ?? ""
      lines.push(`[${time}] ${label(message.author_id)}: ${body}`)
      for (const attachment of message.attachments) {
        lines.push(`    📎 ${attachment.filename}${attachment.url ? ` — ${attachment.url}` : ""}`)
      }
    }
  }

  render(transcript.messages)

  if (transcript.staff_thread) {
    lines.push("", "— Staff thread —", "")
    render(transcript.staff_thread)
  }

  return lines.join("\n")
}
