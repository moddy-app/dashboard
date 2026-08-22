import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  AlertCircleIcon,
  LoaderIcon,
  MailIcon,
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
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ErrorPage } from "@/components/error-state"
import { MessageEditor } from "@/components/message-editor"
import { DiscordMarkup } from "@/components/discord-markup"
import { useGuildContext } from "@/contexts/GuildContext"
import { MAX_WELCOME_DMS, WELCOME_DM_DEFAULT_ACCENT } from "@/types/api"
import type { WelcomeDmConfig, WelcomeDmMessage } from "@/types/api"
import {
  WELCOME_DM_MESSAGE_MAX,
  WELCOME_DM_PLACEHOLDERS,
  buildWelcomeDmConfig,
  canAddWelcomeDm,
  formatDiscordTimestamps,
  generateWelcomeDmId,
  readWelcomeDmConfig,
  renderWelcomeDmPreview,
  welcomeDmHexToInt,
  welcomeDmIntToHex,
} from "@/lib/welcome-dm"
import { cn } from "@/lib/utils"

// Module Welcome DM — jumeau de `welcome_channel` sans `channel_id` : les
// messages partent en DM. Constantes propres au module (préfixe `wdm_`, 3
// entrées max) : rien n'est lu depuis celles de `welcome_channel`.

const MODULE_ID = "welcome_dm"
const DEFAULT_ACCENT_HEX = welcomeDmIntToHex(WELCOME_DM_DEFAULT_ACCENT)

// ─── Brouillon d'édition ──────────────────────────────────────────────────────

interface MessageDraft {
  message: string
  useDefaultColor: boolean
  accent_color: string // hex #RRGGBB
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
    useDefaultColor: m.accent_color === null,
    accent_color: welcomeDmIntToHex(m.accent_color),
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
          await updateModule(MODULE_ID, { ...buildWelcomeDmConfig(next) })
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
        message: t("modules.welcome_dm.defaultMessage"),
        useDefaultColor: true,
        accent_color: DEFAULT_ACCENT_HEX,
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
    if (!draft.useDefaultColor) {
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

  const canAdd = canAddWelcomeDm(messages)

  return (
    <div className="flex flex-col gap-6 w-full pb-16">
      {/* En-tête */}
      <div className="flex items-center gap-4">
        <div className="size-11 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0">
          <MailIcon className="size-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold leading-none">
            {t("modules.welcome_dm.name")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("modules.welcome_dm.description")}
          </p>
        </div>
      </div>

      {/* Liste des messages */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">
              {t("modules.welcome_dm.messagesTitle")}
            </CardTitle>
            <CardDescription>
              {t("modules.welcome_dm.messagesDescription", {
                used: messages.length,
                max: MAX_WELCOME_DMS,
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
            {t("modules.welcome_dm.addMessage")}
          </Button>
        </CardHeader>
        <CardContent>
          {!canAdd && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-xs text-muted-foreground">
              <AlertCircleIcon className="size-4 shrink-0" />
              {t("modules.welcome_dm.limitReached", { max: MAX_WELCOME_DMS })}
            </div>
          )}

          {messages.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center border border-dashed rounded-lg">
              <div className="size-10 rounded-full bg-muted flex items-center justify-center">
                <MailIcon className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">{t("modules.welcome_dm.empty")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("modules.welcome_dm.emptyDescription")}
                </p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={openNew}>
                <PlusIcon className="size-4" />
                {t("modules.welcome_dm.addFirst")}
              </Button>
            </div>
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
                ? t("modules.welcome_dm.addTitle")
                : t("modules.welcome_dm.editTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("modules.welcome_dm.dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          {editing && <MessageForm editing={editing} onChange={patchDraft} t={t} />}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(null)}
              disabled={isSaving}
            >
              {t("modules.welcome_dm.cancel")}
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving && <LoaderIcon className="size-4 mr-2 animate-spin" />}
              {editing?.isNew
                ? t("modules.welcome_dm.add")
                : t("modules.welcome_dm.save")}
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
              {t("modules.welcome_dm.confirmDeleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("modules.welcome_dm.confirmDeleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("modules.welcome_dm.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("modules.welcome_dm.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Ligne de message ─────────────────────────────────────────────────────────

interface MessageRowProps {
  message: WelcomeDmMessage
  /** Rang d'envoi : le bot envoie les DM dans l'ordre de la liste. */
  index: number
  pending: boolean
  onEdit: () => void
  onTogglePause: () => void
  onDelete: () => void
  t: (key: string, opts?: Record<string, unknown>) => string
}

function MessageRow({
  message,
  index,
  pending,
  onEdit,
  onTogglePause,
  onDelete,
  t,
}: MessageRowProps) {
  const color = welcomeDmIntToHex(message.accent_color)
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
              {t("modules.welcome_dm.messageNumber", { index: index + 1 })}
            </p>
            {!message.enabled && (
              <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">
                {t("modules.welcome_dm.paused")}
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
              ? t("modules.welcome_dm.pause")
              : t("modules.welcome_dm.resume")
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
  onChange: (patch: Partial<MessageDraft>) => void
  t: (key: string, opts?: Record<string, unknown>) => string
}

function MessageForm({ editing, onChange, t }: MessageFormProps) {
  const { selectedGuildId } = useGuildContext()
  const { isNew, draft } = editing
  // Le champ texte peut contenir une saisie en cours (`#58`) : le swatch et le
  // sélecteur natif retombent alors sur la couleur par défaut.
  const customColor = welcomeDmHexToInt(draft.accent_color)
  const swatchColor = customColor === null ? DEFAULT_ACCENT_HEX : welcomeDmIntToHex(customColor)

  return (
    <div className="flex flex-col gap-5">
      {/* Message */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">{t("modules.welcome_dm.message")}</label>
        <MessageEditor
          value={draft.message}
          onChange={(v) => onChange({ message: v })}
          variables={[...WELCOME_DM_PLACEHOLDERS]}
          guildId={selectedGuildId ?? undefined}
          maxLength={WELCOME_DM_MESSAGE_MAX}
          placeholder={t("modules.welcome_dm.messagePlaceholder")}
        />
        <p className="text-xs text-muted-foreground">
          {t("modules.welcome_dm.placeholdersHint")}
        </p>
      </div>

      {/* Aperçu */}
      <MessagePreview
        message={draft.message}
        accentHex={swatchColor}
        useDefaultColor={draft.useDefaultColor}
        t={t}
      />

      {/* Couleur d'accent */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">{t("modules.welcome_dm.accentColor")}</label>
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
                {t("modules.welcome_dm.colorDefault")}
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
                {t("modules.welcome_dm.colorCustom")}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {!draft.useDefaultColor
                  ? draft.accent_color
                  : t("modules.welcome_dm.colorPick")}
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

      {/* Actif / en pause (édition uniquement) */}
      {!isNew && (
        <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
          <div className="min-w-0">
            <p className="text-sm">{t("modules.welcome_dm.active")}</p>
            <p className="text-xs text-muted-foreground">
              {t("modules.welcome_dm.activeHint")}
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

// ─── Aperçu ───────────────────────────────────────────────────────────────────

interface MessagePreviewProps {
  message: string
  accentHex: string
  useDefaultColor: boolean
  t: (key: string, opts?: Record<string, unknown>) => string
}

/**
 * Aperçu du DM tel que le bot l'enverra : substitution **littérale** des
 * placeholders (un token inconnu reste visible, une accolade isolée aussi),
 * barre d'accent et markdown Discord.
 */
function MessagePreview({ message, accentHex, useDefaultColor, t }: MessagePreviewProps) {
  const { i18n } = useTranslation()
  const { guildDetail, user } = useGuildContext()

  // Instant d'« arrivée » simulé, figé à l'ouverture du formulaire : le lire à
  // chaque rendu rendrait le composant impur et l'aperçu instable à la frappe.
  const [joinedAt] = useState(() => Date.now())

  const rendered = useMemo(() => {
    const displayName = user.global_name || user.username
    const substituted = renderWelcomeDmPreview(message, {
      server: guildDetail?.name ?? t("modules.welcome_dm.previewServer"),
      user: `@${displayName}`,
      display_name: displayName,
      username: user.username,
      member_count: String(guildDetail?.member_count ?? 1),
      timestamp: String(Math.floor(joinedAt / 1000)),
    })
    return formatDiscordTimestamps(substituted, i18n.language, joinedAt)
  }, [message, guildDetail, user, i18n.language, joinedAt, t])

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">{t("modules.welcome_dm.preview")}</label>
      <div className="flex gap-3 rounded-lg border bg-muted/30 p-3">
        <span
          className="w-1 self-stretch rounded-full shrink-0"
          style={{ backgroundColor: useDefaultColor ? DEFAULT_ACCENT_HEX : accentHex }}
        />
        {/* Le markdown Discord est rendu en balises nues (`h1`, `small`,
            `blockquote`) : hors de la carte de profil (`.dpp-scope`), c'est ici
            qu'on leur redonne l'allure qu'elles ont dans le client. */}
        <div
          className={cn(
            "min-w-0 flex-1 text-sm whitespace-pre-wrap break-words",
            "[&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold",
            "[&_h3]:text-sm [&_h3]:font-semibold [&_small]:text-xs [&_small]:text-muted-foreground",
            "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-2",
            "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs",
            "[&_a]:text-primary [&_a]:underline"
          )}
        >
          {rendered.trim() ? (
            <DiscordMarkup text={rendered} />
          ) : (
            <span className="text-muted-foreground text-xs">
              {t("modules.welcome_dm.previewEmpty")}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
