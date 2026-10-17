import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ErrorIcon, LockIcon } from "@/components/icons"
import { UnsavedBar } from "@/components/unsaved-bar"
import { ModulePage } from "@/components/module/module-page"
import { ModuleStateControl } from "@/components/module/module-state-control"
import { AutomodAdvancedTab } from "@/components/automod/advanced-tab"
import { AutomodExemptionsTab } from "@/components/automod/exemptions-tab"
import { AutomodMonitoringTab } from "@/components/automod/monitoring-tab"
import { AutomodSanctionsTab } from "@/components/automod/sanctions-tab"
import { AutomodSettingsTab } from "@/components/automod/settings-tab"
import { StatusWarnings } from "@/components/automod/status-display"
import {
  AUTOMOD_TABS,
  type AutomodTabId,
  type FieldErrors,
} from "@/components/automod/automod-form"
import { ErrorPage } from "@/components/error-state"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useGuildContext } from "@/contexts/GuildContext"
import { useAutomodCatalog } from "@/hooks/useAutomodCatalog"
import { useAutomodPolicies } from "@/hooks/useAutomodPolicies"
import { ApiError } from "@/lib/auth"
import { handleSaveError } from "@/lib/handle-error"
import { useSanctionGates, useSanctions } from "@/contexts/SanctionContext"
import { sanctionBlockedError } from "@/lib/sanctions"
import { logger } from "@/lib/logger"
import {
  applyAutomodPreset,
  applyExemptions,
  automodErrorKey,
  readAutomodErrorInfo,
  readModuleState,
  resolveFaultyInfractionId,
  stableStringify,
} from "@/lib/automod"
import {
  defaultAutomodConfig,
  deleteAutomodConfig,
  getAutomodConfig,
  getAutomodStatus,
  saveAutomodConfig,
} from "@/services/automod"
import type { AutomodAiConfig, AutomodAiStatus, AutomodCatalogPreset } from "@/types/api"

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
  tab: Extract<AutomodTabId, "sanctions">
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Comparaison indifférente à l'ordre des clés : retirer puis remettre une clé de
// `sanctions` la déplace en fin d'objet, ce qui afficherait sinon un faux
// « non enregistré » alors que le brouillon est revenu à l'état enregistré.
function isSameConfig(a: AutomodAiConfig, b: AutomodAiConfig): boolean {
  return stableStringify(a) === stableStringify(b)
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
 */
function mapStringError(message: string): {
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
  const { selectedGuildId, modules, syncModule } = useGuildContext()
  const [searchParams, setSearchParams] = useSearchParams()

  const [savedConfig, setSavedConfig] = useState<AutomodAiConfig | null>(null)
  const [draft, setDraft] = useState<AutomodAiConfig | null>(null)
  const [status, setStatus] = useState<AutomodAiStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  /** Erreur du PUT qui ne se rattache à aucun champ. */
  const [formError, setFormError] = useState<FormError | null>(null)
  /** Infraction personnalisée ou barème refusé par le PUT. */
  const [faulty, setFaulty] = useState<FaultyInfraction | null>(null)
  /** Ids d'infractions supprimés pendant la session : jamais réutilisés. */
  const usedInfractionIds = useRef<Set<string>>(new Set())

  const {
    catalog,
    loading: catalogLoading,
    error: catalogError,
    retry: retryCatalog,
  } = useAutomodCatalog(selectedGuildId)
  const { policies, reload: reloadPolicies } = useAutomodPolicies(selectedGuildId)

  // L'état (actif / simulation / pause) s'écrit depuis l'en-tête, hors brouillon :
  // on le recopie ici pour que ni la comparaison ni un PUT ne le contredisent.
  const configured = Boolean(modules.automod_ai)
  const ctxState = modules.automod_ai
    ? readModuleState((modules.automod_ai as { state?: unknown }).state)
    : undefined
  useEffect(() => {
    if (!ctxState) return
    const sync = (c: AutomodAiConfig | null) => (c && c.state !== ctxState ? { ...c, state: ctxState } : c)
    setSavedConfig(sync)
    setDraft(sync)
  }, [ctxState])

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

  // ── Mutations du brouillon ────────────────────────────────────────────────

  const patch = useCallback((changes: Partial<AutomodAiConfig>) => {
    setDraft((prev) => (prev ? { ...prev, ...changes } : prev))
  }, [])

  const updateDraft = useCallback((updater: (config: AutomodAiConfig) => AutomodAiConfig) => {
    setDraft((prev) => (prev ? updater(prev) : prev))
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

  // Le bouton « Réessayer » du toast 503 rappelle la DERNIÈRE version de
  // `handleSave` (brouillon à jour), pas la fermeture qui l'a affiché.
  const saveRef = useRef<() => Promise<void>>(async () => {})
  const handleSave = useCallback(async () => {
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

    logger.event("module:automod_ai", "Save", { state: draft.state ?? "active" })
    setIsSaving(true)
    setFieldErrors({})
    setFormError(null)
    setFaulty(null)
    try {
      // On envoie l'objet complet issu de celui reçu : tout champ inconnu de
      // ce front est préservé.
      // Un module déjà configuré garde l'état posé par l'en-tête : sans `state`
      // dans le corps, le backend conserve l'état enregistré.
      const body: AutomodAiConfig = { ...draft }
      if (configured) delete body.state
      const saved = await saveAutomodConfig(selectedGuildId, body)
      syncModule("automod_ai", { ...saved })
      setSavedConfig(saved)
      setDraft(structuredClone(saved))
      toast.success(t("modules.saved"))
      logger.success("module:automod_ai", "Saved")
      await loadStatus()
      reloadPolicies()
    } catch (e) {
      logger.error("module:automod_ai", "Save failed", e)
      if (e instanceof ApiError) {
        // Corps plat `{ error, code, infraction_id, index, sanction_key }` : la
        // phrase `error` est déjà affichable ; l'infraction fautive est retrouvée
        // par son id, à défaut par sa position dans la liste envoyée.
        const info = readAutomodErrorInfo(e)
        // Codes connus (barème, état, serveur sanctionné) : message traduit.
        const knownKey = automodErrorKey(e)
        const knownMessage = knownKey ? t(`modules.automod_ai.errors.${knownKey}`) : null
        if (knownMessage) {
          setFormError({ message: knownMessage })
          if (knownKey?.startsWith("sanctions_")) {
            setFaulty({ id: info?.sanctionKey ?? info?.infractionId ?? null, message: knownMessage, tab: "sanctions" })
          }
        } else if (info) {
          const faultyId = resolveFaultyInfractionId(info, draft.infractions_perso ?? [])
          setFaulty({
            id: faultyId,
            message: e.message,
            tab: "sanctions",
          })
        }
        // 503 : rien n'a été écrit — le contrôle (IA) est indisponible.
        if (e.isUnavailable) {
          setFormError({ message: e.message, notSaved: true })
          toast.error(t("modules.automod_ai.checkUnavailableTitle"), {
            description: t("modules.automod_ai.checkUnavailableSaveDescription"),
            action: { label: t("modules.automod_ai.retry"), onClick: () => void saveRef.current() },
          })
          return
        }
        if (knownMessage) {
          // déjà posé plus haut
        } else if (info) {
          setFormError({ message: e.message })
        } else if (e.status === 422) {
          const mapped = mapValidationErrors(e)
          if (Object.keys(mapped).length > 0) {
            setFieldErrors(mapped)
          } else {
            const { fields, form } = mapStringError(e.message)
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
  }, [selectedGuildId, draft, t, loadStatus, reloadPolicies, gates, configured, syncModule])

  useEffect(() => {
    saveRef.current = handleSave
  }, [handleSave])

  const handleDiscard = useCallback(() => {
    if (!savedConfig) return
    logger.event("module:automod_ai", "Discard")
    setDraft(structuredClone(savedConfig))
    setFieldErrors({})
    setFormError(null)
    setFaulty(null)
  }, [savedConfig])

  // Réinitialisation depuis le menu de l'en-tête (qui porte sa propre confirmation).
  const handleReset = useCallback(async () => {
    if (!selectedGuildId) return
    logger.event("module:automod_ai", "Reset config")
    await deleteAutomodConfig(selectedGuildId)
    const fresh = defaultAutomodConfig()
    syncModule("automod_ai", null)
    setSavedConfig(fresh)
    setDraft(structuredClone(fresh))
    setFieldErrors({})
    setFormError(null)
    setFaulty(null)
    logger.success("module:automod_ai", "Config reset")
    await loadStatus()
    reloadPolicies()
  }, [selectedGuildId, loadStatus, reloadPolicies, syncModule])

  /** Un niveau est un point de départ : il remplit le brouillon, sans enregistrer. */
  const handleApplyPreset = useCallback(
    (preset: AutomodCatalogPreset) => {
      setDraft((prev) =>
        prev
          ? applyAutomodPreset(prev, preset, catalog?.presets ?? [], {
              notifyChannelId: prev.notify_channel_id,
              // Module existant : son état ne bouge pas. Nouveau : on démarre en simulation.
              state: configured ? readModuleState(prev.state) : "simulation",
            })
          : prev
      )
      toast.success(t("modules.automod_ai.levelApplied"))
    },
    [catalog, configured, t]
  )

  // ── Rendu ─────────────────────────────────────────────────────────────────

  const content = draft ? (
    <>
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
          <ErrorIcon />
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
            <TabsTrigger value="monitoring">{t("modules.automod_ai.tabs.monitoring")}</TabsTrigger>
            <TabsTrigger value="sanctions">
              {t("modules.automod_ai.tabs.sanctions")}
              {faulty?.tab === "sanctions" && <FaultyDot />}
            </TabsTrigger>
            <TabsTrigger value="exemptions">{t("modules.automod_ai.tabs.exemptions")}</TabsTrigger>
            <TabsTrigger value="advanced">{t("modules.automod_ai.tabs.advanced")}</TabsTrigger>
          </TabsList>
        </div>

        {/* En lecture seule, `disabled` sur le fieldset désactive tous les
            contrôles natifs d'un coup (Switch, Select, Checkbox, boutons). */}
        <fieldset disabled={readOnly} className="contents">
          <TabsContent value="settings">
            <AutomodSettingsTab
              draft={draft}
              catalog={catalog}
              catalogLoading={catalogLoading}
              fieldErrors={fieldErrors}
              onPatch={patch}
              onApplyPreset={handleApplyPreset}
              onClearFieldError={clearFieldError}
            />
          </TabsContent>

          <TabsContent value="monitoring">
            <AutomodMonitoringTab draft={draft} catalog={catalog} onUpdate={updateDraft} />
          </TabsContent>

          <TabsContent value="sanctions">
            <AutomodSanctionsTab
              guildId={selectedGuildId ?? ""}
              draft={draft}
              savedConfig={savedConfig}
              catalog={catalog}
              loading={catalogLoading}
              error={catalogError}
              onRetry={retryCatalog}
              onUpdate={updateDraft}
              policies={policies}
              readOnly={readOnly}
              usedIds={usedInfractionIds}
              faulty={faulty}
              onClearFaulty={() => setFaulty(null)}
            />
          </TabsContent>

          <TabsContent value="exemptions">
            <AutomodExemptionsTab
              draft={draft}
              readOnly={readOnly}
              fieldErrors={fieldErrors}
              onPatch={patch}
              onPatchExemptions={patchExemptions}
            />
          </TabsContent>

          <TabsContent value="advanced">
            <AutomodAdvancedTab draft={draft} fieldErrors={fieldErrors} onPatch={patch} />
          </TabsContent>
        </fieldset>
      </Tabs>

      <UnsavedBar
        isDirty={isDirty && !readOnly}
        isSaving={isSaving}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </>
  ) : null

  return (
    <ModulePage
      moduleId="automod_ai"
      loading={isLoading || !draft}
      error={loadError}
      onRetry={() => window.location.reload()}
      actions={<ModuleStateControl moduleId="automod_ai" onReset={handleReset} />}
    >
      {content}
    </ModulePage>
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
