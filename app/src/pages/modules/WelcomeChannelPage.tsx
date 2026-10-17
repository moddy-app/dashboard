import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { AddIcon, DeleteIcon, EditIcon, MessageSquareIcon, PauseIcon, PlayIcon } from "@/components/icons"
import { handleSaveError } from "@/lib/handle-error"
import { logger } from "@/lib/logger"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { MessageEditor } from "@/components/message-editor"
import { ModulePage } from "@/components/module/module-page"
import { ModuleStateControl } from "@/components/module/module-state-control"
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/module/responsive-dialog"
import { ChannelPicker, ColorPicker } from "@/components/pickers"
import { WelcomeMessagePreview } from "@/components/welcome/welcome-preview"
import { useGuildContext } from "@/contexts/GuildContext"
import { MAX_WELCOME_MESSAGES, WELCOME_DEFAULT_ACCENT } from "@/types/api"
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

// Module Welcome Messages. Constantes
// propres au module (préfixe `wm_`, 5 entrées max).

const MODULE_ID = "welcome_channel"
const MESSAGE_MAX = 1500
const DEFAULT_ACCENT_HEX = accentIntToHex(WELCOME_DEFAULT_ACCENT)

// ─── Brouillon d'édition ──────────────────────────────────────────────────────

interface MessageDraft {
  channel_id: string
  message: string
  /** Hex `#RRGGBB`, `null` = couleur par défaut. */
  accent_color: string | null
  enabled: boolean
}

interface EditingState {
  isNew: boolean
  /** Entrée d'origine (édition) — porte l'id et les métadonnées à conserver. */
  source: WelcomeMessage | null
  draft: MessageDraft
}

function draftFromMessage(m: WelcomeMessage): MessageDraft {
  return {
    channel_id: String(m.channel_id),
    message: m.message,
    accent_color: m.accent_color === null ? null : accentIntToHex(m.accent_color),
    enabled: m.enabled,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function WelcomeChannelPage() {
  const { t } = useTranslation()
  const {
    modules,
    isLoadingGuild,
    isGuildReady,
    guildError,
    refreshGuildData,
    updateModule,
    disableModule,
  } = useGuildContext()

  const config = modules[MODULE_ID] as WelcomeChannelConfig | undefined
  const currentState = (config as { state?: string } | undefined)?.state

  const [messages, setMessages] = useState<WelcomeMessage[]>([])
  const [editing, setEditing] = useState<EditingState | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<WelcomeMessage | null>(null)

  // La config vient du chargement du serveur (GET /modules) — toujours du v2,
  // les entrées v1 sont migrées côté backend à la lecture (id `wdm_00000000`).
  useEffect(() => {
    setMessages(readWelcomeConfig(config))
  }, [config])

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
          await updateModule(MODULE_ID, {
            ...buildWelcomeConfig(next),
            ...(currentState ? { state: currentState } : {}),
          })
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
    [messages, updateModule, disableModule, currentState, t]
  )

  // ── Ouverture du formulaire ────────────────────────────────────────────────

  const openNew = () => {
    setEditing({
      isNew: true,
      source: null,
      draft: {
        channel_id: "",
        message: t("modules.welcome_channel.defaultMessage"),
        accent_color: null,
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

    // Validation client — le backend rejette la config *entière* au premier
    // manquement, pas seulement l'entrée fautive.
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
      toast.error(
        t("modules.welcome_channel.errorMessageTooLong", { max: MESSAGE_MAX })
      )
      return
    }

    let accent: number | null = null
    if (draft.accent_color !== null) {
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
        // `id`, `created_by` et `created_at` sont repris à l'identique : le bot
        // matche les entrées par id, un id régénéré ferait un message neuf.
        next = messages.map((m) =>
          m.id === source.id
            ? { ...m, channel_id: draft.channel_id, message: text, accent_color: accent, enabled: draft.enabled }
            : m
        )
        logger.event(`module:${MODULE_ID}`, "Update message", { id: source.id })
      } else {
        return
      }

      if (await persist(next)) {
        toast.success(isNew ? t("modules.welcome_channel.addedSuccess") : t("modules.saved"))
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

  const canAdd = canAddWelcomeMessage(messages)

  return (
    <ModulePage
      moduleId={MODULE_ID}
      loading={isLoadingGuild || !isGuildReady}
      error={guildError}
      onRetry={refreshGuildData}
      actions={<ModuleStateControl moduleId={MODULE_ID} />}
    >
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>{t("modules.welcome_channel.messagesTitle")}</CardTitle>
            <CardDescription>
              {t("modules.welcome_channel.messagesDescription", { used: messages.length, max: MAX_WELCOME_MESSAGES })}
            </CardDescription>
          </div>
          <Button type="button" size="sm" onClick={openNew} disabled={!canAdd} className="w-full sm:w-auto">
            <AddIcon data-icon="inline-start" />
            {t("modules.welcome_channel.addMessage")}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!canAdd && (
            <Alert>
              <AlertDescription>{t("modules.welcome_channel.limitReached", { max: MAX_WELCOME_MESSAGES })}</AlertDescription>
            </Alert>
          )}
          {messages.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MessageSquareIcon />
                </EmptyMedia>
                <EmptyTitle>{t("modules.welcome_channel.empty")}</EmptyTitle>
                <EmptyDescription>{t("modules.welcome_channel.emptyDescription")}</EmptyDescription>
              </EmptyHeader>
              <Button type="button" size="sm" variant="outline" onClick={openNew}>
                <AddIcon data-icon="inline-start" />
                {t("modules.welcome_channel.addFirst")}
              </Button>
            </Empty>
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

      <ResponsiveDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open && !isSaving) setEditing(null)
        }}
        className="sm:max-w-lg"
      >
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {editing?.isNew ? t("modules.welcome_channel.addTitle") : t("modules.welcome_channel.editTitle")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{t("modules.welcome_channel.dialogDescription")}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>
          {editing && (
            <MessageForm
              editing={editing}
              usedChannelIds={messages.filter((m) => m.id !== editing.source?.id).map((m) => String(m.channel_id))}
              onChange={patchDraft}
              t={t}
            />
          )}
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={isSaving}>
            {t("modules.welcome_channel.cancel")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving && <Spinner data-icon="inline-start" />}
            {editing?.isNew ? t("modules.welcome_channel.add") : t("modules.welcome_channel.save")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialog>

      <AlertDialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("modules.welcome_channel.confirmDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("modules.welcome_channel.confirmDeleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("modules.welcome_channel.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => confirmDelete && handleDelete(confirmDelete)}>
              {t("modules.welcome_channel.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModulePage>
  )
}

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
        "flex cursor-pointer items-start justify-between gap-2 rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:px-4 sm:py-3",
        !message.enabled && "opacity-60"
      )}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <span className="min-h-9 w-1 shrink-0 self-stretch rounded-full" style={{ backgroundColor: color }} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-sm font-medium">{channel ? `# ${channel.name}` : `#${message.channel_id}`}</p>
            {!message.enabled && <Badge variant="secondary">{t("modules.welcome_channel.paused")}</Badge>}
          </div>
          <WelcomeMessagePreview message={message.message} />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={stop(onTogglePause)}
          disabled={pending}
          aria-label={message.enabled ? t("modules.welcome_channel.pause") : t("modules.welcome_channel.resume")}
        >
          {pending ? <Spinner /> : message.enabled ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={stop(onEdit)} aria-label={t("modules.welcome_channel.editTitle")}>
          <EditIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={stop(onDelete)}
          disabled={pending}
          aria-label={t("modules.welcome_channel.delete")}
        >
          <DeleteIcon />
        </Button>
      </div>
    </div>
  )
}

interface MessageFormProps {
  editing: EditingState
  usedChannelIds: string[]
  onChange: (patch: Partial<MessageDraft>) => void
  t: (key: string, opts?: Record<string, unknown>) => string
}

function MessageForm({ editing, usedChannelIds, onChange, t }: MessageFormProps) {
  const { selectedGuildId } = useGuildContext()
  const { isNew, draft } = editing
  const duplicateChannel = Boolean(draft.channel_id) && usedChannelIds.includes(draft.channel_id)

  return (
    <FieldGroup>
      <Field data-invalid={duplicateChannel || undefined}>
        <FieldLabel>{t("modules.welcome_channel.channel")}</FieldLabel>
        <ChannelPicker
          value={draft.channel_id || null}
          onChange={(v) => onChange({ channel_id: v ?? "" })}
          placeholder={t("modules.selectChannel")}
        />
        {duplicateChannel && (
          <FieldDescription>{t("modules.welcome_channel.duplicateChannelHint")}</FieldDescription>
        )}
      </Field>
      <Field>
        <FieldLabel>{t("modules.welcome_channel.message")}</FieldLabel>
        <MessageEditor
          value={draft.message}
          onChange={(v) => onChange({ message: v })}
          variables={[...WELCOME_PLACEHOLDERS]}
          guildId={selectedGuildId ?? undefined}
          maxLength={MESSAGE_MAX}
          placeholder={t("modules.welcome_channel.messagePlaceholder")}
        />
        <FieldDescription>{t("modules.welcome_channel.placeholdersHint")}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel>{t("modules.welcome_channel.accentColor")}</FieldLabel>
        <ColorPicker
          value={draft.accent_color}
          onChange={(v) => onChange({ accent_color: v })}
          defaultColor={DEFAULT_ACCENT_HEX}
          allowReset
        />
      </Field>
      {!isNew && (
        <Field orientation="horizontal">
          <div className="flex flex-1 flex-col gap-1">
            <FieldLabel>{t("modules.welcome_channel.active")}</FieldLabel>
            <FieldDescription>{t("modules.welcome_channel.activeHint")}</FieldDescription>
          </div>
          <Switch checked={draft.enabled} onCheckedChange={(v) => onChange({ enabled: v })} />
        </Field>
      )}
    </FieldGroup>
  )
}
