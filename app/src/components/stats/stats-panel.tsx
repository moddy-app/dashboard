import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatsAcquisitionTab } from "./stats-acquisition-tab"
import { StatsAiTab } from "./stats-ai-tab"
import { StatsExplorerTab } from "./stats-explorer-tab"
import { StatsHealthAlert } from "./stats-health-alert"
import { StatsLifecycleTab } from "./stats-lifecycle-tab"
import { StatsOverviewTab } from "./stats-overview-tab"
import { StatsError, StatsRangePicker, StatsSkeleton } from "./stats-primitives"
import { useStatsCatalog } from "@/hooks/useStatsCatalog"

/**
 * Panneau de statistiques internes (staff).
 *
 * La fenêtre de jours est tenue ici et partagée par tous les onglets : passer
 * de 7 à 90 jours dans la vue d'ensemble puis basculer sur l'acquisition doit
 * parler de la même période, sinon les chiffres ne se comparent plus.
 *
 * L'explorateur est le seul onglet à dépendre du catalogue : les autres
 * s'affichent même s'il n'a pas pu être chargé.
 */
export function StatsPanel() {
  const { t } = useTranslation()
  const [days, setDays] = useState(30)
  const catalog = useStatsCatalog()

  return (
    <div className="flex flex-col gap-6">
      {/* Ne s'affiche que si `ok: false` — le seul signal d'alerte de la page. */}
      <StatsHealthAlert />

      <Tabs defaultValue="overview" className="gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="overview">{t("stats.tabs.overview")}</TabsTrigger>
            <TabsTrigger value="acquisition">{t("stats.tabs.acquisition")}</TabsTrigger>
            <TabsTrigger value="lifecycle">{t("stats.tabs.lifecycle")}</TabsTrigger>
            <TabsTrigger value="metrics">{t("stats.tabs.metrics")}</TabsTrigger>
            <TabsTrigger value="ai">{t("stats.tabs.ai")}</TabsTrigger>
          </TabsList>
          <StatsRangePicker value={days} onChange={setDays} />
        </div>

        <TabsContent value="overview">
          <StatsOverviewTab days={days} />
        </TabsContent>
        <TabsContent value="acquisition">
          <StatsAcquisitionTab days={days} />
        </TabsContent>
        <TabsContent value="lifecycle">
          <StatsLifecycleTab days={days} />
        </TabsContent>
        <TabsContent value="metrics">
          {catalog.isLoading ? (
            <StatsSkeleton rows={3} />
          ) : catalog.error ? (
            <StatsError message={catalog.error} onRetry={catalog.reload} />
          ) : catalog.catalog ? (
            <StatsExplorerTab catalog={catalog.catalog} days={days} />
          ) : null}
        </TabsContent>
        <TabsContent value="ai">
          <StatsAiTab days={days} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
