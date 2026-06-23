import { useEffect, useState, useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  Trash2Icon,
  BellRingIcon,
  PlusIcon,
  LoaderIcon,
  PencilIcon,
  AlertCircleIcon,
  XIcon,
  PauseIcon,
  PlayIcon,
  CrownIcon,
  ExternalLinkIcon,
  InfoIcon,
  SparklesIcon,
} from "lucide-react"
import { handleSaveError } from "@/lib/handle-error"
import { ApiError } from "@/lib/auth"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ErrorPage } from "@/components/error-state"
import { SocialIcon } from "@/components/social-icons"
import { MessageEditor } from "@/components/message-editor"
import { useGuildContext } from "@/contexts/GuildContext"
import { CHANNEL_TYPES, roleColorToHex } from "@/types/api"
import type {
  SocialPlatform,
  SocialSubscription,
  SocialSubscriptionCreate,
  SocialSubscriptionUpdate,
} from "@/types/api"
import {
  PLATFORM_META,
  PLATFORM_ORDER,
  DEFAULT_MESSAGES,
  hexToInt,
  intToHex,
} from "@/lib/social-platforms"
import {
  getSocialSubscriptions,
  addSocialSubscription,
  updateSocialSubscription,
  deleteSocialSubscription,
  createCheckout,
} from "@/services/guilds"
import { cn } from "@/lib/utils"

const MESSAGE_MAX = 1500
const MODULE_ID = "social_notifications"

// ─── Brouillon d'édition ────────────────────────────────────────────────────────

interface SubscriptionDraft {
  platform: SocialPlatform
  identifier: string
  channel_id: string
  message: string
  mention_role_ids: string[]
  useBrandColor: boolean
  embed_color: string // hex
  show_avatar: boolean
  show_media: boolean
  enabled: boolean
}

interface EditingState {
  isNew: boolean
  source: SocialSubscription | null
  draft: SubscriptionDraft
}

function emptyDraft(platform: SocialPlatform): SubscriptionDraft {
  const meta = PLATFORM_META[platform]
  return {
    platform,
    identifier: "",
    channel_id: "",
    // Le message par défaut de la plateforme est pré-rempli comme texte éditable.
    message: DEFAULT_MESSAGES[platform],
    mention_role_ids: [],
    useBrandColor: true,
    embed_color: meta.brandColor,
    show_avatar: meta.supportsAvatar,
    show_media: meta.supportsMedia,
    enabled: true,
  }
}

function draftFromSubscription(sub: SocialSubscription): SubscriptionDraft {
  return {
    platform: sub.platform,
    identifier: sub.identifier,
    channel_id: String(sub.channel_id),
    message: sub.message ?? "",
    mention_role_ids: sub.mention_role_ids.map(String),
    useBrandColor: sub.embed_color === null,
    embed_color:
      sub.embed_color !== null ? intToHex(sub.embed_color) : PLATFORM_META[sub.platform].brandColor,
    show_avatar: sub.show_avatar,
    show_media: sub.show_media,
    enabled: sub.enabled,
  }
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function SocialNotificationsPage() {
  const { t } = useTranslation()
  const {
    selectedGuildId,
    modules,
    isPremium,
    isLoadingGuild,
    guildError,
    refreshGuildData,
    updateModule,
    disableModule,
  } = useGuildContext()

  const limit = isPremium ? 5 : 1

  const [subscriptions, setSubscriptions] = useState<SocialSubscription[]>([])
  const [isLoadingSubs, setIsLoadingSubs] = useState(false)
  const [subsError, setSubsError] = useState<string | null>(null)
  const [editing, setEditing] = useState<EditingState | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingTarget, setPendingTarget] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<SocialSubscription | null>(null)

  const subKey = (s: { platform: string; target_id: string }) => `${s.platform}/${s.target_id}`

  const countByPlatform = useMemo(() => {
    return subscriptions.reduce<Record<string, number>>((acc, s) => {
      acc[s.platform] = (acc[s.platform] ?? 0) + 1
      return acc
    }, {})
  }, [subscriptions])

  const isAtLimit = useCallback(
    (platform: SocialPlatform) => (countByPlatform[platform] ?? 0) >= limit,
    [countByPlatform, limit]
  )

  const canAddAny = PLATFORM_ORDER.some(
    (p) => !PLATFORM_META[p].disabled && !isAtLimit(p)
  )

  const loadSubscriptions = useCallback(async () => {
    if (!selectedGuildId) return
    setIsLoadingSubs(true)
    setSubsError(null)
    try {
      const subs = await getSocialSubscriptions(selectedGuildId)
      setSubscriptions(subs ?? [])
    } catch (e) {
      if (e instanceof ApiError && e.isNotFound) {
        setSubscriptions([])
      } else {
        logger.error("module:social_notifications", "Load subscriptions failed", e)
        setSubsError(e instanceof Error ? e.message : "Failed to load subscriptions")
      }
    } finally {
      setIsLoadingSubs(false)
    }
  }, [selectedGuildId])

  useEffect(() => {
    if (!isLoadingGuild) loadSubscriptions()
  }, [loadSubscriptions, isLoadingGuild])

  // ── Ouverture du formulaire ────────────────────────────────────────────────

  const openNew = () => {
    const firstAvailable =
      PLATFORM_ORDER.find((p) => !PLATFORM_META[p].disabled && !isAtLimit(p)) ?? "youtube"
    setEditing({ isNew: true, source: null, draft: emptyDraft(firstAvailable) })
  }

  const openEdit = (sub: SocialSubscription) => {
    setEditing({ isNew: false, source: sub, draft: draftFromSubscription(sub) })
  }

  const patchDraft = (patch: Partial<SubscriptionDraft>) => {
    setEditing((prev) => (prev ? { ...prev, draft: { ...prev.draft, ...patch } } : null))
  }

  // ── Sauvegarde (création ou édition) ───────────────────────────────────────

  const handleSave = async () => {
    if (!selectedGuildId || !editing) return
    const { isNew, source, draft } = editing

    const embedColor = draft.useBrandColor ? null : hexToInt(draft.embed_color)
    const message = draft.message.trim() === "" ? null : draft.message

    setIsSaving(true)
    try {
      if (isNew) {
        if (!draft.identifier.trim()) {
          toast.error(t("modules.social_notifications.errorIdentifierRequired"))
          setIsSaving(false)
          return
        }
        if (!draft.channel_id) {
          toast.error(t("modules.social_notifications.errorChannelRequired"))
          setIsSaving(false)
          return
        }
        const payload: SocialSubscriptionCreate = {
          platform: draft.platform,
          identifier: draft.identifier.trim(),
          channel_id: draft.channel_id,
          message,
          mention_role_ids: draft.mention_role_ids,
          embed_color: embedColor,
          show_avatar: draft.show_avatar,
          show_media: draft.show_media,
        }
        logger.event("module:social_notifications", "Add subscription", payload)
        const result = await addSocialSubscription(selectedGuildId, payload)
        const newSub: SocialSubscription = {
          id: Date.now(),
          platform: result.platform,
          target_id: result.target_id,
          identifier: draft.identifier.trim(),
          display_name: result.display_name,
          avatar_url: result.avatar_url,
          channel_id: draft.channel_id,
          message,
          mention_role_ids: draft.mention_role_ids,
          enabled: true,
          embed_color: embedColor,
          show_avatar: draft.show_avatar,
          show_media: draft.show_media,
          created_at: new Date().toISOString(),
        }
        setSubscriptions((prev) => [...prev, newSub])
        // Le module est implicitement activé dès qu'il existe une configuration.
        if (!(MODULE_ID in modules)) {
          await ensureModuleEnabled()
        }
        toast.success(
          t("modules.social_notifications.addedSuccess", {
            name: result.display_name ?? draft.identifier.trim(),
          })
        )
      } else if (source) {
        const update: SocialSubscriptionUpdate = {
          channel_id: draft.channel_id,
          message,
          mention_role_ids: draft.mention_role_ids,
          embed_color: embedColor,
          show_avatar: draft.show_avatar,
          show_media: draft.show_media,
          enabled: draft.enabled,
        }
        logger.event("module:social_notifications", "Update subscription", {
          target: subKey(source),
          update,
        })
        await updateSocialSubscription(selectedGuildId, source.platform, source.target_id, update)
        setSubscriptions((prev) =>
          prev.map((s) =>
            subKey(s) === subKey(source)
              ? {
                  ...s,
                  channel_id: draft.channel_id,
                  message,
                  mention_role_ids: draft.mention_role_ids,
                  embed_color: embedColor,
                  show_avatar: draft.show_avatar,
                  show_media: draft.show_media,
                  enabled: draft.enabled,
                }
              : s
          )
        )
        toast.success(t("modules.saved"))
      }
      setEditing(null)
    } catch (e) {
      logger.error("module:social_notifications", "Save failed", e)
      handleSubscriptionError(e)
    } finally {
      setIsSaving(false)
    }
  }

  // Active la config globale du module (best-effort — n'échoue pas l'ajout).
  const ensureModuleEnabled = async () => {
    try {
      await updateModule(MODULE_ID, { enabled: true, default_message: null })
    } catch (e) {
      logger.warn("module:social_notifications", "Could not enable module config", e)
    }
  }

  const handleSubscriptionError = (e: unknown) => {
    if (e instanceof ApiError) {
      const code = e.message
      if (code === "limit_reached_free") {
        toast.error(t("modules.social_notifications.errorLimitFree"))
        return
      }
      if (code === "limit_reached_premium") {
        toast.error(t("modules.social_notifications.errorLimitPremium"))
        return
      }
      const known = [
        "handle_not_found",
        "channel_not_found",
        "user_not_found",
        "unsafe_url",
        "platform_disabled",
        "unknown_platform",
        "no_entries",
        "missing_identifier",
        "not_supported",
        "twitch_not_configured",
        "fetch_failed",
        "bot_timeout",
      ]
      if (known.includes(code)) {
        toast.error(
          t(`modules.social_notifications.errors.${code}`, {
            defaultValue: t("modules.social_notifications.errorGeneric"),
          })
        )
        return
      }
    }
    handleSaveError(e, { title: t("modules.social_notifications.errorGeneric") })
  }

  // ── Pause / reprise rapide ─────────────────────────────────────────────────

  const handleTogglePause = async (sub: SocialSubscription) => {
    if (!selectedGuildId) return
    setPendingTarget(subKey(sub))
    try {
      await updateSocialSubscription(selectedGuildId, sub.platform, sub.target_id, {
        enabled: !sub.enabled,
      })
      setSubscriptions((prev) =>
        prev.map((s) => (subKey(s) === subKey(sub) ? { ...s, enabled: !s.enabled } : s))
      )
      toast.success(
        sub.enabled
          ? t("modules.social_notifications.pausedSuccess")
          : t("modules.social_notifications.resumedSuccess")
      )
    } catch (e) {
      handleSaveError(e, { title: t("modules.saveError") })
    } finally {
      setPendingTarget(null)
    }
  }

  // ── Suppression ────────────────────────────────────────────────────────────

  const handleDelete = async (sub: SocialSubscription) => {
    if (!selectedGuildId) return
    setPendingTarget(subKey(sub))
    try {
      await deleteSocialSubscription(selectedGuildId, sub.platform, sub.target_id)
      const remaining = subscriptions.filter((s) => subKey(s) !== subKey(sub))
      setSubscriptions(remaining)
      // Plus aucune configuration → le module est implicitement désactivé.
      if (remaining.length === 0 && MODULE_ID in modules) {
        try {
          await disableModule(MODULE_ID)
        } catch (e) {
          logger.warn("module:social_notifications", "Could not disable module config", e)
        }
      }
      toast.success(t("modules.social_notifications.removedSuccess"))
    } catch (e) {
      handleSaveError(e, { title: t("modules.saveError") })
    } finally {
      setPendingTarget(null)
      setConfirmDelete(null)
    }
  }

  // ── États de chargement / erreur ───────────────────────────────────────────

  if (isLoadingGuild) {
    return (
      <div className="flex flex-col gap-4 w-full">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (guildError) {
    return <ErrorPage error={guildError} onRetry={refreshGuildData} />
  }

  return (
    <div className="flex flex-col gap-6 w-full pb-16">
      {/* En-tête */}
      <div className="flex items-center gap-4">
        <div className="size-11 rounded-xl bg-pink-100 dark:bg-pink-950 flex items-center justify-center shrink-0">
          <BellRingIcon className="size-5 text-pink-500" />
        </div>
        <div>
          <h1 className="text-xl font-semibold leading-none">
            {t("modules.social_notifications.name")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("modules.social_notifications.description")}
          </p>
        </div>
      </div>

      {/* Carte abonnements */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">
              {t("modules.social_notifications.subscriptionsTitle")}
            </CardTitle>
            <CardDescription>
              {t("modules.social_notifications.subscriptionsDescription", { limit })}
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={openNew}
            disabled={!canAddAny || isLoadingSubs}
            className="w-full sm:w-auto shrink-0"
          >
            <PlusIcon className="size-4" />
            {t("modules.social_notifications.addSubscription")}
          </Button>
        </CardHeader>
        <CardContent>
          {!isPremium && !canAddAny && subscriptions.length > 0 && (
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-violet-400/50 bg-violet-400/10 px-4 py-3">
              <CrownIcon className="size-4 text-violet-500 shrink-0" />
              <p className="text-xs text-violet-700 dark:text-violet-300">
                {t("modules.social_notifications.quotaUpsell")}
              </p>
            </div>
          )}

          {subsError ? (
            <div className="flex items-center gap-2 text-sm text-destructive rounded-lg border border-destructive/30 p-4">
              <AlertCircleIcon className="size-4 shrink-0" />
              {subsError}
              <Button variant="ghost" size="sm" className="ml-auto" onClick={loadSubscriptions}>
                {t("errors.retry")}
              </Button>
            </div>
          ) : isLoadingSubs ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-20 rounded-lg" />
              <Skeleton className="h-20 rounded-lg" />
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center border border-dashed rounded-lg">
              <div className="size-10 rounded-full bg-muted flex items-center justify-center">
                <BellRingIcon className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {t("modules.social_notifications.empty")}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("modules.social_notifications.emptyDescription")}
                </p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={openNew} disabled={!canAddAny}>
                <PlusIcon className="size-4" />
                {t("modules.social_notifications.addFirst")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {subscriptions.map((sub) => (
                <SubscriptionRow
                  key={subKey(sub)}
                  sub={sub}
                  pending={pendingTarget === subKey(sub)}
                  onEdit={() => openEdit(sub)}
                  onTogglePause={() => handleTogglePause(sub)}
                  onDelete={() => setConfirmDelete(sub)}
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
                ? t("modules.social_notifications.addTitle")
                : t("modules.social_notifications.editTitle")}
            </DialogTitle>
            <DialogDescription>
              {editing?.isNew
                ? t("modules.social_notifications.addDialogDescription")
                : t("modules.social_notifications.editDialogDescription")}
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <SubscriptionForm editing={editing} isAtLimit={isAtLimit} onChange={patchDraft} t={t} />
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={isSaving}>
              {t("modules.social_notifications.cancel")}
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving && <LoaderIcon className="size-4 mr-2 animate-spin" />}
              {editing?.isNew
                ? t("modules.social_notifications.add")
                : t("modules.social_notifications.save")}
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
              {t("modules.social_notifications.confirmDeleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("modules.social_notifications.confirmDeleteDescription", {
                name: confirmDelete?.display_name ?? confirmDelete?.identifier ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("modules.social_notifications.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("modules.social_notifications.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Ligne d'abonnement ─────────────────────────────────────────────────────────

interface SubscriptionRowProps {
  sub: SocialSubscription
  pending: boolean
  onEdit: () => void
  onTogglePause: () => void
  onDelete: () => void
  t: (key: string, opts?: Record<string, unknown>) => string
}

function SubscriptionRow({ sub, pending, onEdit, onTogglePause, onDelete, t }: SubscriptionRowProps) {
  const { channels } = useGuildContext()
  const meta = PLATFORM_META[sub.platform]
  const channel = channels.find((c) => String(c.id) === String(sub.channel_id))
  const color = sub.embed_color !== null ? intToHex(sub.embed_color) : meta.brandColor

  // Empêche le clic sur les boutons d'action de déclencher l'ouverture de l'édition.
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
        !sub.enabled && "opacity-60"
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Avatar className="size-9 shrink-0">
          <AvatarImage
            src={sub.avatar_url ?? undefined}
            alt={sub.display_name ?? sub.identifier}
            referrerPolicy="no-referrer"
          />
          <AvatarFallback className="bg-muted">
            <SocialIcon platform={sub.platform} className="size-4 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{sub.display_name ?? sub.identifier}</p>
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: `${color}1a`, color }}
            >
              <SocialIcon platform={sub.platform} className="size-3" />
              <span className="hidden min-[400px]:inline">
                {t(`modules.social_notifications.platforms.${sub.platform}`)}
              </span>
            </span>
            {!sub.enabled && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {t("modules.social_notifications.paused")}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {channel ? `# ${channel.name}` : `#${sub.channel_id}`}
            {sub.mention_role_ids.length > 0 &&
              ` · ${t("modules.social_notifications.rolesCount", { count: sub.mention_role_ids.length })}`}
          </p>
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
          title={sub.enabled ? t("modules.social_notifications.pause") : t("modules.social_notifications.resume")}
        >
          {pending ? (
            <LoaderIcon className="size-4 animate-spin" />
          ) : sub.enabled ? (
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

// ─── Option (taille uniforme + tooltip) ─────────────────────────────────────────

interface OptionToggleProps {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}

function OptionToggle({ label, hint, checked, onChange }: OptionToggleProps) {
  return (
    <div className="flex h-full items-center justify-between gap-2 rounded-lg border p-3">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm truncate">{label}</span>
        {hint && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                <InfoIcon className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{hint}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

// ─── Formulaire d'abonnement ────────────────────────────────────────────────────

interface SubscriptionFormProps {
  editing: EditingState
  isAtLimit: (platform: SocialPlatform) => boolean
  onChange: (patch: Partial<SubscriptionDraft>) => void
  t: (key: string, opts?: Record<string, unknown>) => string
}

function SubscriptionForm({ editing, isAtLimit, onChange, t }: SubscriptionFormProps) {
  const { channels, roles, selectedGuildId, isPremium } = useGuildContext()
  const { isNew, draft } = editing
  const meta = PLATFORM_META[draft.platform]

  const [upgrading, setUpgrading] = useState(false)

  const handleUpgrade = async () => {
    setUpgrading(true)
    try {
      const url = await createCheckout("monthly")
      window.location.href = url
    } catch (e) {
      handleSaveError(e, { title: t("modules.social_notifications.errorGeneric") })
      setUpgrading(false)
    }
  }

  const textChannels = channels.filter(
    (c) => c.type === CHANNEL_TYPES.TEXT || c.type === CHANNEL_TYPES.ANNOUNCEMENT
  )
  const manageableRoles = roles.filter((r) => !r.managed && r.name !== "@everyone")
  const availableRoles = manageableRoles.filter((r) => !draft.mention_role_ids.includes(r.id))

  const hasOptions = meta.supportsAvatar || meta.supportsMedia || !isNew
  // Upsell : free + au moins une plateforme déjà au quota
  const showUpsell =
    isNew &&
    !isPremium &&
    PLATFORM_ORDER.some((p) => !PLATFORM_META[p].disabled && isAtLimit(p))

  return (
    <div className="flex flex-col gap-5">
      {/* Plateforme */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">{t("modules.social_notifications.platform")}</label>
        {isNew ? (
          <div className="grid grid-cols-3 gap-2">
            {PLATFORM_ORDER.map((p) => {
              const pMeta = PLATFORM_META[p]
              const atLimit = isAtLimit(p)
              const blocked = pMeta.disabled || atLimit
              const active = draft.platform === p
              return (
                <button
                  key={p}
                  type="button"
                  disabled={blocked}
                  onClick={() => {
                    // Si le message est encore un template par défaut (non personnalisé),
                    // on le remplace par celui de la nouvelle plateforme.
                    const isDefault =
                      draft.message.trim() === "" ||
                      Object.values(DEFAULT_MESSAGES).includes(draft.message)
                    onChange({
                      platform: p,
                      embed_color: pMeta.brandColor,
                      show_avatar: pMeta.supportsAvatar,
                      show_media: pMeta.supportsMedia,
                      ...(isDefault ? { message: DEFAULT_MESSAGES[p] } : {}),
                    })
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all",
                    active
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-muted-foreground/50 hover:bg-muted/50",
                    blocked && "opacity-40 cursor-not-allowed hover:bg-transparent hover:border-border"
                  )}
                >
                  <SocialIcon platform={p} className="size-5" style={{ color: pMeta.brandColor }} />
                  <span className="text-xs font-medium">
                    {t(`modules.social_notifications.platforms.${p}`)}
                  </span>
                  {pMeta.disabled ? (
                    <span className="text-[10px] text-muted-foreground">
                      {t("modules.social_notifications.reserved")}
                    </span>
                  ) : atLimit ? (
                    <span className="text-[10px] text-muted-foreground">
                      {t("modules.social_notifications.full")}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
            <SocialIcon platform={draft.platform} className="size-4" style={{ color: meta.brandColor }} />
            <span className="text-sm font-medium">
              {t(`modules.social_notifications.platforms.${draft.platform}`)}
            </span>
            <span className="text-xs text-muted-foreground ml-auto truncate">{draft.identifier}</span>
          </div>
        )}
      </div>

      {/* Upsell Max (free + quota atteint) */}
      {showUpsell && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-violet-400/50 bg-violet-400/10 p-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <CrownIcon className="size-4 text-violet-500 shrink-0" />
            <p className="text-xs text-violet-700 dark:text-violet-300">
              {t("modules.social_notifications.quotaUpsell")}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="bg-violet-600 hover:bg-violet-700 text-white shrink-0"
            onClick={handleUpgrade}
            disabled={upgrading}
          >
            {upgrading ? <LoaderIcon className="size-4 animate-spin" /> : <SparklesIcon className="size-4" />}
            {t("modules.social_notifications.upgrade")}
          </Button>
        </div>
      )}

      {/* Identifiant (création uniquement) */}
      {isNew && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">{t("modules.social_notifications.identifier")}</label>
          <Input
            value={draft.identifier}
            onChange={(e) => onChange({ identifier: e.target.value })}
            placeholder={t(`modules.social_notifications.identifierPlaceholder.${draft.platform}`)}
          />
          <p className="text-xs text-muted-foreground">
            {t(`modules.social_notifications.identifierHint.${draft.platform}`)}
          </p>
        </div>
      )}

      {/* Salon */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">{t("modules.social_notifications.channel")}</label>
        <Select value={draft.channel_id || undefined} onValueChange={(v) => onChange({ channel_id: v })}>
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
      </div>

      {/* Rôles à mentionner */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">{t("modules.social_notifications.mentionRoles")}</label>
        {draft.mention_role_ids.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {draft.mention_role_ids.map((id) => {
              const role = roles.find((r) => r.id === id)
              const color = role ? roleColorToHex(role.color) : "#99aab5"
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium border"
                  style={{ borderColor: color, color }}
                >
                  @{role?.name ?? id}
                  <button
                    type="button"
                    onClick={() =>
                      onChange({ mention_role_ids: draft.mention_role_ids.filter((r) => r !== id) })
                    }
                    className="ml-0.5 rounded-full hover:opacity-70 transition-opacity"
                  >
                    <XIcon className="size-3" />
                  </button>
                </span>
              )
            })}
          </div>
        )}
        {availableRoles.length > 0 && (
          <Select
            value=""
            onValueChange={(roleId) =>
              onChange({ mention_role_ids: [...draft.mention_role_ids, roleId] })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={t("modules.social_notifications.addRole")} />
            </SelectTrigger>
            <SelectContent>
              {availableRoles.map((role) => {
                const color = roleColorToHex(role.color)
                return (
                  <SelectItem key={role.id} value={role.id}>
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
                      {role.name}
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        )}
        <p className="text-xs text-muted-foreground">
          {t("modules.social_notifications.mentionRolesHint")}
        </p>
      </div>

      {/* Message personnalisé (éditeur réutilisable) */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">{t("modules.social_notifications.message")}</label>
        <MessageEditor
          value={draft.message}
          onChange={(v) => onChange({ message: v })}
          variables={meta.placeholders}
          guildId={selectedGuildId ?? undefined}
          maxLength={MESSAGE_MAX}
          placeholder={t("modules.social_notifications.messagePlaceholder")}
        />
        <p className="text-xs text-muted-foreground">{t("modules.social_notifications.messageHint")}</p>
      </div>

      {/* Couleur d'embed — choix marque / personnalisée */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">{t("modules.social_notifications.embedColor")}</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChange({ useBrandColor: true })}
            className={cn(
              "flex items-center gap-2.5 rounded-lg border p-3 text-left transition-all",
              draft.useBrandColor
                ? "border-primary ring-1 ring-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50"
            )}
          >
            <span
              className="size-6 rounded-full ring-1 ring-border shrink-0"
              style={{ backgroundColor: meta.brandColor }}
            />
            <span className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate">
                {t("modules.social_notifications.colorBrand")}
              </span>
              <span className="text-xs text-muted-foreground font-mono">{meta.brandColor}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => onChange({ useBrandColor: false })}
            className={cn(
              "flex items-center gap-2.5 rounded-lg border p-3 text-left transition-all",
              !draft.useBrandColor
                ? "border-primary ring-1 ring-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50"
            )}
          >
            <span
              className="size-6 rounded-full ring-1 ring-border shrink-0"
              style={{ backgroundColor: draft.embed_color }}
            />
            <span className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate">
                {t("modules.social_notifications.colorCustom")}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {!draft.useBrandColor ? draft.embed_color : t("modules.social_notifications.colorPick")}
              </span>
            </span>
          </button>
        </div>
        {!draft.useBrandColor && (
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="color-field size-10 shrink-0 rounded-lg border border-input"
              value={draft.embed_color}
              onChange={(e) => onChange({ embed_color: e.target.value })}
            />
            <Input
              value={draft.embed_color}
              onChange={(e) => onChange({ embed_color: e.target.value })}
              placeholder={meta.brandColor}
              className="flex-1 font-mono"
              maxLength={7}
            />
          </div>
        )}
      </div>

      {/* Options (taille uniforme) */}
      {hasOptions && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">{t("modules.social_notifications.optionsTitle")}</label>
          <div className="grid grid-cols-2 gap-2 items-stretch">
            {!isNew && (
              <OptionToggle
                label={t("modules.social_notifications.active")}
                hint={t("modules.social_notifications.activeHint")}
                checked={draft.enabled}
                onChange={(v) => onChange({ enabled: v })}
              />
            )}
            {meta.supportsAvatar && (
              <OptionToggle
                label={t("modules.social_notifications.showAvatar")}
                hint={t("modules.social_notifications.showAvatarHint")}
                checked={draft.show_avatar}
                onChange={(v) => onChange({ show_avatar: v })}
              />
            )}
            {meta.supportsMedia && (
              <OptionToggle
                label={t("modules.social_notifications.showMedia")}
                hint={t("modules.social_notifications.showMediaHint")}
                checked={draft.show_media}
                onChange={(v) => onChange({ show_media: v })}
              />
            )}
          </div>
        </div>
      )}

      {/* Lien aide */}
      <a
        href="https://docs.moddy.app"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ExternalLinkIcon className="size-3" />
        {t("modules.social_notifications.learnMore")}
      </a>
    </div>
  )
}
