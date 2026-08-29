import { useTranslation } from "react-i18next"
import {
  ChevronDownIcon,
  GripVerticalIcon,
  HashIcon,
  PlusIcon,
  SettingsIcon,
  Trash2Icon,
} from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MessageEditor } from "@/components/message-editor"
import { ChannelSelect, Field } from "@/components/tickets/fields"
import {
  accentToHex,
  categoryFieldKey,
  hexToAccent,
  panelCategoryCap,
  panelChannels,
  panelFieldKey,
} from "@/lib/tickets"
import { cn } from "@/lib/utils"
import { TICKET_PANEL_STYLES, TICKET_TEXT_LIMITS } from "@/types/api"
import type {
  Channel,
  TicketCategory,
  TicketPanel,
  TicketPanelStyle,
  TicketsLimits,
} from "@/types/api"

interface PanelCardProps {
  panel: TicketPanel
  /** Serveur courant — l'éditeur de message y charge les émojis personnalisés. */
  guildId: string
  channels: Channel[]
  limits: TicketsLimits | null
  errors: Record<string, string>
  isOpen: boolean
  onToggle: (open: boolean) => void
  onChange: (changes: Partial<TicketPanel>) => void
  onDelete: () => void
  onAddCategory: () => void
  onEditCategory: (category: TicketCategory) => void
  onDeleteCategory: (category: TicketCategory) => void
  /** Nombre de tickets ouverts par catégorie — sert d'avertissement en ligne. */
  openTicketCounts: Record<string, number>
}

export function PanelCard({
  panel,
  guildId,
  channels,
  limits,
  errors,
  isOpen,
  onToggle,
  onChange,
  onDelete,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  openTicketCounts,
}: PanelCardProps) {
  const { t } = useTranslation()
  const err = (field: string) => errors[panelFieldKey(panel.id, field)]
  // Ces champs sont facultatifs **parce que le bot les remplit** : son texte est
  // déjà traduit dans la langue du serveur et s'améliore d'une version à
  // l'autre. Un texte écrit à leur place est figé dans une seule langue — le
  // dire sous le champ, le placeholder seul ne l'explique pas.
  const leaveEmpty = t("modules.tickets.leaveEmptyForDefault")
  const destinations = panelChannels(channels)
  const channel = panel.channel_id ? channels.find((c) => c.id === panel.channel_id) : undefined
  // Le plafond effectif dépend du style : il est recalculé à chaque rendu, donc
  // repasser un panneau en `buttons` le met à jour immédiatement.
  const cap = panelCategoryCap(limits, panel.style)
  const isFull = panel.categories.length >= cap

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle} className="rounded-xl border bg-card">
      <div className="flex items-center gap-3 p-4">
        <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              !isOpen && "-rotate-90"
            )}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {panel.name || t("modules.tickets.panel.untitled")}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
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
            </p>
          </div>
        </CollapsibleTrigger>

        {!panel.enabled && (
          <Badge variant="secondary" className="shrink-0">
            {t("modules.tickets.panel.disabled")}
          </Badge>
        )}
        <Switch
          checked={panel.enabled}
          onCheckedChange={(v) => onChange({ enabled: v })}
          aria-label={t("modules.tickets.panel.enabledLabel")}
        />
      </div>

      <CollapsibleContent className="flex flex-col gap-5 border-t p-4">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label={t("modules.tickets.panel.name")}
            description={t("modules.tickets.panel.nameDescription")}
            error={err("name")}
            hint={`${panel.name.length} / ${TICKET_TEXT_LIMITS.name}`}
          >
            <Input
              value={panel.name}
              maxLength={TICKET_TEXT_LIMITS.name}
              onChange={(e) => onChange({ name: e.target.value })}
            />
          </Field>

          <Field
            label={t("modules.tickets.panel.channel")}
            description={t("modules.tickets.panel.channelDescription")}
            error={err("channel_id")}
          >
            <ChannelSelect
              value={panel.channel_id}
              channels={destinations}
              onChange={(v) => onChange({ channel_id: v })}
              placeholder={t("modules.selectChannel")}
              emptyLabel={t("modules.noChannels")}
              clearLabel={t("modules.tickets.panel.noChannelOption")}
            />
          </Field>
        </div>

        <Field
          label={t("modules.tickets.panel.title")}
          description={`${t("modules.tickets.panel.titleDescription")} ${leaveEmpty}`}
          error={err("title")}
          hint={`${panel.title?.length ?? 0} / ${TICKET_TEXT_LIMITS.title}`}
        >
          {/* Le défaut n'est affiché qu'en placeholder : c'est le texte du bot
              (copie de ses locales), l'écrire en valeur le figerait ici. */}
          <Input
            value={panel.title ?? ""}
            maxLength={TICKET_TEXT_LIMITS.title}
            placeholder={t("modules.tickets.panel.default_title")}
            onChange={(e) => onChange({ title: e.target.value || null })}
          />
        </Field>

        <Field
          label={t("modules.tickets.panel.description")}
          description={`${t("modules.tickets.panel.descriptionHint")} ${leaveEmpty}`}
          error={err("description")}
        >
          <MessageEditor
            value={panel.description ?? ""}
            onChange={(v) => onChange({ description: v === "" ? null : v })}
            guildId={guildId}
            maxLength={TICKET_TEXT_LIMITS.description}
            placeholder={t("modules.tickets.panel.default_description")}
            minHeight={120}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label={t("modules.tickets.panel.style")}
            description={t("modules.tickets.panel.styleDescription")}
            error={err("style")}
          >
            <Select
              value={panel.style}
              onValueChange={(v) => onChange({ style: v as TicketPanelStyle })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TICKET_PANEL_STYLES.map((style) => (
                  <SelectItem key={style} value={style}>
                    {t(`modules.tickets.panel.styles.${style}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label={t("modules.tickets.panel.accentColor")}
            description={t("modules.tickets.panel.accentColorDescription")}
            error={err("accent_color")}
          >
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={accentToHex(panel.accent_color)}
                onChange={(e) => onChange({ accent_color: hexToAccent(e.target.value) })}
                className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
              />
              <Input
                value={accentToHex(panel.accent_color)}
                onChange={(e) => {
                  const parsed = hexToAccent(e.target.value)
                  if (parsed !== null) onChange({ accent_color: parsed })
                }}
                className="font-mono"
              />
              {panel.accent_color !== null && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange({ accent_color: null })}
                >
                  {t("modules.tickets.panel.resetColor")}
                </Button>
              )}
            </div>
          </Field>
        </div>

        {/* `placeholder` n'existe que sur un menu déroulant. */}
        {panel.style === "select" && (
          <Field
            label={t("modules.tickets.panel.placeholder")}
            description={`${t("modules.tickets.panel.placeholderDescription")} ${leaveEmpty}`}
            error={err("placeholder")}
            hint={`${panel.placeholder?.length ?? 0} / ${TICKET_TEXT_LIMITS.placeholder}`}
          >
            <Input
              value={panel.placeholder ?? ""}
              maxLength={TICKET_TEXT_LIMITS.placeholder}
              onChange={(e) => onChange({ placeholder: e.target.value || null })}
            />
          </Field>
        )}

        {/* ── Catégories ──────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium">
              {t("modules.tickets.panel.categories")}
            </label>
            <span className="text-xs tabular-nums text-muted-foreground">
              {panel.categories.length} / {cap}
            </span>
          </div>

          {err("categories") && <p className="text-xs text-destructive">{err("categories")}</p>}

          {panel.categories.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              {t("modules.tickets.panel.noCategories")}
            </p>
          ) : (
            <div className="divide-y rounded-lg border">
              {panel.categories.map((category) => {
                const openCount = openTicketCounts[category.id] ?? 0
                const nameError = errors[categoryFieldKey(panel.id, category.id, "name")]
                return (
                  <div key={category.id} className="flex items-center gap-3 p-3">
                    <GripVerticalIcon className="size-4 shrink-0 text-muted-foreground/40" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                        {category.emoji && <span>{category.emoji}</span>}
                        {category.name || t("modules.tickets.category.untitled")}
                        {!category.enabled && (
                          <Badge variant="secondary" className="ml-1">
                            {t("modules.tickets.panel.disabled")}
                          </Badge>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {nameError ? (
                          <span className="text-destructive">{nameError}</span>
                        ) : openCount > 0 ? (
                          t("modules.tickets.category.openTickets", { count: openCount })
                        ) : (
                          t("modules.tickets.category.noOpenTickets")
                        )}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditCategory(category)}
                    >
                      <SettingsIcon className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => onDeleteCategory(category)}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={onAddCategory}
            disabled={isFull}
          >
            <PlusIcon className="size-4" />
            {t("modules.tickets.panel.addCategory")}
          </Button>
          {isFull && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t("modules.tickets.panel.categoryCapReached", { max: cap })}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            {t("modules.tickets.panel.idHint", { id: panel.id })}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2Icon className="size-4" />
            {t("modules.tickets.panel.delete")}
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
