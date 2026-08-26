import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  FileClockIcon,
  InfoIcon,
  LoaderIcon,
  Trash2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
import { UnsavedBar } from "@/components/unsaved-bar"
import { ServerLanguageNote } from "@/components/server-language-note"
import { ErrorPage } from "@/components/error-state"
import { ApiError } from "@/lib/auth"
import { handleSaveError } from "@/lib/handle-error"
import { logger } from "@/lib/logger"
import { sanctionBlockedError } from "@/lib/sanctions"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useGuildContext } from "@/contexts/GuildContext"
import { useSanctionGates } from "@/contexts/SanctionContext"
import {
  buildLogsBody,
  categoryDescription,
  categoryLabel,
  categoryOf,
  diagnosticNotices,
  emptyLogsConfig,
  eventLabel,
  eventTitle,
  isSameLogsConfig,
  isThreadChannel,
  linkedChannelIds,
  logsDestinationChannels,
  mapLogsError,
  validateLogsBody,
} from "@/lib/logs"
import type { LogsDiagnosticNotice, LogsErrors, LogsIssue } from "@/lib/logs"
import {
  deleteLogsConfig,
  getLogsCatalog,
  getLogsConfig,
  getLogsDiagnostics,
  saveLogsConfig,
} from "@/services/logs"
import { roleColorToHex } from "@/types/api"
import type {
  Channel,
  LogCategoryConfig,
  LogsCatalog,
  LogsConfig,
  LogsDiagnostics,
} from "@/types/api"

/**
 * Garde de chargement : le formulaire attend les salons et les rôles du serveur.
 * Sans ça, une arrivée directe sur l'URL monte des sélecteurs vides.
 */
export function LogsPage() {
  const { isLoadingGuild, isGuildReady, guildError, refreshGuildData } = useGuildContext()

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

  return <LogsForm />
}

const NO_ERRORS: LogsErrors = {
  global: [],
  byPath: new Map(),
  categories: new Set(),
  channels: new Set(),
}

function LogsForm() {
  const { t } = useTranslation()
  const { selectedGuildId, channels, roles, syncModule } = useGuildContext()
  const gates = useSanctionGates(selectedGuildId)

  const [catalog, setCatalog] = useState<LogsCatalog | null>(null)
  const [savedConfig, setSavedConfig] = useState<LogsConfig | null>(null)
  const [draft, setDraft] = useState<LogsConfig | null>(null)
  /** `false` tant que le serveur n'a jamais configuré le module (GET → 404). */
  const [isConfigured, setIsConfigured] = useState(false)
  const [diagnostics, setDiagnostics] = useState<LogsDiagnostics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [errors, setErrors] = useState<LogsErrors>(NO_ERRORS)
  const [clientIssues, setClientIssues] = useState<LogsIssue[]>([])
  /**
   * Salons déliés lors de la dernière écriture. Leur webhook « Moddy Logs »
   * reste dans Discord : ni le bot ni le backend ne le suppriment, et le
   * dashboard n'a pas de jeton pour le faire — il le signale donc.
   */
  const [orphanWebhooks, setOrphanWebhooks] = useState<string[]>([])

  const destinations = useMemo(() => logsDestinationChannels(channels), [channels])
  const channelById = useMemo(
    () => new Map(channels.map((c) => [c.id, c] as const)),
    [channels]
  )
  const ignorableRoles = useMemo(
    () => roles.filter((r) => r.id !== selectedGuildId && r.name !== "@everyone"),
    [roles, selectedGuildId]
  )

  // ── Chargement ────────────────────────────────────────────────────────────

  const refreshDiagnostics = useCallback(async (guildId: string) => {
    try {
      setDiagnostics(await getLogsDiagnostics(guildId))
    } catch (e) {
      // Le diagnostic est un complément : son échec ne casse pas la page.
      logger.warn("module:logs", "Diagnostics unavailable", e)
      setDiagnostics(null)
    }
  }, [])

  useEffect(() => {
    if (!selectedGuildId) return
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const [loadedCatalog, loadedConfig] = await Promise.all([
          getLogsCatalog(selectedGuildId),
          getLogsConfig(selectedGuildId),
        ])
        if (cancelled) return
        // 404 = jamais configuré → formulaire vierge, ce n'est pas une erreur.
        const initial = loadedConfig ?? emptyLogsConfig()
        setCatalog(loadedCatalog)
        setIsConfigured(loadedConfig !== null)
        setSavedConfig(initial)
        setDraft(initial)
      } catch (e) {
        if (cancelled) return
        logger.error("module:logs", "Load failed", e)
        setLoadError(e instanceof Error ? e.message : "Failed to load module config")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    refreshDiagnostics(selectedGuildId)
    return () => {
      cancelled = true
    }
  }, [selectedGuildId, refreshDiagnostics])

  // ── Mutations du brouillon ────────────────────────────────────────────────

  const patch = useCallback((changes: Partial<LogsConfig>) => {
    setDraft((prev) => (prev ? { ...prev, ...changes } : prev))
  }, [])

  const patchCategory = useCallback(
    (categoryId: string, changes: Partial<LogCategoryConfig>) => {
      setDraft((prev) => {
        if (!prev) return prev
        const current = categoryOf(prev, categoryId)
        return {
          ...prev,
          categories: { ...prev.categories, [categoryId]: { ...current, ...changes } },
        }
      })
      setErrors((prev) => {
        if (!prev.categories.has(categoryId)) return prev
        const next = new Set(prev.categories)
        next.delete(categoryId)
        return { ...prev, categories: next }
      })
    },
    []
  )

  const isDirty = Boolean(
    catalog && savedConfig && draft && !isSameLogsConfig(savedConfig, draft, catalog)
  )

  // ── Sauvegarde ────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!selectedGuildId || !draft || !catalog || !savedConfig) return

    const body = buildLogsBody(draft, catalog)

    // Miroir des règles du backend : le 422 est le filet, pas l'UX.
    const issues = validateLogsBody(body, catalog)
    if (issues.length > 0) {
      setClientIssues(issues)
      setErrors(NO_ERRORS)
      toast.error(t("modules.saveError"), { description: t(issues[0].key, issues[0].params) })
      return
    }

    // Sous sanction, activer un module *jamais configuré* est refusé. On le dit
    // ici plutôt que d'attendre le 403 — le message est le même.
    if (!isConfigured && !gates.canEnableNewModule) {
      handleSaveError(sanctionBlockedError("new_module_blocked", gates.effective), {
        title: t("modules.saveError"),
      })
      return
    }

    logger.event("module:logs", "Save", {
      categories: Object.keys(body.categories).length,
    })
    setIsSaving(true)
    setClientIssues([])
    setErrors(NO_ERRORS)
    const before = linkedChannelIds(savedConfig)
    try {
      // ⚠️ La réponse fait foi : le backend a pu retirer des catégories sans
      // salon ni exclusion. Garder le brouillon ferait diverger l'écran de la base.
      const saved = await saveLogsConfig(selectedGuildId, body)
      setSavedConfig(saved)
      setDraft(saved)
      setIsConfigured(true)
      // La vue d'ensemble et la sidebar lisent `modules` du contexte.
      syncModule("logs", { ...saved })

      const after = linkedChannelIds(saved)
      setOrphanWebhooks(before.filter((id) => !after.includes(id)))

      // `enabled: false` après un enregistrement réussi = « rien ne sera
      // logué ». Sans ce retour, l'admin croit avoir configuré ses logs.
      if (saved.enabled) toast.success(t("modules.saved"))
      else toast.warning(t("modules.saved"), { description: t("modules.logs.savedButInactive") })

      logger.success("module:logs", "Saved", { enabled: saved.enabled })
      // Le diagnostic inspecte la config en base : il n'a de sens qu'après l'écriture.
      await refreshDiagnostics(selectedGuildId)
    } catch (e) {
      logger.error("module:logs", "Save failed", e)
      if (e instanceof ApiError && (e.status === 422 || e.status === 400)) {
        const mapped = mapLogsError(e, catalog)
        setErrors(mapped)
        toast.error(t("modules.saveError"), {
          description: mapped.global[0] ?? e.message,
        })
        return
      }
      handleSaveError(e, { title: t("modules.saveError") })
    } finally {
      setIsSaving(false)
    }
  }, [
    selectedGuildId,
    draft,
    catalog,
    savedConfig,
    isConfigured,
    gates,
    syncModule,
    refreshDiagnostics,
    t,
  ])

  const handleDiscard = useCallback(() => {
    if (!savedConfig) return
    logger.event("module:logs", "Discard")
    setDraft(savedConfig)
    setErrors(NO_ERRORS)
    setClientIssues([])
  }, [savedConfig])

  /**
   * Mise en pause : on retire les salons, les exclusions restent. Ce n'est
   * qu'une mutation du brouillon — l'admin voit ce qui va partir et enregistre
   * lui-même, comme pour n'importe quelle autre modification.
   */
  const handleUnlinkAll = useCallback(() => {
    if (!draft) return
    logger.event("module:logs", "Unlink all channels")
    const categories: Record<string, LogCategoryConfig> = {}
    for (const [id, category] of Object.entries(draft.categories)) {
      categories[id] = { ...category, channel_ids: [] }
    }
    patch({ categories })
  }, [draft, patch])

  /** Réinitialisation : `DELETE`, donc perte des exclusions et des ignorés. */
  const handleReset = useCallback(async () => {
    if (!selectedGuildId || !savedConfig) return
    logger.event("module:logs", "Reset")
    setIsResetting(true)
    const before = linkedChannelIds(savedConfig)
    try {
      await deleteLogsConfig(selectedGuildId)
      const fresh = emptyLogsConfig()
      setSavedConfig(fresh)
      setDraft(fresh)
      setIsConfigured(false)
      setErrors(NO_ERRORS)
      setClientIssues([])
      setOrphanWebhooks(before)
      syncModule("logs", null)
      setDiagnostics(null)
      toast.success(t("modules.logs.resetDone"))
      logger.success("module:logs", "Reset")
    } catch (e) {
      logger.error("module:logs", "Reset failed", e)
      handleSaveError(e, { title: t("modules.saveError") })
    } finally {
      setIsResetting(false)
      setConfirmReset(false)
    }
  }, [selectedGuildId, savedConfig, syncModule, t])

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (loadError) {
    return <ErrorPage error={loadError} onRetry={() => window.location.reload()} />
  }

  if (isLoading || !draft || !catalog || !savedConfig) {
    return (
      <div className="flex flex-col gap-4 w-full">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  const notices = diagnosticNotices(diagnostics)
  const draftLinked = linkedChannelIds(draft)
  // Le badge dit l'état **en base** ; le brouillon, lui, est annoncé à part.
  const isActive = savedConfig.enabled === true

  return (
    <div className="flex flex-col gap-6 w-full pb-24">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="size-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
            <FileClockIcon className="size-5 text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-none">{t("modules.logs.name")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("modules.logs.description")}</p>
          </div>
        </div>
        {/* Pas d'interrupteur : `enabled` est calculé (au moins un salon lié). */}
        {isActive ? (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
            <CheckCircle2Icon className="size-3 mr-1" />
            {t("modules.logs.statusActive")}
          </Badge>
        ) : (
          <Badge variant="secondary">
            <XIcon className="size-3 mr-1" />
            {t("modules.logs.statusInactive")}
          </Badge>
        )}
      </div>

      {/* Erreurs sans champ d'ancrage (`loc: []`) et validation locale : sans cet
          emplacement global, ces messages n'auraient nulle part où s'afficher. */}
      {(errors.global.length > 0 || clientIssues.length > 0) && (
        <Notice level="error" title={t("modules.logs.errorsTitle")}>
          <ul className="list-disc space-y-0.5 pl-4">
            {clientIssues.map((issue) => (
              <li key={`${issue.key}${JSON.stringify(issue.params ?? {})}`}>
                {t(issue.key, issue.params)}
              </li>
            ))}
            {errors.global.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Notice>
      )}

      {/* Diagnostic de la config en base. `checked: false` ne produit rien. */}
      {notices.map((notice) => (
        <DiagnosticNotice
          key={`${notice.key}:${notice.channelId}`}
          notice={notice}
          channel={channelById.get(notice.channelId)}
        />
      ))}

      {/* Webhooks laissés derrière par un salon délié. */}
      {orphanWebhooks.length > 0 && (
        <Notice
          level="info"
          title={t("modules.logs.orphanWebhookTitle")}
          onDismiss={() => setOrphanWebhooks([])}
        >
          {t("modules.logs.orphanWebhookDescription", {
            channels: orphanWebhooks
              .map((id) => `#${channelById.get(id)?.name ?? id}`)
              .join(", "),
          })}
        </Notice>
      )}

      {/* Catégories */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("modules.logs.categoriesTitle")}</CardTitle>
          <CardDescription>
            {t("modules.logs.categoriesDescription", {
              categories: catalog.category_count,
              events: catalog.event_count,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <InfoIcon className="size-3.5 mt-0.5 shrink-0" />
            {t("modules.logs.duplicateChannelHint")}
          </p>

          {Object.keys(catalog.categories).map((categoryId) => (
            <CategoryCard
              key={categoryId}
              categoryId={categoryId}
              catalog={catalog}
              category={categoryOf(draft, categoryId)}
              channels={destinations}
              errorMessages={[
                ...(errors.byPath.get(`categories.${categoryId}.channel_ids`) ?? []),
                ...(errors.byPath.get(`categories.${categoryId}.disabled_events`) ?? []),
              ]}
              hasError={errors.categories.has(categoryId)}
              flaggedChannels={errors.channels}
              diagnostics={notices}
              onChange={(changes) => patchCategory(categoryId, changes)}
            />
          ))}

          {catalog.required_channel_permissions.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t("modules.logs.requiredPermissions", {
                permissions: catalog.required_channel_permissions
                  .map((p) => t(`modules.logs.permissions.${p}`, { defaultValue: p }))
                  .join(", "),
              })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Filtres */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("modules.logs.filtersTitle")}</CardTitle>
          <CardDescription>{t("modules.logs.filtersDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <IdPicker
            label={t("modules.logs.ignoredChannels")}
            hint={t("modules.logs.ignoredChannelsHint")}
            emptyLabel={t("modules.noChannels")}
            addLabel={t("modules.logs.addChannel")}
            max={catalog.limits.ignored_channels}
            limitLabel={t("modules.logs.limitReached", { max: catalog.limits.ignored_channels })}
            values={draft.ignored_channel_ids}
            error={errors.byPath.get("ignored_channel_ids")?.join(" ")}
            /* Ici tous les types de salons sont acceptés : c'est une liste
               d'exclusion, pas une destination. */
            options={channels.map((c) => ({ id: c.id, label: `# ${c.name}` }))}
            onChange={(ignored_channel_ids) => patch({ ignored_channel_ids })}
          />

          <IdPicker
            label={t("modules.logs.ignoredRoles")}
            hint={t("modules.logs.ignoredRolesHint")}
            emptyLabel={t("modules.altguard.noRoles")}
            addLabel={t("modules.logs.addRole")}
            max={catalog.limits.ignored_roles}
            limitLabel={t("modules.logs.limitReached", { max: catalog.limits.ignored_roles })}
            values={draft.ignored_role_ids}
            error={errors.byPath.get("ignored_role_ids")?.join(" ")}
            options={ignorableRoles.map((r) => ({
              id: r.id,
              label: r.name,
              color: roleColorToHex(r.color),
            }))}
            onChange={(ignored_role_ids) => patch({ ignored_role_ids })}
          />

          <ToggleRow
            label={t("modules.logs.ignoreBots")}
            hint={t("modules.logs.ignoreBotsHint")}
            checked={draft.ignore_bots}
            onChange={(ignore_bots) => patch({ ignore_bots })}
          />
        </CardContent>
      </Card>

      {/* Rendu des logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("modules.logs.outputTitle")}</CardTitle>
          <CardDescription>{t("modules.logs.outputDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <ToggleRow
            label={t("modules.logs.attachTranscripts")}
            hint={t("modules.logs.attachTranscriptsHint")}
            checked={draft.attach_transcripts}
            onChange={(attach_transcripts) => patch({ attach_transcripts })}
          />
          <ToggleRow
            label={t("modules.logs.mergeDuplicates")}
            hint={t("modules.logs.mergeDuplicatesHint")}
            checked={draft.merge_duplicates}
            onChange={(merge_duplicates) => patch({ merge_duplicates })}
          />

          {/* La langue des logs suit celle du serveur — un seul réglage, plus
              de sélecteur par module. */}
          <ServerLanguageNote guildId={selectedGuildId} />
        </CardContent>
      </Card>

      {/* Arrêt du module — il n'y a pas d'interrupteur : soit on retire les
          salons (les décochages restent), soit on efface tout. */}
      <div className="flex flex-wrap items-center gap-3">
        {draftLinked.length > 0 && (
          <Button type="button" variant="outline" onClick={handleUnlinkAll}>
            {t("modules.logs.unlinkAll")}
          </Button>
        )}
        {isConfigured && (
          <Button
            type="button"
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirmReset(true)}
            disabled={isSaving || isResetting}
          >
            {isResetting ? (
              <LoaderIcon className="size-4 mr-2 animate-spin" />
            ) : (
              <Trash2Icon className="size-4 mr-2" />
            )}
            {t("modules.logs.reset")}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground -mt-3">{t("modules.logs.unlinkAllHint")}</p>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("modules.logs.confirmResetTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("modules.logs.confirmResetDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("modules.altguard.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("modules.logs.reset")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UnsavedBar
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </div>
  )
}

// ─── Catégorie ────────────────────────────────────────────────────────────────

interface CategoryCardProps {
  categoryId: string
  catalog: LogsCatalog
  category: LogCategoryConfig
  channels: Channel[]
  errorMessages: string[]
  hasError: boolean
  flaggedChannels: Set<string>
  diagnostics: LogsDiagnosticNotice[]
  onChange: (changes: Partial<LogCategoryConfig>) => void
}

/**
 * Une catégorie = une destination. Les cases sont **cochées par défaut** :
 * `disabled_events` ne contient que les décochées, si bien qu'un événement
 * ajouté plus tard au registre du bot démarre allumé.
 */
function CategoryCard({
  categoryId,
  catalog,
  category,
  channels,
  errorMessages,
  hasError,
  flaggedChannels,
  diagnostics,
  onChange,
}: CategoryCardProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const description = categoryDescription(categoryId)
  const events = catalog.categories[categoryId].events
  const unimplemented = new Set(catalog.categories[categoryId].unimplemented)
  const disabled = new Set(category.disabled_events)
  const activeCount = events.filter((e) => !disabled.has(e)).length
  const limit = catalog.limits.channels_per_category

  const problem =
    hasError ||
    category.channel_ids.some(
      (id) =>
        flaggedChannels.has(id) ||
        diagnostics.some((n) => n.level === "error" && n.channelId === id)
    )

  const toggleEvent = (event: string) => {
    const next = disabled.has(event)
      ? category.disabled_events.filter((e) => e !== event)
      : [...category.disabled_events, event]
    onChange({ disabled_events: next })
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "rounded-lg border",
          problem && "border-destructive/50",
          category.channel_ids.length > 0 && !problem && "border-primary/30"
        )}
      >
        <CollapsibleTrigger className="flex w-full items-center gap-3 p-3.5 text-left">
          <ChevronRightIcon
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90"
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{categoryLabel(categoryId)}</p>
            {/* Ce que la catégorie couvre, dans les mots du bot. Les salons
                choisis se lisent juste à droite, et en détail une fois ouvert.
                Rien à afficher si la description manque — pas de texte de
                remplissage. */}
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {category.channel_ids.length > 0
              ? t("modules.logs.channelCount", { count: category.channel_ids.length })
              : t("modules.logs.noChannel")}
            {" · "}
            {t("modules.logs.eventCount", { active: activeCount, total: events.length })}
          </span>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="flex flex-col gap-4 border-t p-3.5">
            <IdPicker
              label={t("modules.logs.categoryChannels")}
              hint={t("modules.logs.categoryChannelsHint")}
              emptyLabel={t("modules.noChannels")}
              addLabel={t("modules.logs.addChannel")}
              max={limit}
              limitLabel={t("modules.logs.channelLimitReached", { max: limit })}
              values={category.channel_ids}
              error={errorMessages.join(" ") || undefined}
              options={channels.map((c) => ({
                id: c.id,
                label: `${isThreadChannel(c) ? "🧵" : "#"} ${c.name}`,
              }))}
              onChange={(channel_ids) => onChange({ channel_ids })}
            />

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-medium">{t("modules.logs.eventsLabel")}</label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => onChange({ disabled_events: [] })}
                  >
                    {t("modules.logs.checkAll")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => onChange({ disabled_events: [...events] })}
                  >
                    {t("modules.logs.uncheckAll")}
                  </Button>
                </div>
              </div>

              <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                {events.map((event) => (
                  <EventRow
                    key={event}
                    categoryId={categoryId}
                    event={event}
                    catalog={catalog}
                    checked={!disabled.has(event)}
                    unimplemented={unimplemented.has(event)}
                    onToggle={() => toggleEvent(event)}
                  />
                ))}
              </div>

              <p className="text-xs text-muted-foreground">{t("modules.logs.eventsHint")}</p>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

/**
 * Un événement non implémenté est **grisé, jamais masqué** : il est
 * configurable et s'allumera tout seul le jour où une source l'émettra.
 * `moderation.case_update` est un cas mixte (il marche pour `restrict` et
 * `revoke_access`) — d'où « partiel » plutôt que « bientôt ».
 */
function EventRow({
  categoryId,
  event,
  catalog,
  checked,
  unimplemented,
  onToggle,
}: {
  categoryId: string
  event: string
  catalog: LogsCatalog
  checked: boolean
  unimplemented: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const label = eventLabel(catalog, categoryId, event)
  const title = eventTitle(catalog, categoryId, event)
  const isPartial = categoryId === "moderation" && event === "case_update"
  const inputId = `logs-${categoryId}-${event}`

  const name = (
    <label
      htmlFor={inputId}
      className={cn("cursor-pointer text-sm truncate", unimplemented && "text-muted-foreground")}
    >
      {label}
    </label>
  )

  return (
    <div className="flex items-center gap-2">
      <Checkbox id={inputId} checked={checked} onCheckedChange={onToggle} />
      {/* La phrase du log (`locale_keys.title`) sert d'aperçu quand elle est
          traduite. Elle est portée par le seul libellé : imbriquer deux
          déclencheurs d'infobulle dans la même ligne les ferait se marcher dessus. */}
      {title ? (
        <Tooltip>
          <TooltipTrigger asChild>{name}</TooltipTrigger>
          <TooltipContent>{title}</TooltipContent>
        </Tooltip>
      ) : (
        name
      )}
      {unimplemented && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
              {isPartial ? t("modules.logs.partial") : t("modules.logs.soon")}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {isPartial ? t("modules.logs.partialHint") : t("modules.logs.soonHint")}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

// ─── Champs partagés ──────────────────────────────────────────────────────────

interface IdOption {
  id: string
  label: string
  color?: string
}

/**
 * Liste d'identifiants bornée (salons d'une catégorie, ignorés) : chips
 * supprimables + sélecteur d'ajout. Les ids restent des **chaînes** de bout en
 * bout ; une valeur absente de la liste live (salon supprimé) reste visible
 * plutôt que de disparaître silencieusement.
 */
function IdPicker({
  label,
  hint,
  emptyLabel,
  addLabel,
  max,
  limitLabel,
  values,
  options,
  error,
  onChange,
}: {
  label: string
  hint: string
  emptyLabel: string
  addLabel: string
  max: number
  limitLabel: string
  values: string[]
  options: IdOption[]
  error?: string
  onChange: (values: string[]) => void
}) {
  const byId = new Map(options.map((o) => [o.id, o] as const))
  const available = options.filter((o) => !values.includes(o.id))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-xs text-muted-foreground tabular-nums">
          {values.length} / {max}
        </span>
      </div>

      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((id) => {
            const option = byId.get(id)
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium"
                style={option?.color ? { borderColor: option.color, color: option.color } : undefined}
              >
                {option?.label ?? id}
                <button
                  type="button"
                  onClick={() => onChange(values.filter((v) => v !== id))}
                  className="ml-0.5 rounded-full text-muted-foreground transition-colors hover:text-foreground"
                >
                  <XIcon className="size-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}

      {values.length >= max ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">{limitLabel}</p>
      ) : available.length > 0 ? (
        <Select value="" onValueChange={(id) => onChange([...values, id])}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder={addLabel} />
          </SelectTrigger>
          <SelectContent>
            {available.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                <div className="flex items-center gap-2">
                  {option.color && (
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: option.color }}
                    />
                  )}
                  <span className="truncate">{option.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        values.length === 0 && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertCircleIcon className="size-3.5" />
            {emptyLabel}
          </p>
        )
      )}

      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5 shrink-0" />
    </div>
  )
}

// ─── Encarts ──────────────────────────────────────────────────────────────────

type NoticeLevel = "info" | "warning" | "error"

const NOTICE_STYLES: Record<NoticeLevel, { box: string; icon: string; Icon: typeof InfoIcon }> = {
  info: {
    box: "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40",
    icon: "text-sky-600 dark:text-sky-400",
    Icon: InfoIcon,
  },
  warning: {
    box: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
    icon: "text-amber-600 dark:text-amber-400",
    Icon: TriangleAlertIcon,
  },
  error: {
    box: "border-destructive/30 bg-destructive/5",
    icon: "text-destructive",
    Icon: AlertCircleIcon,
  },
}

function Notice({
  level,
  title,
  children,
  onDismiss,
}: {
  level: NoticeLevel
  title: string
  children?: React.ReactNode
  onDismiss?: () => void
}) {
  const { Icon, box, icon } = NOTICE_STYLES[level]
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border p-4", box)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", icon)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {children && (
          <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{children}</div>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/10"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  )
}

/**
 * Problème remonté par `/diagnostics`. Un `manage_webhooks` manquant reste un
 * avertissement : la config est parfaitement valide, les logs partiront — plus
 * lentement pendant les pics.
 */
function DiagnosticNotice({
  notice,
  channel,
}: {
  notice: LogsDiagnosticNotice
  channel: Channel | undefined
}) {
  const { t } = useTranslation()
  const name = channel ? `#${channel.name}` : notice.channelId
  return (
    <Notice
      level={notice.level}
      title={t(`${notice.key}Title`, { channel: name })}
    >
      <p>{t(notice.key, { ...notice.params, channel: name })}</p>
      {notice.categories.length > 0 && (
        <p className="mt-1">
          {t("modules.logs.diagnostics.affectedCategories", {
            categories: notice.categories.map((id) => categoryLabel(id)).join(", "),
          })}
        </p>
      )}
    </Notice>
  )
}
