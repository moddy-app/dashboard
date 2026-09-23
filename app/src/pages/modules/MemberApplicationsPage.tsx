import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Alert02Icon,
  AlertCircleIcon,
  Cancel01Icon,
  Clock01Icon,
  Delete02Icon,
  InformationCircleIcon,
  UserAdd01Icon,
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
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ErrorPage } from "@/components/error-state"
import { ChannelPicker, RoleMultiPicker } from "@/components/module-pickers"
import { UnsavedBar } from "@/components/unsaved-bar"
import { ApplicationList } from "@/components/member-applications/application-list"
import { ApplicationStatsPanel } from "@/components/member-applications/application-stats"
import { useGuildContext } from "@/contexts/GuildContext"
import { useSanctionGates } from "@/contexts/SanctionContext"
import { ApiError } from "@/lib/auth"
import { handleSaveError } from "@/lib/handle-error"
import { logger } from "@/lib/logger"
import {
  emptyMemberApplicationsConfig,
  FALLBACK_MEMBER_APPLICATIONS_LIMITS,
  isSameMemberApplicationsConfig,
  memberApplicationsChannels,
  memberApplicationsNotices,
  memberApplicationsRoles,
  validateMemberApplications,
} from "@/lib/member-applications"
import type { MemberApplicationsField, MemberApplicationsIssue } from "@/lib/member-applications"
import { sanctionBlockedError } from "@/lib/sanctions"
import {
  deleteMemberApplicationsConfig,
  getApplicationStats,
  getMemberApplicationsConfig,
  getMemberApplicationsDiagnostics,
  saveMemberApplicationsConfig,
} from "@/services/member-applications"
import type {
  ApplicationStats,
  MemberApplicationsConfig,
  MemberApplicationsDiagnostics,
} from "@/types/member-applications"

const MODULE_ID = "member_applications"
const E = "modules.member_applications"

/** Erreurs rattachées aux champs : issues locales + 422 Pydantic (`loc`). */
type FieldErrors = Partial<Record<MemberApplicationsField, string>>
const FIELDS: MemberApplicationsField[] = [
  "channel_id",
  "ping_role_ids",
  "reviewer_role_ids",
  "rejection_reasons",
]

/**
 * Garde de chargement : le formulaire attend les salons et les rôles du
 * serveur, sinon une arrivée directe sur l'URL monte des sélecteurs vides.
 */
export function MemberApplicationsPage() {
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
  return <MemberApplicationsView />
}

function MemberApplicationsView() {
  const { t } = useTranslation()
  const { selectedGuildId, channels, roles, syncModule } = useGuildContext()
  const guildId = selectedGuildId as string
  const gates = useSanctionGates(guildId)

  const [saved, setSaved] = useState<MemberApplicationsConfig | null>(null)
  const [draft, setDraft] = useState<MemberApplicationsConfig | null>(null)
  /** `false` tant que le serveur n'a jamais configuré le module (GET → 404). */
  const [isConfigured, setIsConfigured] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  /** Index des motifs fautifs, pour surligner la bonne ligne. */
  const [badReasons, setBadReasons] = useState<Set<number>>(new Set())
  /** Refus Discord (permission, salon, rôle) : texte lisible du backend. */
  const [serverError, setServerError] = useState<string | null>(null)
  const [diagnostics, setDiagnostics] = useState<MemberApplicationsDiagnostics | null>(null)
  const [stats, setStats] = useState<ApplicationStats | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)

  const textChannels = useMemo(() => memberApplicationsChannels(channels), [channels])
  const roleOptions = useMemo(() => memberApplicationsRoles(roles, guildId), [roles, guildId])
  const limits = diagnostics?.limits ?? FALLBACK_MEMBER_APPLICATIONS_LIMITS

  // ── Chargement ────────────────────────────────────────────────────────────

  const loadDiagnostics = useCallback(async () => {
    try {
      setDiagnostics(await getMemberApplicationsDiagnostics(guildId))
    } catch (e) {
      // Complément, pas une condition : son échec ne casse pas la page.
      logger.warn("module:member_applications", "Diagnostics failed", e)
    }
  }, [guildId])

  const loadStats = useCallback(async () => {
    try {
      setStats(await getApplicationStats(guildId))
      setStatsError(null)
    } catch (e) {
      logger.warn("module:member_applications", "Stats failed", e)
      setStatsError(e instanceof Error ? e.message : "Failed to load stats")
    }
  }, [guildId])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const config = await getMemberApplicationsConfig(guildId)
        if (cancelled) return
        const initial = config ?? emptyMemberApplicationsConfig()
        setIsConfigured(config !== null)
        setSaved(initial)
        setDraft(initial)
      } catch (e) {
        if (cancelled) return
        logger.error("module:member_applications", "Load failed", e)
        setLoadError(e instanceof Error ? e.message : "Failed to load module config")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    void loadDiagnostics()
    void loadStats()
    return () => {
      cancelled = true
    }
  }, [guildId, loadDiagnostics, loadStats])

  // ── Brouillon ─────────────────────────────────────────────────────────────

  const patch = useCallback((changes: Partial<MemberApplicationsConfig>) => {
    setDraft((prev) => (prev ? { ...prev, ...changes } : prev))
    setFieldErrors((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(changes) as MemberApplicationsField[]) delete next[key]
      return next
    })
    if ("rejection_reasons" in changes) setBadReasons(new Set())
    setServerError(null)
  }, [])

  const isDirty = Boolean(saved && draft && !isSameMemberApplicationsConfig(saved, draft))

  const applyIssues = useCallback(
    (issues: MemberApplicationsIssue[]) => {
      const mapped: FieldErrors = {}
      const bad = new Set<number>()
      for (const issue of issues) {
        mapped[issue.field] ??= t(`${E}.errors.${issue.key}`, issue.params)
        if (issue.index !== undefined) bad.add(issue.index)
      }
      setFieldErrors(mapped)
      setBadReasons(bad)
    },
    [t]
  )

  // ── Sauvegarde ────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!draft) return

    if (!isConfigured && !gates.canEnableNewModule) {
      handleSaveError(sanctionBlockedError("new_module_blocked", gates.effective), {
        title: t("modules.saveError"),
      })
      return
    }

    const issues = validateMemberApplications(draft, limits, guildId)
    if (issues.length > 0) {
      applyIssues(issues)
      toast.error(t("modules.saveError"), { description: t(`${E}.errors.fixFields`) })
      return
    }

    logger.event("module:member_applications", "Save", { enabled: draft.enabled })
    setIsSaving(true)
    setFieldErrors({})
    setServerError(null)
    try {
      const config = await saveMemberApplicationsConfig(guildId, draft)
      setSaved(config)
      setDraft(config)
      setIsConfigured(true)
      syncModule(MODULE_ID, { ...config })
      // Aucun accusé : le bot relit la config en ~2 min, on le dit.
      toast.success(t(`${E}.saved`), { description: t(`${E}.savedDelay`) })
      void loadDiagnostics()
    } catch (e) {
      logger.error("module:member_applications", "Save failed", e)
      if (e instanceof ApiError && e.status === 422) {
        const pydantic = e.validationIssues
        if (pydantic.length > 0) {
          const mapped: FieldErrors = {}
          for (const issue of pydantic) {
            const field = issue.loc?.find((p): p is MemberApplicationsField =>
              FIELDS.includes(p as MemberApplicationsField)
            )
            if (field) mapped[field] ??= issue.msg
          }
          setFieldErrors(mapped)
          if (Object.keys(mapped).length > 0) {
            toast.error(t("modules.saveError"), { description: t(`${E}.errors.fixFields`) })
            return
          }
        } else {
          // Vérification Discord : le texte est lisible, affiché tel quel.
          setServerError(e.message)
          toast.error(t("modules.saveError"), { description: e.message })
          return
        }
      }
      handleSaveError(e, { title: t("modules.saveError") })
    } finally {
      setIsSaving(false)
    }
  }, [draft, isConfigured, gates, limits, guildId, applyIssues, syncModule, loadDiagnostics, t])

  const handleDiscard = useCallback(() => {
    if (!saved) return
    setDraft(saved)
    setFieldErrors({})
    setBadReasons(new Set())
    setServerError(null)
  }, [saved])

  const handleDelete = useCallback(async () => {
    logger.event("module:member_applications", "Delete")
    setIsDeleting(true)
    try {
      await deleteMemberApplicationsConfig(guildId)
      const fresh = emptyMemberApplicationsConfig()
      setSaved(fresh)
      setDraft(fresh)
      setIsConfigured(false)
      setFieldErrors({})
      setServerError(null)
      syncModule(MODULE_ID, null)
      toast.success(t(`${E}.deleted`))
      void loadDiagnostics()
    } catch (e) {
      logger.error("module:member_applications", "Delete failed", e)
      handleSaveError(e, { title: t("modules.saveError") })
    } finally {
      setIsDeleting(false)
      setConfirmDelete(false)
    }
  }, [guildId, syncModule, loadDiagnostics, t])

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (loadError) return <ErrorPage error={loadError} onRetry={() => window.location.reload()} />
  if (isLoading || !draft || !saved) {
    return (
      <div className="flex w-full flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  // L'état affiché est celui **en base** : un brouillon non enregistré ne
  // fait rien tourner.
  const isActive = saved.enabled && saved.channel_id !== null
  const notices = memberApplicationsNotices(diagnostics)

  return (
    <div className="flex w-full flex-col gap-6 pb-24">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted">
            <HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} className="size-5" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-xl leading-none font-semibold">{t(`${E}.name`)}</h1>
            <p className="text-sm text-muted-foreground">{t(`${E}.description`)}</p>
          </div>
        </div>
        <Badge variant={isActive ? "default" : "secondary"}>
          {t(isActive ? `${E}.statusActive` : `${E}.statusInactive`)}
        </Badge>
      </div>

      {/* Diagnostic — les permissions peuvent disparaître après la sauvegarde. */}
      {notices.map((notice) => (
        <Alert key={notice.key} variant={notice.level === "error" ? "destructive" : "default"}>
          <HugeiconsIcon icon={notice.level === "error" ? AlertCircleIcon : Alert02Icon} strokeWidth={2} />
          <AlertTitle>{t(`${E}.diagnostics.${notice.key}Title`)}</AlertTitle>
          <AlertDescription>{t(`${E}.diagnostics.${notice.key}`, notice.params)}</AlertDescription>
        </Alert>
      ))}

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">{t(`${E}.tabs.config`)}</TabsTrigger>
          <TabsTrigger value="applications">
            {t(`${E}.tabs.applications`)}
            {stats && stats.pending > 0 && <Badge variant="secondary">{stats.pending}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="stats">{t(`${E}.tabs.stats`)}</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="flex flex-col gap-4 pt-4">
          {serverError && (
            <Alert variant="destructive">
              <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} />
              <AlertTitle>{t(`${E}.errors.discordCheckTitle`)}</AlertTitle>
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{t(`${E}.configTitle`)}</CardTitle>
              <CardDescription>{t(`${E}.configDescription`)}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor="ma-enabled">{t(`${E}.enabled`)}</FieldLabel>
                    <FieldDescription>{t(`${E}.enabledDescription`)}</FieldDescription>
                  </FieldContent>
                  <Switch
                    id="ma-enabled"
                    checked={draft.enabled}
                    onCheckedChange={(enabled) => patch({ enabled })}
                  />
                </Field>

                <Field data-invalid={fieldErrors.channel_id ? true : undefined}>
                  <FieldLabel htmlFor="ma-channel">{t(`${E}.channel`)}</FieldLabel>
                  <ChannelPicker
                    id="ma-channel"
                    value={draft.channel_id}
                    channels={textChannels}
                    onChange={(channel_id) => patch({ channel_id })}
                    placeholder={t("modules.selectChannel")}
                    clearLabel={t(`${E}.noChannel`)}
                    invalid={Boolean(fieldErrors.channel_id)}
                  />
                  <FieldDescription>{t(`${E}.channelDescription`)}</FieldDescription>
                  <FieldError>{fieldErrors.channel_id}</FieldError>
                </Field>

                <Field data-invalid={fieldErrors.ping_role_ids ? true : undefined}>
                  <FieldLabel htmlFor="ma-ping-roles">
                    {t(`${E}.pingRoles`)}
                    <span className="ml-auto text-xs font-normal text-muted-foreground tabular-nums">
                      {draft.ping_role_ids.length}/{limits.ping_roles}
                    </span>
                  </FieldLabel>
                  <RoleMultiPicker
                    id="ma-ping-roles"
                    value={draft.ping_role_ids}
                    roles={roleOptions}
                    max={limits.ping_roles}
                    onChange={(ping_role_ids) => patch({ ping_role_ids })}
                    placeholder={t(`${E}.addRole`)}
                    invalid={Boolean(fieldErrors.ping_role_ids)}
                  />
                  <FieldDescription>{t(`${E}.pingRolesDescription`)}</FieldDescription>
                  <FieldError>{fieldErrors.ping_role_ids}</FieldError>
                </Field>

                <Field data-invalid={fieldErrors.reviewer_role_ids ? true : undefined}>
                  <FieldLabel htmlFor="ma-reviewer-roles">
                    {t(`${E}.reviewerRoles`)}
                    <span className="ml-auto text-xs font-normal text-muted-foreground tabular-nums">
                      {draft.reviewer_role_ids.length}/{limits.reviewer_roles}
                    </span>
                  </FieldLabel>
                  <RoleMultiPicker
                    id="ma-reviewer-roles"
                    value={draft.reviewer_role_ids}
                    roles={roleOptions}
                    max={limits.reviewer_roles}
                    onChange={(reviewer_role_ids) => patch({ reviewer_role_ids })}
                    placeholder={t(`${E}.addRole`)}
                    invalid={Boolean(fieldErrors.reviewer_role_ids)}
                  />
                  <FieldDescription>{t(`${E}.reviewerRolesDescription`)}</FieldDescription>
                  <FieldError>{fieldErrors.reviewer_role_ids}</FieldError>
                </Field>

                <RejectionReasonsField
                  reasons={draft.rejection_reasons}
                  max={limits.rejection_reasons}
                  maxLength={limits.rejection_reason_length}
                  error={fieldErrors.rejection_reasons}
                  badIndexes={badReasons}
                  onChange={(rejection_reasons) => patch({ rejection_reasons })}
                />
              </FieldGroup>
            </CardContent>
            <CardFooter className="flex-wrap justify-between gap-3">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-3.5 shrink-0" />
                {t(`${E}.applyDelayHint`)}
              </p>
              {isConfigured && (
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
                  {t(`${E}.delete`)}
                </Button>
              )}
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="applications" className="pt-4">
          <Alert className="mb-4">
            <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
            <AlertDescription>{t(`${E}.readOnlyHint`)}</AlertDescription>
          </Alert>
          <ApplicationList guildId={guildId} onChanged={loadStats} />
        </TabsContent>

        <TabsContent value="stats" className="pt-4">
          <ApplicationStatsPanel stats={stats} error={statsError} onRetry={() => void loadStats()} />
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(`${E}.confirmDeleteTitle`)}</AlertDialogTitle>
            <AlertDialogDescription>{t(`${E}.confirmDeleteDescription`)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void handleDelete()}>
              {t(`${E}.delete`)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UnsavedBar isDirty={isDirty} isSaving={isSaving} onSave={handleSave} onDiscard={handleDiscard} />
    </div>
  )
}

/**
 * Motifs de refus proposés sur la carte d'examen. Le candidat **voit** le
 * motif choisi : l'avertissement est permanent, pas une note de bas de page.
 */
function RejectionReasonsField({
  reasons,
  max,
  maxLength,
  error,
  badIndexes,
  onChange,
}: {
  reasons: string[]
  max: number
  maxLength: number
  error?: string
  badIndexes: Set<number>
  onChange: (reasons: string[]) => void
}) {
  const { t } = useTranslation()
  const isFull = reasons.length >= max

  return (
    <FieldSet data-invalid={error ? true : undefined}>
      <FieldLegend variant="label">
        {t(`${E}.rejectionReasons`)}{" "}
        <span className="text-xs font-normal text-muted-foreground tabular-nums">
          {reasons.length}/{max}
        </span>
      </FieldLegend>
      <FieldDescription>{t(`${E}.rejectionReasonsDescription`)}</FieldDescription>
      <Alert>
        <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
        <AlertDescription>{t(`${E}.rejectionReasonsVisible`)}</AlertDescription>
      </Alert>
      <FieldGroup className="gap-2">
        {reasons.map((reason, index) => (
          <Field key={index} data-invalid={badIndexes.has(index) ? true : undefined}>
            <FieldLabel htmlFor={`ma-reason-${index}`} className="sr-only">
              {t(`${E}.rejectionReasonLabel`, { index: index + 1 })}
            </FieldLabel>
            <InputGroup>
              <InputGroupInput
                id={`ma-reason-${index}`}
                value={reason}
                maxLength={maxLength}
                aria-invalid={badIndexes.has(index) || undefined}
                placeholder={t(`${E}.rejectionReasonPlaceholder`)}
                onChange={(e) => onChange(reasons.map((r, i) => (i === index ? e.target.value : r)))}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText className="tabular-nums">
                  {reason.trim().length}/{maxLength}
                </InputGroupText>
                <InputGroupButton
                  size="icon-xs"
                  aria-label={t(`${E}.removeReason`)}
                  onClick={() => onChange(reasons.filter((_, i) => i !== index))}
                >
                  <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        ))}
      </FieldGroup>
      <FieldError>{error}</FieldError>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={isFull}
        onClick={() => onChange([...reasons, ""])}
      >
        <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
        {t(`${E}.addReason`)}
      </Button>
    </FieldSet>
  )
}
