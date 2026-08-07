import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  FlaskConicalIcon,
  LoaderIcon,
  RotateCcwIcon,
  SparklesIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
import { UnsavedBar } from "@/components/unsaved-bar"
import { ErrorPage } from "@/components/error-state"
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
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useGuildContext } from "@/contexts/GuildContext"
import { ApiError } from "@/lib/auth"
import { handleSaveError } from "@/lib/handle-error"
import { logger } from "@/lib/logger"
import { cn } from "@/lib/utils"
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
import { CHANNEL_TYPES, roleColorToHex } from "@/types/api"
import type {
  AutomodAiConfig,
  AutomodAiStatus,
  AutomodFeature,
  AutomodLanguage,
  AutomodMaxAction,
} from "@/types/api"

// ─── Constantes ───────────────────────────────────────────────────────────────

const MAX_ACTIONS: AutomodMaxAction[] = ["warn", "mute", "ban"]
const LANGUAGES: AutomodLanguage[] = ["auto", "fr", "en-US"]
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
type FieldErrors = Partial<Record<"notify_channel_id" | "indications" | "severity" | "max_action" | "langue_serveur" | "features", string>>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSameConfig(a: AutomodAiConfig, b: AutomodAiConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Mappe les erreurs de validation d'un 422 sur les champs du formulaire.
 * `loc` peut être `["severity"]` comme `["body", "features", "content"]` : on
 * retient le premier segment qui correspond à un champ connu.
 */
function mapValidationErrors(error: ApiError): FieldErrors {
  const fields: FieldErrors = {}
  const known: (keyof FieldErrors)[] = [
    "notify_channel_id",
    "indications",
    "severity",
    "max_action",
    "langue_serveur",
    "features",
  ]
  for (const issue of error.validationIssues) {
    const target = issue.loc?.find((part) => known.includes(part as keyof FieldErrors))
    if (target) fields[target as keyof FieldErrors] = issue.msg
  }
  return fields
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
  const { selectedGuildId, channels } = useGuildContext()

  const [savedConfig, setSavedConfig] = useState<AutomodAiConfig | null>(null)
  const [draft, setDraft] = useState<AutomodAiConfig | null>(null)
  const [status, setStatus] = useState<AutomodAiStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [check, setCheck] = useState<CheckState>({ kind: "idle" })

  const textChannels = useMemo(
    () =>
      channels.filter(
        (c) => c.type === CHANNEL_TYPES.TEXT || c.type === CHANNEL_TYPES.ANNOUNCEMENT
      ),
    [channels]
  )

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

  // ── Sauvegarde ────────────────────────────────────────────────────────────

  const isDirty = Boolean(savedConfig && draft && !isSameConfig(savedConfig, draft))

  // Annotation explicite : le corps se référence lui-même (bouton « Réessayer »
  // du toast 503), ce que l'inférence de TypeScript ne sait pas résoudre.
  const handleSave: () => Promise<void> = useCallback(async () => {
    if (!selectedGuildId || !draft) return

    if (draft.indications.length > INDICATIONS_MAX) {
      setFieldErrors({ indications: t("modules.automod_ai.indicationsTooLong", { max: INDICATIONS_MAX }) })
      return
    }

    logger.event("module:automod_ai", "Save", { enabled: draft.enabled, dry_run: draft.dry_run })
    setIsSaving(true)
    setFieldErrors({})
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
          // Détail en chaîne (ex. « Salon d'alertes invalide ») : pas de `loc`,
          // on le rattache au salon d'alertes, seul champ concerné côté backend.
          if (Object.keys(mapped).length === 0) {
            setFieldErrors({ notify_channel_id: e.message })
          } else {
            setFieldErrors(mapped)
          }
        }
      }
      handleSaveError(e, { title: t("modules.saveError") })
    } finally {
      setIsSaving(false)
    }
  }, [selectedGuildId, draft, t, loadStatus])

  const handleDiscard = useCallback(() => {
    if (!savedConfig) return
    logger.event("module:automod_ai", "Discard")
    setDraft(structuredClone(savedConfig))
    setFieldErrors({})
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

  const featureIds = Object.keys(draft.features)

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

      {/* Avertissements de configuration (calculés côté backend) */}
      <StatusWarnings status={status} />

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

          {/* Langue */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">{t("modules.automod_ai.language")}</label>
            <Select
              value={draft.langue_serveur}
              onValueChange={(v) => patch({ langue_serveur: v as AutomodLanguage })}
            >
              <SelectTrigger className={cn("w-full sm:w-64", fieldErrors.langue_serveur && "border-destructive")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {t(`modules.automod_ai.language_${lang}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.langue_serveur ? (
              <p className="text-xs text-destructive">{fieldErrors.langue_serveur}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("modules.automod_ai.languageDescription")}
              </p>
            )}
          </div>
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

      {/* Détecteurs (map ouverte — rendu générique) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("modules.automod_ai.featuresTitle")}</CardTitle>
          <CardDescription>{t("modules.automod_ai.featuresDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {featureIds.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("modules.automod_ai.noFeatures")}</p>
          )}
          {featureIds.map((id) => (
            <FeatureCard
              key={id}
              featureId={id}
              feature={draft.features[id]}
              onChange={(changes) => patchFeature(id, changes)}
            />
          ))}
          {fieldErrors.features && (
            <p className="text-xs text-destructive">{fieldErrors.features}</p>
          )}
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
        isDirty={isDirty}
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
  if (!status || status.warnings.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {status.warnings.map((warning) => {
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

interface FeatureCardProps {
  featureId: string
  feature: AutomodFeature
  onChange: (changes: Partial<AutomodFeature>) => void
}

/**
 * Rendu générique d'un détecteur : les prochaines features (anti-link,
 * anti-spam…) auront la même forme `{enabled, exempt_roles, exempt_channels}`
 * et s'afficheront sans code supplémentaire — les libellés retombent sur l'id.
 */
function FeatureCard({ featureId, feature, onChange }: FeatureCardProps) {
  const { t } = useTranslation()
  const { channels, roles } = useGuildContext()

  const textChannels = channels.filter(
    (c) =>
      c.type === CHANNEL_TYPES.TEXT ||
      c.type === CHANNEL_TYPES.ANNOUNCEMENT ||
      c.type === CHANNEL_TYPES.FORUM
  )
  const manageableRoles = roles.filter((r) => r.name !== "@everyone")

  const exemptRoles = feature.exempt_roles ?? []
  const exemptChannels = feature.exempt_channels ?? []

  const availableRoles = manageableRoles.filter((r) => !exemptRoles.includes(r.id))
  const availableChannels = textChannels.filter((c) => !exemptChannels.includes(c.id))

  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between gap-4 p-3.5">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {t(`modules.automod_ai.features.${featureId}.name`, { defaultValue: featureId })}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t(`modules.automod_ai.features.${featureId}.description`, {
              defaultValue: t("modules.automod_ai.features.genericDescription"),
            })}
          </p>
        </div>
        <Switch checked={feature.enabled} onCheckedChange={(v) => onChange({ enabled: v })} />
      </div>

      {feature.enabled && (
        <div className="flex flex-col gap-5 border-t p-3.5">
          {/* Rôles exemptés */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{t("modules.automod_ai.exemptRoles")}</label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {exemptRoles.length} / {EXEMPT_MAX}
              </span>
            </div>
            {exemptRoles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {exemptRoles.map((id) => {
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
                          onChange({ exempt_roles: exemptRoles.filter((r) => r !== id) })
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
            {exemptRoles.length >= EXEMPT_MAX ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t("modules.automod_ai.exemptLimitReached", { max: EXEMPT_MAX })}
              </p>
            ) : (
              availableRoles.length > 0 && (
                <Select
                  value=""
                  onValueChange={(roleId) => onChange({ exempt_roles: [...exemptRoles, roleId] })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("modules.automod_ai.addRole")} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        <div className="flex items-center gap-2">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: roleColorToHex(role.color) }}
                          />
                          {role.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            )}
            <p className="text-xs text-muted-foreground">
              {t("modules.automod_ai.exemptRolesHint")}
            </p>
          </div>

          {/* Salons exemptés */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{t("modules.automod_ai.exemptChannels")}</label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {exemptChannels.length} / {EXEMPT_MAX}
              </span>
            </div>
            {exemptChannels.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {exemptChannels.map((id) => {
                  const channel = channels.find((c) => c.id === id)
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium"
                    >
                      # {channel?.name ?? id}
                      <button
                        type="button"
                        onClick={() =>
                          onChange({ exempt_channels: exemptChannels.filter((c) => c !== id) })
                        }
                        className="ml-0.5 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <XIcon className="size-3" />
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
            {exemptChannels.length >= EXEMPT_MAX ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t("modules.automod_ai.exemptLimitReached", { max: EXEMPT_MAX })}
              </p>
            ) : (
              availableChannels.length > 0 && (
                <Select
                  value=""
                  onValueChange={(channelId) =>
                    onChange({ exempt_channels: [...exemptChannels, channelId] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("modules.automod_ai.addChannel")} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableChannels.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        # {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            )}
            <p className="text-xs text-muted-foreground">
              {t("modules.automod_ai.exemptChannelsHint")}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
