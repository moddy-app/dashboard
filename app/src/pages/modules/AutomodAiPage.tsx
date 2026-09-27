import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  FlaskConicalIcon,
  LoaderIcon,
  LockIcon,
  RotateCcwIcon,
  SparklesIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
import { UnsavedBar } from "@/components/unsaved-bar"
import { ChannelMultiPicker, RoleMultiPicker } from "@/components/module-pickers"
import { ServerLanguageNote } from "@/components/server-language-note"
import { ErrorPage } from "@/components/error-state"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useGuildContext } from "@/contexts/GuildContext"
import { ApiError } from "@/lib/auth"
import { handleSaveError } from "@/lib/handle-error"
import { useSanctionGates, useSanctions } from "@/contexts/SanctionContext"
import { sanctionBlockedError } from "@/lib/sanctions"
import { logger } from "@/lib/logger"
import { cn } from "@/lib/utils"
import {
  SCAN_ALL_FEATURE,
  applyExemptions,
  orderedFeatureIds,
  sharedExemptions,
} from "@/lib/automod"
import {
  EXEMPT_MAX,
  INDICATIONS_MAX,
  checkIndications,
  defaultAutomodConfig,
  deleteAutomodConfig,
  getAutomodConfig,
  getAutomodStatus,
  saveAutomodConfig,
} from "@/services/automod"
import { CHANNEL_TYPES } from "@/types/api"
import type {
  AutomodAiConfig,
  AutomodAiStatus,
  AutomodFeature,
  AutomodMaxAction,
} from "@/types/api"

// ─── Constantes ───────────────────────────────────────────────────────────────

const MAX_ACTIONS: AutomodMaxAction[] = ["warn", "mute", "ban"]
/** Valeur sentinelle du Select : Radix interdit un SelectItem de valeur vide. */
const NO_CHANNEL = "__none__"
/** Délai avant de soumettre les indications au contrôle anti-injection. */
const CHECK_DEBOUNCE_MS = 800

/** État du contrôle anti-injection du champ `indications`. */
type CheckState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok" }
  | { kind: "rejected"; reason: string }
  | { kind: "unavailable" }

/** Champs de formulaire susceptibles de porter une erreur renvoyée par le PUT. */
type FieldErrors = Partial<
  Record<"notify_channel_id" | "indications" | "severity" | "max_action" | "features" | "exemptions", string>
>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSameConfig(a: AutomodAiConfig, b: AutomodAiConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Mappe les erreurs de validation d'un 422 sur les champs du formulaire.
 * `loc` peut être `["severity"]` comme `["body", "features", "content",
 * "exempt_roles"]` : on retient le premier segment qui correspond à un champ
 * connu, et une exemption en trop (> 25 sur un bloc) va sous la liste commune.
 */
function mapValidationErrors(error: ApiError): FieldErrors {
  const fields: FieldErrors = {}
  const known: (keyof FieldErrors)[] = [
    "notify_channel_id",
    "indications",
    "severity",
    "max_action",
    "features",
  ]
  for (const issue of error.validationIssues) {
    const loc = issue.loc ?? []
    if (loc.includes("exempt_roles") || loc.includes("exempt_channels")) {
      fields.exemptions = issue.msg
      continue
    }
    const target = loc.find((part) => known.includes(part as keyof FieldErrors))
    if (target) fields[target as keyof FieldErrors] = issue.msg
  }
  return fields
}

/**
 * Rattache un 422 en **chaîne** (sans `loc`) à ce qui l'a causé :
 * - « Salon d'alertes invalide » → le salon d'alertes ;
 * - « Fonctionnalité inconnue » / « Catégorie inconnue » → encart global, rien
 *   dans le formulaire ne les pilote ;
 * - sinon, si les consignes ont changé, c'est le contrôle anti-injection
 *   rejoué à l'enregistrement : sa raison va sous le champ.
 */
function mapStringError(message: string, indicationsChanged: boolean): {
  fields: FieldErrors
  form: string | null
} {
  if (/salon d'alertes|alert channel|notify_channel/i.test(message)) {
    return { fields: { notify_channel_id: message }, form: null }
  }
  if (/fonctionnalit[ée] inconnue|cat[ée]gorie inconnue|unknown (feature|category)/i.test(message)) {
    return { fields: {}, form: message }
  }
  if (indicationsChanged) return { fields: { indications: message }, form: null }
  return { fields: {}, form: message }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AutomodAiPage() {
  const { isLoadingGuild, isGuildReady, guildError, refreshGuildData } = useGuildContext()

  if (guildError) {
    return <ErrorPage error={guildError} onRetry={refreshGuildData} />
  }

  // Le formulaire n'est monté qu'une fois channels/roles disponibles : sinon les
  // sélecteurs s'initialiseraient vides sur une arrivée directe par l'URL.
  if (isLoadingGuild || !isGuildReady) {
    return (
      <div className="flex flex-col gap-4 w-full">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  return <AutomodAiForm />
}

function AutomodAiForm() {
  const { t } = useTranslation()
  const { selectedGuildId, channels, roles } = useGuildContext()

  const [savedConfig, setSavedConfig] = useState<AutomodAiConfig | null>(null)
  const [draft, setDraft] = useState<AutomodAiConfig | null>(null)
  const [status, setStatus] = useState<AutomodAiStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  /** 422 qui ne se rattache à aucun champ (id de détecteur ou catégorie inconnus). */
  const [formError, setFormError] = useState<string | null>(null)
  const [check, setCheck] = useState<CheckState>({ kind: "idle" })

  const textChannels = useMemo(
    () =>
      channels.filter(
        (c) => c.type === CHANNEL_TYPES.TEXT || c.type === CHANNEL_TYPES.ANNOUNCEMENT
      ),
    [channels]
  )

  // Exemptions : salons texte, annonces et forums (les fils suivent leur
  // parent) ; rôles hors `@everyone`.
  const exemptableChannels = useMemo(
    () =>
      channels.filter(
        (c) =>
          c.type === CHANNEL_TYPES.TEXT ||
          c.type === CHANNEL_TYPES.ANNOUNCEMENT ||
          c.type === CHANNEL_TYPES.FORUM
      ),
    [channels]
  )
  const exemptableRoles = useMemo(() => roles.filter((r) => r.name !== "@everyone"), [roles])

  // ── Chargement ────────────────────────────────────────────────────────────

  const loadStatus = useCallback(async () => {
    if (!selectedGuildId) return
    try {
      setStatus(await getAutomodStatus(selectedGuildId))
    } catch (e) {
      // Le statut est un confort d'affichage : son échec ne bloque pas le form.
      logger.warn("module:automod_ai", "Status unavailable", e)
      setStatus(null)
    }
  }, [selectedGuildId])

  useEffect(() => {
    if (!selectedGuildId) return
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const [config, statusResult] = await Promise.all([
          getAutomodConfig(selectedGuildId),
          getAutomodStatus(selectedGuildId).catch(() => null),
        ])
        if (cancelled) return
        // 404 = jamais configuré → formulaire vierge, pas une erreur.
        const initial = config ?? defaultAutomodConfig()
        setSavedConfig(initial)
        setDraft(structuredClone(initial))
        setStatus(statusResult)
      } catch (e) {
        if (cancelled) return
        logger.error("module:automod_ai", "Load failed", e)
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

  // ── Contrôle anti-injection (debounce) ────────────────────────────────────

  const indications = draft?.indications ?? ""
  const savedIndications = savedConfig?.indications ?? ""
  const indicationsChanged = indications !== savedIndications
  // Identifie la requête en vol : une réponse tardive d'un texte déjà remplacé
  // ne doit pas écraser l'état du texte courant.
  const checkSeq = useRef(0)

  useEffect(() => {
    if (!selectedGuildId) return
    // Pas d'appel IA si le texte n'a pas bougé — activer un toggle ne coûte rien.
    if (!indicationsChanged || indications.trim() === "") {
      setCheck({ kind: "idle" })
      return
    }
    if (indications.length > INDICATIONS_MAX) {
      setCheck({ kind: "idle" })
      return
    }

    const seq = ++checkSeq.current
    setCheck({ kind: "checking" })

    const timer = setTimeout(async () => {
      try {
        const result = await checkIndications(selectedGuildId, indications)
        if (seq !== checkSeq.current) return
        setCheck(
          result.ok
            ? { kind: "ok" }
            : { kind: "rejected", reason: result.reason ?? t("modules.automod_ai.indicationsRejectedFallback") }
        )
      } catch (e) {
        if (seq !== checkSeq.current) return
        // 503 : contrôle indisponible — on avertit sans empêcher la tentative
        // de sauvegarde (le backend rejouera le contrôle de toute façon).
        if (e instanceof ApiError && e.isUnavailable) {
          setCheck({ kind: "unavailable" })
          return
        }
        logger.warn("module:automod_ai", "Indications check failed", e)
        setCheck({ kind: "idle" })
      }
    }, CHECK_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [selectedGuildId, indications, indicationsChanged, t])

  // ── Mutations du brouillon ────────────────────────────────────────────────

  const patch = useCallback((changes: Partial<AutomodAiConfig>) => {
    setDraft((prev) => (prev ? { ...prev, ...changes } : prev))
  }, [])

  const patchFeature = useCallback((featureId: string, changes: Partial<AutomodFeature>) => {
    setDraft((prev) => {
      if (!prev) return prev
      const current = prev.features[featureId]
      if (!current) return prev
      return {
        ...prev,
        features: { ...prev.features, [featureId]: { ...current, ...changes } },
      }
    })
  }, [])

  /** Une seule liste dans l'UI, recopiée sur tous les blocs (comme le panneau du bot). */
  const patchExemptions = useCallback((changes: { roles?: string[]; channels?: string[] }) => {
    setDraft((prev) => (prev ? { ...prev, features: applyExemptions(prev.features, changes) } : prev))
    setFieldErrors((prev) => ({ ...prev, exemptions: undefined }))
  }, [])

  // ── Sauvegarde ────────────────────────────────────────────────────────────

  const gates = useSanctionGates(selectedGuildId)
  const { isExempt } = useSanctions()
  // Deux sources pour le même verrou : le statut de sanction du serveur (déjà
  // connu du contexte) et `/status`, qui le dit aussi. Le staff n'est jamais
  // bloqué — l'API ne le bloque pas non plus.
  const blockedByStatus =
    !isExempt &&
    (status?.blocked_by_global_sanction === true ||
      status?.warnings.includes("blocked_by_global_sanction") === true)
  const readOnly = !gates.canWriteAutomod || blockedByStatus
  const isDirty = Boolean(savedConfig && draft && !isSameConfig(savedConfig, draft))

  // Annotation explicite : le corps se référence lui-même (bouton « Réessayer »
  // du toast 503), ce que l'inférence de TypeScript ne sait pas résoudre.
  const handleSave: () => Promise<void> = useCallback(async () => {
    if (!selectedGuildId || !draft) return

    // L'automod IA suit le **serveur**, jamais l'utilisateur : un compte limité
    // peut encore l'éditer sur un serveur sain, mais toute écriture est refusée
    // dès que le serveur est sanctionné (le module est coupé de toute façon).
    if (!gates.canWriteAutomod) {
      handleSaveError(
        sanctionBlockedError("automod_ai_blocked", gates.guild ?? gates.effective),
        { title: t("modules.saveError") }
      )
      return
    }

    if (draft.indications.length > INDICATIONS_MAX) {
      setFieldErrors({ indications: t("modules.automod_ai.indicationsTooLong", { max: INDICATIONS_MAX }) })
      return
    }

    logger.event("module:automod_ai", "Save", { enabled: draft.enabled, dry_run: draft.dry_run })
    setIsSaving(true)
    setFieldErrors({})
    setFormError(null)
    try {
      // On envoie l'objet complet issu de celui reçu : `categories_desactivees`
      // et tout champ inconnu de ce front sont préservés.
      const saved = await saveAutomodConfig(selectedGuildId, draft)
      setSavedConfig(saved)
      setDraft(structuredClone(saved))
      setCheck({ kind: "idle" })
      toast.success(t("modules.saved"))
      logger.success("module:automod_ai", "Saved")
      await loadStatus()
    } catch (e) {
      logger.error("module:automod_ai", "Save failed", e)
      if (e instanceof ApiError) {
        // 503 : rien n'a été écrit — le contrôle des indications est indisponible.
        if (e.isUnavailable) {
          toast.error(t("modules.automod_ai.checkUnavailableTitle"), {
            description: t("modules.automod_ai.checkUnavailableSaveDescription"),
            action: { label: t("modules.automod_ai.retry"), onClick: () => void handleSave() },
          })
          return
        }
        if (e.status === 422) {
          const mapped = mapValidationErrors(e)
          if (Object.keys(mapped).length > 0) {
            setFieldErrors(mapped)
          } else {
            const { fields, form } = mapStringError(
              e.message,
              draft.indications !== (savedConfig?.indications ?? "")
            )
            setFieldErrors(fields)
            setFormError(form)
          }
        }
      }
      handleSaveError(e, { title: t("modules.saveError") })
      // 403 `automod_ai_blocked` : le serveur vient d'être sanctionné — `/status`
      // le dit et fait passer le formulaire en lecture seule.
      if (e instanceof ApiError && e.isForbidden) await loadStatus()
    } finally {
      setIsSaving(false)
    }
  }, [selectedGuildId, draft, savedConfig, t, loadStatus, gates])

  const handleDiscard = useCallback(() => {
    if (!savedConfig) return
    logger.event("module:automod_ai", "Discard")
    setDraft(structuredClone(savedConfig))
    setFieldErrors({})
    setFormError(null)
    setCheck({ kind: "idle" })
  }, [savedConfig])

  const handleReset = useCallback(async () => {
    if (!selectedGuildId) return
    logger.event("module:automod_ai", "Reset config")
    setIsResetting(true)
    try {
      await deleteAutomodConfig(selectedGuildId)
      const fresh = defaultAutomodConfig()
      setSavedConfig(fresh)
      setDraft(structuredClone(fresh))
      setFieldErrors({})
      setFormError(null)
      setCheck({ kind: "idle" })
      toast.success(t("modules.automod_ai.resetSuccess"))
      logger.success("module:automod_ai", "Config reset")
      await loadStatus()
    } catch (e) {
      logger.error("module:automod_ai", "Reset failed", e)
      handleSaveError(e, { title: t("modules.saveError") })
    } finally {
      setIsResetting(false)
      setConfirmReset(false)
    }
  }, [selectedGuildId, t, loadStatus])

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (loadError) {
    return <ErrorPage error={loadError} onRetry={() => window.location.reload()} />
  }

  if (isLoading || !draft) {
    return (
      <div className="flex flex-col gap-4 w-full">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  const featureIds = orderedFeatureIds(draft.features)
  const exemptions = sharedExemptions(draft.features)

  return (
    <div className="flex flex-col gap-6 w-full pb-24">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="size-11 rounded-xl bg-violet-100 dark:bg-violet-950 flex items-center justify-center shrink-0">
            <SparklesIcon className="size-5 text-violet-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-none">{t("modules.automod_ai.name")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("modules.automod_ai.description")}
            </p>
          </div>
        </div>
        <StatusBadges status={status} />
      </div>

      {/* Sanction globale : le bandeau de la page couvre le cas connu du
          contexte ; celui-ci couvre le cas que seul `/status` a vu. */}
      {blockedByStatus && gates.canWriteAutomod && (
        <Alert variant="destructive">
          <LockIcon />
          <AlertTitle>{t("violations.banner.automodBlockedTitle")}</AlertTitle>
          <AlertDescription>{t("violations.banner.automodBlockedDescription")}</AlertDescription>
        </Alert>
      )}

      {/* Avertissements de configuration (calculés côté backend) */}
      <StatusWarnings status={status} />

      {formError && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{t("modules.automod_ai.formErrorTitle")}</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      {/* En lecture seule, `disabled` sur le fieldset désactive tous les
          contrôles natifs d'un coup (Switch, Select, Checkbox, boutons). */}
      <fieldset disabled={readOnly} className="contents">
      {/* Général */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("modules.automod_ai.generalTitle")}</CardTitle>
          <CardDescription>{t("modules.automod_ai.generalDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Interrupteur principal */}
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">{t("modules.automod_ai.enabled")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("modules.automod_ai.enabledDescription")}
              </p>
            </div>
            <Switch
              checked={draft.enabled}
              onCheckedChange={(v) => patch({ enabled: v })}
            />
          </div>

          {/* Salon d'alertes */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">{t("modules.automod_ai.notifyChannel")}</label>
            <Select
              value={draft.notify_channel_id ?? NO_CHANNEL}
              onValueChange={(v) => {
                patch({ notify_channel_id: v === NO_CHANNEL ? null : v })
                setFieldErrors((prev) => ({ ...prev, notify_channel_id: undefined }))
              }}
            >
              <SelectTrigger
                className={cn(fieldErrors.notify_channel_id && "border-destructive")}
                disabled={textChannels.length === 0}
              >
                <SelectValue placeholder={t("modules.selectChannel")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CHANNEL}>{t("modules.automod_ai.noNotifyChannel")}</SelectItem>
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
                {/* Salon enregistré absent de la liste (supprimé, mauvais type) :
                    on l'affiche quand même pour ne pas retomber sur le placeholder. */}
                {draft.notify_channel_id &&
                  !textChannels.find((c) => c.id === draft.notify_channel_id) && (
                    <SelectItem value={draft.notify_channel_id} disabled>
                      # {draft.notify_channel_id}
                    </SelectItem>
                  )}
              </SelectContent>
            </Select>
            {fieldErrors.notify_channel_id ? (
              <p className="text-xs text-destructive">{fieldErrors.notify_channel_id}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("modules.automod_ai.notifyChannelDescription")}
              </p>
            )}
          </div>

          {/* Ignorer les modérateurs */}
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">{t("modules.automod_ai.ignoreModerators")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("modules.automod_ai.ignoreModeratorsDescription")}
              </p>
            </div>
            <Switch
              checked={draft.ignore_moderators}
              onCheckedChange={(v) => patch({ ignore_moderators: v })}
            />
          </div>

          {/* Mode simulation */}
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{t("modules.automod_ai.dryRun")}</p>
                {draft.dry_run && (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <FlaskConicalIcon className="size-3" />
                    {t("modules.automod_ai.dryRunBadge")}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("modules.automod_ai.dryRunDescription")}
              </p>
            </div>
            <Switch checked={draft.dry_run} onCheckedChange={(v) => patch({ dry_run: v })} />
          </div>

          {/* La langue des DM et cartes de sanction suit celle du serveur — il
              n'y a plus de sélecteur par module. */}
          <ServerLanguageNote guildId={selectedGuildId} />
        </CardContent>
      </Card>

      {/* Sévérité & sanction maximale */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("modules.automod_ai.severityTitle")}</CardTitle>
          <CardDescription>{t("modules.automod_ai.severityDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {/* Sévérité */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{t("modules.automod_ai.severity")}</label>
              <Badge variant="secondary" className="tabular-nums">
                {t(`modules.automod_ai.severity_${draft.severity}`)}
              </Badge>
            </div>
            <div className="px-1 py-2">
              <Slider
                min={1}
                max={5}
                step={1}
                value={[draft.severity]}
                onValueChange={([v]) => patch({ severity: v })}
                disabled={readOnly}
                className="w-full"
              />
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>{t("modules.automod_ai.severityLow")}</span>
                <span>{t("modules.automod_ai.severityHigh")}</span>
              </div>
            </div>
            {fieldErrors.severity && (
              <p className="text-xs text-destructive">{fieldErrors.severity}</p>
            )}
          </div>

          {/* Sanction maximale */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">{t("modules.automod_ai.maxAction")}</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {MAX_ACTIONS.map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => patch({ max_action: action })}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border p-3 text-left transition-all",
                    draft.max_action === action
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-muted-foreground/50 hover:bg-muted/50"
                  )}
                >
                  <span className="text-sm font-medium">
                    {t(`modules.automod_ai.maxAction_${action}`)}
                  </span>
                  <span className="text-xs text-muted-foreground leading-tight">
                    {t(`modules.automod_ai.maxAction_${action}_desc`)}
                  </span>
                </button>
              ))}
            </div>
            {fieldErrors.max_action ? (
              <p className="text-xs text-destructive">{fieldErrors.max_action}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("modules.automod_ai.maxActionDescription")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Indications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("modules.automod_ai.indicationsTitle")}</CardTitle>
          <CardDescription>{t("modules.automod_ai.indicationsDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Textarea
            value={draft.indications}
            onChange={(e) => {
              patch({ indications: e.target.value })
              setFieldErrors((prev) => ({ ...prev, indications: undefined }))
            }}
            placeholder={t("modules.automod_ai.indicationsPlaceholder")}
            className={cn(
              "min-h-40 resize-y",
              (fieldErrors.indications || check.kind === "rejected") && "border-destructive"
            )}
          />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <IndicationsCheckHint check={check} />
              {fieldErrors.indications && (
                <p className="text-xs text-destructive">{fieldErrors.indications}</p>
              )}
            </div>
            <span
              className={cn(
                "text-xs tabular-nums shrink-0",
                draft.indications.length > INDICATIONS_MAX
                  ? "text-destructive font-medium"
                  : "text-muted-foreground"
              )}
            >
              {draft.indications.length} / {INDICATIONS_MAX}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("modules.automod_ai.indicationsSafetyHint")}
          </p>
        </CardContent>
      </Card>

      {/* Détecteurs — chacun s'active indépendamment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("modules.automod_ai.featuresTitle")}</CardTitle>
          <CardDescription>{t("modules.automod_ai.featuresDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldSet>
            <FieldGroup className="gap-3">
              {featureIds.map((id) => (
                <FeatureChoice
                  key={id}
                  featureId={id}
                  feature={draft.features[id]}
                  onChange={(changes) => patchFeature(id, changes)}
                />
              ))}
            </FieldGroup>
            {fieldErrors.features && <FieldError>{fieldErrors.features}</FieldError>}
          </FieldSet>

          {/* `scan_all` : champ ops, placé sous « Captures d'arnaque » dans une
              section repliée, avec son coût. Renvoyé tel que lu sinon. */}
          {draft.features[SCAN_ALL_FEATURE] && (
            <ScanAllSetting
              checked={draft.features[SCAN_ALL_FEATURE].scan_all === true}
              onChange={(v) => patchFeature(SCAN_ALL_FEATURE, { scan_all: v })}
            />
          )}
        </CardContent>
      </Card>

      {/* Exemptions — une seule liste, recopiée sur les trois blocs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("modules.automod_ai.exemptionsTitle")}</CardTitle>
          <CardDescription>{t("modules.automod_ai.exemptionsDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {exemptions.diverged && (
            <Alert>
              <TriangleAlertIcon />
              <AlertTitle>{t("modules.automod_ai.exemptionsDivergedTitle")}</AlertTitle>
              <AlertDescription>{t("modules.automod_ai.exemptionsDivergedDescription")}</AlertDescription>
              {!readOnly && (
                <AlertAction>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      patchExemptions({ roles: exemptions.roles, channels: exemptions.channels })
                    }
                  >
                    {t("modules.automod_ai.exemptionsUnify")}
                  </Button>
                </AlertAction>
              )}
            </Alert>
          )}
          <FieldGroup>
            <Field data-invalid={fieldErrors.exemptions ? true : undefined}>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor="automod-exempt-roles">
                  {t("modules.automod_ai.exemptRoles")}
                </FieldLabel>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t("modules.automod_ai.exemptCount", {
                    count: exemptions.roles.length,
                    max: EXEMPT_MAX,
                  })}
                </span>
              </div>
              <RoleMultiPicker
                id="automod-exempt-roles"
                value={exemptions.roles}
                roles={exemptableRoles}
                onChange={(roles) => patchExemptions({ roles })}
                max={EXEMPT_MAX}
                placeholder={t("modules.automod_ai.addRole")}
                invalid={Boolean(fieldErrors.exemptions)}
                disabled={readOnly}
              />
              <FieldDescription>{t("modules.automod_ai.exemptRolesHint")}</FieldDescription>
            </Field>
            <Field data-invalid={fieldErrors.exemptions ? true : undefined}>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor="automod-exempt-channels">
                  {t("modules.automod_ai.exemptChannels")}
                </FieldLabel>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t("modules.automod_ai.exemptCount", {
                    count: exemptions.channels.length,
                    max: EXEMPT_MAX,
                  })}
                </span>
              </div>
              <ChannelMultiPicker
                id="automod-exempt-channels"
                value={exemptions.channels}
                channels={exemptableChannels}
                onChange={(channels) => patchExemptions({ channels })}
                max={EXEMPT_MAX}
                placeholder={t("modules.automod_ai.addChannel")}
                invalid={Boolean(fieldErrors.exemptions)}
                disabled={readOnly}
              />
              <FieldDescription>{t("modules.automod_ai.exemptChannelsHint")}</FieldDescription>
              {fieldErrors.exemptions && <FieldError>{fieldErrors.exemptions}</FieldError>}
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Réinitialisation */}
      <Button
        type="button"
        variant="outline"
        className="text-destructive hover:text-destructive w-fit"
        onClick={() => setConfirmReset(true)}
        disabled={isSaving || isResetting}
      >
        {isResetting ? (
          <LoaderIcon className="size-4 mr-2 animate-spin" />
        ) : (
          <RotateCcwIcon className="size-4 mr-2" />
        )}
        {t("modules.automod_ai.reset")}
      </Button>
      </fieldset>

      <AlertDialog open={confirmReset} onOpenChange={(open) => !open && setConfirmReset(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("modules.automod_ai.confirmResetTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("modules.automod_ai.confirmResetDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("modules.automod_ai.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("modules.automod_ai.reset")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UnsavedBar
        isDirty={isDirty && !readOnly}
        isSaving={isSaving}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </div>
  )
}

// ─── Badges d'état ────────────────────────────────────────────────────────────

/** Le badge se lit sur `running`, jamais sur `enabled` (trois conditions). */
function StatusBadges({ status }: { status: AutomodAiStatus | null }) {
  const { t } = useTranslation()
  if (!status) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {status.running ? (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
          <CheckCircle2Icon className="size-3 mr-1" />
          {t("modules.automod_ai.statusRunning")}
        </Badge>
      ) : (
        <Badge variant="secondary">
          <XIcon className="size-3 mr-1" />
          {t("modules.automod_ai.statusStopped")}
        </Badge>
      )}
      {status.dry_run && (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
          <FlaskConicalIcon className="size-3 mr-1" />
          {t("modules.automod_ai.dryRunBadge")}
        </Badge>
      )}
    </div>
  )
}

/** Avertissements renvoyés par `/status`, traduits et hiérarchisés. */
function StatusWarnings({ status }: { status: AutomodAiStatus | null }) {
  const { t } = useTranslation()
  // La sanction globale a déjà son bandeau : on ne la dit pas deux fois.
  const warnings = status?.warnings.filter((w) => w !== "blocked_by_global_sanction") ?? []
  if (warnings.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {warnings.map((warning) => {
        // `missing_notify_channel` est la mauvaise config n°1 : elle empêche le
        // module de tourner → traitée visuellement comme une erreur.
        const isBlocking = warning === "missing_notify_channel"
        return (
          <div
            key={warning}
            className={cn(
              "flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm",
              isBlocking
                ? "border-destructive/40 bg-destructive/5 text-destructive"
                : "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300"
            )}
          >
            {isBlocking ? (
              <AlertCircleIcon className="size-4 mt-0.5 shrink-0" />
            ) : (
              <TriangleAlertIcon className="size-4 mt-0.5 shrink-0" />
            )}
            <span>
              {t(`modules.automod_ai.warnings.${warning}`, {
                defaultValue: t("modules.automod_ai.warnings.unknown", { code: warning }),
              })}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Retour du contrôle anti-injection ────────────────────────────────────────

function IndicationsCheckHint({ check }: { check: CheckState }) {
  const { t } = useTranslation()

  switch (check.kind) {
    case "checking":
      return (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <LoaderIcon className="size-3 animate-spin" />
          {t("modules.automod_ai.checking")}
        </p>
      )
    case "ok":
      return (
        <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2Icon className="size-3" />
          {t("modules.automod_ai.checkOk")}
        </p>
      )
    case "rejected":
      return (
        <p className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircleIcon className="size-3 mt-0.5 shrink-0" />
          <span>{check.reason}</span>
        </p>
      )
    case "unavailable":
      return (
        <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <TriangleAlertIcon className="size-3 mt-0.5 shrink-0" />
          <span>{t("modules.automod_ai.checkUnavailable")}</span>
        </p>
      )
    default:
      return null
  }
}

// ─── Détecteur ────────────────────────────────────────────────────────────────

interface FeatureChoiceProps {
  featureId: string
  feature: AutomodFeature
  onChange: (changes: Partial<AutomodFeature>) => void
}

/**
 * Une case par détecteur (`features.<id>.enabled`), indépendante des autres.
 * Un id sans traduction retombe sur l'id lui-même plutôt que sur un vide.
 */
function FeatureChoice({ featureId, feature, onChange }: FeatureChoiceProps) {
  const { t } = useTranslation()
  const inputId = `automod-feature-${featureId}`

  return (
    <FieldLabel htmlFor={inputId}>
      <Field orientation="horizontal">
        <FieldContent>
          <FieldTitle>
            {t(`modules.automod_ai.features.${featureId}.name`, { defaultValue: featureId })}
          </FieldTitle>
          <FieldDescription>
            {t(`modules.automod_ai.features.${featureId}.description`, {
              defaultValue: t("modules.automod_ai.features.genericDescription"),
            })}
          </FieldDescription>
        </FieldContent>
        <Checkbox
          id={inputId}
          checked={feature.enabled}
          onCheckedChange={(v) => onChange({ enabled: v === true })}
        />
      </Field>
    </FieldLabel>
  )
}

// ─── Lecture de toutes les images (image_scam.scan_all) ───────────────────────

function ScanAllSetting({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (value: boolean) => void
}) {
  const { t } = useTranslation()
  // Ouvert d'office si le réglage est déjà actif : un coût en cours ne se cache pas.
  const [open, setOpen] = useState(checked)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-4">
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="-ml-2">
          <ChevronDownIcon
            data-icon="inline-start"
            className={cn("transition-transform", open && "rotate-180")}
          />
          {t("modules.automod_ai.advanced")}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-3 pt-2">
        <p className="text-xs font-medium text-muted-foreground">
          {t("modules.automod_ai.features.image_scam.name")}
        </p>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="automod-scan-all">{t("modules.automod_ai.scanAll")}</FieldLabel>
            <FieldDescription>{t("modules.automod_ai.scanAllDescription")}</FieldDescription>
          </FieldContent>
          <Switch id="automod-scan-all" checked={checked} onCheckedChange={onChange} />
        </Field>
        <Alert>
          <TriangleAlertIcon />
          <AlertDescription>{t("modules.automod_ai.scanAllWarning")}</AlertDescription>
        </Alert>
      </CollapsibleContent>
    </Collapsible>
  )
}
