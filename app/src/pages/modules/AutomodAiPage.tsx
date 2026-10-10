import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  AlertCircleIcon,
  LoaderIcon,
  LockIcon,
  RotateCcwIcon,
  SparklesIcon,
  WandSparklesIcon,
} from "lucide-react"
import { UnsavedBar } from "@/components/unsaved-bar"
import { AutomodCustomTab } from "@/components/automod/custom-infractions-tab"
import { AutomodProfileHoldsPanel } from "@/components/automod/profile-holds-panel"
import { AutomodScaleTab } from "@/components/automod/scale-tab"
import { AutomodSettingsTab } from "@/components/automod/settings-tab"
import { StatusBadges, StatusWarnings } from "@/components/automod/status-display"
import {
  AUTOMOD_TABS,
  type AutomodTabId,
  type CheckState,
  type FieldErrors,
} from "@/components/automod/automod-form"
import { ErrorPage } from "@/components/error-state"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useGuildContext } from "@/contexts/GuildContext"
import { useAutomodCatalog } from "@/hooks/useAutomodCatalog"
import { ApiError } from "@/lib/auth"
import { handleSaveError } from "@/lib/handle-error"
import { useSanctionGates, useSanctions } from "@/contexts/SanctionContext"
import { sanctionBlockedError } from "@/lib/sanctions"
import { logger } from "@/lib/logger"
import { applyExemptions, readAutomodErrorInfo, resolveFaultyInfractionId } from "@/lib/automod"
import {
  INDICATIONS_MAX,
  checkIndications,
  defaultAutomodConfig,
  deleteAutomodConfig,
  getAutomodConfig,
  getAutomodStatus,
  saveAutomodConfig,
} from "@/services/automod"
import type { AutomodAiConfig, AutomodAiStatus, AutomodFeature } from "@/types/api"

/** Délai avant de soumettre les indications au contrôle anti-injection. */
const CHECK_DEBOUNCE_MS = 800

/** Encart global d'erreur d'enregistrement. */
interface FormError {
  message: string
  /** 503 : la config n'a PAS été enregistrée, rien n'a changé côté serveur. */
  notSaved?: boolean
}

/** Infraction personnalisée (ou barème) refusée par le PUT. */
interface FaultyInfraction {
  /** `null` quand l'erreur ne vise aucune entrée précise (ex. trop d'infractions). */
  id: string | null
  message: string
  tab: Extract<AutomodTabId, "infractions" | "scale">
}

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
 * - « Fonctionnalité inconnue », « Catégorie inconnue », « Option de profil
 *   invalide », « Barème personnalisé invalide », « Infractions personnalisées
 *   invalides » → encart global, rien dans le formulaire ne les pilote ;
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
  if (
    /fonctionnalit[ée] inconnue|cat[ée]gorie inconnue|unknown (feature|category)|option de profil|bar[èe]me|infractions? personnalis|custom infraction|profile option/i.test(
      message
    )
  ) {
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
  const { selectedGuildId } = useGuildContext()
  const [searchParams, setSearchParams] = useSearchParams()

  const [savedConfig, setSavedConfig] = useState<AutomodAiConfig | null>(null)
  const [draft, setDraft] = useState<AutomodAiConfig | null>(null)
  const [status, setStatus] = useState<AutomodAiStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  /** Erreur du PUT qui ne se rattache à aucun champ. */
  const [formError, setFormError] = useState<FormError | null>(null)
  /** Infraction personnalisée ou barème refusé par le PUT. */
  const [faulty, setFaulty] = useState<FaultyInfraction | null>(null)
  const [check, setCheck] = useState<CheckState>({ kind: "idle" })
  // TODO: l'assistant de configuration sera branché ici (ouverture seulement pour l'instant).
  const [wizardOpen, setWizardOpen] = useState(false)
  /** Ids d'infractions supprimés pendant la session : jamais réutilisés. */
  const usedInfractionIds = useRef<Set<string>>(new Set())

  const {
    catalog,
    loading: catalogLoading,
    error: catalogError,
    retry: retryCatalog,
  } = useAutomodCatalog(selectedGuildId)

  // L'onglet actif vit dans `?tab=` ; le brouillon, lui, est unique et partagé.
  const tabParam = searchParams.get("tab")
  const tab: AutomodTabId = AUTOMOD_TABS.includes(tabParam as AutomodTabId)
    ? (tabParam as AutomodTabId)
    : "settings"
  const setTab = useCallback(
    (next: string) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          if (next === "settings") params.delete("tab")
          else params.set("tab", next)
          return params
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const onOpenWizard = useCallback(() => {
    setWizardOpen(true)
  }, [])

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

  const updateDraft = useCallback((updater: (config: AutomodAiConfig) => AutomodAiConfig) => {
    setDraft((prev) => (prev ? updater(prev) : prev))
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

  const clearFieldError = useCallback((field: keyof FieldErrors) => {
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
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
    setFaulty(null)
    try {
      // On envoie l'objet complet issu de celui reçu : tout champ inconnu de
      // ce front est préservé.
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
        // Corps plat `{ error, code, infraction_id, index, sanction_key }` : la
        // phrase `error` est déjà affichable ; l'infraction fautive est retrouvée
        // par son id, à défaut par sa position dans la liste envoyée.
        const info = readAutomodErrorInfo(e)
        if (info) {
          const faultyId = resolveFaultyInfractionId(info, draft.infractions_perso ?? [])
          setFaulty({
            id: faultyId,
            message: e.message,
            tab: info.code.startsWith("sanction") ? "scale" : "infractions",
          })
        }
        // 503 : rien n'a été écrit — le contrôle (IA) est indisponible.
        if (e.isUnavailable) {
          setFormError({ message: e.message, notSaved: true })
          toast.error(t("modules.automod_ai.checkUnavailableTitle"), {
            description: t("modules.automod_ai.checkUnavailableSaveDescription"),
            action: { label: t("modules.automod_ai.retry"), onClick: () => void handleSave() },
          })
          return
        }
        if (info) {
          setFormError({ message: e.message })
        } else if (e.status === 422) {
          const mapped = mapValidationErrors(e)
          if (Object.keys(mapped).length > 0) {
            setFieldErrors(mapped)
          } else {
            const { fields, form } = mapStringError(
              e.message,
              draft.indications !== (savedConfig?.indications ?? "")
            )
            setFieldErrors(fields)
            setFormError(form ? { message: form } : null)
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
    setFaulty(null)
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
      setFaulty(null)
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

  const catalogProps = {
    catalog,
    loading: catalogLoading,
    error: catalogError,
    onRetry: retryCatalog,
  }

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
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadges status={status} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenWizard}
            disabled={readOnly}
            aria-haspopup="dialog"
            aria-expanded={wizardOpen}
          >
            <WandSparklesIcon data-icon="inline-start" />
            {t("modules.automod_ai.wizard.open")}
          </Button>
        </div>
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
          <AlertTitle>
            {t(formError.notSaved ? "modules.automod_ai.notSavedTitle" : "modules.automod_ai.formErrorTitle")}
          </AlertTitle>
          <AlertDescription>
            {formError.notSaved && <p>{t("modules.automod_ai.notSavedDescription")}</p>}
            <p>{formError.message}</p>
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="settings">{t("modules.automod_ai.tabs.settings")}</TabsTrigger>
            <TabsTrigger value="scale">
              {t("modules.automod_ai.tabs.scale")}
              {faulty?.tab === "scale" && <FaultyDot />}
            </TabsTrigger>
            <TabsTrigger value="infractions">
              {t("modules.automod_ai.tabs.infractions")}
              {faulty?.tab === "infractions" && <FaultyDot />}
            </TabsTrigger>
            <TabsTrigger value="profiles">{t("modules.automod_ai.tabs.profiles")}</TabsTrigger>
          </TabsList>
        </div>

        {/* En lecture seule, `disabled` sur le fieldset désactive tous les
            contrôles natifs d'un coup (Switch, Select, Checkbox, boutons). */}
        <fieldset disabled={readOnly} className="contents">
          <TabsContent value="settings" className="flex flex-col gap-6">
            <AutomodSettingsTab
              draft={draft}
              readOnly={readOnly}
              fieldErrors={fieldErrors}
              check={check}
              onPatch={patch}
              onPatchFeature={patchFeature}
              onPatchExemptions={patchExemptions}
              onClearFieldError={clearFieldError}
            />

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
          </TabsContent>

          <TabsContent value="scale">
            <AutomodScaleTab
              draft={draft}
              readOnly={readOnly}
              onUpdate={updateDraft}
              {...catalogProps}
            />
          </TabsContent>

          <TabsContent value="infractions">
            <AutomodCustomTab
              guildId={selectedGuildId ?? ""}
              draft={draft}
              savedConfig={savedConfig}
              onUpdate={updateDraft}
              usedIds={usedInfractionIds}
              faulty={faulty}
              onClearFaulty={() => setFaulty(null)}
              onOpenScale={() => setTab("scale")}
              {...catalogProps}
            />
          </TabsContent>
        </fieldset>

        {/* Lecture seule par nature : hors du fieldset, ses boutons restent actifs. */}
        <TabsContent value="profiles">
          {selectedGuildId && <AutomodProfileHoldsPanel guildId={String(selectedGuildId)} />}
        </TabsContent>
      </Tabs>

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

/** Pastille d'erreur sur un onglet dont le contenu a été refusé par le PUT. */
function FaultyDot() {
  const { t } = useTranslation()
  return (
    <span
      role="img"
      aria-label={t("modules.automod_ai.tabs.refused")}
      className="size-2 shrink-0 rounded-full bg-destructive"
    />
  )
}
