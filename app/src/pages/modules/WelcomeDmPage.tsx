import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { AddIcon, DeleteIcon, EditIcon, MailIcon, PauseIcon, PlayIcon } from "@/components/icons"
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
import { ColorPicker } from "@/components/pickers"
import { WelcomeMessagePreview } from "@/components/welcome/welcome-preview"
import { useGuildContext } from "@/contexts/GuildContext"
import { MAX_WELCOME_DMS, WELCOME_DM_DEFAULT_ACCENT } from "@/types/api"
import type { WelcomeDmConfig, WelcomeDmMessage } from "@/types/api"
import {
  WELCOME_DM_MESSAGE_MAX,
  WELCOME_DM_PLACEHOLDERS,
  buildWelcomeDmConfig,
  canAddWelcomeDm,
  generateWelcomeDmId,
  readWelcomeDmConfig,
  welcomeDmHexToInt,
  welcomeDmIntToHex,
} from "@/lib/welcome-dm"
import { cn } from "@/lib/utils"

// Module Welcome DM — jumeau de `welcome_channel` sans `channel_id`. Constantes
// propres au module (préfixe `wdm_`, 3 entrées max).

const MODULE_ID = "welcome_dm"
const DEFAULT_ACCENT_HEX = welcomeDmIntToHex(WELCOME_DM_DEFAULT_ACCENT)

// ─── Brouillon d'édition ──────────────────────────────────────────────────────

interface MessageDraft {
  message: string
  /** Hex `#RRGGBB`, `null` = couleur par défaut. */
  accent_color: string | null
  enabled: boolean
}

interface EditingState {
  isNew: boolean
  /** Entrée d'origine (édition) — porte l'id et les métadonnées à conserver. */
  source: WelcomeDmMessage | null
  draft: MessageDraft
}

function draftFromMessage(m: WelcomeDmMessage): MessageDraft {
  return {
    message: m.message,
    accent_color: m.accent_color === null ? null : welcomeDmIntToHex(m.accent_color),
    enabled: m.enabled,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function WelcomeDmPage() {
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

  const config = modules[MODULE_ID] as WelcomeDmConfig | undefined
  const currentState = (config as { state?: string } | undefined)?.state

  const [messages, setMessages] = useState<WelcomeDmMessage[]>([])
  const [editing, setEditing] = useState<EditingState | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<WelcomeDmMessage | null>(null)

  // La config vient du chargement du serveur (GET /modules) — toujours du v2,
  // les entrées v1 sont migrées côté backend à la lecture (id `wdm_00000000`).
  useEffect(() => {
    setMessages(readWelcomeDmConfig(config))
  }, [config])

  /**
   * Écrit la liste complète : chaque action déclenche une sauvegarde immédiate
   * (pas de barre « enregistrer »). Une liste vide désactive le module.
   */
  const persist = useCallback(
    async (next: WelcomeDmMessage[]) => {
      const previous = messages
      setMessages(next)
      try {
        if (next.length === 0) {
          await disableModule(MODULE_ID)
        } else {
          await updateModule(MODULE_ID, {
            ...buildWelcomeDmConfig(next),
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
        message: t("modules.welcome_dm.defaultMessage"),
        accent_color: null,
        enabled: true,
      },
    })
  }

  const openEdit = (m: WelcomeDmMessage) => {
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
    const text = draft.message.trim()
    if (!text) {
      toast.error(t("modules.welcome_dm.errorMessageRequired"))
      return
    }
    if (text.length > WELCOME_DM_MESSAGE_MAX) {
      toast.error(
        t("modules.welcome_dm.errorMessageTooLong", { max: WELCOME_DM_MESSAGE_MAX })
      )
      return
    }

    let accent: number | null = null
    if (draft.accent_color !== null) {
      accent = welcomeDmHexToInt(draft.accent_color)
      if (accent === null) {
        toast.error(t("modules.welcome_dm.errorColorInvalid"))
        return
      }
    }

    setIsSaving(true)
    try {
      let next: WelcomeDmMessage[]
      if (isNew) {
        if (!canAddWelcomeDm(messages)) {
          toast.error(t("modules.welcome_dm.errorLimit", { max: MAX_WELCOME_DMS }))
          return
        }
        const created: WelcomeDmMessage = {
          id: generateWelcomeDmId(messages),
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
            ? { ...m, message: text, accent_color: accent, enabled: draft.enabled }
            : m
        )
        logger.event(`module:${MODULE_ID}`, "Update message", { id: source.id })
      } else {
        return
      }

      if (await persist(next)) {
        toast.success(isNew ? t("modules.welcome_dm.addedSuccess") : t("modules.saved"))
        setEditing(null)
      }
    } finally {
      setIsSaving(false)
    }
  }

  // ── Pause / reprise ────────────────────────────────────────────────────────

  const handleTogglePause = async (m: WelcomeDmMessage) => {
    setPendingId(m.id)
    try {
      const next = messages.map((x) => (x.id === m.id ? { ...x, enabled: !x.enabled } : x))
      if (await persist(next)) {
        toast.success(
          m.enabled
            ? t("modules.welcome_dm.pausedSuccess")
            : t("modules.welcome_dm.resumedSuccess")
        )
      }
    } finally {
      setPendingId(null)
    }
  }

  // ── Suppression ────────────────────────────────────────────────────────────

  const handleDelete = async (m: WelcomeDmMessage) => {
    setPendingId(m.id)
    try {
      logger.event(`module:${MODULE_ID}`, "Delete message", { id: m.id })
      if (await persist(messages.filter((x) => x.id !== m.id))) {
        toast.success(t("modules.welcome_dm.removedSuccess"))
      }
    } finally {
      setPendingId(null)
      setConfirmDelete(null)
    }
  }

  const canAdd = canAddWelcomeDm(messages)

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
            <CardTitle>{t("modules.welcome_dm.messagesTitle")}</CardTitle>
            <CardDescription>
              {t("modules.welcome_dm.messagesDescription", { used: messages.length, max: MAX_WELCOME_DMS })}
            </CardDescription>
          </div>
          <Button type="button" size="sm" onClick={openNew} disabled={!canAdd} className="w-full sm:w-auto">
            <AddIcon data-icon="inline-start" />
            {t("modules.welcome_dm.addMessage")}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!canAdd && (
            <Alert>
              <AlertDescription>{t("modules.welcome_dm.limitReached", { max: MAX_WELCOME_DMS })}</AlertDescription>
            </Alert>
          )}
          {messages.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MailIcon />
                </EmptyMedia>
                <EmptyTitle>{t("modules.welcome_dm.empty")}</EmptyTitle>
                <EmptyDescription>{t("modules.welcome_dm.emptyDescription")}</EmptyDescription>
              </EmptyHeader>
              <Button type="button" size="sm" variant="outline" onClick={openNew}>
                <AddIcon data-icon="inline-start" />
                {t("modules.welcome_dm.addFirst")}
              </Button>
            </Empty>
          ) : (
            <div className="flex flex-col gap-2">
              {messages.map((m, index) => (
                <MessageRow
                  key={m.id}
                  message={m}
                  index={index}
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
            {editing?.isNew ? t("modules.welcome_dm.addTitle") : t("modules.welcome_dm.editTitle")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{t("modules.welcome_dm.dialogDescription")}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>
          {editing && <MessageForm editing={editing} onChange={patchDraft} t={t} />}
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={isSaving}>
            {t("modules.welcome_dm.cancel")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving && <Spinner data-icon="inline-start" />}
            {editing?.isNew ? t("modules.welcome_dm.add") : t("modules.welcome_dm.save")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialog>

      <AlertDialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("modules.welcome_dm.confirmDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("modules.welcome_dm.confirmDeleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("modules.welcome_dm.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => confirmDelete && handleDelete(confirmDelete)}>
              {t("modules.welcome_dm.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModulePage>
  )
}

interface MessageRowProps {
  message: WelcomeDmMessage
  index: number
  pending: boolean
  onEdit: () => void
  onTogglePause: () => void
  onDelete: () => void
  t: (key: string, opts?: Record<string, unknown>) => string
}

function MessageRow({ message, index, pending, onEdit, onTogglePause, onDelete, t }: MessageRowProps) {
  const color = welcomeDmIntToHex(message.accent_color)
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
            <p className="truncate text-sm font-medium">{t("modules.welcome_dm.messageNumber", { index: index + 1 })}</p>
            {!message.enabled && <Badge variant="secondary">{t("modules.welcome_dm.paused")}</Badge>}
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
          aria-label={message.enabled ? t("modules.welcome_dm.pause") : t("modules.welcome_dm.resume")}
        >
          {pending ? <Spinner /> : message.enabled ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={stop(onEdit)} aria-label={t("modules.welcome_dm.editTitle")}>
          <EditIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={stop(onDelete)}
          disabled={pending}
          aria-label={t("modules.welcome_dm.delete")}
        >
          <DeleteIcon />
        </Button>
      </div>
    </div>
  )
}

interface MessageFormProps {
  editing: EditingState
  onChange: (patch: Partial<MessageDraft>) => void
  t: (key: string, opts?: Record<string, unknown>) => string
}

function MessageForm({ editing, onChange, t }: MessageFormProps) {
  const { selectedGuildId } = useGuildContext()
  const { isNew, draft } = editing

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>{t("modules.welcome_dm.message")}</FieldLabel>
        <MessageEditor
          value={draft.message}
          onChange={(v) => onChange({ message: v })}
          variables={[...WELCOME_DM_PLACEHOLDERS]}
          guildId={selectedGuildId ?? undefined}
          maxLength={WELCOME_DM_MESSAGE_MAX}
          placeholder={t("modules.welcome_dm.messagePlaceholder")}
        />
        <FieldDescription>{t("modules.welcome_dm.placeholdersHint")}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel>{t("modules.welcome_dm.accentColor")}</FieldLabel>
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
            <FieldLabel>{t("modules.welcome_dm.active")}</FieldLabel>
            <FieldDescription>{t("modules.welcome_dm.activeHint")}</FieldDescription>
          </div>
          <Switch checked={draft.enabled} onCheckedChange={(v) => onChange({ enabled: v })} />
        </Field>
      )}
    </FieldGroup>
  )
}
