import { useTranslation } from "react-i18next"
import { PlusIcon, XIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { MessageEditor } from "@/components/message-editor"
import { ServerLanguageNote } from "@/components/server-language-note"
import {
  ChannelSelect,
  Field as TicketField,
  RoleChips,
  RoleDot,
  ToggleField,
} from "@/components/tickets/fields"
import { categoryFieldKey, discordCategories } from "@/lib/tickets"
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

interface CategoryDialogProps {
  panel: TicketPanel
  category: TicketCategory
  /** Serveur courant — l'éditeur de message y charge les émojis personnalisés. */
  guildId: string
  channels: Channel[]
  roles: Role[]
  /** Erreurs de champ (validation locale + 422 du backend), indexées par clé. */
  errors: Record<string, string>
  onChange: (changes: Partial<TicketCategory>) => void
  onClose: () => void
}

/**
 * Table champ → onglet du dialogue. Sert à poser une pastille d'erreur sur un
 * onglet fermé : une erreur invisible parce que son onglet n'est pas ouvert est
 * un blocage de sauvegarde que personne ne comprend.
 */
const FIELD_TABS: Record<string, "general" | "access" | "messages" | "buttons"> = {
  name: "general",
  emoji: "general",
  button_style: "general",
  description: "general",
  discord_category_id: "general",
  name_format: "general",
  max_open_per_user: "general",
  claim_enabled: "general",
  claim_lock: "general",
  allowed_role_ids: "access",
  denied_role_ids: "access",
  ping_role_ids: "access",
  ping_staff_roles: "access",
  permissions: "access",
  open_message: "messages",
  close_message: "messages",
  buttons: "buttons",
}

/**
 * Édition d'une catégorie. Les changements sont appliqués **immédiatement** au
 * brouillon de la page : rien n'est écrit tant que la barre « enregistrer » ne
 * l'est pas, un second niveau de brouillon n'apporterait que de la confusion.
 */
export function CategoryDialog({
  panel,
  category,
  guildId,
  channels,
  roles,
  errors,
  onChange,
  onClose,
}: CategoryDialogProps) {
  const { t } = useTranslation()
  const err = (field: string) => errors[categoryFieldKey(panel.id, category.id, field)]
  // Facultatifs **parce que le bot les remplit** : son texte est déjà traduit
  // dans la langue du serveur et s'améliore d'une version à l'autre. Un texte
  // écrit à leur place est figé dans une seule langue — le placeholder seul ne
  // le dit pas.
  const leaveEmpty = t("modules.tickets.leaveEmptyForDefault")
  const parents = discordCategories(channels)
  const assignableRoles = roles.filter((r) => r.name !== "@everyone")

  // Onglets portant au moins une erreur — calculé une fois pour poser la
  // pastille sur chaque `TabsTrigger`, ouvert ou non.
  const tabsWithErrors = new Set<string>()
  const categoryPrefix = categoryFieldKey(panel.id, category.id, "")
  for (const key of Object.keys(errors)) {
    if (!key.startsWith(categoryPrefix)) continue
    const field = key.slice(categoryPrefix.length)
    tabsWithErrors.add(FIELD_TABS[field] ?? "general")
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{category.name || t("modules.tickets.category.untitled")}</DialogTitle>
          <DialogDescription>
            {t("modules.tickets.category.inPanel", { name: panel.name || panel.id })}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="w-full">
            {(["general", "access", "messages", "buttons"] as const).map((tab) => (
              <TabsTrigger key={tab} value={tab} className="gap-1.5">
                {t(`modules.tickets.category.tabs.${tab}`)}
                {tabsWithErrors.has(tab) && (
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-destructive"
                    aria-label={t("modules.tickets.category.tabHasErrors")}
                    title={t("modules.tickets.category.tabHasErrors")}
                  />
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── Général ─────────────────────────────────────────────────── */}
          <TabsContent value="general" className="flex flex-col gap-5 pt-4">
            <TicketField
              label={t("modules.tickets.category.name")}
              description={t("modules.tickets.category.nameDescription")}
              error={err("name")}
              hint={`${category.name.length} / ${TICKET_TEXT_LIMITS.name}`}
            >
              <Input
                value={category.name}
                maxLength={TICKET_TEXT_LIMITS.name}
                onChange={(e) => onChange({ name: e.target.value })}
              />
            </TicketField>

            <div className="grid gap-5 sm:grid-cols-2">
              <TicketField
                label={t("modules.tickets.category.emoji")}
                description={t("modules.tickets.category.emojiDescription")}
                error={err("emoji")}
              >
                <Input
                  value={category.emoji ?? ""}
                  maxLength={TICKET_TEXT_LIMITS.emoji}
                  placeholder="🎫"
                  onChange={(e) => onChange({ emoji: e.target.value || null })}
                />
              </TicketField>

              {panel.style === "buttons" ? (
                <TicketField
                  label={t("modules.tickets.category.buttonStyle")}
                  description={t("modules.tickets.category.buttonStyleDescription")}
                  error={err("button_style")}
                >
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    value={category.button_style}
                    // Comme pour le style de panneau : jamais de valeur vide,
                    // un reclic sur l'option active est ignoré.
                    onValueChange={(v) => v && onChange({ button_style: v as TicketButtonStyle })}
                    className="w-full"
                  >
                    {TICKET_BUTTON_STYLES.map((style) => (
                      <ToggleGroupItem key={style} value={style}>
                        {t(`modules.tickets.buttonStyles.${style}`)}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </TicketField>
              ) : (
                <TicketField
                  label={t("modules.tickets.category.description")}
                  description={t("modules.tickets.category.descriptionHint")}
                  error={err("description")}
                  hint={`${category.description?.length ?? 0} / ${TICKET_TEXT_LIMITS.categoryDescription}`}
                >
                  <Input
                    value={category.description ?? ""}
                    maxLength={TICKET_TEXT_LIMITS.categoryDescription}
                    onChange={(e) => onChange({ description: e.target.value || null })}
                  />
                </TicketField>
              )}
            </div>

            <TicketField
              label={t("modules.tickets.category.discordCategory")}
              description={t("modules.tickets.category.discordCategoryDescription")}
              error={err("discord_category_id")}
            >
              <ChannelSelect
                value={category.discord_category_id}
                channels={parents}
                onChange={(v) => onChange({ discord_category_id: v })}
                placeholder={t("modules.tickets.category.selectDiscordCategory")}
                emptyLabel={t("modules.tickets.category.noDiscordCategory")}
                clearLabel={t("modules.tickets.category.noParent")}
                prefix=""
              />
            </TicketField>

            <div className="grid gap-5 sm:grid-cols-2">
              <TicketField
                label={t("modules.tickets.category.nameFormat")}
                description={t("modules.tickets.category.nameFormatDescription")}
                error={err("name_format")}
              >
                <Input
                  value={category.name_format}
                  maxLength={TICKET_TEXT_LIMITS.nameFormat}
                  onChange={(e) => onChange({ name_format: e.target.value })}
                />
              </TicketField>

              <TicketField
                label={t("modules.tickets.category.maxOpenPerUser")}
                description={t("modules.tickets.category.maxOpenPerUserDescription")}
                error={err("max_open_per_user")}
              >
                <Input
                  type="number"
                  min={TICKET_OPEN_PER_USER.min}
                  max={TICKET_OPEN_PER_USER.max}
                  value={category.max_open_per_user}
                  onChange={(e) => onChange({ max_open_per_user: Number(e.target.value) })}
                />
              </TicketField>
            </div>

            {/* La langue des panneaux et des salons de ticket suit celle du
                serveur — il n'y a plus de réglage par catégorie. */}
            <ServerLanguageNote guildId={guildId} />

            <ToggleField
              label={t("modules.tickets.category.claimEnabled")}
              description={t("modules.tickets.category.claimEnabledDescription")}
              checked={category.claim_enabled}
            >
              <Switch
                checked={category.claim_enabled}
                onCheckedChange={(v) => onChange({ claim_enabled: v })}
              />
            </ToggleField>
            {/* `claim_lock` ne prend son sens qu'avec `claim_enabled` : la
                dépendance se voit, elle ne surgit pas sèchement. */}
            {category.claim_enabled && (
              <div className="ml-6">
                <ToggleField
                  label={t("modules.tickets.category.claimLock")}
                  description={t("modules.tickets.category.claimLockDescription")}
                  checked={category.claim_lock}
                >
                  <Switch
                    checked={category.claim_lock}
                    onCheckedChange={(v) => onChange({ claim_lock: v })}
                  />
                </ToggleField>
              </div>
            )}
          </TabsContent>

          {/* ── Accès ───────────────────────────────────────────────────── */}
          <TabsContent value="access" className="flex flex-col gap-5 pt-4">
            <TicketField
              label={t("modules.tickets.category.allowedRoles")}
              description={t("modules.tickets.category.allowedRolesDescription")}
              error={err("allowed_role_ids")}
            >
              <RoleChips
                value={category.allowed_role_ids}
                roles={assignableRoles}
                onChange={(v) => onChange({ allowed_role_ids: v })}
                addLabel={t("modules.tickets.category.addRole")}
                emptyLabel={t("modules.tickets.category.noRole")}
              />
            </TicketField>

            <TicketField
              label={t("modules.tickets.category.deniedRoles")}
              description={t("modules.tickets.category.deniedRolesDescription")}
              error={err("denied_role_ids")}
            >
              <RoleChips
                value={category.denied_role_ids}
                roles={assignableRoles}
                onChange={(v) => onChange({ denied_role_ids: v })}
                addLabel={t("modules.tickets.category.addRole")}
                emptyLabel={t("modules.tickets.category.noRole")}
                tone="danger"
              />
            </TicketField>

            <TicketField
              label={t("modules.tickets.category.pingRoles")}
              description={t("modules.tickets.category.pingRolesDescription")}
              error={err("ping_role_ids")}
            >
              <RoleChips
                value={category.ping_role_ids}
                roles={assignableRoles}
                onChange={(v) => onChange({ ping_role_ids: v })}
                addLabel={t("modules.tickets.category.addRole")}
                emptyLabel={t("modules.tickets.category.noRole")}
              />
            </TicketField>

            <ToggleField
              label={t("modules.tickets.category.pingStaffRoles")}
              description={t("modules.tickets.category.pingStaffRolesDescription")}
              checked={category.ping_staff_roles}
            >
              <Switch
                checked={category.ping_staff_roles}
                onCheckedChange={(v) => onChange({ ping_staff_roles: v })}
              />
            </ToggleField>

            <PermissionsEditor
              permissions={category.permissions}
              roles={assignableRoles}
              onChange={(permissions) => onChange({ permissions })}
            />
          </TabsContent>

          {/* ── Messages ────────────────────────────────────────────────── */}
          <TabsContent value="messages" className="flex flex-col gap-5 pt-4">
            <MessageField
              guildId={guildId}
              label={t("modules.tickets.category.openMessage")}
              description={`${t("modules.tickets.category.openMessageDescription")} ${leaveEmpty}`}
              value={category.open_message}
              // Le défaut est traduit côté bot : on le montre en placeholder,
              // jamais en valeur — sinon il serait figé dans la config à la
              // première sauvegarde et divergerait au prochain changement de
              // wording.
              placeholder={t("modules.tickets.channel.default_open_message")}
              error={err("open_message")}
              onChange={(v) => onChange({ open_message: v })}
            />
            <MessageField
              guildId={guildId}
              label={t("modules.tickets.category.closeMessage")}
              description={`${t("modules.tickets.category.closeMessageDescription")} ${leaveEmpty}`}
              value={category.close_message}
              placeholder={t("modules.tickets.channel.default_close_message")}
              error={err("close_message")}
              onChange={(v) => onChange({ close_message: v })}
            />
          </TabsContent>

          {/* ── Boutons ─────────────────────────────────────────────────── */}
          <TabsContent value="buttons" className="flex flex-col gap-5 pt-4">
            <ButtonsEditor
              value={category.buttons}
              onChange={(buttons) => onChange({ buttons })}
              error={err("buttons")}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button onClick={onClose}>{t("modules.tickets.category.done")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Message d'ouverture / de fermeture ───────────────────────────────────────

/**
 * Le bot n'ajoute plus **rien** autour : ce champ contient le titre, le corps et
 * le pied du message. D'où un vrai multi-lignes avec aperçu markdown, et un
 * champ vidé qui repart en `null` (pas `""`) pour laisser le défaut du bot.
 */
function MessageField({
  label,
  description,
  value,
  placeholder,
  error,
  guildId,
  onChange,
}: {
  label: string
  description: string
  value: string | null
  placeholder: string
  error?: string
  guildId: string
  onChange: (value: string | null) => void
}) {
  const { t } = useTranslation()

  return (
    <TicketField label={label} description={description} error={error}>
      <div className="flex flex-col gap-2">
        {/* `null` = le bot écrit son message traduit par défaut. */}
        {value === null && (
          <p className="text-xs text-muted-foreground">
            {t("modules.tickets.category.usingDefault")}
          </p>
        )}
        {/* Éditeur de message commun au dashboard : multi-lignes, mise en forme
            Discord, émojis du serveur, placeholders surlignés et insérables. */}
        <MessageEditor
          value={value ?? ""}
          // Champ vidé → `null`, jamais `""` : `null` doit être round-trippé
          // tel quel pour que le bot garde son message par défaut.
          onChange={(v) => onChange(v === "" ? null : v)}
          variables={[...TICKET_PLACEHOLDERS]}
          guildId={guildId}
          maxLength={TICKET_TEXT_LIMITS.message}
          placeholder={placeholder}
          minHeight={160}
        />
        <p className="text-xs text-muted-foreground">
          {t("modules.tickets.category.separatorHint")}
        </p>
      </div>
    </TicketField>
  )
}

// ─── Boutons du salon de ticket ───────────────────────────────────────────────

/**
 * Trois états à ne pas aplatir : `null` (le bot décide), `[]` (aucun bouton,
 * choix explicite) et une liste. Un groupe de cases seul ne suffirait pas —
 * « tout décoché » et « je ne touche pas » doivent produire deux JSON
 * différents, d'où l'interrupteur « personnaliser ».
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

  const toggle = (button: TicketButton, on: boolean) => {
    const next = on ? [...checked, button] : checked.filter((b) => b !== button)
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-4">
      <ToggleField
        label={t("modules.tickets.category.customizeButtons")}
        description={t("modules.tickets.category.customizeButtonsDescription")}
        checked={custom}
      >
        <Switch
          checked={custom}
          // Passer en « personnalisé » part des défauts du bot ; revenir renvoie
          // `null` — le bot reprend la main.
          onCheckedChange={(on) => onChange(on ? [...TICKET_DEFAULT_BUTTONS] : null)}
        />
      </ToggleField>

      {custom ? (
        <FieldSet>
          <FieldGroup>
            {TICKET_BUTTONS.map((button) => (
              <Field key={button} orientation="horizontal" className="rounded-lg border p-3">
                <Checkbox
                  id={`ticket-button-${button}`}
                  checked={checked.includes(button)}
                  onCheckedChange={(v) => toggle(button, v === true)}
                />
                <FieldContent>
                  <FieldLabel htmlFor={`ticket-button-${button}`}>
                    {t(`modules.tickets.buttons.${button}.label`)}
                  </FieldLabel>
                  <FieldDescription>{t(`modules.tickets.buttons.${button}.description`)}</FieldDescription>
                </FieldContent>
              </Field>
            ))}
          </FieldGroup>
          {checked.length === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t("modules.tickets.category.noButtonsWarning")}
            </p>
          )}
          {/* L'ordre envoyé est ignoré (le bot rend dans le sien) : pas de
              réordonnancement, il ne servirait à rien. */}
          <p className="text-xs text-muted-foreground">
            {t("modules.tickets.category.buttonsOrderHint")}
          </p>
        </FieldSet>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {TICKET_DEFAULT_BUTTONS.map((button) => (
            <Badge key={button} variant="secondary">
              {t(`modules.tickets.buttons.${button}.label`)}
            </Badge>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

// ─── Permissions par rôle ─────────────────────────────────────────────────────

/**
 * 9 permissions, par rôle **et par catégorie**. `admin` implique tout le reste :
 * les autres cases sont grisées et seul `["admin"]` part au backend. Un rôle
 * sans aucune case cochée est retiré à l'enregistrement — le bot ferait pareil.
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
  const entries = Object.entries(permissions)
  const available = roles.filter((r) => !(r.id in permissions))

  const setRole = (roleId: string, perms: TicketPermission[]) => {
    onChange({ ...permissions, [roleId]: perms })
  }

  const removeRole = (roleId: string) => {
    const next = { ...permissions }
    delete next[roleId]
    onChange(next)
  }

  return (
    <FieldSet>
      <FieldLegend variant="label">{t("modules.tickets.permissions.title")}</FieldLegend>
      <FieldDescription>{t("modules.tickets.permissions.description")}</FieldDescription>

      {entries.length === 0 && (
        <p className="text-xs text-muted-foreground">{t("modules.tickets.permissions.empty")}</p>
      )}

      <div className="flex flex-col gap-3">
        {entries.map(([roleId, perms]) => {
          const role = roles.find((r) => r.id === roleId)
          const isAdmin = perms.includes("admin")
          return (
            <div key={roleId} className="rounded-lg border p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <RoleDot color={role ? roleColorToHex(role.color) : "#99aab5"} />
                  <span className="truncate">@{role?.name ?? roleId}</span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => removeRole(roleId)}
                  aria-label={t("modules.tickets.permissions.removeRole")}
                >
                  <XIcon />
                </Button>
              </div>
              <FieldGroup className="mt-3 @md/field-group:grid @md/field-group:grid-cols-2">
                {TICKET_PERMISSIONS.map((permission) => {
                  const locked = isAdmin && permission !== "admin"
                  const fieldId = `ticket-perm-${roleId}-${permission}`
                  return (
                    <Field
                      key={permission}
                      orientation="horizontal"
                      data-disabled={locked ? true : undefined}
                      className={locked ? "opacity-60" : undefined}
                    >
                      <Checkbox
                        id={fieldId}
                        // `admin` implique les 8 autres : elles s'affichent
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
                      <FieldContent>
                        <FieldLabel htmlFor={fieldId} className="text-xs font-medium">
                          {t(`modules.tickets.permissions.items.${permission}.label`)}
                        </FieldLabel>
                        <FieldDescription className="text-xs">
                          {t(`modules.tickets.permissions.items.${permission}.description`)}
                        </FieldDescription>
                      </FieldContent>
                    </Field>
                  )
                })}
              </FieldGroup>
            </div>
          )
        })}
      </div>

      {available.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className="w-fit">
              <PlusIcon data-icon="inline-start" />
              {t("modules.tickets.permissions.addRole")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuGroup>
              {available.map((role) => (
                <DropdownMenuItem key={role.id} onSelect={() => setRole(role.id, ["view"])}>
                  <RoleDot color={roleColorToHex(role.color)} />
                  {role.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </FieldSet>
  )
}
