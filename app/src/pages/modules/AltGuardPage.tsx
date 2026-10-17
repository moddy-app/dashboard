import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { AlertCircleIcon, CheckCircleIcon, ClockIcon, InfoIcon, TriangleAlertIcon, XIcon } from "@/components/icons"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { UnsavedBar } from "@/components/unsaved-bar"
import { ServerLanguageNote } from "@/components/server-language-note"
import i18n from "@/i18n"
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
import { ModulePage } from "@/components/module/module-page"
import { ModuleStateControl } from "@/components/module/module-state-control"
import { ChannelPicker, RolePicker } from "@/components/pickers"
import { useGuildContext } from "@/contexts/GuildContext"
import { useSanctionGates } from "@/contexts/SanctionContext"
import { sanctionBlockedError } from "@/lib/sanctions"
import {
  altGuardChannels,
  altGuardMissingFields,
  altGuardRoles,
  applyFeedback,
  botTopRolePosition,
  emptyAltGuardConfig,
  isRoleAboveBot,
  isSameAltGuardConfig,
} from "@/lib/altguard"
import type { ApplyFeedback, ApplyLevel } from "@/lib/altguard"
import {
  deleteAltGuardConfig,
  getAltGuardConfig,
  saveAltGuardConfig,
} from "@/services/altguard"
import type {
  AltGuardConfig,
  Role,
} from "@/types/api"

/** Sentinelle du sélecteur : Radix Select refuse une valeur vide. */

/** Champs sur lesquels une erreur 422 peut être rattachée. */
type FieldKey =
  | "channel_id"
  | "unverified_role_id"
  | "verified_role_id"
  | "log_channel_id"

const FIELD_KEYS: FieldKey[] = [
  "channel_id",
  "unverified_role_id",
  "verified_role_id",
  "log_channel_id",
]

type FieldErrors = Partial<Record<FieldKey, string>>

/**
 * Rattache une 422 à ses champs. Le backend renvoie soit un tableau Pydantic
 * (mappé via `loc`), soit une chaîne lisible dont le champ est nommé au début
 * (« channel_id invalide: … n'est pas un salon texte du serveur »).
 */
function mapValidationError(error: ApiError): FieldErrors {
  const mapped: FieldErrors = {}
  for (const issue of error.validationIssues) {
    const field = issue.loc?.find((p): p is FieldKey => FIELD_KEYS.includes(p as FieldKey))
    if (field) mapped[field] = issue.msg
  }
  if (Object.keys(mapped).length > 0) return mapped

  const named = FIELD_KEYS.find((f) => error.message.startsWith(f))
  if (named) mapped[named] = error.message
  return mapped
}

/**
 * Garde de chargement : le formulaire attend les salons et les rôles du serveur.
 * Sans ça, une arrivée directe sur l'URL monte des sélecteurs vides.
 */
export function AltGuardPage() {
  const { isLoadingGuild, isGuildReady, guildError, refreshGuildData } = useGuildContext()

  if (guildError || isLoadingGuild || !isGuildReady) {
    return (
      <ModulePage moduleId="altguard" loading={!guildError} error={guildError} onRetry={refreshGuildData}>
        {null}
      </ModulePage>
    )
  }

  return <AltGuardForm />
}

function AltGuardForm() {
  const { t } = useTranslation()
  const { selectedGuildId, channels, roles, syncModule } = useGuildContext()
  const gates = useSanctionGates(selectedGuildId)

  const [savedConfig, setSavedConfig] = useState<AltGuardConfig | null>(null)
  const [draft, setDraft] = useState<AltGuardConfig | null>(null)
  /** `false` tant que le serveur n'a jamais configuré le module (GET → 404). */
  const [isConfigured, setIsConfigured] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  /**
   * Dernier accusé du bot. Affiché de façon persistante : un toast se rate, et
   * une permission manquante ne doit pas disparaître au bout de 4 secondes.
   */
  const [feedback, setFeedback] = useState<ApplyFeedback | null>(null)

  const textChannels = useMemo(() => altGuardChannels(channels), [channels])
  const assignableRoles = useMemo(
    () => altGuardRoles(roles, selectedGuildId),
    [roles, selectedGuildId]
  )
  const botTop = useMemo(() => botTopRolePosition(roles), [roles])

  // ── Chargement ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedGuildId) return
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const config = await getAltGuardConfig(selectedGuildId)
        if (cancelled) return
        // 404 = jamais configuré → formulaire vierge, ce n'est pas une erreur.
        const initial = config ?? emptyAltGuardConfig()
        setIsConfigured(config !== null)
        setSavedConfig(initial)
        setDraft({ ...initial })
      } catch (e) {
        if (cancelled) return
        logger.error("module:altguard", "Load failed", e)
        setLoadError(e instanceof Error ? e.message : "Failed to load module config")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [selectedGuildId])

  // ── Mutations du brouillon ────────────────────────────────────────────────

  const patch = useCallback((changes: Partial<AltGuardConfig>) => {
    setDraft((prev) => (prev ? { ...prev, ...changes } : prev))
    setFieldErrors((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(changes) as FieldKey[]) delete next[key]
      return next
    })
  }, [])

  const isDirty = Boolean(savedConfig && draft && !isSameAltGuardConfig(savedConfig, draft))
  const missing = draft ? altGuardMissingFields(draft) : []

  // ── Sauvegarde ────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!selectedGuildId || !draft) return

    // Sous sanction, activer un module *jamais configuré* est refusé. On le dit
    // ici plutôt que d'attendre le 403 : le message est le même, mais la
    // sauvegarde (jusqu'à 25 s) n'est pas lancée pour rien.
    if (!isConfigured && !gates.canEnableNewModule) {
      handleSaveError(sanctionBlockedError("new_module_blocked", gates.effective), {
        title: t("modules.saveError"),
      })
      return
    }

    logger.event("module:altguard", "Save", { missing: missing.length })
    setIsSaving(true)
    setFieldErrors({})
    try {
      // Une config incomplète est acceptée : elle renvoie `enabled: false` et
      // le bot retire le panneau. On ne bloque donc pas l'enregistrement.
      const { config, apply } = await saveAltGuardConfig(selectedGuildId, draft)
      setSavedConfig(config)
      setDraft({ ...config })
      setIsConfigured(true)
      // La vue d'ensemble et la sidebar lisent `modules` du contexte : sans
      // cette synchro, elles resteraient sur l'état d'avant la sauvegarde.
      syncModule("altguard", { ...config })

      // Un 200 ne veut pas dire que Discord a suivi — l'accusé du bot décide.
      const result = applyFeedback(apply)
      setFeedback(result)
      notify(result)
      logger.success("module:altguard", "Saved", { level: result.level })
    } catch (e) {
      logger.error("module:altguard", "Save failed", e)
      if (e instanceof ApiError && e.status === 422) {
        const mapped = mapValidationError(e)
        setFieldErrors(mapped)
        // Message 422 non rattachable à un champ → toast générique.
        if (Object.keys(mapped).length > 0) {
          toast.error(t("modules.saveError"), { description: e.message })
          return
        }
      }
      handleSaveError(e, { title: t("modules.saveError") })
    } finally {
      setIsSaving(false)
    }
  }, [selectedGuildId, draft, isConfigured, gates, missing.length, syncModule, t])

  const handleDiscard = useCallback(() => {
    if (!savedConfig) return
    logger.event("module:altguard", "Discard")
    setDraft({ ...savedConfig })
    setFieldErrors({})
  }, [savedConfig])

  const handleDisable = useCallback(async () => {
    if (!selectedGuildId) return
    logger.event("module:altguard", "Disable")
    const apply = await deleteAltGuardConfig(selectedGuildId)
    const fresh = emptyAltGuardConfig()
    setSavedConfig(fresh)
    setDraft({ ...fresh })
    setIsConfigured(false)
    setFieldErrors({})
    syncModule("altguard", null)
    const result = applyFeedback(apply)
    setFeedback(result)
    notify(result)
    logger.success("module:altguard", "Disabled", { level: result.level })
  }, [selectedGuildId, syncModule])

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <ModulePage
      moduleId="altguard"
      loading={isLoading || !draft}
      error={loadError}
      onRetry={() => window.location.reload()}
      actions={<ModuleStateControl moduleId="altguard" onReset={handleDisable} />}
    >
      {draft && (
        <>
      {/* Dernier accusé du bot */}
      {feedback && <ApplyNotice feedback={feedback} onDismiss={() => setFeedback(null)} />}

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("modules.altguard.configTitle")}</CardTitle>
          <CardDescription>{t("modules.altguard.configDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Salon de vérification */}
          <Field
            label={t("modules.altguard.channel")}
            description={t("modules.altguard.channelDescription")}
            error={fieldErrors.channel_id}
          >
            <ChannelSelect
              value={draft.channel_id}
              channels={textChannels}
              onChange={(v) => patch({ channel_id: v })}
              placeholder={t("modules.selectChannel")}
              emptyLabel={t("modules.noChannels")}
            />
          </Field>

          {/* Rôle non vérifié */}
          <Field
            label={t("modules.altguard.unverifiedRole")}
            description={t("modules.altguard.unverifiedRoleDescription")}
            error={fieldErrors.unverified_role_id}
          >
            <RoleSelect
              value={draft.unverified_role_id}
              roles={assignableRoles}
              botTop={botTop}
              excludeId={draft.verified_role_id}
              onChange={(v) => patch({ unverified_role_id: v })}
              placeholder={t("modules.altguard.selectRole")}
              emptyLabel={t("modules.altguard.noRoles")}
              aboveBotLabel={t("modules.altguard.roleAboveBot")}
            />
          </Field>

          {/* Rôle vérifié */}
          <Field
            label={t("modules.altguard.verifiedRole")}
            description={t("modules.altguard.verifiedRoleDescription")}
            error={fieldErrors.verified_role_id}
          >
            <RoleSelect
              value={draft.verified_role_id}
              roles={assignableRoles}
              botTop={botTop}
              excludeId={draft.unverified_role_id}
              onChange={(v) => patch({ verified_role_id: v })}
              placeholder={t("modules.altguard.selectRole")}
              emptyLabel={t("modules.altguard.noRoles")}
              aboveBotLabel={t("modules.altguard.roleAboveBot")}
            />
          </Field>

          {/* Salon de logs (optionnel) */}
          <Field
            label={t("modules.altguard.logChannel")}
            description={t("modules.altguard.logChannelDescription")}
            error={fieldErrors.log_channel_id}
            optional
            optionalLabel={t("modules.altguard.optional")}
          >
            <ChannelSelect
              value={draft.log_channel_id}
              channels={textChannels}
              onChange={(v) => patch({ log_channel_id: v })}
              placeholder={t("modules.altguard.noLogChannel")}
              emptyLabel={t("modules.noChannels")}
              clearable
              clearLabel={t("modules.altguard.noLogChannel")}
            />
          </Field>

          {/* Le texte du panneau n'est pas configurable, et sa langue ne l'est
              plus ici : il n'y a plus qu'un réglage, au niveau du serveur. */}
          <ServerLanguageNote guildId={selectedGuildId} />

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ClockIcon className="size-3.5 mt-0.5 shrink-0" />
            {t("modules.altguard.saveDurationHint")}
          </p>
        </CardContent>
      </Card>

      <UnsavedBar
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
        </>
      )}
    </ModulePage>
  )
}

// ─── Retour utilisateur ───────────────────────────────────────────────────────

/** Toast correspondant à l'accusé du bot (le détail reste affiché sur la page). */
function notify(feedback: ApplyFeedback) {
  const t = i18n.t.bind(i18n)
  const message = t(feedback.key)
  const description =
    feedback.problems.length > 0
      ? feedback.problems.map((p) => t(p.key, p.params)).join(" ")
      : undefined

  switch (feedback.level) {
    case "error":
      toast.error(message, { description })
      break
    case "warning":
      toast.warning(message, { description })
      break
    case "info":
      toast.info(message, { description })
      break
    default:
      toast.success(message, { description })
  }
}

const NOTICE_ICONS = {
  success: CheckCircleIcon,
  info: InfoIcon,
  warning: TriangleAlertIcon,
  error: AlertCircleIcon,
} as const

function Notice({
  level,
  title,
  children,
  onDismiss,
}: {
  level: ApplyLevel
  title: string
  children?: React.ReactNode
  onDismiss?: () => void
}) {
  const Icon = NOTICE_ICONS[level]
  return (
    <Alert variant={level === "error" ? "destructive" : "default"}>
      <Icon />
      <AlertTitle>{title}</AlertTitle>
      {children && <AlertDescription>{children}</AlertDescription>}
      {onDismiss && (
        <AlertAction>
          <Button type="button" variant="ghost" size="icon-xs" onClick={onDismiss}>
            <XIcon />
          </Button>
        </AlertAction>
      )}
    </Alert>
  )
}

/**
 * Résultat de la dernière écriture. Les problèmes de permission restent à
 * l'écran : c'est le seul endroit où l'admin apprend que son serveur n'est pas
 * protégé malgré un enregistrement réussi.
 */
function ApplyNotice({
  feedback,
  onDismiss,
}: {
  feedback: ApplyFeedback
  onDismiss: () => void
}) {
  const { t } = useTranslation()
  return (
    <Notice level={feedback.level} title={t(feedback.key)} onDismiss={onDismiss}>
      {feedback.problems.length > 0 && (
        <ul className="list-disc pl-4">
          {feedback.problems.map((p) => (
            <li key={p.key}>{t(p.key, p.params)}</li>
          ))}
        </ul>
      )}
    </Notice>
  )
}

// ─── Champs ───────────────────────────────────────────────────────────────────

function Field({
  label,
  description,
  error,
  optional,
  optionalLabel,
  children,
}: {
  label: string
  description: string
  error?: string
  optional?: boolean
  optionalLabel?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">{label}</label>
        {optional && (
          <span className="text-xs text-muted-foreground">{optionalLabel}</span>
        )}
      </div>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  )
}

function ChannelSelect({
  value,
  channels,
  onChange,
  placeholder,
  clearable = false,
  clearLabel,
}: {
  value: string | null
  channels: import("@/types/api").Channel[]
  onChange: (value: string | null) => void
  placeholder: string
  emptyLabel?: string
  clearable?: boolean
  clearLabel?: string
}) {
  return (
    <ChannelPicker
      value={value}
      onChange={onChange}
      channels={channels}
      placeholder={placeholder}
      allowNone={clearable}
      noneLabel={clearLabel}
    />
  )
}

function RoleSelect({
  value,
  roles,
  botTop,
  excludeId,
  onChange,
  placeholder,
  aboveBotLabel,
}: {
  value: string | null
  roles: Role[]
  botTop: number | null
  /** Rôle déjà choisi de l'autre côté — l'API refuse les deux rôles identiques. */
  excludeId: string | null
  onChange: (value: string | null) => void
  placeholder: string
  emptyLabel?: string
  aboveBotLabel: string
}) {
  const { t } = useTranslation()
  const usedLabel = t("modules.altguard.roleAlreadyUsed")
  return (
    <RolePicker
      value={value}
      onChange={onChange}
      roles={roles}
      placeholder={placeholder}
      disabledReason={(role) =>
        role.id === excludeId ? usedLabel : isRoleAboveBot(role, botTop) ? aboveBotLabel : null
      }
    />
  )
}
