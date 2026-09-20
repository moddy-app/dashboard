import { useTranslation } from "react-i18next"
import { HashIcon, PlusIcon, TicketIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Switch } from "@/components/ui/switch"
import { List, NavRow, Section } from "@/components/tickets/primitives"
import { canAddPanel, panelCategoryCap } from "@/lib/tickets"
import type { Channel, TicketPanel, TicketsLimits } from "@/types/api"

interface ModuleHomeProps {
  panels: TicketPanel[]
  channels: Channel[]
  limits: TicketsLimits | null
  onOpenPanel: (panel: TicketPanel) => void
  onAddPanel: () => void
  onTogglePanel: (panel: TicketPanel, enabled: boolean) => void
}

/**
 * Premier niveau : la liste des panneaux. Rien d'autre — le réglage d'un
 * panneau et celui d'une catégorie ont leur propre écran, on ne les empile pas
 * ici.
 */
export function ModuleHome({
  panels,
  channels,
  limits,
  onOpenPanel,
  onAddPanel,
  onTogglePanel,
}: ModuleHomeProps) {
  const { t } = useTranslation()
  const canAdd = canAddPanel(panels, limits)

  if (panels.length === 0) {
    return (
      <Empty className="border border-dashed py-14">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TicketIcon />
          </EmptyMedia>
          <EmptyTitle>{t("modules.tickets.empty.title")}</EmptyTitle>
          <EmptyDescription>{t("modules.tickets.empty.description")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button type="button" onClick={onAddPanel}>
            <PlusIcon data-icon="inline-start" />
            {t("modules.tickets.addPanel")}
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <Section
      title={t("modules.tickets.panelsTitle")}
      description={t("modules.tickets.panelsHint")}
      actions={
        limits && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {panels.length} / {limits.max_panels}
          </span>
        )
      }
    >
      <List className="-mx-6 border-y">
        {panels.map((panel) => {
          const channel = panel.channel_id
            ? channels.find((c) => c.id === panel.channel_id)
            : undefined
          const cap = panelCategoryCap(limits, panel.style)
          return (
            <NavRow
              key={panel.id}
              title={
                <>
                  <span className="truncate">
                    {panel.name || t("modules.tickets.panel.untitled")}
                  </span>
                  {!panel.channel_id && (
                    <Badge variant="secondary">{t("modules.tickets.panel.draft")}</Badge>
                  )}
                </>
              }
              subtitle={
                <span className="flex items-center gap-1.5">
                  {channel ? (
                    <>
                      <HashIcon className="size-3 shrink-0" />
                      {channel.name}
                    </>
                  ) : (
                    t("modules.tickets.panel.noChannel")
                  )}
                  <span aria-hidden>·</span>
                  {t("modules.tickets.panel.categoryCount", {
                    count: panel.categories.length,
                    max: cap,
                  })}
                </span>
              }
              trailing={
                <Switch
                  checked={panel.enabled}
                  onCheckedChange={(v) => onTogglePanel(panel, v)}
                  aria-label={t("modules.tickets.panel.enabledLabel")}
                />
              }
              onClick={() => onOpenPanel(panel)}
            />
          )
        })}
      </List>

      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={onAddPanel} disabled={!canAdd}>
          <PlusIcon data-icon="inline-start" />
          {t("modules.tickets.addPanel")}
        </Button>
        {!canAdd && limits && (
          <span className="text-xs text-muted-foreground">
            {t("modules.tickets.panelCapReached", { max: limits.max_panels })}
          </span>
        )}
      </div>
    </Section>
  )
}
