import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { AddIcon, AlertCircleIcon, DeleteIcon, EditIcon, RocketIcon, TriangleAlertIcon } from "@/components/icons"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
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
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ModulePage } from "@/components/module/module-page"
import { ModuleStateControl } from "@/components/module/module-state-control"
import { DirectoryIcon } from "@/components/bump-reminder/directory-icon"
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
  saveBumpConfig,
} from "@/services/bump-reminder"
import type { Channel, Role } from "@/types/api"
import type { BumpCatalog, BumpDiagnostics } from "@/types/bump-reminder"

const MODULE_ID = "bump_reminder"
const K = "modules.bump_reminder"

export function BumpReminderPage() {
  const { isLoadingGuild, isGuildReady, guildError, refreshGuildData } = useGuildContext()

  if (guildError || isLoadingGuild || !isGuildReady) {
    return (
      <ModulePage moduleId={MODULE_ID} loading={!guildError} error={guildError} onRetry={refreshGuildData}>
        {null}
      </ModulePage>
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
  const [draft, setDraft] = useState<BumpReminderDraft[] | null>(null)
  const [isConfigured, setIsConfigured] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  /** Refus du backend (quota, vérification Discord) — texte lisible. */
  const [serverError, setServerError] = useState<string | null>(null)
  const [diagnostics, setDiagnostics] = useState<BumpDiagnostics | null>(null)
  const [editing, setEditing] = useState<{ reminder: BumpReminderDraft; isNew: boolean } | null>(null)

  const textChannels = useMemo(() => bumpChannels(channels), [channels])
  const roleOptions = useMemo(() => bumpRoles(roles, guildId), [roles, guildId])

  // ── Chargement ────────────────────────────────────────────────────────────

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
    void loadDiagnostics()
    return () => {
      cancelled = true
    }
  }, [guildId, loadDiagnostics])

  // ── Brouillon ─────────────────────────────────────────────────────────────

  /**
   * Écrit la liste complète (PUT) et **remplace** l'état local par la réponse :
   * elle porte les `id` générés, sans quoi l'écriture suivante recréerait
   * l'entrée. Renvoie `true` si l'écriture a réussi.
   */
  const persist = useCallback(
    async (next: BumpReminderDraft[], opts: { validate: boolean }): Promise<boolean> => {
      if (!catalog) return false
      if (!isConfigured && !gates.canEnableNewModule) {
        handleSaveError(sanctionBlockedError("new_module_blocked", gates.effective), {
          title: t("modules.saveError"),
        })
        return false
      }
      if (opts.validate && !isBumpConfigValid(next, catalog.limits, guildId)) {
        toast.error(t("modules.saveError"), { description: t(`${K}.errors.fixReminders`) })
        return false
      }
      logger.event("module:bump_reminder", "Save", { count: next.length })
      setIsSaving(true)
      setServerError(null)
      try {
        const saved = await saveBumpConfig(guildId, next)
        setDraft(saved)
        setIsConfigured(true)
        syncModule(MODULE_ID, { ...serializeBumpConfig(saved) })
        toast.success(t(`${K}.saved`))
        void loadCatalog()
        void loadDiagnostics()
        return true
      } catch (e) {
        logger.error("module:bump_reminder", "Save failed", e)
        // 422 texte (quota, vérification Discord) : lisible, affiché tel quel.
        if (e instanceof ApiError && e.status === 422 && e.validationIssues.length === 0) {
          setServerError(e.message)
          toast.error(t("modules.saveError"), { description: e.message })
        } else {
          handleSaveError(e, { title: t("modules.saveError") })
        }
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [catalog, isConfigured, gates, guildId, syncModule, loadCatalog, loadDiagnostics, t]
  )

  const toggleReminder = useCallback(
    (key: string, enabled: boolean) => {
      if (!draft) return
      void persist(draft.map((r) => (r.key === key ? { ...r, enabled } : r)), { validate: false })
    },
    [draft, persist]
  )

  const removeReminder = useCallback(
    (key: string) => {
      if (!draft) return
      void persist(draft.filter((r) => r.key !== key), { validate: false })
    },
    [draft, persist]
  )

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

  /** Validation du dialog = enregistrement. Le dialog se ferme si l'écriture passe. */
  const submitDialog = useCallback(
    async (reminder: BumpReminderDraft) => {
      if (!draft) return
      const next = draft.some((r) => r.key === reminder.key)
        ? draft.map((r) => (r.key === reminder.key ? reminder : r))
        : [...draft, reminder]
      if (await persist(next, { validate: true })) setEditing(null)
    },
    [draft, persist]
  )

  /** Réinitialisation (menu de l'en-tête) : DELETE, puis liste vide. */
  const handleReset = useCallback(async () => {
    logger.event("module:bump_reminder", "Delete")
    await deleteBumpConfig(guildId)
    setDraft([])
    setIsConfigured(false)
    setServerError(null)
    syncModule(MODULE_ID, null)
    void loadCatalog()
    void loadDiagnostics()
  }, [guildId, syncModule, loadCatalog, loadDiagnostics])

  // ── Rendu ─────────────────────────────────────────────────────────────────

  const reminders = draft ?? []
  const counts = usedByDirectory(reminders)
  const canAdd = catalog ? catalog.directories.some((d) => (counts[d.key] ?? 0) < catalog.limits.per_directory) : false
  const overQuota = catalog ? overQuotaDirectories(reminders, catalog.limits) : []
  const directoryName = (bot: string) => catalog?.directories.find((d) => d.key === bot)?.name ?? bot

  return (
    <ModulePage
      moduleId={MODULE_ID}
      loading={isLoading || !draft || !catalog}
      error={loadError}
      onRetry={() => window.location.reload()}
      actions={<ModuleStateControl moduleId={MODULE_ID} onReset={handleReset} />}
    >
      {draft && catalog && (
        <>
      {/* Premium perdu : plus de rappels que le quota — rien ne s'enregistre
          tant qu'ils n'ont pas été retirés. */}
      {overQuota.length > 0 && (
        <Alert variant="destructive">
          <AlertCircleIcon/>
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
          <AlertCircleIcon/>
          <AlertTitle>{t(`${K}.errors.serverTitle`)}</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

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
                <AddIcon data-icon="inline-start"/>
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
                  <RocketIcon/>
                </EmptyMedia>
                <EmptyTitle>{t(`${K}.emptyTitle`)}</EmptyTitle>
                <EmptyDescription>{t(`${K}.emptyDescription`)}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={openNew}>
                  <AddIcon data-icon="inline-start"/>
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
                  onToggle={(enabled) => toggleReminder(reminder.key, enabled)}
                  onEdit={() => setEditing({ reminder, isNew: false })}
                  onRemove={() => removeReminder(reminder.key)}
                />
              ))}
            </ItemGroup>
          )}
        </CardContent>
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
        saving={isSaving}
        onSubmit={submitDialog}
      />

        </>
      )}
    </ModulePage>
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
              <EditIcon/>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t(`${K}.edit`)}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label={t(`${K}.remove`)}>
              <DeleteIcon/>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t(`${K}.remove`)}</TooltipContent>
        </Tooltip>
      </ItemActions>
      {(notices.length > 0 || invalid) && (
        <ItemFooter className="flex-col items-stretch gap-2">
          {invalid && (
            <Alert variant="destructive">
              <AlertCircleIcon/>
              <AlertDescription>{t(`${K}.errors.rowInvalid`)}</AlertDescription>
            </Alert>
          )}
          {notices.map((notice) => (
            <Alert key={notice.key} variant={notice.level === "error" ? "destructive" : "default"}>
              {notice.level === "error" ? <AlertCircleIcon /> : <TriangleAlertIcon />}
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
