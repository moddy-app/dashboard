import { useTranslation } from "react-i18next"
import { ClockIcon, LoaderIcon, PlusIcon, TicketIcon, Trash2Icon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Notice } from "@/components/tickets/fields"
import { PanelCard } from "@/components/tickets/panel-card"
import { canAddPanel } from "@/lib/tickets"
import type { Channel, TicketCategory, TicketPanel, TicketsLimits } from "@/types/api"

interface PanelsTabProps {
  panels: TicketPanel[]
  guildId: string
  channels: Channel[]
  limits: TicketsLimits | null
  errors: Record<string, string>
  openPanelId: string | null
  onTogglePanel: (panelId: string, open: boolean) => void
  onChangePanel: (panelId: string, changes: Partial<TicketPanel>) => void
  onDeletePanel: (panelId: string) => void
  onAddPanel: () => void
  onAddCategory: (panelId: string) => void
  onEditCategory: (panelId: string, category: TicketCategory) => void
  onDeleteCategory: (panelId: string, category: TicketCategory) => void
  openTicketCounts: Record<string, number>
  /** Tickets encore ouverts mais dont la catégorie a disparu de la config. */
  orphanCount: number
  /** Problèmes de validation qui ne se rattachent à aucun champ précis. */
  globalIssues: string[]
  isConfigured: boolean
  isSaving: boolean
  isDisabling: boolean
  onRequestDisable: () => void
}

/**
 * Onglet « Panneaux » : c'est ici, et nulle part ailleurs, qu'on construit les
 * messages que le bot publie dans Discord. Extrait de `TicketsPage` pour que
 * la page reste un chef d'orchestre plutôt qu'un fichier de 800 lignes.
 */
export function PanelsTab({
  panels,
  guildId,
  channels,
  limits,
  errors,
  openPanelId,
  onTogglePanel,
  onChangePanel,
  onDeletePanel,
  onAddPanel,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  openTicketCounts,
  orphanCount,
  globalIssues,
  isConfigured,
  isSaving,
  isDisabling,
  onRequestDisable,
}: PanelsTabProps) {
  const { t } = useTranslation()
  const canAdd = canAddPanel(panels, limits)

  return (
    <div className="flex flex-col gap-4">
      {/* Tickets orphelins — supprimer une catégorie ne ferme pas ses tickets. */}
      {orphanCount > 0 && (
        <Notice level="warning" title={t("modules.tickets.orphans.title", { count: orphanCount })}>
          {t("modules.tickets.orphans.description")}
        </Notice>
      )}

      {/* Refus certains bloqués avant l'appel : le 422 reste le filet, pas l'UX. */}
      {globalIssues.length > 0 && (
        <Notice level="error" title={t("modules.tickets.validation.title")}>
          <ul className="flex list-disc flex-col gap-0.5 pl-4">
            {globalIssues.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Notice>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {limits
            ? t("modules.tickets.panelQuota", { count: panels.length, max: limits.max_panels })
            : t("modules.tickets.panelQuotaUnknown")}
        </p>
        {limits && !limits.premium && (
          <Badge variant="secondary">{t("modules.tickets.freePlan")}</Badge>
        )}
      </div>

      {panels.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TicketIcon />
            </EmptyMedia>
            <EmptyTitle>{t("modules.tickets.empty.title")}</EmptyTitle>
            <EmptyDescription>{t("modules.tickets.empty.description")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" onClick={onAddPanel} disabled={!canAdd}>
              <PlusIcon data-icon="inline-start" />
              {t("modules.tickets.addPanel")}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {panels.map((panel) => (
            <PanelCard
              key={panel.id}
              panel={panel}
              guildId={guildId}
              channels={channels}
              limits={limits}
              errors={errors}
              isOpen={openPanelId === panel.id}
              onToggle={(open) => onTogglePanel(panel.id, open)}
              onChange={(changes) => onChangePanel(panel.id, changes)}
              onDelete={() => onDeletePanel(panel.id)}
              onAddCategory={() => onAddCategory(panel.id)}
              onEditCategory={(category) => onEditCategory(panel.id, category)}
              onDeleteCategory={(category) => onDeleteCategory(panel.id, category)}
              openTicketCounts={openTicketCounts}
            />
          ))}
        </div>
      )}

      {/* Le bouton « Ajouter un panneau » vit dans l'en-tête de la Card (motif
          WelcomeChannelPage) — inutile de le répéter ici tant que la liste
          n'est pas vide. */}
      {panels.length > 0 && !canAdd && limits && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {t("modules.tickets.panelCapReached", { max: limits.max_panels })}
        </p>
      )}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ClockIcon className="mt-0.5 size-3.5 shrink-0" />
        {t("modules.tickets.saveDurationHint")}
      </p>

      {isConfigured && (
        <Button
          type="button"
          variant="outline"
          className="w-fit text-destructive hover:text-destructive"
          onClick={onRequestDisable}
          disabled={isSaving || isDisabling}
        >
          {isDisabling ? (
            <LoaderIcon data-icon="inline-start" className="animate-spin" />
          ) : (
            <Trash2Icon data-icon="inline-start" />
          )}
          {t("modules.disable")}
        </Button>
      )}
    </div>
  )
}
