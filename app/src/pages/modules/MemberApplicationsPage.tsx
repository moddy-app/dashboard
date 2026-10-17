import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { AddIcon, AlertCircleIcon, ClockIcon, CloseIcon, TriangleAlertIcon } from "@/components/icons"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
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
import { ModulePage } from "@/components/module/module-page"
import { ModuleStateControl } from "@/components/module/module-state-control"
import { ChannelPicker, RoleMultiPicker } from "@/components/pickers"
import { UnsavedBar } from "@/components/unsaved-bar"
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
  getMemberApplicationsConfig,
  getMemberApplicationsDiagnostics,
  saveMemberApplicationsConfig,
} from "@/services/member-applications"
import type {
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

export function MemberApplicationsPage() {
  const { isLoadingGuild, isGuildReady, guildError, refreshGuildData } = useGuildContext()
  if (guildError || isLoadingGuild || !isGuildReady) {
    return <ModulePage moduleId={MODULE_ID} loading={!guildError} error={guildError} onRetry={refreshGuildData}>{null}</ModulePage>
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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  /** Index des motifs fautifs, pour surligner la bonne ligne. */
  const [badReasons, setBadReasons] = useState<Set<number>>(new Set())
  /** Refus Discord (permission, salon, rôle) : texte lisible du backend. */
  const [serverError, setServerError] = useState<string | null>(null)
  const [diagnostics, setDiagnostics] = useState<MemberApplicationsDiagnostics | null>(null)

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
    return () => {
      cancelled = true
    }
  }, [guildId, loadDiagnostics])

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

    logger.event("module:member_applications", "Save", { hasChannel: draft.channel_id !== null })
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

  /** Réinitialisation (menu de l'en-tête) : DELETE, puis formulaire vierge. */
  const handleReset = useCallback(async () => {
    logger.event("module:member_applications", "Delete")
    await deleteMemberApplicationsConfig(guildId)
    const fresh = emptyMemberApplicationsConfig()
    setSaved(fresh)
    setDraft(fresh)
    setIsConfigured(false)
    setFieldErrors({})
    setServerError(null)
    syncModule(MODULE_ID, null)
    void loadDiagnostics()
  }, [guildId, syncModule, loadDiagnostics])

  // ── Rendu ─────────────────────────────────────────────────────────────────

  const notices = memberApplicationsNotices(diagnostics)

  return (
    <ModulePage
      moduleId={MODULE_ID}
      loading={isLoading || !draft || !saved}
      error={loadError}
      onRetry={() => window.location.reload()}
      actions={<ModuleStateControl moduleId={MODULE_ID} onReset={handleReset} />}
    >
      {draft && saved && (
        <>
          {notices.map((notice) => (
            <Alert key={notice.key} variant={notice.level === "error" ? "destructive" : "default"}>
              {notice.level === "error" ? <AlertCircleIcon /> : <TriangleAlertIcon />}
              <AlertTitle>{t(`${E}.diagnostics.${notice.key}Title`)}</AlertTitle>
              <AlertDescription>{t(`${E}.diagnostics.${notice.key}`, notice.params)}</AlertDescription>
            </Alert>
          ))}

          {serverError && (
            <Alert variant="destructive">
              <AlertCircleIcon />
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
                <Field data-invalid={fieldErrors.channel_id ? true : undefined}>
                  <FieldLabel htmlFor="ma-channel">{t(`${E}.channel`)}</FieldLabel>
                  <ChannelPicker
                    id="ma-channel"
                    value={draft.channel_id}
                    channels={textChannels}
                    onChange={(channel_id) => patch({ channel_id })}
                    placeholder={t("modules.selectChannel")}
                    allowNone
                    noneLabel={t(`${E}.noChannel`)}
                    aria-invalid={Boolean(fieldErrors.channel_id) || undefined}
                  />
                  <FieldDescription>{t(`${E}.channelDescription`)}</FieldDescription>
                  <FieldError>{fieldErrors.channel_id}</FieldError>
                </Field>

                <Field data-invalid={fieldErrors.ping_role_ids ? true : undefined}>
                  <FieldLabel htmlFor="ma-ping-roles">{t(`${E}.pingRoles`)}</FieldLabel>
                  <RoleMultiPicker
                    id="ma-ping-roles"
                    value={draft.ping_role_ids}
                    roles={roleOptions}
                    max={limits.ping_roles}
                    onChange={(ping_role_ids) => patch({ ping_role_ids })}
                    placeholder={t(`${E}.addRole`)}
                    aria-invalid={Boolean(fieldErrors.ping_role_ids) || undefined}
                  />
                  <FieldDescription>{t(`${E}.pingRolesDescription`)}</FieldDescription>
                  <FieldError>{fieldErrors.ping_role_ids}</FieldError>
                </Field>

                <Field data-invalid={fieldErrors.reviewer_role_ids ? true : undefined}>
                  <FieldLabel htmlFor="ma-reviewer-roles">{t(`${E}.reviewerRoles`)}</FieldLabel>
                  <RoleMultiPicker
                    id="ma-reviewer-roles"
                    value={draft.reviewer_role_ids}
                    roles={roleOptions}
                    max={limits.reviewer_roles}
                    onChange={(reviewer_role_ids) => patch({ reviewer_role_ids })}
                    placeholder={t(`${E}.addRole`)}
                    aria-invalid={Boolean(fieldErrors.reviewer_role_ids) || undefined}
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
          </Card>

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ClockIcon className="size-3.5 shrink-0" />
            {t(`${E}.applyDelayHint`)}
          </p>

          <UnsavedBar isDirty={isDirty} isSaving={isSaving} onSave={handleSave} onDiscard={handleDiscard} />
        </>
      )}
    </ModulePage>
  )
}

/**
 * Motifs de refus proposés sur la carte d'examen. Le candidat voit le motif
 * choisi : la description du champ le dit.
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
      <FieldLegend variant="label">{t(`${E}.rejectionReasons`)}</FieldLegend>
      <FieldDescription>
        {t(`${E}.rejectionReasonsDescription`)}
        {reasons.length >= max - 1 && ` ${reasons.length}/${max}`}
      </FieldDescription>
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
                  <CloseIcon />
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
        <AddIcon data-icon="inline-start" />
        {t(`${E}.addReason`)}
      </Button>
    </FieldSet>
  )
}
