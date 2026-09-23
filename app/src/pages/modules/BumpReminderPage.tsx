import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Alert02Icon,
  AlertCircleIcon,
  Delete02Icon,
  PencilEdit02Icon,
  Rocket01Icon,
} from "@hugeicons/core-free-icons"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ErrorPage } from "@/components/error-state"
import { UnsavedBar } from "@/components/unsaved-bar"
import { DirectoryIcon } from "@/components/bump-reminder/directory-icon"
import { BumpLiveState } from "@/components/bump-reminder/live-state"
import { ReminderDialog } from "@/components/bump-reminder/reminder-dialog"
import { useGuildContext } from "@/contexts/GuildContext"
import { useSanctionGates } from "@/contexts/SanctionContext"
import { ApiError } from "@/lib/auth"
import {
  bumpChannels,
  bumpRoles,
  bumpReminderNotices,
  formatInterval,
  hasDuplicateTarget,
  isBumpConfigValid,
  isSameBumpConfig,
  newBumpReminderDraft,
  overQuotaDirectories,
  serializeBumpConfig,
  usedByDirectory,
  validateBumpReminder,
} from "@/lib/bump-reminder"
import type { BumpReminderDraft } from "@/lib/bump-reminder"
import { handleSaveError } from "@/lib/handle-error"
import { logger } from "@/lib/logger"
import { sanctionBlockedError } from "@/lib/sanctions"
import {
  deleteBumpConfig,
  getBumpCatalog,
  getBumpConfig,
  getBumpDiagnostics,
  getBumpState,
  saveBumpConfig,
} from "@/services/bump-reminder"
import type { Channel, Role } from "@/types/api"
import type { BumpCatalog, BumpDiagnostics, BumpState } from "@/types/bump-reminder"

const MODULE_ID = "bump_reminder"
const K = "modules.bump_reminder"
const POLL_MS = 45_000

/** Garde de chargement : le formulaire attend les salons et les rôles. */
export function BumpReminderPage() {
  const { isLoadingGuild, isGuildReady, guildError, refreshGuildData } = useGuildContext()

  if (guildError) return <ErrorPage error={guildError} onRetry={refreshGuildData} />
  if (isLoadingGuild || !isGuildReady) {
    return (
      <div className="flex w-full flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }
  return <BumpReminderView />
}

function BumpReminderView() {
  const { t } = useTranslation()
  const { selectedGuildId, channels, roles, user, syncModule } = useGuildContext()
  const guildId = selectedGuildId as string
  const gates = useSanctionGates(guildId)

  const [catalog, setCatalog] = useState<BumpCatalog | null>(null)
  const [saved, setSaved] = useState<BumpReminderDraft[] | null>(null)
  const [draft, setDraft] = useState<BumpReminderDraft[] | null>(null)
  const [isConfigured, setIsConfigured] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  /** Refus du backend (quota, vérification Discord) — texte lisible. */
  const [serverError, setServerError] = useState<string | null>(null)
  const [state, setState] = useState<BumpState | null>(null)
  const [isRefreshingState, setIsRefreshingState] = useState(false)
  const [diagnostics, setDiagnostics] = useState<BumpDiagnostics | null>(null)
  const [editing, setEditing] = useState<{ reminder: BumpReminderDraft; isNew: boolean } | null>(null)

  const textChannels = useMemo(() => bumpChannels(channels), [channels])
  const roleOptions = useMemo(() => bumpRoles(roles, guildId), [roles, guildId])

  // ── Chargement ────────────────────────────────────────────────────────────

  const loadState = useCallback(async () => {
    setIsRefreshingState(true)
    try {
      setState(await getBumpState(guildId))
    } catch (e) {
      logger.warn("module:bump_reminder", "State failed", e)
    } finally {
      setIsRefreshingState(false)
    }
  }, [guildId])

  const loadDiagnostics = useCallback(async () => {
    try {
      setDiagnostics(await getBumpDiagnostics(guildId))
    } catch (e) {
      // Complément : un échec n'affiche rien, ce n'est pas un diagnostic négatif.
      logger.warn("module:bump_reminder", "Diagnostics failed", e)
    }
  }, [guildId])

  const loadCatalog = useCallback(async () => {
    try {
      setCatalog(await getBumpCatalog(guildId))
    } catch (e) {
      logger.warn("module:bump_reminder", "Catalog refresh failed", e)
    }
  }, [guildId])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        // Le catalogue d'abord : sans lui, ni annuaires ni limites.
        const [nextCatalog, config] = await Promise.all([getBumpCatalog(guildId), getBumpConfig(guildId)])
        if (cancelled) return
        setCatalog(nextCatalog)
        setIsConfigured(config !== null)
        setSaved(config ?? [])
        setDraft(config ?? [])
      } catch (e) {
        if (cancelled) return
        logger.error("module:bump_reminder", "Load failed", e)
        setLoadError(e instanceof Error ? e.message : "Failed to load module config")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    void loadState()
    void loadDiagnostics()
    return () => {
      cancelled = true
    }
  }, [guildId, loadState, loadDiagnostics])

  // Pas de temps réel : relecture de `/state` toutes les 45 s, onglet visible.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadState()
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [loadState])

  // ── Brouillon ─────────────────────────────────────────────────────────────

  const isDirty = Boolean(saved && draft && !isSameBumpConfig(saved, draft))

  const updateReminder = useCallback((key: string, changes: Partial<BumpReminderDraft>) => {
    setDraft((prev) => prev?.map((r) => (r.key === key ? { ...r, ...changes } : r)) ?? prev)
    setServerError(null)
  }, [])

  const removeReminder = useCallback((key: string) => {
    setDraft((prev) => prev?.filter((r) => r.key !== key) ?? prev)
    setServerError(null)
  }, [])

  const openNew = useCallback(() => {
    if (!catalog || !draft) return
    const counts = usedByDirectory(draft)
    const firstFree =
      catalog.directories.find((d) => (counts[d.key] ?? 0) < catalog.limits.per_directory)?.key ?? ""
    setEditing({
      reminder: newBumpReminderDraft(firstFree, catalog.default_ping_mode, user.user_id ?? null),
      isNew: true,
    })
  }, [catalog, draft, user.user_id])

  const submitDialog = useCallback(
    (reminder: BumpReminderDraft) => {
      setDraft((prev) => {
        if (!prev) return prev
        return prev.some((r) => r.key === reminder.key)
          ? prev.map((r) => (r.key === reminder.key ? reminder : r))
          : [...prev, reminder]
      })
      setServerError(null)
      setEditing(null)
    },
    []
  )

  // ── Sauvegarde ────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!draft || !catalog) return

    if (!isConfigured && !gates.canEnableNewModule) {
      handleSaveError(sanctionBlockedError("new_module_blocked", gates.effective), {
        title: t("modules.saveError"),
      })
      return
    }
    if (!isBumpConfigValid(draft, catalog.limits, guildId)) {
      toast.error(t("modules.saveError"), { description: t(`${K}.errors.fixReminders`) })
      return
    }

    logger.event("module:bump_reminder", "Save", { count: draft.length })
    setIsSaving(true)
    setServerError(null)
    try {
      // La réponse porte les `id` générés : elle **remplace** l'état local.
      const next = await saveBumpConfig(guildId, draft)
      setSaved(next)
      setDraft(next)
      setIsConfigured(true)
      syncModule(MODULE_ID, { ...serializeBumpConfig(next) })
      toast.success(t(`${K}.saved`))
      void loadCatalog()
      void loadDiagnostics()
      void loadState()
    } catch (e) {
      logger.error("module:bump_reminder", "Save failed", e)
      // 422 texte (quota, vérification Discord) : lisible, affiché tel quel.
      if (e instanceof ApiError && e.status === 422 && e.validationIssues.length === 0) {
        setServerError(e.message)
        toast.error(t("modules.saveError"), { description: e.message })
        return
      }
      handleSaveError(e, { title: t("modules.saveError") })
    } finally {
      setIsSaving(false)
    }
  }, [draft, catalog, isConfigured, gates, guildId, syncModule, loadCatalog, loadDiagnostics, loadState, t])

  const handleDiscard = useCallback(() => {
    if (!saved) return
    setDraft(saved)
    setServerError(null)
  }, [saved])

  const handleDelete = useCallback(async () => {
    logger.event("module:bump_reminder", "Delete")
    setIsDeleting(true)
    try {
      await deleteBumpConfig(guildId)
      setSaved([])
      setDraft([])
      setIsConfigured(false)
      setServerError(null)
      syncModule(MODULE_ID, null)
      toast.success(t(`${K}.deleted`))
      void loadCatalog()
      void loadDiagnostics()
      void loadState()
    } catch (e) {
      logger.error("module:bump_reminder", "Delete failed", e)
      handleSaveError(e, { title: t("modules.saveError") })
    } finally {
      setIsDeleting(false)
      setConfirmDelete(false)
    }
  }, [guildId, syncModule, loadCatalog, loadDiagnostics, loadState, t])

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (loadError) return <ErrorPage error={loadError} onRetry={() => window.location.reload()} />
  if (isLoading || !draft || !saved || !catalog) {
    return (
      <div className="flex w-full flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  const isActive = saved.some((r) => r.enabled && r.channel_id)
  const counts = usedByDirectory(draft)
  const canAdd = catalog.directories.some((d) => (counts[d.key] ?? 0) < catalog.limits.per_directory)
  const overQuota = overQuotaDirectories(draft, catalog.limits)
  const directoryName = (bot: string) => catalog.directories.find((d) => d.key === bot)?.name ?? bot

  return (
    <div className="flex w-full flex-col gap-6 pb-24">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
            <HugeiconsIcon icon={Rocket01Icon} strokeWidth={2} className="size-5" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-xl leading-none font-semibold">{t(`${K}.name`)}</h1>
            <p className="text-sm text-muted-foreground">{t(`${K}.description`)}</p>
          </div>
        </div>
        <Badge variant={isActive ? "default" : "secondary"}>
          {t(isActive ? `${K}.statusActive` : `${K}.statusInactive`)}
        </Badge>
      </div>

      {/* Premium perdu : plus de rappels que le quota — rien ne s'enregistre
          tant qu'ils n'ont pas été retirés. */}
      {overQuota.length > 0 && (
        <Alert variant="destructive">
          <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} />
          <AlertTitle>{t(`${K}.overQuotaTitle`)}</AlertTitle>
          <AlertDescription>
            {t(`${K}.overQuota`, {
              directories: overQuota.map(directoryName).join(", "),
              max: catalog.limits.per_directory,
            })}
          </AlertDescription>
        </Alert>
      )}

      {serverError && (
        <Alert variant="destructive">
          <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} />
          <AlertTitle>{t(`${K}.errors.serverTitle`)}</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <BumpLiveState state={state} isRefreshing={isRefreshingState} onRefresh={() => void loadState()} />

      <Card>
        <CardHeader>
          <CardTitle>{t(`${K}.remindersTitle`)}</CardTitle>
          <CardDescription>
            {t(`${K}.remindersDescription`, { max: catalog.limits.per_directory })}
            {!catalog.premium && (
              <>
                {" "}
                {t(`${K}.premiumHint`, { max: catalog.limits.per_directory_premium })}
                {gates.canSubscribe && (
                  <>
                    {" "}
                    <Link to="/premium" className="underline underline-offset-3">
                      {t(`${K}.premiumCta`)}
                    </Link>
                  </>
                )}
              </>
            )}
          </CardDescription>
          {draft.length > 0 && (
            <CardAction>
              <Button size="sm" onClick={openNew} disabled={!canAdd}>
                <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
                {t(`${K}.add`)}
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {draft.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HugeiconsIcon icon={Rocket01Icon} strokeWidth={2} />
                </EmptyMedia>
                <EmptyTitle>{t(`${K}.emptyTitle`)}</EmptyTitle>
                <EmptyDescription>{t(`${K}.emptyDescription`)}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={openNew}>
                  <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
                  {t(`${K}.add`)}
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <ItemGroup className="gap-2">
              {draft.map((reminder) => (
                <ReminderRow
                  key={reminder.key}
                  reminder={reminder}
                  all={draft}
                  catalog={catalog}
                  channels={channels}
                  roles={roles}
                  guildId={guildId}
                  diagnostics={diagnostics}
                  overQuota={overQuota.includes(reminder.bot)}
                  onToggle={(enabled) => updateReminder(reminder.key, { enabled })}
                  onEdit={() => setEditing({ reminder, isNew: false })}
                  onRemove={() => removeReminder(reminder.key)}
                />
              ))}
            </ItemGroup>
          )}
        </CardContent>
        {isConfigured && (
          <CardFooter className="justify-end">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              disabled={isSaving || isDeleting}
            >
              {isDeleting ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} data-icon="inline-start" />
              )}
              {t(`${K}.deleteAll`)}
            </Button>
          </CardFooter>
        )}
      </Card>

      <ReminderDialog
        open={editing !== null}
        initial={editing?.reminder ?? null}
        isNew={editing?.isNew ?? false}
        all={draft}
        catalog={catalog}
        channels={textChannels}
        roles={roleOptions}
        guildId={guildId}
        canSubscribe={gates.canSubscribe}
        onOpenChange={(open) => !open && setEditing(null)}
        onSubmit={submitDialog}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(`${K}.confirmDeleteTitle`)}</AlertDialogTitle>
            <AlertDialogDescription>{t(`${K}.confirmDeleteDescription`)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void handleDelete()}>
              {t(`${K}.deleteAll`)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UnsavedBar isDirty={isDirty} isSaving={isSaving} onSave={handleSave} onDiscard={handleDiscard} />
    </div>
  )
}

/**
 * Un rappel du brouillon. Les alertes de `/diagnostics` portent sur la config
 * **en base** : une entrée pas encore enregistrée (sans `id`) n'en a pas.
 */
function ReminderRow({
  reminder,
  all,
  catalog,
  channels,
  roles,
  guildId,
  diagnostics,
  overQuota,
  onToggle,
  onEdit,
  onRemove,
}: {
  reminder: BumpReminderDraft
  all: BumpReminderDraft[]
  catalog: BumpCatalog
  channels: Channel[]
  roles: Role[]
  guildId: string
  diagnostics: BumpDiagnostics | null
  overQuota: boolean
  onToggle: (enabled: boolean) => void
  onEdit: () => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const directory = catalog.directories.find((d) => d.key === reminder.bot)
  const channel = channels.find((c) => c.id === reminder.channel_id)
  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? id
  const interval = reminder.interval ?? directory?.default_interval ?? null
  const invalid =
    validateBumpReminder(reminder, catalog.limits, guildId).length > 0 || hasDuplicateTarget(reminder, all)
  const notices = bumpReminderNotices(diagnostics, reminder.id)

  return (
    <Item variant="outline" size="sm">
      <ItemMedia>
        <DirectoryIcon bot={reminder.bot} />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="flex-wrap">
          {/* Marque : jamais traduite. */}
          {directory?.name ?? reminder.bot}
          {!reminder.enabled && <Badge variant="secondary">{t(`${K}.paused`)}</Badge>}
          {reminder.id === null && <Badge variant="outline">{t(`${K}.unsaved`)}</Badge>}
          {overQuota && <Badge variant="destructive">{t(`${K}.overQuotaBadge`)}</Badge>}
        </ItemTitle>
        <ItemDescription>
          {channel ? `#${channel.name}` : reminder.channel_id ? `#${reminder.channel_id}` : t(`${K}.noChannel`)}
          {" · "}
          {interval !== null && (
            <>
              {reminder.interval === null
                ? t(`${K}.intervalDefault`, { interval: formatInterval(interval) })
                : t(`${K}.intervalCustom`, { interval: formatInterval(interval) })}
              {" · "}
            </>
          )}
          {t(`${K}.pingModes.${reminder.ping_mode}.short`)}
          {reminder.role_ids.length > 0 && (
            <>
              {" · "}
              {reminder.role_ids.map((id) => `@${roleName(id)}`).join(", ")}
            </>
          )}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Switch
          checked={reminder.enabled}
          onCheckedChange={onToggle}
          aria-label={t(`${K}.fields.enabled`)}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={t(`${K}.edit`)}>
              <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t(`${K}.edit`)}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label={t(`${K}.remove`)}>
              <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t(`${K}.remove`)}</TooltipContent>
        </Tooltip>
      </ItemActions>
      {(notices.length > 0 || invalid) && (
        <ItemFooter className="flex-col items-stretch gap-2">
          {invalid && (
            <Alert variant="destructive">
              <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} />
              <AlertDescription>{t(`${K}.errors.rowInvalid`)}</AlertDescription>
            </Alert>
          )}
          {notices.map((notice) => (
            <Alert key={notice.key} variant={notice.level === "error" ? "destructive" : "default"}>
              <HugeiconsIcon icon={notice.level === "error" ? AlertCircleIcon : Alert02Icon} strokeWidth={2} />
              <AlertDescription>
                {t(`${K}.diagnostics.${notice.key}`, {
                  roles: notice.roleIds?.map((id) => `@${roleName(id)}`).join(", ") ?? "",
                })}
              </AlertDescription>
            </Alert>
          ))}
        </ItemFooter>
      )}
    </Item>
  )
}
