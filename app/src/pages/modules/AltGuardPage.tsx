import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ClockIcon,
  InfoIcon,
  LoaderIcon,
  ShieldCheckIcon,
  Trash2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
import { UnsavedBar } from "@/components/unsaved-bar"
import i18n from "@/i18n"
import { handleSaveError } from "@/lib/handle-error"
import { ApiError } from "@/lib/auth"
import { logger } from "@/lib/logger"
import { cn, resolveChannelId, resolveRoleIds } from "@/lib/utils"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorPage } from "@/components/error-state"
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
import { ALTGUARD_PANEL_LOCALES, roleColorToHex } from "@/types/api"
import type {
  AltGuardConfig,
  AltGuardPanelLocale,
  Role,
} from "@/types/api"

/** Sentinelle du sélecteur : Radix Select refuse une valeur vide. */
const NONE = "__none__"

/** Champs sur lesquels une erreur 422 peut être rattachée. */
type FieldKey =
  | "channel_id"
  | "unverified_role_id"
  | "verified_role_id"
  | "log_channel_id"
  | "panel_locale"

const FIELD_KEYS: FieldKey[] = [
  "channel_id",
  "unverified_role_id",
  "verified_role_id",
  "log_channel_id",
  "panel_locale",
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
  const [isDisabling, setIsDisabling] = useState(false)
  const [confirmDisable, setConfirmDisable] = useState(false)
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
    setIsDisabling(true)
    try {
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
    } catch (e) {
      logger.error("module:altguard", "Disable failed", e)
      handleSaveError(e, { title: t("modules.saveError") })
    } finally {
      setIsDisabling(false)
      setConfirmDisable(false)
    }
  }, [selectedGuildId, syncModule, t])

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (loadError) {
    return <ErrorPage error={loadError} onRetry={() => window.location.reload()} />
  }

  if (isLoading || !draft) {
    return (
      <div className="flex flex-col gap-4 w-full">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  const isActive = missing.length === 0

  return (
    <div className="flex flex-col gap-6 w-full pb-24">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="size-11 rounded-xl bg-sky-100 dark:bg-sky-950 flex items-center justify-center shrink-0">
            <ShieldCheckIcon className="size-5 text-sky-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-none">{t("modules.altguard.name")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("modules.altguard.description")}
            </p>
          </div>
        </div>
        {/* Badge d'état — dérivé des champs remplis, il n'y a pas
            d'interrupteur : le module est actif dès que salon + rôles y sont. */}
        {isActive ? (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
            <CheckCircle2Icon className="size-3 mr-1" />
            {t("modules.altguard.statusActive")}
          </Badge>
        ) : (
          <Badge variant="secondary">
            <XIcon className="size-3 mr-1" />
            {t("modules.altguard.statusInactive")}
          </Badge>
        )}
      </div>

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

          {/* Langue du panneau */}
          <Field
            label={t("modules.altguard.panelLocale")}
            description={t("modules.altguard.panelLocaleDescription")}
            error={fieldErrors.panel_locale}
          >
            <Select
              value={draft.panel_locale}
              onValueChange={(v) => patch({ panel_locale: v as AltGuardPanelLocale })}
            >
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALTGUARD_PANEL_LOCALES.map((locale) => (
                  <SelectItem key={locale} value={locale}>
                    {t(`modules.altguard.locales.${locale}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ClockIcon className="size-3.5 mt-0.5 shrink-0" />
            {t("modules.altguard.saveDurationHint")}
          </p>
        </CardContent>
      </Card>

      {/* Désactivation — il n'y a pas d'interrupteur, « désactiver » = DELETE. */}
      {isConfigured && (
        <Button
          type="button"
          variant="outline"
          className="text-destructive hover:text-destructive w-fit"
          onClick={() => setConfirmDisable(true)}
          disabled={isSaving || isDisabling}
        >
          {isDisabling ? (
            <LoaderIcon className="size-4 mr-2 animate-spin" />
          ) : (
            <Trash2Icon className="size-4 mr-2" />
          )}
          {t("modules.disable")}
        </Button>
      )}

      <AlertDialog open={confirmDisable} onOpenChange={setConfirmDisable}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("modules.altguard.confirmDisableTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("modules.altguard.confirmDisableDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("modules.altguard.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisable}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("modules.disable")}
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

const NOTICE_STYLES: Record<ApplyLevel, { box: string; icon: string; Icon: typeof InfoIcon }> = {
  success: {
    box: "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40",
    icon: "text-emerald-600 dark:text-emerald-400",
    Icon: CheckCircle2Icon,
  },
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
  level: ApplyLevel
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
        <ul className="list-disc space-y-0.5 pl-4">
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
  emptyLabel,
  clearable = false,
  clearLabel,
}: {
  value: string | null
  channels: { id: string; name: string }[]
  onChange: (value: string | null) => void
  placeholder: string
  emptyLabel: string
  clearable?: boolean
  clearLabel?: string
}) {
  // Un id enregistré avant le correctif de précision JSON peut ne pas matcher
  // la liste live à la chaîne près — même résolution que les autres modules.
  const resolved = resolveChannelId(value, channels.map((c) => c.id))
  const known = channels.some((c) => c.id === resolved)

  return (
    <Select
      value={resolved || NONE}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
    >
      <SelectTrigger className="w-full sm:w-72" disabled={channels.length === 0}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {channels.length === 0 && (
          <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
            <AlertCircleIcon className="size-4" />
            {emptyLabel}
          </div>
        )}
        {clearable && <SelectItem value={NONE}>{clearLabel}</SelectItem>}
        {channels.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            # {c.name}
          </SelectItem>
        ))}
        {/* Valeur enregistrée absente de la liste (salon supprimé, mauvais
            type) : gardée visible plutôt que de retomber sur le placeholder. */}
        {resolved && !known && (
          <SelectItem value={resolved} disabled>
            # {resolved}
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  )
}

function RoleSelect({
  value,
  roles,
  botTop,
  excludeId,
  onChange,
  placeholder,
  emptyLabel,
  aboveBotLabel,
}: {
  value: string | null
  roles: Role[]
  botTop: number | null
  /** Rôle déjà choisi de l'autre côté — l'API refuse les deux rôles identiques. */
  excludeId: string | null
  onChange: (value: string | null) => void
  placeholder: string
  emptyLabel: string
  aboveBotLabel: string
}) {
  const resolved = value ? resolveRoleIds([value], roles.map((r) => r.id))[0] : ''
  const known = roles.some((r) => r.id === resolved)

  return (
    <Select value={resolved || undefined} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-72" disabled={roles.length === 0}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {roles.length === 0 && (
          <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
            <AlertCircleIcon className="size-4" />
            {emptyLabel}
          </div>
        )}
        {roles.map((role) => {
          const aboveBot = isRoleAboveBot(role, botTop)
          return (
            <SelectItem
              key={role.id}
              value={role.id}
              disabled={role.id === excludeId || aboveBot}
            >
              <div className="flex items-center gap-2">
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: roleColorToHex(role.color) }}
                />
                <span className="truncate">{role.name}</span>
                {aboveBot && (
                  <span className="text-xs text-muted-foreground">{aboveBotLabel}</span>
                )}
              </div>
            </SelectItem>
          )
        })}
        {resolved && !known && (
          <SelectItem value={resolved} disabled>
            {resolved}
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  )
}
