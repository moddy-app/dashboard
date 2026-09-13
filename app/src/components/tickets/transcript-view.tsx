import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
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
  useMessageScroller,
  useMessageScrollerVisibility,
} from "@/components/ui/message-scroller"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DiscordMessageBody, EmojiText } from "@/components/tickets/discord-message"
import { Notice } from "@/components/tickets/fields"
import { DiscordMentionProvider } from "@/components/discord-mention"
import { MessageContextMenu, UserContextMenu } from "@/components/tickets/message-context-menu"
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
  selfId,
  onBack,
  className,
}: {
  transcript: TranscriptDetail
  /**
   * Identifiant Discord du lecteur connecté. **Seuls ses propres messages**
   * passent à droite : un fil de support n'a pas deux camps, il a une personne
   * qui lit et tous les autres. Sans lui, tout s'aligne à gauche — ce qui est
   * la bonne lecture d'une conversation à laquelle on n'a pas participé.
   */
  selfId?: string | null
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

  /**
   * Les mentions `<@id>` ne se résolvent que sur `authors` — l'archive ne stocke
   * ni la liste des membres, ni celle des rôles ou des salons. Un id absent
   * reste donc affiché nu : ce composant ne sait rien de plus, et un nom inventé
   * serait pire qu'un identifiant.
   */
  const resolveUser = useCallback(
    (id: string) => {
      const author = authors.get(id)
      return author ? authorName(author, id) : null
    },
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
    <DiscordMentionProvider resolveUser={resolveUser} selfId={selfId}>
    <div className={cn("flex min-h-0 w-full flex-col gap-3 sm:gap-4", className)}>
      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      {/* Sur mobile, chaque ligne d'en-tête est prise sur la conversation : le
          titre et les actions tiennent donc sur **une** rangée, et la méta se
          résume à une ligne tronquée. */}
      <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-3">
          {onBack && (
            <Button variant="ghost" size="icon-sm" onClick={onBack} className="mt-0.5 shrink-0">
              <ArrowLeftIcon />
              <span className="sr-only">{t("modules.tickets.transcript.back")}</span>
            </Button>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight tabular-nums sm:text-xl">
              {t("modules.tickets.transcript.title", { number: transcript.ticket_number })}
            </h1>
            {/* Une seule ligne de méta, ponctuée de points : la catégorie, la
                date de fermeture, la durée. Trois badges feraient du bruit
                là où il n'y a qu'un contexte à poser. */}
            <p className="mt-0.5 flex items-center gap-x-1.5 truncate text-xs text-muted-foreground sm:mt-1 sm:flex-wrap sm:text-sm">
              {transcript.category_name && (
                <>
                  <span className="truncate font-medium text-foreground">
                    {transcript.category_name}
                  </span>
                  <span aria-hidden>·</span>
                </>
              )}
              <span>
                {t("modules.tickets.transcript.closedOn", {
                  date: formatDateTime(transcript.closed_at, i18n.language),
                })}
              </span>
              {duration !== null && (
                <>
                  <span aria-hidden>·</span>
                  <span className="tabular-nums">{formatDuration(duration)}</span>
                </>
              )}
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

              {/* La recherche partage la rangée des onglets : sur mobile,
                  chaque ligne d'en-tête est prise sur la conversation. `basis`
                  lui garde une largeur utilisable, et elle ne passe à la ligne
                  que si l'écran est vraiment trop étroit. */}
              <InputGroup className="min-w-0 flex-1 basis-40 sm:max-w-xs">
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
                selfId={selfId}
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
                  selfId={selfId}
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
    </DiscordMentionProvider>
  )
}

// ─── Fil de conversation ──────────────────────────────────────────────────────

function Thread({
  messages,
  transcript,
  selfId,
  authors,
  label,
  query,
}: {
  messages: TranscriptMessage[]
  transcript: TranscriptDetail
  selfId?: string | null
  authors: Map<string, TranscriptAuthor>
  label: (authorId: string) => string
  query: string
}) {
  const { t } = useTranslation()
  const { scrollToMessage } = useMessageScroller()
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

  // Référence stable : l'effet de `LoadEarlier` ne doit se réarmer que sur un
  // changement réel, jamais à cause d'une fonction recréée à chaque rendu — ce
  // serait une boucle de chargement.
  //
  // `preserveScrollOnPrepend` du scroller ne suffit pas ici : sa restauration
  // ne se déclenche que si le premier enfant précédent se retrouve à un index
  // > 0 après coup. Or notre sentinelle (`LOAD_MORE_ID`) reste **toujours** le
  // tout premier enfant tant que `hidden > 0` — les blocs nouvellement révélés
  // s'insèrent *après* elle, jamais avant. Son index reste donc 0 à chaque
  // rechargement, la restauration automatique ne se déclenche jamais, la
  // sentinelle ne bouge jamais à l'écran, reste visible, et `onReach` se
  // redéclenche en boucle — c'est le chargement infini. On ancre donc
  // manuellement sur le premier bloc **réel** actuellement affiché : une fois
  // la fenêtre agrandie, on ramène ce bloc en haut du viewport, ce qui pousse
  // la sentinelle hors champ et arrête la boucle.
  const anchorIdRef = useRef<string | null>(null)
  const visibleRef = useRef(visible)
  useLayoutEffect(() => {
    visibleRef.current = visible
  })
  const loadMore = useCallback(() => {
    anchorIdRef.current = visibleRef.current[0]?.id ?? null
    setWindow((w) => w + WINDOW_STEP)
  }, [])

  useLayoutEffect(() => {
    const anchorId = anchorIdRef.current
    if (!anchorId) return
    anchorIdRef.current = null
    scrollToMessage(anchorId, { align: "start" })
  }, [window_, scrollToMessage])

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

      {/* Pleine largeur sur mobile : les marges de la page et les coins arrondis
          reprenaient une bande de chaque côté d'un écran qui n'en a pas à
          donner. Le cadre revient dès qu'il y a la place. */}
      <div className="-mx-3 min-h-0 flex-1 overflow-hidden border-y bg-card sm:mx-0 sm:rounded-xl sm:border">
        <MessageScrollerProvider defaultScrollPosition="end">
          <MessageScroller>
            <MessageScrollerViewport
              ref={viewportRef}
              preserveScrollOnPrepend
              className="px-3 py-4 sm:px-6 sm:py-5"
            >
              <MessageScrollerContent className="mx-auto w-full max-w-3xl gap-5">
                {/* Fenêtre : le début d'une très longue conversation n'est monté
                    qu'à la demande. Le scroller garde la position au dépliage. */}
                {hidden > 0 && !query.trim() && (
                  <MessageScrollerItem messageId={LOAD_MORE_ID}>
                    <LoadEarlier remaining={hidden} onReach={loadMore} />
                  </MessageScrollerItem>
                )}

                {visible.map((block) => {
                  if (block.kind === "day") {
                    return (
                      <MessageScrollerItem key={block.id} messageId={block.id}>
                        <Marker variant="separator">
                          <MarkerContent className="text-[11px] font-medium">
                            {formatDay(block.date)}
                          </MarkerContent>
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
                        selfId={selfId}
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

/** Identifiant de la sentinelle de chargement, connu du scroller. */
const LOAD_MORE_ID = "load-more"

/**
 * Chargement du début de la conversation **en remontant**, sans bouton.
 *
 * La visibilité est lue sur `useMessageScrollerVisibility` — l'échappatoire
 * prévue par le scroller — plutôt que sur un `IntersectionObserver` maison : le
 * scroller sait déjà quels éléments sont à l'écran, et c'est lui qui conserve la
 * position quand des blocs s'insèrent au-dessus.
 *
 * `remaining` fait partie des dépendances : si l'ajout d'une tranche laisse la
 * sentinelle encore visible (des blocs très courts), l'effet se réarme et charge
 * la suivante. Sans ça, le chargement s'arrêterait sans que rien ne bouge à
 * l'écran.
 */
function LoadEarlier({ remaining, onReach }: { remaining: number; onReach: () => void }) {
  const { t } = useTranslation()
  const { visibleMessageIds } = useMessageScrollerVisibility()
  const visible = visibleMessageIds.includes(LOAD_MORE_ID)

  useEffect(() => {
    if (visible) onReach()
  }, [visible, remaining, onReach])

  return (
    <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
      <Spinner />
      {t("modules.tickets.transcript.loadingEarlier", { count: remaining })}
    </div>
  )
}

/** Un groupe de messages consécutifs d'un même auteur — l'unité visuelle. */
function MessageBlock({
  authorId,
  messages,
  transcript,
  selfId,
  author,
  label,
  matches,
  onJump,
  allMessages,
}: {
  authorId: string
  messages: TranscriptMessage[]
  transcript: TranscriptDetail
  selfId?: string | null
  author: TranscriptAuthor | undefined
  label: (authorId: string) => string
  matches: Set<string>
  onJump: (messageId: string) => void
  allMessages: TranscriptMessage[]
}) {
  const { t, i18n } = useTranslation()

  // **Seuls les messages du lecteur connecté** passent à droite. Une archive de
  // support n'oppose pas deux camps : il y a celui qui lit, et tous les autres.
  const mine = Boolean(selfId) && authorId === selfId
  const align = mine ? "end" : "start"
  const name = label(authorId)
  const isOwner = authorId === transcript.owner_id

  // Le rôle ne se dit que lorsqu'il apprend quelque chose : un bot, ou l'auteur
  // du ticket. Étiqueter chaque groupe transformerait le fil en mur de badges.
  const role = author?.is_bot
    ? t("modules.tickets.transcript.roles.bot")
    : isOwner
      ? t("modules.tickets.transcript.roles.author")
      : null

  return (
    <Message align={align}>
      {/* L'avatar se pose en haut du groupe, en face du nom — collé en bas, il
          flottait loin de la personne à qui il appartient. */}
      <MessageAvatar className="translate-y-0! self-start">
        <Avatar className="size-7">
          {author?.avatar_url && <AvatarImage src={author.avatar_url} alt="" />}
          <AvatarFallback className="text-[11px]">{authorInitials(name)}</AvatarFallback>
        </Avatar>
      </MessageAvatar>

      <MessageContent className="gap-1.5">
        <MessageHeader className="gap-2 px-1">
          <span className="truncate font-medium text-foreground">{name}</span>
          {role && (
            <span className="shrink-0 text-muted-foreground/80">{role}</span>
          )}
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
            {formatTime(messages[0].created_at, i18n.language)}
          </span>
        </MessageHeader>

        {messages.map((message) => (
          // Clic droit : copier l'identifiant du message, de son auteur, du
          // salon ou du serveur. Une archive s'ouvre pour enquêter, et tout y
          // est rendu sous forme lisible — l'identifiant n'apparaît nulle part
          // ailleurs.
          <MessageContextMenu
            key={message.id}
            message={message}
            transcript={transcript}
            authorLabel={name}
          >
          <Bubble
            align={align}
            // Un message qui n'est fait que de composants V2 ou d'embeds porte
            // déjà son propre cadre (conteneur à barre d'accent) : l'enfermer
            // dans une bulle ferait un cadre dans un cadre. Sinon : le bleu
            // d'accentuation pour le lecteur (`default`), un gris calme pour
            // les autres, un contour pour le bot — une archive se lit
            // longtemps, une seule couleur vive suffit à s'y repérer.
            variant={
              isSelfFramed(message)
                ? "ghost"
                : mine
                  ? "default"
                  : author?.is_bot
                    ? "outline"
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
            <BubbleContent
              className={cn(
                "flex flex-col gap-2",
                // Une pastille de mention se peint en `primary` sur `primary` :
                // sur la bulle pleine du lecteur, elle disparaissait purement et
                // simplement. On la repeint dans le contraste de ce fond.
                mine &&
                  !isSelfFramed(message) &&
                  "[&_[data-mention]]:bg-primary-foreground/20 [&_[data-mention]]:text-primary-foreground [&_[data-mention]:hover]:bg-primary-foreground/30"
              )}
            >
              {message.reply_to && (
                <ReplyPreview
                  message={message}
                  messages={allMessages}
                  label={label}
                  onJump={onJump}
                  onPrimary={mine && !isSelfFramed(message)}
                />
              )}

              <DiscordMessageBody message={message} />

              {(message.edited_at || message.pinned) && (
                <p
                  className={cn(
                    "flex items-center gap-2 text-[11px]",
                    // Sur la bulle pleine, `muted-foreground` devient illisible :
                    // on atténue la couleur du texte au lieu de la remplacer.
                    mine ? "opacity-70" : "text-muted-foreground"
                  )}
                >
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
                    {/* Une réaction peut être un émoji du serveur : c'est une
                        image du CDN, pas un caractère. */}
                    <EmojiText text={reaction.emoji} />
                    <span className="tabular-nums">{reaction.count}</span>
                  </Badge>
                ))}
              </BubbleReactions>
            )}
          </Bubble>
          </MessageContextMenu>
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

/**
 * Citation du message auquel on répond.
 *
 * Trois sources, dans cet ordre — chacune sait quelque chose que la suivante
 * ignore :
 *
 * 1. **Le message lui-même**, s'il est dans l'archive : la citation devient
 *    cliquable, on saute dessus.
 * 2. **`reference_preview`** (la clé `pr` du corps stocké) : un aperçu autonome
 *    écrit à l'export. Il couvre exactement les cas où le 1 échoue — début
 *    tronqué, message supprimé depuis — et il porte le texte même quand le
 *    message d'origine était une carte sans `content`. Pas de saut possible :
 *    la cible n'est pas montée.
 * 3. **Rien** : Discord n'avait pas su résoudre la référence à l'export. On le
 *    dit, plutôt que d'afficher une citation vide.
 */
function ReplyPreview({
  message,
  messages,
  label,
  onJump,
  onPrimary = false,
}: {
  message: TranscriptMessage
  messages: TranscriptMessage[]
  label: (authorId: string) => string
  onJump: (messageId: string) => void
  /**
   * La citation est-elle posée sur la bulle pleine du lecteur ? `muted-foreground`
   * et la couleur de bordure par défaut y sont presque illisibles : sur ce fond,
   * le contraste se prend sur `primary-foreground`, pas sur les tokens neutres.
   */
  onPrimary?: boolean
}) {
  const { t } = useTranslation()
  const messageId = message.reply_to
  const target = messageId ? messages.find((m) => m.id === messageId) : undefined
  const preview = message.reference_preview

  const quote = cn(
    "border-l-2 pl-2 text-xs",
    onPrimary
      ? "border-primary-foreground/50 text-primary-foreground/80"
      : "text-muted-foreground"
  )

  if (target && messageId) {
    return (
      <button
        type="button"
        onClick={() => onJump(messageId)}
        className={cn(
          quote,
          "flex min-w-0 items-baseline gap-1.5 text-left transition-colors",
          onPrimary ? "hover:text-primary-foreground" : "hover:text-foreground"
        )}
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

  // Le message d'origine a bien existé, il n'existait plus à l'export. C'est une
  // information — souvent celle qu'on cherchait — pas un trou à masquer.
  if (preview?.kind === "deleted") {
    return <p className={cn(quote, "italic")}>{t("modules.tickets.transcript.replyDeleted")}</p>
  }

  if (preview?.kind === "preview") {
    return (
      <div className={cn(quote, "flex min-w-0 items-baseline gap-1.5")}>
        <span className="shrink-0 font-medium">
          {preview.author_id
            ? label(preview.author_id)
            : t("modules.tickets.transcript.unknownAuthor")}
        </span>
        <span className="truncate">
          {preview.content
            ? plainPreview(preview.content)
            : t("modules.tickets.transcript.noTextContent")}
        </span>
      </div>
    )
  }

  return <p className={cn(quote, "italic")}>{t("modules.tickets.transcript.replyUnavailable")}</p>
}

/**
 * Un **événement du salon** : épinglage, arrivée, départ, renommage. Une réponse
 * n'en est pas un et ne passe jamais ici — voir `isSystemEvent()`.
 *
 * Deux champs additifs du corps stocké rendent ces lignes utiles plutôt que
 * décoratives : `system_target` nomme la personne **concernée** par un
 * `recipient_add` / `recipient_remove` (sans lui, « quelqu'un a été ajouté »
 * n'apprend rien), et `reference_preview` cite le message épinglé — Discord
 * attache la même référence à un `pin_add` qu'à une réponse.
 */
function SystemRow({
  message,
  label,
}: {
  message: TranscriptMessage
  label: (authorId: string) => string
}) {
  const { t, i18n } = useTranslation()
  const target = message.system_target
  // Une clé `_target` dédiée quand la cible est connue : « X a ajouté Y » et
  // « X a ajouté quelqu'un » sont deux phrases, pas une phrase à trou.
  const base = `modules.tickets.transcript.system.${message.system_type}`
  const key = target && i18n.exists(`${base}_target`) ? `${base}_target` : base
  const known = i18n.exists(key)
  const preview = message.reference_preview

  return (
    <Marker>
      <MarkerIcon>{message.system_type === "pin_add" ? <PinIcon /> : <HashIcon />}</MarkerIcon>
      <MarkerContent className="flex min-w-0 flex-col gap-1 text-xs">
        <span className="flex flex-wrap items-baseline gap-x-1.5">
          {/* Un type système inconnu n'est pas masqué : on montre son identifiant
              plutôt que de faire disparaître une ligne de l'historique. */}
          <span>
            {known
              ? t(key, { user: label(message.author_id), target: target ? label(target) : "" })
              : t("modules.tickets.transcript.system.unknown", {
                  user: label(message.author_id),
                  type: message.system_type,
                })}
          </span>
          <span className="tabular-nums opacity-70">
            {formatTime(message.created_at, i18n.language)}
          </span>
        </span>

        {/* « A épinglé un message » sans dire lequel obligeait à recroiser toute
            la conversation — quand le message y est encore. */}
        {preview?.kind === "preview" && (
          <span className="flex min-w-0 items-baseline gap-1.5 border-l-2 pl-2 text-muted-foreground">
            <span className="shrink-0 font-medium">
              {preview.author_id
                ? label(preview.author_id)
                : t("modules.tickets.transcript.unknownAuthor")}
            </span>
            <span className="truncate">
              {preview.content
                ? plainPreview(preview.content)
                : t("modules.tickets.transcript.noTextContent")}
            </span>
          </span>
        )}
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
      <p className="text-xs font-medium text-muted-foreground">
        {t("modules.tickets.transcript.details")}
      </p>
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
            <UserContextMenu
              key={author.author_id}
              userId={author.author_id}
              label={authorName(author, author.author_id)}
            >
              <div className="flex min-w-0 items-center gap-2">
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
            </UserContextMenu>
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
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-sm font-medium wrap-break-word">{value}</span>
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
