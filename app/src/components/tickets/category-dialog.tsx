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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MessageEditor } from "@/components/message-editor"
import { ServerLanguageNote } from "@/components/server-language-note"
import { ChannelSelect, Field, RoleChips } from "@/components/tickets/fields"
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

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{category.name || t("modules.tickets.category.untitled")}</DialogTitle>
          <DialogDescription>{t("modules.tickets.category.dialogDescription")}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="general">{t("modules.tickets.category.tabs.general")}</TabsTrigger>
            <TabsTrigger value="access">{t("modules.tickets.category.tabs.access")}</TabsTrigger>
            <TabsTrigger value="messages">{t("modules.tickets.category.tabs.messages")}</TabsTrigger>
            <TabsTrigger value="buttons">{t("modules.tickets.category.tabs.buttons")}</TabsTrigger>
          </TabsList>

          {/* ── Général ─────────────────────────────────────────────────── */}
          <TabsContent value="general" className="flex flex-col gap-5 pt-4">
            <Field
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
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
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
              </Field>

              {panel.style === "buttons" ? (
                <Field
                  label={t("modules.tickets.category.buttonStyle")}
                  description={t("modules.tickets.category.buttonStyleDescription")}
                  error={err("button_style")}
                >
                  <Select
                    value={category.button_style}
                    onValueChange={(v) => onChange({ button_style: v as TicketButtonStyle })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_BUTTON_STYLES.map((style) => (
                        <SelectItem key={style} value={style}>
                          {t(`modules.tickets.buttonStyles.${style}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : (
                <Field
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
                </Field>
              )}
            </div>

            <Field
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
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label={t("modules.tickets.category.nameFormat")}
                description={t("modules.tickets.category.nameFormatDescription")}
                error={err("name_format")}
              >
                <Input
                  value={category.name_format}
                  maxLength={TICKET_TEXT_LIMITS.nameFormat}
                  onChange={(e) => onChange({ name_format: e.target.value })}
                />
              </Field>

              <Field
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
              </Field>
            </div>

            {/* La langue des panneaux et des salons de ticket suit celle du
                serveur — il n'y a plus de réglage par catégorie. */}
            <ServerLanguageNote guildId={guildId} />

            <ToggleRow
              label={t("modules.tickets.category.claimEnabled")}
              description={t("modules.tickets.category.claimEnabledDescription")}
              checked={category.claim_enabled}
              onCheckedChange={(v) => onChange({ claim_enabled: v })}
            />
            {category.claim_enabled && (
              <ToggleRow
                label={t("modules.tickets.category.claimLock")}
                description={t("modules.tickets.category.claimLockDescription")}
                checked={category.claim_lock}
                onCheckedChange={(v) => onChange({ claim_lock: v })}
              />
            )}
          </TabsContent>

          {/* ── Accès ───────────────────────────────────────────────────── */}
          <TabsContent value="access" className="flex flex-col gap-5 pt-4">
            <Field
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
            </Field>

            <Field
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
            </Field>

            <Field
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
            </Field>

            <ToggleRow
              label={t("modules.tickets.category.pingStaffRoles")}
              description={t("modules.tickets.category.pingStaffRolesDescription")}
              checked={category.ping_staff_roles}
              onCheckedChange={(v) => onChange({ ping_staff_roles: v })}
            />

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

// ─── Interrupteur avec libellé ────────────────────────────────────────────────

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
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
    <Field label={label} description={description} error={error}>
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
    </Field>
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
      <ToggleRow
        label={t("modules.tickets.category.customizeButtons")}
        description={t("modules.tickets.category.customizeButtonsDescription")}
        checked={custom}
        // Passer en « personnalisé » part des défauts du bot ; revenir renvoie
        // `null` — le bot reprend la main.
        onCheckedChange={(on) => onChange(on ? [...TICKET_DEFAULT_BUTTONS] : null)}
      />

      {custom ? (
        <div className="flex flex-col gap-2">
          {TICKET_BUTTONS.map((button) => (
            <label
              key={button}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
            >
              <Checkbox
                checked={checked.includes(button)}
                onCheckedChange={(v) => toggle(button, v === true)}
                className="mt-0.5"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {t(`modules.tickets.buttons.${button}.label`)}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t(`modules.tickets.buttons.${button}.description`)}
                </span>
              </span>
            </label>
          ))}
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
        </div>
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
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium">{t("modules.tickets.permissions.title")}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("modules.tickets.permissions.description")}
        </p>
      </div>

      {entries.length === 0 && (
        <p className="text-xs text-muted-foreground">{t("modules.tickets.permissions.empty")}</p>
      )}

      {entries.map(([roleId, perms]) => {
        const role = roles.find((r) => r.id === roleId)
        const isAdmin = perms.includes("admin")
        return (
          <div key={roleId} className="rounded-lg border p-3.5">
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: role ? roleColorToHex(role.color) : "#99aab5" }}
                />
                <span className="truncate">@{role?.name ?? roleId}</span>
              </span>
              <button
                type="button"
                onClick={() => removeRole(roleId)}
                className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {TICKET_PERMISSIONS.map((permission) => {
                const locked = isAdmin && permission !== "admin"
                return (
                  <label
                    key={permission}
                    className={cn(
                      "flex items-start gap-2",
                      locked ? "cursor-default opacity-60" : "cursor-pointer"
                    )}
                  >
                    <Checkbox
                      className="mt-0.5"
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
                    <span className="min-w-0">
                      <span className="block text-xs font-medium">
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
          </div>
        )
      })}

      {available.length > 0 && (
        <Select value="" onValueChange={(roleId) => setRole(roleId, ["view"])}>
          <SelectTrigger className="w-full">
            <span className="flex items-center gap-2 text-muted-foreground">
              <PlusIcon className="size-3.5" />
              {t("modules.tickets.permissions.addRole")}
            </span>
          </SelectTrigger>
          <SelectContent>
            {available.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: roleColorToHex(role.color) }}
                  />
                  {role.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
