import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  InfoIcon,
  MessageSquareIcon,
  PlusIcon,
  ShieldIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChannelPicker, RoleDot, RoleMultiPicker } from "@/components/discord-pickers"
import { EmojiPicker, EmojiView } from "@/components/discord-emoji"
import { MessageEditor } from "@/components/message-editor"
import { ServerLanguageNote } from "@/components/server-language-note"
import { List, Section, SegmentedControl, SwitchRow } from "@/components/tickets/primitives"
import { categoryFieldKey, discordCategories } from "@/lib/tickets"
import { cn } from "@/lib/utils"
import {
  TICKET_BUTTONS,
  TICKET_BUTTON_STYLES,
  TICKET_DEFAULT_BUTTONS,
  TICKET_OPEN_PER_USER,
  TICKET_PERMISSIONS,
  TICKET_PLACEHOLDERS,
  TICKET_TEXT_LIMITS,
  roleColorToHex,
} from "@/types/api"
import type {
  Channel,
  Role,
  TicketButton,
  TicketButtonStyle,
  TicketCategory,
  TicketPanel,
  TicketPermission,
} from "@/types/api"

/** Couleurs des quatre styles de bouton Discord. */
const DISCORD_BUTTON_COLORS: Record<TicketButtonStyle, string> = {
  primary: "#5865F2",
  secondary: "#4E5058",
  success: "#248046",
  danger: "#DA373C",
}

/** Couleur de repli d'un rôle inconnu — celle de Discord pour « pas de couleur ». */
const DEFAULT_ROLE_COLOR = "#99aab5"

interface CategoryEditorProps {
  panel: TicketPanel
  category: TicketCategory
  guildId: string
  channels: Channel[]
  roles: Role[]
  errors: Record<string, string>
  /** Tickets encore ouverts dans cette catégorie — avertissement de suppression. */
  openTickets: number
  onChange: (changes: Partial<TicketCategory>) => void
  onDelete: () => void
  /** Fermeture de la modale — le brouillon de la page a déjà tout reçu. */
  onClose: () => void
}

/**
 * Une catégorie : un bouton du panneau, et tout ce qui arrive quand un membre
 * clique dessus. Elle s'édite dans une **modale à onglets** posée sur son
 * panneau, plutôt que sur un écran de plus — on y entre pour un réglage précis
 * et on en ressort.
 *
 * Les changements partent **immédiatement** dans le brouillon de la page : rien
 * n'est écrit tant que la barre « enregistrer » ne l'est pas, un second niveau
 * de brouillon n'apporterait que de la confusion.
 */
export function CategoryEditor({
  panel,
  category,
  guildId,
  channels,
  roles,
  errors,
  openTickets,
  onChange,
  onDelete,
  onClose,
}: CategoryEditorProps) {
  const { t } = useTranslation()
  // L'id d'un champ **est** sa clé d'erreur : c'est ce qui permet à la page de
  // faire défiler jusqu'au premier champ refusé par l'API.
  const cf = (field: string) => categoryFieldKey(panel.id, category.id, field)
  const err = (field: string) => errors[cf(field)]
  const parents = discordCategories(channels)
  const assignableRoles = roles.filter((r) => r.name !== "@everyone")

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      {/* Grande modale : une catégorie porte quatre familles de réglages, les
          serrer dans une colonne étroite obligerait à défiler pour chacune. */}
      {/* `rounded-2xl` : le rayon par défaut d'un dialogue (`rounded-4xl`, 30 px)
          est dessiné pour une petite boîte centrée. Sur une modale pleine
          largeur dont l'en-tête est souligné, la courbe mange la ligne et laisse
          une bande vide au-dessus du titre. */}
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[85vh] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-3xl"
      >
        <DialogHeader className="border-b bg-background px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 truncate">
                {category.emoji && <EmojiView value={category.emoji} />}
                {category.name || t("modules.tickets.category.untitled")}
              </DialogTitle>
              <DialogDescription>{t("modules.tickets.category.subtitle")}</DialogDescription>
            </div>
            {/* Fermeture rendue ici plutôt qu'en absolu : le bouton par défaut
                se pose en `top-4 right-4`, donc au-dessus de l'interrupteur et
                décalé du titre. */}
            <div className="flex shrink-0 items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {category.enabled
                    ? t("modules.tickets.panel.enabled")
                    : t("modules.tickets.panel.disabled")}
                </span>
                <Switch
                  checked={category.enabled}
                  onCheckedChange={(v) => onChange({ enabled: v })}
                  aria-label={t("modules.tickets.category.enabledLabel")}
                />
              </div>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("modules.tickets.close")}
                >
                  <XIcon />
                </Button>
              </DialogClose>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="info" className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="border-b px-6 py-3">
            <TabsList>
              <TabsTrigger value="info">
                <InfoIcon data-icon="inline-start" />
                {t("modules.tickets.category.tabs.info")}
              </TabsTrigger>
              <TabsTrigger value="permissions">
                <ShieldIcon data-icon="inline-start" />
                {t("modules.tickets.category.tabs.permissions")}
              </TabsTrigger>
              <TabsTrigger value="messages">
                <MessageSquareIcon data-icon="inline-start" />
                {t("modules.tickets.category.tabs.messages")}
              </TabsTrigger>
              <TabsTrigger value="advanced">
                <SlidersHorizontalIcon data-icon="inline-start" />
                {t("modules.tickets.category.tabs.advanced")}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Une seule zone de défilement, celle du contenu de l'onglet :
              l'en-tête et la barre d'onglets restent en place. */}
          <div className="min-h-0 flex-1 overflow-y-auto bg-muted/40 px-6 py-5">
            {/* ── Informations ──────────────────────────────────────────── */}
            <TabsContent value="info" className="flex flex-col gap-4">
              <Section
                title={t("modules.tickets.category.sections.button")}
                description={t("modules.tickets.category.sections.buttonHint")}
              >
                <FieldGroup className="gap-5">
                <Field data-invalid={Boolean(err("name")) || undefined}>
                  <FieldLabel htmlFor={cf("name")}>
                    {t("modules.tickets.category.name")}
                  </FieldLabel>
                  <div className="flex items-center gap-2">
                    <EmojiPicker
                      value={category.emoji}
                      onChange={(v) => onChange({ emoji: v })}
                      guildId={guildId}
                    />
                    <Input
                      id={cf("name")}
                      value={category.name}
                      maxLength={TICKET_TEXT_LIMITS.name}
                      aria-invalid={Boolean(err("name"))}
                      onChange={(e) => onChange({ name: e.target.value })}
                      className="max-w-xs"
                    />
                  </div>
                  <FieldDescription>
                    {t("modules.tickets.category.nameDescription")}
                  </FieldDescription>
                  <FieldError errors={err("name") ? [{ message: err("name") }] : undefined} />
                </Field>

                {/* Le style de bouton et la description de l'option ne
                    coexistent pas : l'un ne se voit qu'en boutons, l'autre
                    qu'en menu déroulant. */}
                {panel.style === "buttons" ? (
                  <Field>
                    <FieldLabel>{t("modules.tickets.category.buttonStyle")}</FieldLabel>
                    <SegmentedControl
                      value={category.button_style}
                      onChange={(button_style) => onChange({ button_style })}
                      options={TICKET_BUTTON_STYLES.map((style) => ({
                        value: style,
                        label: t(`modules.tickets.buttonStyles.${style}`),
                        dot: DISCORD_BUTTON_COLORS[style],
                      }))}
                    />
                  </Field>
                ) : (
                  <Field data-invalid={Boolean(err("description")) || undefined}>
                    <FieldLabel htmlFor={cf("description")}>
                      {t("modules.tickets.category.description")}
                    </FieldLabel>
                    <Input
                      id={cf("description")}
                      value={category.description ?? ""}
                      maxLength={TICKET_TEXT_LIMITS.categoryDescription}
                      aria-invalid={Boolean(err("description"))}
                      onChange={(e) => onChange({ description: e.target.value || null })}
                      className="max-w-md"
                    />
                    <FieldDescription>
                      {t("modules.tickets.category.descriptionHint")}
                    </FieldDescription>
                    <FieldError
                      errors={err("description") ? [{ message: err("description") }] : undefined}
                    />
                  </Field>
                )}
                </FieldGroup>
              </Section>

              <Section title={t("modules.tickets.category.sections.channel")}>
                <FieldGroup className="grid gap-5 sm:grid-cols-2">
                  <Field data-invalid={Boolean(err("discord_category_id")) || undefined}>
                    <FieldLabel>{t("modules.tickets.category.discordCategory")}</FieldLabel>
                    <ChannelPicker
                      value={category.discord_category_id}
                      channels={parents}
                      onChange={(v) => onChange({ discord_category_id: v })}
                      placeholder={t("modules.tickets.category.selectDiscordCategory")}
                      clearLabel={t("modules.tickets.category.noParent")}
                      invalid={Boolean(err("discord_category_id"))}
                    />
                    <FieldDescription>
                      {t("modules.tickets.category.discordCategoryDescription")}
                    </FieldDescription>
                    <FieldError
                      errors={
                        err("discord_category_id")
                          ? [{ message: err("discord_category_id") }]
                          : undefined
                      }
                    />
                  </Field>

                  {/* Deux champs courts qui parlent du même salon : même ligne. */}
                  <div className="flex items-start gap-4">
                    <Field data-invalid={Boolean(err("name_format")) || undefined}>
                      <FieldLabel htmlFor={cf("name_format")}>
                        {t("modules.tickets.category.nameFormat")}
                      </FieldLabel>
                      <Input
                        id={cf("name_format")}
                        value={category.name_format}
                        maxLength={TICKET_TEXT_LIMITS.nameFormat}
                        aria-invalid={Boolean(err("name_format"))}
                        onChange={(e) => onChange({ name_format: e.target.value })}
                        className="font-mono text-sm"
                      />
                      <FieldDescription>
                        {t("modules.tickets.category.nameFormatDescription")}
                      </FieldDescription>
                      <FieldError
                        errors={err("name_format") ? [{ message: err("name_format") }] : undefined}
                      />
                    </Field>

                    <Field
                      className="w-auto"
                      data-invalid={Boolean(err("max_open_per_user")) || undefined}
                    >
                      <FieldLabel htmlFor={cf("max_open_per_user")} className="whitespace-nowrap">
                        {t("modules.tickets.category.maxOpenPerUser")}
                      </FieldLabel>
                      <Input
                        id={cf("max_open_per_user")}
                        type="number"
                        min={TICKET_OPEN_PER_USER.min}
                        max={TICKET_OPEN_PER_USER.max}
                        value={category.max_open_per_user}
                        aria-invalid={Boolean(err("max_open_per_user"))}
                        onChange={(e) => onChange({ max_open_per_user: Number(e.target.value) })}
                        className="w-20"
                      />
                      <FieldError
                        errors={
                          err("max_open_per_user")
                            ? [{ message: err("max_open_per_user") }]
                            : undefined
                        }
                      />
                    </Field>
                  </div>
                </FieldGroup>
              </Section>
            </TabsContent>

            {/* ── Permissions ───────────────────────────────────────────── */}
            <TabsContent value="permissions" className="flex flex-col gap-4">
              <Section
                title={t("modules.tickets.category.sections.access")}
                description={t("modules.tickets.category.sections.accessHint")}
              >
                <FieldGroup className="grid gap-5 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>{t("modules.tickets.category.allowedRoles")}</FieldLabel>
                    <RoleMultiPicker
                      value={category.allowed_role_ids}
                      roles={assignableRoles}
                      onChange={(v) => onChange({ allowed_role_ids: v })}
                      addLabel={t("modules.tickets.category.addRole")}
                    />
                    <FieldDescription>
                      {category.allowed_role_ids.length === 0
                        ? t("modules.tickets.category.allowedRolesEveryone")
                        : t("modules.tickets.category.allowedRolesRestricted")}
                    </FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel>{t("modules.tickets.category.deniedRoles")}</FieldLabel>
                    <RoleMultiPicker
                      value={category.denied_role_ids}
                      roles={assignableRoles}
                      onChange={(v) => onChange({ denied_role_ids: v })}
                      addLabel={t("modules.tickets.category.addRole")}
                      tone="danger"
                    />
                    <FieldDescription>
                      {t("modules.tickets.category.deniedRolesDescription")}
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </Section>

              <Section title={t("modules.tickets.category.sections.onOpen")}>
                <FieldGroup className="gap-5">
                  <Field>
                    <FieldLabel>{t("modules.tickets.category.pingRoles")}</FieldLabel>
                    <RoleMultiPicker
                      value={category.ping_role_ids}
                      roles={assignableRoles}
                      onChange={(v) => onChange({ ping_role_ids: v })}
                      addLabel={t("modules.tickets.category.addRole")}
                    />
                    <FieldDescription>
                      {t("modules.tickets.category.pingRolesDescription")}
                    </FieldDescription>
                  </Field>

                  <SwitchRow
                    label={t("modules.tickets.category.pingStaffRoles")}
                    description={t("modules.tickets.category.pingStaffRolesDescription")}
                    checked={category.ping_staff_roles}
                    onCheckedChange={(v) => onChange({ ping_staff_roles: v })}
                  />
                </FieldGroup>
              </Section>

              <PermissionsEditor
                permissions={category.permissions}
                roles={assignableRoles}
                onChange={(permissions) => onChange({ permissions })}
              />
            </TabsContent>

            {/* ── Messages ──────────────────────────────────────────────── */}
            <TabsContent value="messages" className="flex flex-col gap-4">
              <Section
                title={t("modules.tickets.category.sections.messages")}
                description={t("modules.tickets.leaveEmptyForDefault")}
              >
                <FieldGroup className="gap-5">
                <Field data-invalid={Boolean(err("open_message")) || undefined}>
                  <FieldLabel>{t("modules.tickets.category.openMessage")}</FieldLabel>
                  <MessageEditor
                    value={category.open_message ?? ""}
                    // Vidé → `null`, jamais `""` : `null` laisse le bot écrire
                    // son message, déjà traduit dans la langue du serveur.
                    onChange={(v) => onChange({ open_message: v === "" ? null : v })}
                    variables={[...TICKET_PLACEHOLDERS]}
                    guildId={guildId}
                    maxLength={TICKET_TEXT_LIMITS.message}
                    placeholder={t("modules.tickets.channel.default_open_message")}
                    minHeight={140}
                  />
                  <FieldDescription>{t("modules.tickets.category.separatorHint")}</FieldDescription>
                  <FieldError
                    errors={err("open_message") ? [{ message: err("open_message") }] : undefined}
                  />
                </Field>

                <Field data-invalid={Boolean(err("close_message")) || undefined}>
                  <FieldLabel>{t("modules.tickets.category.closeMessage")}</FieldLabel>
                  <MessageEditor
                    value={category.close_message ?? ""}
                    onChange={(v) => onChange({ close_message: v === "" ? null : v })}
                    variables={[...TICKET_PLACEHOLDERS]}
                    guildId={guildId}
                    maxLength={TICKET_TEXT_LIMITS.message}
                    placeholder={t("modules.tickets.channel.default_close_message")}
                    minHeight={120}
                  />
                  <FieldError
                    errors={err("close_message") ? [{ message: err("close_message") }] : undefined}
                  />
                </Field>
                </FieldGroup>

                <ServerLanguageNote guildId={guildId} />
              </Section>
            </TabsContent>

            {/* ── Avancé ────────────────────────────────────────────────── */}
            <TabsContent value="advanced" className="flex flex-col gap-4">
              <Section title={t("modules.tickets.category.sections.claim")}>
                <FieldGroup className="gap-5">
                  <SwitchRow
                    label={t("modules.tickets.category.claimEnabled")}
                    description={t("modules.tickets.category.claimEnabledDescription")}
                    checked={category.claim_enabled}
                    onCheckedChange={(v) => onChange({ claim_enabled: v })}
                  />
                  {category.claim_enabled && (
                    <SwitchRow
                      label={t("modules.tickets.category.claimLock")}
                      description={t("modules.tickets.category.claimLockDescription")}
                      checked={category.claim_lock}
                      onCheckedChange={(v) => onChange({ claim_lock: v })}
                    />
                  )}
                </FieldGroup>
              </Section>

              <ButtonsEditor
                value={category.buttons}
                onChange={(buttons) => onChange({ buttons })}
                error={err("buttons")}
              />
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2Icon data-icon="inline-start" />
            {t("modules.tickets.category.delete")}
          </Button>
          <div className="flex items-center gap-3">
            {openTickets > 0 && (
              <span className="text-xs text-muted-foreground">
                {t("modules.tickets.category.openTickets", { count: openTickets })}
              </span>
            )}
            <Button type="button" onClick={onClose}>
              {t("modules.tickets.category.done")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Boutons du salon de ticket ───────────────────────────────────────────────

/**
 * Trois états à ne pas aplatir : `null` (le bot décide), `[]` (aucun bouton,
 * choix explicite) et une liste. D'où l'interrupteur — « tout décoché » et « je
 * ne touche à rien » doivent produire deux JSON différents.
 */
function ButtonsEditor({
  value,
  onChange,
  error,
}: {
  value: TicketButton[] | null
  onChange: (value: TicketButton[] | null) => void
  error?: string
}) {
  const { t } = useTranslation()
  const custom = value !== null
  const checked = value ?? []

  return (
    <Section
      title={t("modules.tickets.category.sections.buttons")}
      description={t("modules.tickets.category.sections.buttonsHint")}
    >
      <SwitchRow
        label={t("modules.tickets.category.customizeButtons")}
        checked={custom}
        onCheckedChange={(on) => onChange(on ? [...TICKET_DEFAULT_BUTTONS] : null)}
      />

      {custom ? (
        <>
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {TICKET_BUTTONS.map((button) => (
              <label key={button} className="flex cursor-pointer items-start gap-2.5">
                <Checkbox
                  checked={checked.includes(button)}
                  onCheckedChange={(v) =>
                    onChange(
                      v === true ? [...checked, button] : checked.filter((b) => b !== button)
                    )
                  }
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block text-sm">
                    {t(`modules.tickets.buttons.${button}.label`)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t(`modules.tickets.buttons.${button}.description`)}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {checked.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("modules.tickets.category.noButtonsWarning")}
            </p>
          )}
        </>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {TICKET_DEFAULT_BUTTONS.map((button) => (
            <Badge key={button} variant="secondary">
              {t(`modules.tickets.buttons.${button}.label`)}
            </Badge>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </Section>
  )
}

// ─── Permissions par rôle ─────────────────────────────────────────────────────

/**
 * Dix permissions par rôle : les aligner en cases dans la modale noierait le
 * reste. Une ligne par rôle, le détail dans un popover, et `admin` qui coche
 * tout — seul `["admin"]` part alors au backend.
 */
function PermissionsEditor({
  permissions,
  roles,
  onChange,
}: {
  permissions: Record<string, TicketPermission[]>
  roles: Role[]
  onChange: (value: Record<string, TicketPermission[]>) => void
}) {
  const { t } = useTranslation()
  const [addOpen, setAddOpen] = useState(false)
  const entries = Object.entries(permissions)
  const available = roles.filter((r) => !(r.id in permissions))

  const setRole = (roleId: string, perms: TicketPermission[]) =>
    onChange({ ...permissions, [roleId]: perms })

  const removeRole = (roleId: string) => {
    const next = { ...permissions }
    delete next[roleId]
    onChange(next)
  }

  return (
    <Section
      title={t("modules.tickets.permissions.title")}
      description={t("modules.tickets.permissions.description")}
    >
      {entries.length > 0 && (
        <List className="-mx-6 border-y">
          {entries.map(([roleId, perms]) => {
            const role = roles.find((r) => r.id === roleId)
            const isAdmin = perms.includes("admin")
            return (
              <div key={roleId} className="flex items-center gap-3 p-3">
                <RoleDot color={role ? roleColorToHex(role.color) : DEFAULT_ROLE_COLOR} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {role?.name ?? roleId}
                </span>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="sm">
                      {isAdmin
                        ? t("modules.tickets.permissions.items.admin.label")
                        : t("modules.tickets.permissions.count", { count: perms.length })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72">
                    <div className="flex flex-col gap-2.5">
                      {TICKET_PERMISSIONS.map((permission) => {
                        const locked = isAdmin && permission !== "admin"
                        return (
                          <label
                            key={permission}
                            className={cn(
                              "flex items-start gap-2.5",
                              locked ? "cursor-default opacity-60" : "cursor-pointer"
                            )}
                          >
                            <Checkbox
                              className="mt-0.5"
                              // `admin` implique les autres : elles s'affichent
                              // cochées, mais ne partent pas dans le corps.
                              checked={isAdmin || perms.includes(permission)}
                              disabled={locked}
                              onCheckedChange={(v) =>
                                setRole(
                                  roleId,
                                  v === true
                                    ? [...perms.filter((p) => p !== permission), permission]
                                    : perms.filter((p) => p !== permission)
                                )
                              }
                            />
                            <span className="min-w-0">
                              <span className="block text-sm">
                                {t(`modules.tickets.permissions.items.${permission}.label`)}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {t(`modules.tickets.permissions.items.${permission}.description`)}
                              </span>
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </PopoverContent>
                </Popover>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("pickers.removeRole", { name: role?.name ?? roleId })}
                  className="text-muted-foreground"
                  onClick={() => removeRole(roleId)}
                >
                  <XIcon />
                </Button>
              </div>
            )
          })}
        </List>
      )}

      {available.length > 0 && (
        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="w-fit">
              <PlusIcon data-icon="inline-start" />
              {t("modules.tickets.permissions.addRole")}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-0">
            <Command>
              <CommandInput placeholder={t("pickers.searchRole")} />
              <CommandList>
                <CommandEmpty>{t("pickers.noRole")}</CommandEmpty>
                <CommandGroup>
                  {available.map((role) => (
                    <CommandItem
                      key={role.id}
                      value={`${role.name} ${role.id}`}
                      onSelect={() => {
                        setRole(role.id, ["view"])
                        setAddOpen(false)
                      }}
                    >
                      <RoleDot color={roleColorToHex(role.color)} />
                      <span className="truncate">{role.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </Section>
  )
}
