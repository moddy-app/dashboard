import { useTranslation } from "react-i18next"
import { ChevronDownIcon, HashIcon, PlusIcon, SettingsIcon, Trash2Icon } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { FieldGroup, FieldSeparator } from "@/components/ui/field"
import { Empty, EmptyContent, EmptyTitle } from "@/components/ui/empty"
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

  // Un panneau replié cache ses champs fautifs : le nombre d'erreurs qu'il
  // porte (panneau + toutes ses catégories) doit rester visible sans l'ouvrir.
  const panelPrefix = `p:${panel.id}.`
  const errorCount = Object.keys(errors).filter((key) => key.startsWith(panelPrefix)).length

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
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="truncate text-sm font-semibold">
                  {panel.name || t("modules.tickets.panel.untitled")}
                </p>
              </TooltipTrigger>
              <TooltipContent>{t("modules.tickets.panel.idHint", { id: panel.id })}</TooltipContent>
            </Tooltip>
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

        {errorCount > 0 && (
          <Badge variant="destructive" className="shrink-0">
            {t("modules.tickets.panel.errorsCount", { count: errorCount })}
          </Badge>
        )}
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
        {/* ── Publication ─────────────────────────────────────────────── */}
        <FieldSeparator>{t("modules.tickets.panel.sections.publication")}</FieldSeparator>
        <FieldGroup>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={t("modules.tickets.panel.name")}
              description={t("modules.tickets.panel.nameDescription")}
              error={err("name")}
              fieldId={panelFieldKey(panel.id, "name")}
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
              fieldId={panelFieldKey(panel.id, "channel_id")}
            >
              <ChannelSelect
                value={panel.channel_id}
                channels={destinations}
                onChange={(v) => onChange({ channel_id: v })}
                placeholder={t("modules.selectChannel")}
                emptyLabel={t("modules.noChannels")}
                clearLabel={t("modules.tickets.panel.noChannelOption")}
                invalid={Boolean(err("channel_id"))}
              />
            </Field>
          </div>
        </FieldGroup>

        {/* ── Apparence ────────────────────────────────────────────────── */}
        <FieldSeparator>{t("modules.tickets.panel.sections.appearance")}</FieldSeparator>
        <FieldGroup>
          <Field
            label={t("modules.tickets.panel.title")}
            description={`${t("modules.tickets.panel.titleDescription")} ${leaveEmpty}`}
            error={err("title")}
            fieldId={panelFieldKey(panel.id, "title")}
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
            fieldId={panelFieldKey(panel.id, "description")}
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
              fieldId={panelFieldKey(panel.id, "style")}
            >
              <ToggleGroup
                type="single"
                variant="outline"
                value={panel.style}
                // Une valeur vide n'a pas de sens pour ce réglage : un clic sur
                // l'option déjà active désélectionne côté Radix, on l'ignore.
                onValueChange={(v) => v && onChange({ style: v as TicketPanelStyle })}
                className="w-full"
              >
                {TICKET_PANEL_STYLES.map((style) => (
                  <ToggleGroupItem key={style} value={style}>
                    {t(`modules.tickets.panel.styles.${style}`)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>

            <Field
              label={t("modules.tickets.panel.accentColor")}
              description={t("modules.tickets.panel.accentColorDescription")}
              error={err("accent_color")}
              fieldId={panelFieldKey(panel.id, "accent_color")}
            >
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  {/* Pas de composant couleur dans le registre : l'input natif
                      reste le plus simple. */}
                  <input
                    type="color"
                    value={accentToHex(panel.accent_color)}
                    onChange={(e) => onChange({ accent_color: hexToAccent(e.target.value) })}
                    className="size-6 shrink-0 cursor-pointer rounded-sm border-0 bg-transparent p-0"
                  />
                </InputGroupAddon>
                <InputGroupInput
                  value={accentToHex(panel.accent_color)}
                  onChange={(e) => {
                    const parsed = hexToAccent(e.target.value)
                    if (parsed !== null) onChange({ accent_color: parsed })
                  }}
                  className="font-mono"
                />
                <InputGroupAddon align="inline-end">
                  {/* Toujours rendu (juste désactivé) pour que la largeur du
                      champ ne saute pas selon l'état. */}
                  <InputGroupButton
                    type="button"
                    disabled={panel.accent_color === null}
                    onClick={() => onChange({ accent_color: null })}
                  >
                    {t("modules.tickets.panel.resetColor")}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </Field>
          </div>

          {/* `placeholder` n'existe que sur un menu déroulant. */}
          {panel.style === "select" && (
            <Field
              label={t("modules.tickets.panel.placeholder")}
              description={`${t("modules.tickets.panel.placeholderDescription")} ${leaveEmpty}`}
              error={err("placeholder")}
              fieldId={panelFieldKey(panel.id, "placeholder")}
              hint={`${panel.placeholder?.length ?? 0} / ${TICKET_TEXT_LIMITS.placeholder}`}
            >
              <Input
                value={panel.placeholder ?? ""}
                maxLength={TICKET_TEXT_LIMITS.placeholder}
                onChange={(e) => onChange({ placeholder: e.target.value || null })}
              />
            </Field>
          )}
        </FieldGroup>

        {/* ── Catégories ──────────────────────────────────────────────── */}
        <FieldSeparator>{t("modules.tickets.panel.sections.categories")}</FieldSeparator>
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
            <Empty className="border p-6">
              <EmptyTitle className="text-sm">{t("modules.tickets.panel.noCategories")}</EmptyTitle>
              <EmptyContent>
                <Button type="button" variant="outline" size="sm" onClick={onAddCategory} disabled={isFull}>
                  <PlusIcon data-icon="inline-start" />
                  {t("modules.tickets.panel.addCategory")}
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <>
              <div className="divide-y rounded-lg border">
                {panel.categories.map((category) => {
                  const openCount = openTicketCounts[category.id] ?? 0
                  const categoryPrefix = `p:${panel.id}.c:${category.id}.`
                  const categoryHasError = Object.keys(errors).some((key) =>
                    key.startsWith(categoryPrefix)
                  )
                  const nameError = errors[categoryFieldKey(panel.id, category.id, "name")]
                  return (
                    <div key={category.id} className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                          {category.emoji && <span>{category.emoji}</span>}
                          {category.name || t("modules.tickets.category.untitled")}
                          {!category.enabled && (
                            <Badge variant="secondary" className="ml-1">
                              {t("modules.tickets.panel.disabled")}
                            </Badge>
                          )}
                          {categoryHasError && (
                            <Badge variant="destructive" className="ml-1">
                              {t("modules.tickets.category.tabHasErrors")}
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("modules.tickets.category.edit")}
                            onClick={() => onEditCategory(category)}
                          >
                            <SettingsIcon />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("modules.tickets.category.edit")}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive"
                            aria-label={t("modules.tickets.category.delete")}
                            onClick={() => onDeleteCategory(category)}
                          >
                            <Trash2Icon />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("modules.tickets.category.delete")}</TooltipContent>
                      </Tooltip>
                    </div>
                  )
                })}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={onAddCategory}
                disabled={isFull}
              >
                <PlusIcon data-icon="inline-start" />
                {t("modules.tickets.panel.addCategory")}
              </Button>
            </>
          )}
          {isFull && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t("modules.tickets.panel.categoryCapReached", { max: cap })}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end border-t pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2Icon data-icon="inline-start" />
            {t("modules.tickets.panel.delete")}
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
