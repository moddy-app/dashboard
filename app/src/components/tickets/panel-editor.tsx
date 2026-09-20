import { useTranslation } from "react-i18next"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { EmojiView } from "@/components/discord-emoji"
import { MessageEditor } from "@/components/message-editor"
import { ChannelPicker } from "@/components/discord-pickers"
import {
  List,
  NavRow,
  ScreenHeader,
  Section,
  SegmentedControl,
} from "@/components/tickets/primitives"
import {
  accentToHex,
  hexToAccent,
  panelCategoryCap,
  panelChannels,
  panelFieldKey,
} from "@/lib/tickets"
import { TICKET_PANEL_STYLES, TICKET_TEXT_LIMITS } from "@/types/api"
import type {
  Channel,
  TicketCategory,
  TicketPanel,
  TicketsLimits,
} from "@/types/api"

interface PanelEditorProps {
  panel: TicketPanel
  guildId: string
  channels: Channel[]
  limits: TicketsLimits | null
  errors: Record<string, string>
  onChange: (changes: Partial<TicketPanel>) => void
  onDelete: () => void
  onBack: () => void
  onOpenCategory: (category: TicketCategory) => void
  onAddCategory: () => void
  onToggleCategory: (category: TicketCategory, enabled: boolean) => void
}

/**
 * Deuxième niveau : un panneau. Ce qu'on y règle tient en trois questions — où
 * il est publié, ce qu'il raconte, et ce qu'il propose. Le détail d'une
 * catégorie appartient au niveau suivant.
 */
export function PanelEditor({
  panel,
  guildId,
  channels,
  limits,
  errors,
  onChange,
  onDelete,
  onBack,
  onOpenCategory,
  onAddCategory,
  onToggleCategory,
}: PanelEditorProps) {
  const { t } = useTranslation()
  // L'id d'un champ **est** sa clé d'erreur : c'est ce qui permet à la page de
  // faire défiler jusqu'au premier champ refusé par l'API.
  const pf = (field: string) => panelFieldKey(panel.id, field)
  const err = (field: string) => errors[pf(field)]
  const destinations = panelChannels(channels)
  // Recalculé à chaque rendu : repasser en boutons change le plafond Discord.
  const cap = panelCategoryCap(limits, panel.style)
  const isFull = panel.categories.length >= cap

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <ScreenHeader
        back={t("modules.tickets.name")}
        onBack={onBack}
        title={panel.name || t("modules.tickets.panel.untitled")}
        description={t("modules.tickets.panel.subtitle")}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {panel.enabled
                ? t("modules.tickets.panel.enabled")
                : t("modules.tickets.panel.disabled")}
            </span>
            <Switch
              checked={panel.enabled}
              onCheckedChange={(v) => onChange({ enabled: v })}
              aria-label={t("modules.tickets.panel.enabledLabel")}
            />
          </div>
        }
      />

      {/* ── 1. Publication ─────────────────────────────────────────────── */}
      <Section
        title={t("modules.tickets.panel.sections.publication")}
        description={t("modules.tickets.panel.sections.publicationHint")}
      >
        <FieldGroup className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={Boolean(err("name")) || undefined}>
            <FieldLabel htmlFor={pf("name")}>
              {t("modules.tickets.panel.name")}
            </FieldLabel>
            <Input
              id={pf("name")}
              value={panel.name}
              maxLength={TICKET_TEXT_LIMITS.name}
              aria-invalid={Boolean(err("name"))}
              onChange={(e) => onChange({ name: e.target.value })}
            />
            <FieldDescription>{t("modules.tickets.panel.nameDescription")}</FieldDescription>
            <FieldError errors={err("name") ? [{ message: err("name") }] : undefined} />
          </Field>

          <Field data-invalid={Boolean(err("channel_id")) || undefined}>
            <FieldLabel>{t("modules.tickets.panel.channel")}</FieldLabel>
            <ChannelPicker
              value={panel.channel_id}
              channels={destinations}
              onChange={(v) => onChange({ channel_id: v })}
              placeholder={t("modules.selectChannel")}
              clearLabel={t("modules.tickets.panel.noChannelOption")}
              invalid={Boolean(err("channel_id"))}
            />
            <FieldDescription>{t("modules.tickets.panel.channelDescription")}</FieldDescription>
            <FieldError errors={err("channel_id") ? [{ message: err("channel_id") }] : undefined} />
          </Field>
        </FieldGroup>
      </Section>


      {/* ── 2. Message publié ──────────────────────────────────────────── */}
      <Section
        title={t("modules.tickets.panel.sections.message")}
        description={t("modules.tickets.leaveEmptyForDefault")}
      >
        <FieldGroup className="gap-5">
          {/* Un titre court et une couleur : deux champs étroits, une ligne. */}
          <div className="flex flex-wrap items-start gap-5">
            <Field className="w-auto" data-invalid={Boolean(err("title")) || undefined}>
              <FieldLabel htmlFor={pf("title")}>{t("modules.tickets.panel.title")}</FieldLabel>
              <Input
                id={pf("title")}
                value={panel.title ?? ""}
                maxLength={TICKET_TEXT_LIMITS.title}
                // Le défaut du bot reste un placeholder : écrit en valeur, il
                // serait figé dans la config et dans une seule langue.
                placeholder={t("modules.tickets.panel.default_title")}
                aria-invalid={Boolean(err("title"))}
                onChange={(e) => onChange({ title: e.target.value || null })}
                className="w-72"
              />
              <FieldError errors={err("title") ? [{ message: err("title") }] : undefined} />
            </Field>

            <Field className="w-auto">
              <FieldLabel htmlFor={pf("accent_color")}>
                {t("modules.tickets.panel.accentColor")}
              </FieldLabel>
              <div className="flex items-center gap-2">
                <input
                  id={pf("accent_color")}
                  type="color"
                  value={accentToHex(panel.accent_color)}
                  onChange={(e) => onChange({ accent_color: hexToAccent(e.target.value) })}
                  className="color-field size-9 shrink-0 rounded-md border"
                />
                <Input
                  value={accentToHex(panel.accent_color)}
                  onChange={(e) => {
                    const parsed = hexToAccent(e.target.value)
                    if (parsed !== null) onChange({ accent_color: parsed })
                  }}
                  className="w-28 font-mono"
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

          <Field data-invalid={Boolean(err("description")) || undefined}>
            <FieldLabel>{t("modules.tickets.panel.description")}</FieldLabel>
            <MessageEditor
              value={panel.description ?? ""}
              onChange={(v) => onChange({ description: v === "" ? null : v })}
              guildId={guildId}
              maxLength={TICKET_TEXT_LIMITS.description}
              placeholder={t("modules.tickets.panel.default_description")}
              minHeight={120}
            />
            <FieldError errors={err("description") ? [{ message: err("description") }] : undefined} />
          </Field>

        </FieldGroup>
      </Section>


      {/* ── 3. Présentation des catégories ─────────────────────────────── */}
      <Section title={t("modules.tickets.panel.sections.layout")}>
        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel>{t("modules.tickets.panel.style")}</FieldLabel>
            <SegmentedControl
              value={panel.style}
              onChange={(style) => onChange({ style })}
              options={TICKET_PANEL_STYLES.map((style) => ({
                value: style,
                label: t(`modules.tickets.panel.styles.${style}`),
              }))}
            />
            <FieldDescription>
              {t(`modules.tickets.panel.styleHint.${panel.style}`, { max: cap })}
            </FieldDescription>
          </Field>

          {/* `placeholder` ne veut rien dire hors du style menu déroulant. */}
          {panel.style === "select" && (
            <Field data-invalid={Boolean(err("placeholder")) || undefined}>
              <FieldLabel htmlFor={pf("placeholder")}>
                {t("modules.tickets.panel.placeholder")}
              </FieldLabel>
              <Input
                id={pf("placeholder")}
                value={panel.placeholder ?? ""}
                maxLength={TICKET_TEXT_LIMITS.placeholder}
                aria-invalid={Boolean(err("placeholder"))}
                onChange={(e) => onChange({ placeholder: e.target.value || null })}
                className="max-w-sm"
              />
              <FieldDescription>
                {t("modules.tickets.panel.placeholderDescription")}
              </FieldDescription>
              <FieldError
                errors={err("placeholder") ? [{ message: err("placeholder") }] : undefined}
              />
            </Field>
          )}
        </FieldGroup>
      </Section>


      {/* ── 4. Catégories ──────────────────────────────────────────────── */}
      <Section
        title={t("modules.tickets.panel.categories")}
        description={t("modules.tickets.panel.categoriesHint")}
        actions={
          <span className="text-xs tabular-nums text-muted-foreground">
            {panel.categories.length} / {cap}
          </span>
        }
      >
        {panel.categories.length === 0 ? (
          <Empty className="border border-dashed py-10">
            <EmptyHeader>
              <EmptyTitle>{t("modules.tickets.panel.noCategories")}</EmptyTitle>
              <EmptyDescription>
                {t("modules.tickets.panel.noCategoriesHint")}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <List className="-mx-6 border-y">
            {panel.categories.map((category) => (
              <NavRow
                key={category.id}
                icon={
                  category.emoji ? (
                    <EmojiView value={category.emoji} className="text-base" />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {(category.name || "?").slice(0, 1).toUpperCase()}
                    </span>
                  )
                }
                title={
                  <>
                    <span className="truncate">
                      {category.name || t("modules.tickets.category.untitled")}
                    </span>
                    {!category.enabled && (
                      <Badge variant="secondary">{t("modules.tickets.panel.disabled")}</Badge>
                    )}
                  </>
                }
                subtitle={
                  channels.find((c) => c.id === category.discord_category_id)?.name ??
                  t("modules.tickets.category.noParentShort")
                }
                trailing={
                  <Switch
                    checked={category.enabled}
                    onCheckedChange={(v) => onToggleCategory(category, v)}
                    aria-label={t("modules.tickets.category.enabledLabel")}
                  />
                }
                onClick={() => onOpenCategory(category)}
              />
            ))}
          </List>
        )}

        {err("categories") && <p className="text-sm text-destructive">{err("categories")}</p>}

        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onAddCategory} disabled={isFull}>
            <PlusIcon data-icon="inline-start" />
            {t("modules.tickets.panel.addCategory")}
          </Button>
          {isFull && (
            <span className="text-xs text-muted-foreground">
              {t("modules.tickets.panel.categoryCapReached", { max: cap })}
            </span>
          )}
        </div>
      </Section>


      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2Icon data-icon="inline-start" />
          {t("modules.tickets.panel.delete")}
        </Button>
      </div>
    </div>
  )
}
