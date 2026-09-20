import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  LayoutPanelTopIcon,
  LoaderIcon,
  SettingsIcon,
  StarIcon,
  TicketIcon,
  Trash2Icon,
} from "lucide-react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorPage } from "@/components/error-state"
import { UnsavedBar } from "@/components/unsaved-bar"
import { ApplyNotice, Notice } from "@/components/tickets/fields"
import { CategoryEditor } from "@/components/tickets/category-editor"
import { ModuleHome } from "@/components/tickets/module-home"
import { PanelEditor } from "@/components/tickets/panel-editor"
import { RatingsPanel } from "@/components/tickets/ratings-panel"
import { TicketExplorer } from "@/components/tickets/ticket-explorer"
import { TicketsSettingsPanel } from "@/components/tickets/settings-panel"
import i18n from "@/i18n"
import { useGuildContext } from "@/contexts/GuildContext"
import { useSanctionGates } from "@/contexts/SanctionContext"
import { ApiError } from "@/lib/auth"
import { handleSaveError } from "@/lib/handle-error"
import { logger } from "@/lib/logger"
import { setModuleCrumbs } from "@/lib/module-breadcrumb"
import { sanctionBlockedError } from "@/lib/sanctions"
import { cn } from "@/lib/utils"
import {
  createTicketCategory,
  createTicketPanel,
  isSaveConflict,
  issuesByField,
  mapTicketsApiError,
  openTicketsForCategory,
  retentionShrinks,
  serializeTicketsConfig,
  ticketsApplyFeedback,
  validateTicketsConfig,
} from "@/lib/tickets"
import type { TicketsApplyFeedback } from "@/lib/tickets"
import {
  deleteTicketsConfig,
  getOrphanTickets,
  getTickets,
  getTicketsConfig,
  getTicketsLimits,
  saveTicketsConfig,
} from "@/services/tickets"
import { TICKET_SETTINGS_DEFAULTS } from "@/types/api"
import type {
  Ticket,
  TicketCategory,
  TicketPanel,
  TicketsLimits,
  TicketsSettings,
} from "@/types/api"

const MODULE_ID = "tickets"

/**
 * La configuration se parcourt en **deux écrans** — module (liste des panneaux)
 * puis panneau —, une catégorie s'éditant dans une modale à onglets posée sur
 * son panneau. Tout partage un seul brouillon et une seule sauvegarde : la
 * config tickets reste un document unique.
 *
 * La navigation entre niveaux est **locale, jamais routée** : `UnsavedBar` pose
 * un `useBlocker` sur les changements d'URL, une route par niveau ferait donc
 * surgir l'avertissement « modifications non enregistrées » à chaque descente.
 */
type View = { level: "home" } | { level: "panel"; panelId: string }

/**
 * Garde de chargement : le formulaire attend les salons et les rôles du serveur.
 * Sans ça, une arrivée directe sur l'URL monte des sélecteurs vides.
 */
export function TicketsPage() {
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

  return <TicketsForm />
}

/** Fait défiler jusqu'au champ fautif après un blocage local ou un 422. */
function scrollToField(fieldId: string) {
  // Un double `requestAnimationFrame` laisse le temps à React de committer un
  // éventuel changement d'état (ouvrir le panneau fautif) avant de chercher le
  // nœud dans le DOM — un seul passage arrive parfois trop tôt.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById(fieldId)?.scrollIntoView({ behavior: "smooth", block: "center" })
    })
  })
}

function TicketsForm() {
  const { t } = useTranslation()
  const { selectedGuildId, channels, roles, syncModule } = useGuildContext()
  const gates = useSanctionGates(selectedGuildId)
  const guildId = selectedGuildId as string

  const [savedPanels, setSavedPanels] = useState<TicketPanel[] | null>(null)
  const [panels, setPanels] = useState<TicketPanel[]>([])
  // Les réglages vivent dans **le même document** que les panneaux : un seul
  // brouillon, une seule écriture, un seul bouton « enregistrer ».
  const [savedSettings, setSavedSettings] = useState<TicketsSettings>(TICKET_SETTINGS_DEFAULTS)
  const [settings, setSettings] = useState<TicketsSettings>(TICKET_SETTINGS_DEFAULTS)
  /** Abaisser la rétention efface des conversations : on le fait confirmer. */
  const [confirmRetention, setConfirmRetention] = useState(false)
  const [limits, setLimits] = useState<TicketsLimits | null>(null)
  const [orphanCount, setOrphanCount] = useState(0)
  /** Tickets ouverts — servent d'avertissement avant de supprimer une catégorie. */
  const [openTickets, setOpenTickets] = useState<Ticket[]>([])
  /** `false` tant que le serveur n'a jamais configuré le module (GET → 404). */
  const [isConfigured, setIsConfigured] = useState(false)

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDisabling, setIsDisabling] = useState(false)
  const [confirmDisable, setConfirmDisable] = useState(false)
  const [view, setView] = useState<View>({ level: "home" })
  /** Catégorie ouverte dans la modale, rattachée au panneau affiché. */
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<
    | { kind: "panel"; panel: TicketPanel }
    | { kind: "category"; panelId: string; category: TicketCategory }
    | null
  >(null)
  const [apiErrors, setApiErrors] = useState<{ fields: Record<string, string>; global: string[] }>({
    fields: {},
    global: [],
  })
  /** Dernier accusé du bot, affiché de façon persistante. */
  const [feedback, setFeedback] = useState<TicketsApplyFeedback | null>(null)
  /** Une sauvegarde est déjà en vol côté backend (409, verrou par serveur). */
  const [conflict, setConflict] = useState(false)

  /** Verrou local : une seule sauvegarde en vol, double-clic ignoré. */
  const savingRef = useRef(false)

  // ── Chargement ────────────────────────────────────────────────────────────

  const loadSideData = useCallback(async () => {
    // Aucune de ces routes n'est critique : la page reste utilisable sans.
    const [limitsResult, orphansResult, openResult] = await Promise.allSettled([
      getTicketsLimits(guildId),
      getOrphanTickets(guildId),
      getTickets(guildId, { status: "open", limit: 200 }),
    ])
    if (limitsResult.status === "fulfilled") setLimits(limitsResult.value)
    else logger.warn("module:tickets", "Limits failed", limitsResult.reason)
    if (orphansResult.status === "fulfilled") setOrphanCount(orphansResult.value.count)
    if (openResult.status === "fulfilled") setOpenTickets(openResult.value.tickets)
  }, [guildId])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const config = await getTicketsConfig(guildId)
        if (cancelled) return
        // 404 = jamais configuré → on part d'une liste vide, pas d'une erreur.
        setIsConfigured(config !== null)
        setSavedPanels(config?.panels ?? [])
        setPanels(config?.panels ?? [])
        setSavedSettings(config?.settings ?? TICKET_SETTINGS_DEFAULTS)
        setSettings(config?.settings ?? TICKET_SETTINGS_DEFAULTS)
      } catch (e) {
        if (cancelled) return
        logger.error("module:tickets", "Load failed", e)
        setLoadError(e instanceof Error ? e.message : "Failed to load module config")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
      if (!cancelled) await loadSideData()
    }

    load()
    return () => {
      cancelled = true
    }
  }, [guildId, loadSideData])

  // ── Brouillon ─────────────────────────────────────────────────────────────

  const patchPanel = useCallback((panelId: string, changes: Partial<TicketPanel>) => {
    setPanels((prev) => prev.map((p) => (p.id === panelId ? { ...p, ...changes } : p)))
  }, [])

  const patchCategory = useCallback(
    (panelId: string, categoryId: string, changes: Partial<TicketCategory>) => {
      setPanels((prev) =>
        prev.map((p) =>
          p.id === panelId
            ? {
                ...p,
                categories: p.categories.map((c) =>
                  c.id === categoryId ? { ...c, ...changes } : c
                ),
              }
            : p
        )
      )
    },
    []
  )

  const addPanel = useCallback(() => {
    setPanels((prev) => {
      const panel = createTicketPanel(
        t("modules.tickets.panel.defaultName", { index: prev.length + 1 }),
        prev
      )
      // On descend directement dans le nouveau panneau : une ligne vide en
      // liste ne dit rien de ce qu'il reste à faire.
      setView({ level: "panel", panelId: panel.id })
      return [...prev, panel]
    })
  }, [t])

  const addCategory = useCallback(
    (panelId: string) => {
      setPanels((prev) => {
        const takenIds = prev.flatMap((p) => p.categories.map((c) => c.id))
        return prev.map((p) => {
          if (p.id !== panelId) return p
          const category = createTicketCategory(
            t("modules.tickets.category.defaultName", { index: p.categories.length + 1 }),
            takenIds
          )
          setEditingCategoryId(category.id)
          return { ...p, categories: [...p.categories, category] }
        })
      })
    },
    [t]
  )

  const removePanel = useCallback((panelId: string) => {
    setPanels((prev) => prev.filter((p) => p.id !== panelId))
    setEditingCategoryId(null)
    setView({ level: "home" })
  }, [])

  const removeCategory = useCallback((panelId: string, categoryId: string) => {
    setPanels((prev) =>
      prev.map((p) =>
        p.id === panelId
          ? { ...p, categories: p.categories.filter((c) => c.id !== categoryId) }
          : p
      )
    )
    setEditingCategoryId(null)
  }, [])

  // ── Validation ────────────────────────────────────────────────────────────

  const issues = useMemo(
    () => validateTicketsConfig(panels, { limits, channels, settings }),
    [panels, limits, channels, settings]
  )

  const fieldErrors = useMemo(() => {
    const map: Record<string, string> = {}
    for (const [field, issue] of issuesByField(issues)) {
      map[field] = t(issue.key, issue.params)
    }
    // Le message du backend l'emporte : il est plus précis que le nôtre.
    return { ...map, ...apiErrors.fields }
  }, [issues, apiErrors.fields, t])

  const globalIssues = useMemo(
    () => [
      ...issues.filter((i) => i.field === null).map((i) => t(i.key, i.params)),
      ...apiErrors.global,
    ],
    [issues, apiErrors.global, t]
  )

  const isDirty = useMemo(() => {
    if (!savedPanels) return false
    return (
      JSON.stringify(serializeTicketsConfig(panels, settings)) !==
      JSON.stringify(serializeTicketsConfig(savedPanels, savedSettings))
    )
  }, [panels, settings, savedPanels, savedSettings])

  const openTicketCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const ticket of openTickets) {
      if (ticket.category_id) counts[ticket.category_id] = (counts[ticket.category_id] ?? 0) + 1
    }
    return counts
  }, [openTickets])

  // ── Sauvegarde ────────────────────────────────────────────────────────────

  /**
   * Amène un champ fautif à l'écran : le champ vit peut-être deux niveaux plus
   * bas, il faut donc ouvrir son panneau (ou sa catégorie) avant de défiler.
   */
  const revealField = useCallback((field: string | null | undefined) => {
    if (!field) return
    const match = /^p:([^.]+)(?:\.c:([^.]+))?/.exec(field)
    if (match) {
      setView({ level: "panel", panelId: match[1] })
      setEditingCategoryId(match[2] ?? null)
    }
    scrollToField(field)
  }, [])

  const handleSave = useCallback(async () => {
    // Une seule requête en vol : le backend n'en accepte qu'une par serveur, et
    // deux sauvegardes qui se croisent s'écrasent (last-writer-wins côté bot).
    if (savingRef.current) return

    setConfirmRetention(false)

    // Sous sanction, activer un module *jamais configuré* est refusé. On le dit
    // ici plutôt que d'attendre le 403 : le message est le même, mais la
    // sauvegarde (plusieurs secondes) n'est pas lancée pour rien.
    if (!isConfigured && !gates.canEnableNewModule) {
      handleSaveError(sanctionBlockedError("new_module_blocked", gates.effective), {
        title: t("modules.saveError"),
      })
      return
    }

    // Les refus certains sont bloqués ici : le 422 est le filet, pas l'UX. Un
    // panneau sans salon, lui, reste un brouillon parfaitement enregistrable.
    if (issues.length > 0) {
      toast.error(t("modules.saveError"), {
        description: t("modules.tickets.validation.blocked", { count: issues.length }),
      })
      // Fait apparaître (ouvre le panneau au besoin) puis défile jusqu'au
      // premier champ fautif — sans quoi le blocage n'a aucun visage.
      revealField(issues.find((i) => i.field)?.field)
      return
    }

    savingRef.current = true
    setIsSaving(true)
    setConflict(false)
    setApiErrors({ fields: {}, global: [] })
    const sent = panels
    logger.event("module:tickets", "Save", { panels: sent.length })

    try {
      const { config, apply } = await saveTicketsConfig(guildId, sent, settings)
      // La réponse porte les `message_id` frais : c'est elle le nouvel état.
      setSavedPanels(config.panels)
      setPanels(config.panels)
      setSavedSettings(config.settings)
      setSettings(config.settings)
      setIsConfigured(true)
      // La vue d'ensemble et la sidebar lisent `modules` du contexte : sans
      // cette synchro elles resteraient sur l'état d'avant la sauvegarde.
      syncModule(MODULE_ID, { panels: config.panels, settings: config.settings })

      // Un 200 ne veut pas dire que Discord a suivi — l'accusé du bot décide.
      const result = ticketsApplyFeedback(apply)
      setFeedback(result)
      notify(result)
      logger.success("module:tickets", "Saved", { level: result.level })

      // Les compteurs de quota et les orphelins ont bougé.
      await loadSideData()
    } catch (e) {
      logger.error("module:tickets", "Save failed", e)
      if (isSaveConflict(e)) {
        // Ne jamais retenter en boucle : une sauvegarde est déjà en vol,
        // peut-être depuis un autre onglet.
        setConflict(true)
        return
      }
      if (e instanceof ApiError && e.status === 422) {
        const mapped = mapTicketsApiError(e, sent)
        setApiErrors(mapped)
        toast.error(t("modules.saveError"), {
          description: mapped.global[0] ?? t("modules.tickets.validation.fieldErrors"),
        })
        revealField(Object.keys(mapped.fields)[0])
        return
      }
      handleSaveError(e, { title: t("modules.saveError") })
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }, [guildId, panels, settings, issues, isConfigured, gates, syncModule, loadSideData, revealField, t])

  /**
   * Point d'entrée du bouton « enregistrer ». Abaisser `transcript_retention_days`
   * fait **supprimer des conversations** par le bot à sa prochaine purge, et ce
   * n'est pas réversible : on ne l'écrit jamais sans un oui explicite.
   */
  const requestSave = useCallback(() => {
    if (retentionShrinks(savedSettings.transcript_retention_days, settings.transcript_retention_days)) {
      setConfirmRetention(true)
      return
    }
    handleSave()
  }, [savedSettings.transcript_retention_days, settings.transcript_retention_days, handleSave])

  const handleDiscard = useCallback(() => {
    if (!savedPanels) return
    setPanels(savedPanels)
    setSettings(savedSettings)
    setApiErrors({ fields: {}, global: [] })
  }, [savedPanels, savedSettings])

  const handleDisable = useCallback(async () => {
    setIsDisabling(true)
    try {
      const apply = await deleteTicketsConfig(guildId)
      setSavedPanels([])
      setPanels([])
      setSavedSettings(TICKET_SETTINGS_DEFAULTS)
      setSettings(TICKET_SETTINGS_DEFAULTS)
      setIsConfigured(false)
      setApiErrors({ fields: {}, global: [] })
      setView({ level: "home" })
      syncModule(MODULE_ID, null)
      const result = ticketsApplyFeedback(apply)
      setFeedback(result)
      notify(result)
      await loadSideData()
    } catch (e) {
      logger.error("module:tickets", "Disable failed", e)
      handleSaveError(e, { title: t("modules.saveError") })
    } finally {
      setIsDisabling(false)
      setConfirmDisable(false)
    }
  }, [guildId, syncModule, loadSideData, t])

  // Un panneau ou une catégorie supprimé ailleurs ramène au niveau du dessus.
  const activePanelId = view.level === "home" ? null : view.panelId
  const activePanel = activePanelId ? panels.find((p) => p.id === activePanelId) : undefined
  const activeCategory = editingCategoryId
    ? activePanel?.categories.find((c) => c.id === editingCategoryId)
    : undefined

  // ── Fil d'Ariane ──────────────────────────────────────────────────────────
  //
  // Les niveaux ne changent pas d'URL : sans ça, l'en-tête s'arrêterait à
  // « Tickets » alors qu'on édite une catégorie deux écrans plus bas.
  const panelName = activePanel?.name || t("modules.tickets.panel.untitled")
  const categoryName = activeCategory?.name || t("modules.tickets.category.untitled")

  useEffect(() => {
    if (view.level === "home" || !activePanelId) {
      setModuleCrumbs(null)
      return
    }
    setModuleCrumbs({
      onRoot: () => setView({ level: "home" }),
      // La catégorie ouverte est un segment de plus : la modale cache le
      // panneau, le fil d'Ariane est le seul endroit qui dit où l'on est.
      items: editingCategoryId
        ? [{ label: panelName, onSelect: () => setEditingCategoryId(null) }, { label: categoryName }]
        : [{ label: panelName }],
    })
  }, [view.level, activePanelId, editingCategoryId, panelName, categoryName])

  // Le fil d'Ariane appartient à l'écran : en quittant le module, il repart.
  useEffect(() => () => setModuleCrumbs(null), [])

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (loadError) {
    return <ErrorPage error={loadError} onRetry={() => window.location.reload()} />
  }

  if (isLoading || savedPanels === null) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  const isActive = panels.some((p) => p.enabled && Boolean(p.channel_id))

  const dialogs = (
    <>
      {/* Supprimer une catégorie ne ferme pas ses tickets ouverts : ils
          restent, et le bot répond « catégorie disparue » à toute action. */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDelete?.kind === "panel"
                ? t("modules.tickets.panel.confirmDeleteTitle", {
                    name: pendingDelete.panel.name || t("modules.tickets.panel.untitled"),
                  })
                : t("modules.tickets.category.confirmDeleteTitle", {
                    name: pendingDelete?.category.name || t("modules.tickets.category.untitled"),
                  })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.kind === "panel"
                ? t("modules.tickets.panel.confirmDeleteDescription")
                : pendingDelete &&
                    openTicketsForCategory(openTickets, pendingDelete.category.id).length > 0
                  ? t("modules.tickets.category.confirmDeleteOpen", {
                      count: openTicketsForCategory(openTickets, pendingDelete.category.id).length,
                    })
                  : t("modules.tickets.category.confirmDeleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("modules.tickets.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingDelete?.kind === "panel") removePanel(pendingDelete.panel.id)
                else if (pendingDelete)
                  removeCategory(pendingDelete.panelId, pendingDelete.category.id)
                setPendingDelete(null)
              }}
            >
              {t("modules.tickets.deleteAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDisable} onOpenChange={setConfirmDisable}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("modules.tickets.confirmDisableTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("modules.tickets.confirmDisableDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("modules.tickets.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDisable}>
              {t("modules.disable")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Baisser la rétention **supprime des conversations** : le bot efface, à
          sa prochaine purge quotidienne, toute archive fermée depuis plus de N
          jours. Ce n'est pas réversible — d'où un oui explicite, jamais un
          simple enregistrement. */}
      <AlertDialog open={confirmRetention} onOpenChange={setConfirmRetention}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("modules.tickets.settings.confirmRetentionTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("modules.tickets.settings.confirmRetentionDescription", {
                days: settings.transcript_retention_days,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("modules.tickets.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleSave}>
              {t("modules.tickets.settings.confirmRetentionAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <UnsavedBar
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={requestSave}
        onDiscard={handleDiscard}
      />
    </>
  )

  const notices = (
    <>
      {/* Les deux bandeaux qui portent sur la **dernière écriture** : un conflit
          409 et l'accusé du bot. Ils suivent quel que soit le niveau ouvert. */}
      {conflict && (
        <Notice
          level="warning"
          title={t("modules.tickets.conflict.title")}
          onDismiss={() => setConflict(false)}
          action={
            <Button size="sm" variant="outline" onClick={handleSave} disabled={isSaving}>
              {t("modules.tickets.conflict.retry")}
            </Button>
          }
        >
          {t("modules.tickets.conflict.description")}
        </Notice>
      )}

      {feedback && <ApplyNotice feedback={feedback} onDismiss={() => setFeedback(null)} />}
    </>
  )

  // La réponse du `PUT` **écrase** l'état local (elle porte les `message_id`
  // frais) : ce qui serait tapé pendant l'appel serait perdu en silence. On gèle
  // donc l'édition le temps de la requête.
  const frozen = {
    "aria-busy": isSaving,
    inert: isSaving ? true : undefined,
    className: cn("flex w-full flex-col gap-6", isSaving && "pointer-events-none opacity-60"),
  }

  // ── Niveau 1 : un panneau ───────────────────────────────────────────────
  if (view.level === "panel" && activePanel) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-24">
        {notices}
        <div {...frozen}>
          <PanelEditor
            panel={activePanel}
            guildId={guildId}
            channels={channels}
            limits={limits}
            errors={fieldErrors}
            onChange={(changes) => patchPanel(activePanel.id, changes)}
            onDelete={() => setPendingDelete({ kind: "panel", panel: activePanel })}
            onBack={() => setView({ level: "home" })}
            onOpenCategory={(category) => setEditingCategoryId(category.id)}
            onAddCategory={() => addCategory(activePanel.id)}
            onToggleCategory={(category, enabled) =>
              patchCategory(activePanel.id, category.id, { enabled })
            }
          />
        </div>
        {activeCategory && (
          <CategoryEditor
            panel={activePanel}
            category={activeCategory}
            guildId={guildId}
            channels={channels}
            roles={roles}
            errors={fieldErrors}
            openTickets={openTicketCounts[activeCategory.id] ?? 0}
            onChange={(changes) => patchCategory(activePanel.id, activeCategory.id, changes)}
            onDelete={() =>
              setPendingDelete({
                kind: "category",
                panelId: activePanel.id,
                category: activeCategory,
              })
            }
            onClose={() => setEditingCategoryId(null)}
          />
        )}
        {dialogs}
      </div>
    )
  }

  // ── Niveau 0 : le module ────────────────────────────────────────────────
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("modules.tickets.name")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("modules.tickets.description")}</p>
        </div>
        <Badge variant={isActive ? "default" : "secondary"}>
          {isActive ? t("modules.tickets.statusActive") : t("modules.tickets.statusInactive")}
        </Badge>
      </div>

      {notices}

      <Tabs defaultValue="panels">
        {/* Quatre onglets sur un petit écran : la liste défile pour elle seule
            plutôt que d'élargir la page. */}
        <div className="-mx-1 overflow-x-auto px-1 scrollbar-none">
          <TabsList>
            <TabsTrigger value="panels">
              <LayoutPanelTopIcon data-icon="inline-start" />
              {t("modules.tickets.tabs.panels")}
            </TabsTrigger>
            <TabsTrigger value="settings">
              <SettingsIcon data-icon="inline-start" />
              {t("modules.tickets.tabs.settings")}
            </TabsTrigger>
            <TabsTrigger value="tickets">
              <TicketIcon data-icon="inline-start" />
              {t("modules.tickets.tabs.tickets")}
            </TabsTrigger>
            <TabsTrigger value="ratings">
              <StarIcon data-icon="inline-start" />
              {t("modules.tickets.tabs.ratings")}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Panneaux ────────────────────────────────────────────────── */}
        <TabsContent value="panels" className="pt-6">
          <div {...frozen} className={cn(frozen.className, "gap-6")}>
            {/* Supprimer une catégorie ne ferme pas ses tickets : ils restent
                ouverts, et le bot répond « catégorie disparue » dedans. */}
            {orphanCount > 0 && (
              <Notice
                level="warning"
                title={t("modules.tickets.orphans.title", { count: orphanCount })}
              >
                {t("modules.tickets.orphans.description")}
              </Notice>
            )}

            {globalIssues.length > 0 && (
              <Notice level="error" title={t("modules.tickets.validation.title")}>
                <ul className="flex list-disc flex-col gap-0.5 pl-4">
                  {globalIssues.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </Notice>
            )}

            <ModuleHome
              panels={panels}
              channels={channels}
              limits={limits}
              onOpenPanel={(panel) => setView({ level: "panel", panelId: panel.id })}
              onAddPanel={addPanel}
              onTogglePanel={(panel, enabled) => patchPanel(panel.id, { enabled })}
            />

            {isConfigured && (
              <div className="border-t pt-6">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmDisable(true)}
                  disabled={isSaving || isDisabling}
                >
                  {isDisabling ? (
                    <LoaderIcon data-icon="inline-start" className="animate-spin" />
                  ) : (
                    <Trash2Icon data-icon="inline-start" />
                  )}
                  {t("modules.disable")}
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Réglages du module ──────────────────────────────────────── */}
        <TabsContent value="settings" className="pt-6">
          <div {...frozen} className={frozen.className}>
            <TabHeader
              title={t("modules.tickets.cards.settings.title")}
              description={t("modules.tickets.cards.settings.description")}
            />
            <TicketsSettingsPanel
              settings={settings}
              savedSettings={savedSettings}
              channels={channels}
              errors={fieldErrors}
              onChange={(changes) => setSettings((prev) => ({ ...prev, ...changes }))}
            />
          </div>
        </TabsContent>

        {/* ── Tickets réels + archives (lecture seule) ─────────────────── */}
        {/* Un seul onglet : un ticket fermé s'ouvre directement sur sa
            transcription, il n'y a plus d'onglet « Archives » séparé. */}
        <TabsContent value="tickets" className="flex flex-col gap-6 pt-6">
          <TabHeader
            title={t("modules.tickets.cards.tickets.title")}
            description={t("modules.tickets.cards.tickets.description")}
          />
          <TicketExplorer guildId={guildId} panels={savedPanels} settings={savedSettings} />
        </TabsContent>

        {/* ── Avis ─────────────────────────────────────────────────────── */}
        <TabsContent value="ratings" className="flex flex-col gap-6 pt-6">
          <TabHeader
            title={t("modules.tickets.cards.ratings.title")}
            description={t("modules.tickets.cards.ratings.description")}
          />
          <RatingsPanel guildId={guildId} panels={savedPanels} />
        </TabsContent>
      </Tabs>

      {dialogs}
    </div>
  )
}

/** Intitulé d'un onglet — un titre et une phrase, sans cadre autour. */
function TabHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

/** Toast correspondant à l'accusé du bot (le détail reste affiché sur la page). */
function notify(feedback: TicketsApplyFeedback) {
  const t = i18n.t.bind(i18n)
  const message = t(feedback.key, feedback.params)
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
