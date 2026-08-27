import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { BotIcon, AlertTriangleIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
} from "@/components/ui/message"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { EntityAvatar } from "./entity-ref"

// ─── Parsing du log de contexte automod ───────────────────────────────────────
// `context_text` est une string brute déjà formatée par le bot, une ligne par
// message : `[date] Nom (id): contenu`. Le message signalé est le dernier, préfixé
// par `>>>`. Jusqu'à 15 messages précédents. On le découpe pour l'afficher avec le
// composant Message (bulles), en récupérant l'avatar de chaque auteur via son id.

interface AutomodContextMessage {
  timestamp: string
  name: string
  id: string | null
  content: string
  flagged: boolean
}

// [timestamp] (>>> )?Nom (id): contenu — le `(id)` capté est le dernier groupe
// de chiffres entre parenthèses avant le `:` (le nom peut lui-même contenir des
// parenthèses).
const LINE_RE = /^\[([^\]]+)\]\s*(>>>\s*)?(.+?)\s*\((\d+)\):\s?(.*)$/

function parseAutomodContext(text: string): AutomodContextMessage[] {
  return text
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim().length > 0)
    .map((line) => {
      const m = line.match(LINE_RE)
      if (!m) {
        // Ligne non conforme : on la préserve telle quelle plutôt que de la perdre.
        const flagged = line.includes(">>>")
        return {
          timestamp: "",
          name: "",
          id: null,
          content: line.replace(/^\s*>>>\s*/, ""),
          flagged,
        }
      }
      return {
        timestamp: m[1],
        flagged: !!m[2],
        name: m[3],
        id: m[4],
        content: m[5],
      }
    })
}

// ─── Ligne de message ──────────────────────────────────────────────────────────

function ContextMessageRow({ msg }: { msg: AutomodContextMessage }) {
  const { t } = useTranslation()
  return (
    <Message align="start">
      <MessageAvatar className="self-start bg-transparent">
        <EntityAvatar kind="discord_user" id={msg.id} className="size-8" />
      </MessageAvatar>
      <MessageContent>
        <MessageHeader className="gap-2 px-0">
          {msg.name && <span className="font-medium text-foreground/80">{msg.name}</span>}
          {msg.timestamp && (
            <span className="text-xs tabular-nums text-muted-foreground/60">{msg.timestamp}</span>
          )}
          {msg.flagged && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0 text-[10px] font-medium text-destructive">
              <AlertTriangleIcon className="size-2.5" />
              {t("cases.evidence.flagged")}
            </span>
          )}
        </MessageHeader>
        <Bubble variant={msg.flagged ? "destructive" : "muted"} align="start" className="max-w-full">
          <BubbleContent
            className={msg.flagged ? "whitespace-pre-wrap rounded-2xl ring-1 ring-destructive/30" : "whitespace-pre-wrap rounded-2xl"}
          >
            {msg.content || <span className="italic opacity-70">—</span>}
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  )
}

// ─── Dialog ─────────────────────────────────────────────────────────────────────

export function AutomodContextDialog({
  open,
  onOpenChange,
  text,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  text: string
}) {
  const { t } = useTranslation()
  const messages = useMemo(() => parseAutomodContext(text), [text])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BotIcon className="size-4 text-sky-500" />
            {t("cases.evidence.contextTitle")}
          </DialogTitle>
          <DialogDescription>{t("cases.evidence.contextDescription")}</DialogDescription>
        </DialogHeader>

        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("cases.evidence.noContent")}
          </p>
        ) : (
          <div className="-mx-1 max-h-[60vh] overflow-y-auto px-1 py-1">
            <div className="flex flex-col gap-3">
              {messages.map((m, i) => (
                <ContextMessageRow key={i} msg={m} />
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
