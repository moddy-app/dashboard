import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  CheckCircle2Icon,
  ClockIcon,
  LoaderIcon,
  PlusIcon,
  TicketIcon,
  Trash2Icon,
  XIcon,
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
import { CategoryDialog } from "@/components/tickets/category-dialog"
import { PanelCard } from "@/components/tickets/panel-card"
import { TicketExplorer } from "@/components/tickets/ticket-explorer"
import i18n from "@/i18n"
import { useGuildContext } from "@/contexts/GuildContext"
import { useSanctionGates } from "@/contexts/SanctionContext"
import { ApiError } from "@/lib/auth"
import { handleSaveError } from "@/lib/handle-error"
import { logger } from "@/lib/logger"
import { sanctionBlockedError } from "@/lib/sanctions"
import {
  canAddPanel,
  createTicketCategory,
  createTicketPanel,
  isSaveConflict,
  issuesByField,
  mapTicketsApiError,
  openTicketsForCategory,
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
import type { Ticket, TicketCategory, TicketPanel, TicketsLimits } from "@/types/api"

const MODULE_ID = "tickets"

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

function TicketsForm() {
  const { t } = useTranslation()
  const { selectedGuildId, channels, roles, syncModule } = useGuildContext()
  const gates = useSanctionGates(selectedGuildId)
  const guildId = selectedGuildId as string

  const [savedPanels, setSavedPanels] = useState<TicketPanel[] | null>(null)
  const [panels, setPanels] = useState<TicketPanel[]>([])
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
  const [openPanelId, setOpenPanelId] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ panelId: string; categoryId: string } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<
    { panelId: string; category: TicketCategory } | null
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
      setOpenPanelId(panel.id)
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
          setEditing({ panelId, categoryId: category.id })
          return { ...p, categories: [...p.categories, category] }
        })
      })
    },
    [t]
  )

  const removePanel = useCallback((panelId: string) => {
    setPanels((prev) => prev.filter((p) => p.id !== panelId))
  }, [])

  const removeCategory = useCallback((panelId: string, categoryId: string) => {
    setPanels((prev) =>
      prev.map((p) =>
        p.id === panelId
          ? { ...p, categories: p.categories.filter((c) => c.id !== categoryId) }
          : p
      )
    )
  }, [])

  // ── Validation ────────────────────────────────────────────────────────────

  const issues = useMemo(
    () => validateTicketsConfig(panels, { limits, channels }),
    [panels, limits, channels]
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
      JSON.stringify(serializeTicketsConfig(panels)) !==
      JSON.stringify(serializeTicketsConfig(savedPanels))
    )
  }, [panels, savedPanels])

  const openTicketCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const ticket of openTickets) {
      if (ticket.category_id) counts[ticket.category_id] = (counts[ticket.category_id] ?? 0) + 1
    }
    return counts
  }, [openTickets])

  // ── Sauvegarde ────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    // Une seule requête en vol : le backend n'en accepte qu'une par serveur, et
    // deux sauvegardes qui se croisent s'écrasent (last-writer-wins côté bot).
    if (savingRef.current) return

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
      return
    }

    savingRef.current = true
    setIsSaving(true)
    setConflict(false)
    setApiErrors({ fields: {}, global: [] })
    const sent = panels
    logger.event("module:tickets", "Save", { panels: sent.length })

    try {
      const { config, apply } = await saveTicketsConfig(guildId, sent)
      // La réponse porte les `message_id` frais : c'est elle le nouvel état.
      setSavedPanels(config.panels)
      setPanels(config.panels)
      setIsConfigured(true)
      // La vue d'ensemble et la sidebar lisent `modules` du contexte : sans
      // cette synchro elles resteraient sur l'état d'avant la sauvegarde.
      syncModule(MODULE_ID, { panels: config.panels })

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
        return
      }
      handleSaveError(e, { title: t("modules.saveError") })
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }, [guildId, panels, issues, isConfigured, gates, syncModule, loadSideData, t])

  const handleDiscard = useCallback(() => {
    if (!savedPanels) return
    setPanels(savedPanels)
    setApiErrors({ fields: {}, global: [] })
  }, [savedPanels])

  const handleDisable = useCallback(async () => {
    setIsDisabling(true)
    try {
      const apply = await deleteTicketsConfig(guildId)
      setSavedPanels([])
      setPanels([])
      setIsConfigured(false)
      setApiErrors({ fields: {}, global: [] })
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

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (loadError) {
    return <ErrorPage error={loadError} onRetry={() => window.location.reload()} />
  }

  if (isLoading || savedPanels === null) {
    return (
      <div className="flex w-full flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  const isActive = panels.some((p) => p.enabled && Boolean(p.channel_id))
  const editingPanel = editing ? panels.find((p) => p.id === editing.panelId) : undefined
  const editingCategory = editingPanel?.categories.find((c) => c.id === editing?.categoryId)

  return (
    <div className="flex w-full flex-col gap-6 pb-24">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950">
            <TicketIcon className="size-5 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-none">{t("modules.tickets.name")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("modules.tickets.description")}
            </p>
          </div>
        </div>
        {isActive ? (
          <Badge className="border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle2Icon className="mr-1 size-3" />
            {t("modules.tickets.statusActive")}
          </Badge>
        ) : (
          <Badge variant="secondary">
            <XIcon className="mr-1 size-3" />
            {t("modules.tickets.statusInactive")}
          </Badge>
        )}
      </div>

      {/* Tickets orphelins — supprimer une catégorie ne ferme pas ses tickets. */}
      {orphanCount > 0 && (
        <Notice level="warning" title={t("modules.tickets.orphans.title", { count: orphanCount })}>
          {t("modules.tickets.orphans.description")}
        </Notice>
      )}

      {/* Une sauvegarde est déjà en vol (peut-être depuis un autre onglet). */}
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

      {globalIssues.length > 0 && (
        <Notice level="error" title={t("modules.tickets.validation.title")}>
          <ul className="list-disc space-y-0.5 pl-4">
            {globalIssues.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Notice>
      )}

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">{t("modules.tickets.tabs.settings")}</TabsTrigger>
          <TabsTrigger value="tickets">{t("modules.tickets.tabs.tickets")}</TabsTrigger>
        </TabsList>

        {/* ── Configuration ────────────────────────────────────────────── */}
        <TabsContent value="settings" className="flex flex-col gap-4 pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {limits
                ? t("modules.tickets.panelQuota", {
                    count: panels.length,
                    max: limits.max_panels,
                  })
                : t("modules.tickets.panelQuotaUnknown")}
            </p>
            {limits && !limits.premium && (
              <Badge variant="secondary">{t("modules.tickets.freePlan")}</Badge>
            )}
          </div>

          {panels.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center">
              <TicketIcon className="size-6 text-muted-foreground" />
              <p className="text-sm font-medium">{t("modules.tickets.empty.title")}</p>
              <p className="text-xs text-muted-foreground">{t("modules.tickets.empty.description")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {panels.map((panel) => (
                <PanelCard
                  key={panel.id}
                  panel={panel}
                  guildId={guildId}
                  channels={channels}
                  limits={limits}
                  errors={fieldErrors}
                  isOpen={openPanelId === panel.id}
                  onToggle={(open) => setOpenPanelId(open ? panel.id : null)}
                  onChange={(changes) => patchPanel(panel.id, changes)}
                  onDelete={() => removePanel(panel.id)}
                  onAddCategory={() => addCategory(panel.id)}
                  onEditCategory={(category) =>
                    setEditing({ panelId: panel.id, categoryId: category.id })
                  }
                  onDeleteCategory={(category) =>
                    setPendingDelete({ panelId: panel.id, category })
                  }
                  openTicketCounts={openTicketCounts}
                />
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={addPanel}
              disabled={!canAddPanel(panels, limits)}
              className="w-fit"
            >
              <PlusIcon className="size-4" />
              {t("modules.tickets.addPanel")}
            </Button>
            {!canAddPanel(panels, limits) && limits && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t("modules.tickets.panelCapReached", { max: limits.max_panels })}
              </p>
            )}
          </div>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ClockIcon className="mt-0.5 size-3.5 shrink-0" />
            {t("modules.tickets.saveDurationHint")}
          </p>

          {isConfigured && (
            <Button
              type="button"
              variant="outline"
              className="w-fit text-destructive hover:text-destructive"
              onClick={() => setConfirmDisable(true)}
              disabled={isSaving || isDisabling}
            >
              {isDisabling ? (
                <LoaderIcon className="size-4 animate-spin" />
              ) : (
                <Trash2Icon className="size-4" />
              )}
              {t("modules.disable")}
            </Button>
          )}
        </TabsContent>

        {/* ── Tickets réels (lecture seule) ────────────────────────────── */}
        <TabsContent value="tickets" className="pt-4">
          <TicketExplorer guildId={guildId} panels={savedPanels} />
        </TabsContent>
      </Tabs>

      {editingPanel && editingCategory && (
        <CategoryDialog
          panel={editingPanel}
          category={editingCategory}
          guildId={guildId}
          channels={channels}
          roles={roles}
          errors={fieldErrors}
          onChange={(changes) => patchCategory(editingPanel.id, editingCategory.id, changes)}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Supprimer une catégorie ne ferme pas ses tickets ouverts : ils
          restent, et le bot répond « catégorie disparue » à toute action. */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("modules.tickets.category.confirmDeleteTitle", {
                name: pendingDelete?.category.name || pendingDelete?.category.id,
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete &&
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) removeCategory(pendingDelete.panelId, pendingDelete.category.id)
                setPendingDelete(null)
              }}
            >
              {t("modules.tickets.category.delete")}
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
