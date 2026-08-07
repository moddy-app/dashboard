import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  AlertCircleIcon,
  LoaderIcon,
  MessageSquareIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { handleSaveError } from "@/lib/handle-error"
import { logger } from "@/lib/logger"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ErrorPage } from "@/components/error-state"
import { MessageEditor } from "@/components/message-editor"
import { useGuildContext } from "@/contexts/GuildContext"
import { CHANNEL_TYPES, MAX_WELCOME_MESSAGES, WELCOME_DEFAULT_ACCENT } from "@/types/api"
import type { WelcomeChannelConfig, WelcomeMessage } from "@/types/api"
import {
  WELCOME_PLACEHOLDERS,
  accentHexToInt,
  accentIntToHex,
  buildWelcomeConfig,
  canAddWelcomeMessage,
  generateWelcomeId,
  readWelcomeConfig,
} from "@/lib/welcome"
import { cn } from "@/lib/utils"

const MODULE_ID = "welcome_channel"
const MESSAGE_MAX = 1500
const DEFAULT_ACCENT_HEX = accentIntToHex(WELCOME_DEFAULT_ACCENT)

// ─── Brouillon d'édition ──────────────────────────────────────────────────────

interface MessageDraft {
  channel_id: string
  message: string
  useDefaultColor: boolean
  accent_color: string // hex #RRGGBB
  enabled: boolean
}

interface EditingState {
  isNew: boolean
  /** Entrée d'origine (édition) — porte l'id à conserver. */
  source: WelcomeMessage | null
  draft: MessageDraft
}

function draftFromMessage(m: WelcomeMessage): MessageDraft {
  return {
    channel_id: String(m.channel_id),
    message: m.message,
    useDefaultColor: m.accent_color === null,
    accent_color: accentIntToHex(m.accent_color),
    enabled: m.enabled,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function WelcomeChannelPage() {
  const { t } = useTranslation()
  const {
    modules,
    channels,
    isLoadingGuild,
    isGuildReady,
    guildError,
    refreshGuildData,
    updateModule,
    disableModule,
  } = useGuildContext()

  const config = modules[MODULE_ID] as WelcomeChannelConfig | undefined

  const [messages, setMessages] = useState<WelcomeMessage[]>([])
  const [editing, setEditing] = useState<EditingState | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<WelcomeMessage | null>(null)

  // La config vient du chargement du serveur (GET /modules) — toujours du v2,
  // les entrées v1 sont migrées côté backend à la lecture.
  useEffect(() => {
    setMessages(readWelcomeConfig(config))
  }, [config])

  const textChannels = channels.filter(
    (c) => c.type === CHANNEL_TYPES.TEXT || c.type === CHANNEL_TYPES.ANNOUNCEMENT
  )

  /**
   * Écrit la liste complète : chaque action déclenche une sauvegarde immédiate
   * (pas de barre « enregistrer »). Une liste vide désactive le module.
   */
  const persist = useCallback(
    async (next: WelcomeMessage[]) => {
      const previous = messages
      setMessages(next)
      try {
        if (next.length === 0) {
          await disableModule(MODULE_ID)
        } else {
          await updateModule(MODULE_ID, { ...buildWelcomeConfig(next) })
        }
        return true
      } catch (e) {
        // Rollback : l'état local ne doit jamais diverger du backend.
        setMessages(previous)
        logger.error(`module:${MODULE_ID}`, "Save failed", e)
        handleSaveError(e, { title: t("modules.saveError") })
        return false
      }
    },
    [messages, updateModule, disableModule, t]
  )

  // ── Ouverture du formulaire ────────────────────────────────────────────────

  const openNew = () => {
    setEditing({
      isNew: true,
      source: null,
      draft: {
        channel_id: "",
        message: t("modules.welcome_channel.defaultMessage"),
        useDefaultColor: true,
        accent_color: DEFAULT_ACCENT_HEX,
        enabled: true,
      },
    })
  }

  const openEdit = (m: WelcomeMessage) => {
    setEditing({ isNew: false, source: m, draft: draftFromMessage(m) })
  }

  const patchDraft = (patch: Partial<MessageDraft>) => {
    setEditing((prev) => (prev ? { ...prev, draft: { ...prev.draft, ...patch } } : null))
  }

  // ── Enregistrement (ajout ou édition) ──────────────────────────────────────

  const handleSave = async () => {
    if (!editing) return
    const { isNew, source, draft } = editing

    if (!draft.channel_id) {
      toast.error(t("modules.welcome_channel.errorChannelRequired"))
      return
    }
    const text = draft.message.trim()
    if (!text) {
      toast.error(t("modules.welcome_channel.errorMessageRequired"))
      return
    }
    if (text.length > MESSAGE_MAX) {
      toast.error(t("modules.welcome_channel.errorMessageTooLong", { max: MESSAGE_MAX }))
      return
    }

    let accent: number | null = null
    if (!draft.useDefaultColor) {
      accent = accentHexToInt(draft.accent_color)
      if (accent === null) {
        toast.error(t("modules.welcome_channel.errorColorInvalid"))
        return
      }
    }

    setIsSaving(true)
    try {
      let next: WelcomeMessage[]
      if (isNew) {
        if (!canAddWelcomeMessage(messages)) {
          toast.error(t("modules.welcome_channel.errorLimit", { max: MAX_WELCOME_MESSAGES }))
          return
        }
        const created: WelcomeMessage = {
          id: generateWelcomeId(messages),
          channel_id: draft.channel_id,
          message: text,
          accent_color: accent,
          enabled: draft.enabled,
          created_by: null,
          created_at: new Date().toISOString(),
        }
        next = [...messages, created]
        logger.event(`module:${MODULE_ID}`, "Add message", created)
      } else if (source) {
        next = messages.map((m) =>
          m.id === source.id
            ? {
                ...m,
                channel_id: draft.channel_id,
                message: text,
                accent_color: accent,
                enabled: draft.enabled,
              }
            : m
        )
        logger.event(`module:${MODULE_ID}`, "Update message", { id: source.id })
      } else {
        return
      }

      if (await persist(next)) {
        toast.success(
          isNew ? t("modules.welcome_channel.addedSuccess") : t("modules.saved")
        )
        setEditing(null)
      }
    } finally {
      setIsSaving(false)
    }
  }

  // ── Pause / reprise ────────────────────────────────────────────────────────

  const handleTogglePause = async (m: WelcomeMessage) => {
    setPendingId(m.id)
    try {
      const next = messages.map((x) => (x.id === m.id ? { ...x, enabled: !x.enabled } : x))
      if (await persist(next)) {
        toast.success(
          m.enabled
            ? t("modules.welcome_channel.pausedSuccess")
            : t("modules.welcome_channel.resumedSuccess")
        )
      }
    } finally {
      setPendingId(null)
    }
  }

  // ── Suppression ────────────────────────────────────────────────────────────

  const handleDelete = async (m: WelcomeMessage) => {
    setPendingId(m.id)
    try {
      logger.event(`module:${MODULE_ID}`, "Delete message", { id: m.id })
      if (await persist(messages.filter((x) => x.id !== m.id))) {
        toast.success(t("modules.welcome_channel.removedSuccess"))
      }
    } finally {
      setPendingId(null)
      setConfirmDelete(null)
    }
  }

  // ── États de chargement / erreur ───────────────────────────────────────────

  if (guildError) {
    return <ErrorPage error={guildError} onRetry={refreshGuildData} />
  }

  if (isLoadingGuild || !isGuildReady) {
    return (
      <div className="flex flex-col gap-4 w-full">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  const canAdd = canAddWelcomeMessage(messages)

  return (
    <div className="flex flex-col gap-6 w-full pb-16">
      {/* En-tête */}
      <div className="flex items-center gap-4">
        <div className="size-11 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0">
          <MessageSquareIcon className="size-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold leading-none">
            {t("modules.welcome_channel.name")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("modules.welcome_channel.description")}
          </p>
        </div>
      </div>

      {/* Liste des messages */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">
              {t("modules.welcome_channel.messagesTitle")}
            </CardTitle>
            <CardDescription>
              {t("modules.welcome_channel.messagesDescription", {
                used: messages.length,
                max: MAX_WELCOME_MESSAGES,
              })}
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={openNew}
            disabled={!canAdd}
            className="w-full sm:w-auto shrink-0"
          >
            <PlusIcon className="size-4" />
            {t("modules.welcome_channel.addMessage")}
          </Button>
        </CardHeader>
        <CardContent>
          {!canAdd && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-xs text-muted-foreground">
              <AlertCircleIcon className="size-4 shrink-0" />
              {t("modules.welcome_channel.limitReached", { max: MAX_WELCOME_MESSAGES })}
            </div>
          )}

          {messages.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center border border-dashed rounded-lg">
              <div className="size-10 rounded-full bg-muted flex items-center justify-center">
                <MessageSquareIcon className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">{t("modules.welcome_channel.empty")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("modules.welcome_channel.emptyDescription")}
                </p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={openNew}>
                <PlusIcon className="size-4" />
                {t("modules.welcome_channel.addFirst")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {messages.map((m) => (
                <MessageRow
                  key={m.id}
                  message={m}
                  pending={pendingId === m.id}
                  onEdit={() => openEdit(m)}
                  onTogglePause={() => handleTogglePause(m)}
                  onDelete={() => setConfirmDelete(m)}
                  t={t}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog ajout / édition */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open && !isSaving) setEditing(null)
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing?.isNew
                ? t("modules.welcome_channel.addTitle")
                : t("modules.welcome_channel.editTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("modules.welcome_channel.dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <MessageForm
              editing={editing}
              textChannels={textChannels}
              usedChannelIds={messages
                .filter((m) => m.id !== editing.source?.id)
                .map((m) => m.channel_id)}
              onChange={patchDraft}
              t={t}
            />
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(null)}
              disabled={isSaving}
            >
              {t("modules.welcome_channel.cancel")}
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving && <LoaderIcon className="size-4 mr-2 animate-spin" />}
              {editing?.isNew
                ? t("modules.welcome_channel.add")
                : t("modules.welcome_channel.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression */}
      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("modules.welcome_channel.confirmDeleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("modules.welcome_channel.confirmDeleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("modules.welcome_channel.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("modules.welcome_channel.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Ligne de message ─────────────────────────────────────────────────────────

interface MessageRowProps {
  message: WelcomeMessage
  pending: boolean
  onEdit: () => void
  onTogglePause: () => void
  onDelete: () => void
  t: (key: string, opts?: Record<string, unknown>) => string
}

function MessageRow({ message, pending, onEdit, onTogglePause, onDelete, t }: MessageRowProps) {
  const { channels } = useGuildContext()
  const channel = channels.find((c) => String(c.id) === String(message.channel_id))
  const color = accentIntToHex(message.accent_color)
  // Aperçu sur une ligne : les sauts de ligne deviennent des espaces.
  const preview = message.message.replace(/\s+/g, " ").trim()

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    fn()
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onEdit()
        }
      }}
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3 cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        !message.enabled && "opacity-60"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Barre d'accent — reprend le rendu du bot (Components V2) */}
        <span
          className="w-1 self-stretch min-h-9 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-sm font-medium truncate">
              {channel ? `# ${channel.name}` : `#${message.channel_id}`}
            </p>
            {!message.enabled && (
              <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">
                {t("modules.welcome_channel.paused")}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{preview}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={stop(onTogglePause)}
          disabled={pending}
          title={
            message.enabled
              ? t("modules.welcome_channel.pause")
              : t("modules.welcome_channel.resume")
          }
        >
          {pending ? (
            <LoaderIcon className="size-4 animate-spin" />
          ) : message.enabled ? (
            <PauseIcon className="size-4" />
          ) : (
            <PlayIcon className="size-4" />
          )}
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-8" onClick={stop(onEdit)}>
          <PencilIcon className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-destructive hover:text-destructive"
          onClick={stop(onDelete)}
          disabled={pending}
        >
          <Trash2Icon className="size-4" />
        </Button>
      </div>
    </div>
  )
}

// ─── Formulaire ───────────────────────────────────────────────────────────────

interface MessageFormProps {
  editing: EditingState
  textChannels: { id: string; name: string }[]
  /** Salons déjà utilisés par une autre entrée (avertissement, pas un blocage). */
  usedChannelIds: string[]
  onChange: (patch: Partial<MessageDraft>) => void
  t: (key: string, opts?: Record<string, unknown>) => string
}

function MessageForm({ editing, textChannels, usedChannelIds, onChange, t }: MessageFormProps) {
  const { selectedGuildId } = useGuildContext()
  const { isNew, draft } = editing
  const duplicateChannel = Boolean(draft.channel_id) && usedChannelIds.includes(draft.channel_id)
  // Le champ texte peut contenir une saisie en cours (`#58`) : l'aperçu et le
  // sélecteur natif retombent alors sur la couleur par défaut.
  const customColor = accentHexToInt(draft.accent_color)
  const swatchColor = customColor === null ? DEFAULT_ACCENT_HEX : accentIntToHex(customColor)
  const previewColor = draft.useDefaultColor ? DEFAULT_ACCENT_HEX : swatchColor

  return (
    <div className="flex flex-col gap-5">
      {/* Salon */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">{t("modules.welcome_channel.channel")}</label>
        <Select
          value={draft.channel_id || undefined}
          onValueChange={(v) => onChange({ channel_id: v })}
        >
          <SelectTrigger disabled={textChannels.length === 0}>
            <SelectValue placeholder={t("modules.selectChannel")} />
          </SelectTrigger>
          <SelectContent>
            {textChannels.length === 0 && (
              <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                <AlertCircleIcon className="size-4" />
                {t("modules.noChannels")}
              </div>
            )}
            {textChannels.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                # {c.name}
              </SelectItem>
            ))}
            {draft.channel_id && !textChannels.find((c) => c.id === draft.channel_id) && (
              <SelectItem value={draft.channel_id} disabled>
                # {draft.channel_id}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        {duplicateChannel && (
          <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircleIcon className="size-3.5 shrink-0" />
            {t("modules.welcome_channel.duplicateChannelHint")}
          </p>
        )}
      </div>

      {/* Message */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">{t("modules.welcome_channel.message")}</label>
        <MessageEditor
          value={draft.message}
          onChange={(v) => onChange({ message: v })}
          variables={[...WELCOME_PLACEHOLDERS]}
          guildId={selectedGuildId ?? undefined}
          maxLength={MESSAGE_MAX}
          placeholder={t("modules.welcome_channel.messagePlaceholder")}
        />
        <p className="text-xs text-muted-foreground">
          {t("modules.welcome_channel.placeholdersHint")}
        </p>
      </div>

      {/* Couleur d'accent */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">{t("modules.welcome_channel.accentColor")}</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChange({ useDefaultColor: true })}
            className={cn(
              "flex items-center gap-2.5 rounded-lg border p-3 text-left transition-all",
              draft.useDefaultColor
                ? "border-primary ring-1 ring-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50"
            )}
          >
            <span
              className="size-6 rounded-full ring-1 ring-border shrink-0"
              style={{ backgroundColor: DEFAULT_ACCENT_HEX }}
            />
            <span className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate">
                {t("modules.welcome_channel.colorDefault")}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {DEFAULT_ACCENT_HEX}
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => onChange({ useDefaultColor: false })}
            className={cn(
              "flex items-center gap-2.5 rounded-lg border p-3 text-left transition-all",
              !draft.useDefaultColor
                ? "border-primary ring-1 ring-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50"
            )}
          >
            <span
              className="size-6 rounded-full ring-1 ring-border shrink-0"
              style={{ backgroundColor: swatchColor }}
            />
            <span className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate">
                {t("modules.welcome_channel.colorCustom")}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {!draft.useDefaultColor
                  ? draft.accent_color
                  : t("modules.welcome_channel.colorPick")}
              </span>
            </span>
          </button>
        </div>
        {!draft.useDefaultColor && (
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="color-field size-10 shrink-0 rounded-lg border border-input"
              // `<input type="color">` n'accepte qu'un `#rrggbb` minuscule ; on
              // affiche l'hex en majuscules côté champ texte uniquement.
              value={swatchColor.toLowerCase()}
              onChange={(e) => onChange({ accent_color: e.target.value.toUpperCase() })}
            />
            <Input
              value={draft.accent_color}
              onChange={(e) => onChange({ accent_color: e.target.value })}
              placeholder={DEFAULT_ACCENT_HEX}
              className="flex-1 font-mono"
              maxLength={7}
            />
          </div>
        )}
      </div>

      {/* Aperçu — barre d'accent + texte, aucun champ d'embed */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">{t("modules.welcome_channel.preview")}</label>
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="flex gap-3">
            <span
              className="w-1 self-stretch rounded-full shrink-0"
              style={{ backgroundColor: previewColor }}
            />
            <p className="text-sm whitespace-pre-wrap break-words min-w-0">
              {draft.message.trim() || t("modules.welcome_channel.previewEmpty")}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("modules.welcome_channel.previewHint")}
        </p>
      </div>

      {/* Actif / en pause (édition uniquement) */}
      {!isNew && (
        <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
          <div className="min-w-0">
            <p className="text-sm">{t("modules.welcome_channel.active")}</p>
            <p className="text-xs text-muted-foreground">
              {t("modules.welcome_channel.activeHint")}
            </p>
          </div>
          <Switch
            checked={draft.enabled}
            onCheckedChange={(v) => onChange({ enabled: v })}
          />
        </div>
      )}
    </div>
  )
}
