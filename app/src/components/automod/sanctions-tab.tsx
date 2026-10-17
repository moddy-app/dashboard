import { useMemo, useState, type RefObject } from "react"
import { useTranslation } from "react-i18next"
import { AddIcon, ChevronDownIcon, DeleteIcon, EditIcon, ErrorIcon, RefreshIcon, SearchIcon } from "@/components/icons"
import {
  ActionsField,
  ApprovalField,
  LegacyPlan,
  PolicyView,
  TimeoutField,
} from "@/components/automod/sanction-fields"
import { CustomInfractionDialog } from "@/components/automod/custom-infraction-dialog"
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
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { summarizeSanction } from "@/lib/automod-labels"
import { cn } from "@/lib/utils"
import {
  DEFAULT_TIMEOUT_SECONDS,
  FALLBACK_ACTION_RULES,
  FAMILY_ORDER,
  applySanctionChanges,
  blankInfraction,
  canRequireApproval,
  customSanctionKey,
  effectiveProfileAction,
  generateCustomInfractionId,
  infractionFromTemplate,
  normalizeActions,
  pickLocalized,
  removeCustomInfraction,
  setSanction,
  upsertCustomInfraction,
} from "@/lib/automod"
import type {
  AutomodAiConfig,
  AutomodCatalog,
  AutomodCustomInfraction,
  AutomodPolicy,
  AutomodSanction,
} from "@/types/api"

interface Row {
  key: string
  customId?: string
  family: string
  name: string
  description: string
  sensitive: boolean
  banOnSight: boolean
  profileActions?: string[]
  defaultProfileAction?: string
  isCustom: boolean
}

interface Editing {
  infraction: AutomodCustomInfraction
  isNew: boolean
}

interface AutomodSanctionsTabProps {
  guildId: string
  draft: AutomodAiConfig
  savedConfig: AutomodAiConfig | null
  catalog: AutomodCatalog | null
  loading: boolean
  error: string | null
  onRetry: () => void
  onUpdate: (updater: (config: AutomodAiConfig) => AutomodAiConfig) => void
  policies: Record<string, AutomodPolicy> | null
  readOnly: boolean
  usedIds: RefObject<Set<string>>
  faulty: { id: string | null; message: string } | null
  onClearFaulty: () => void
}

export function AutomodSanctionsTab({
  guildId,
  draft,
  savedConfig,
  catalog,
  loading,
  error,
  onRetry,
  onUpdate,
  policies,
  readOnly,
  usedIds,
  faulty,
  onClearFaulty,
}: AutomodSanctionsTabProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [query, setQuery] = useState("")
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)

  const perso = useMemo(() => draft.infractions_perso ?? [], [draft.infractions_perso])

  const rows = useMemo<Row[]>(() => {
    if (!catalog) return []
    return [
      ...catalog.infractions.map((i) => ({
        key: i.id,
        family: i.family as string,
        name: pickLocalized(i.name, lang) || i.id,
        description: pickLocalized(i.description, lang),
        sensitive: i.sensitive,
        banOnSight: i.ban_on_sight,
        profileActions: i.profile_actions,
        defaultProfileAction: i.default_action_profil,
        isCustom: false,
      })),
      ...perso.map((i) => ({
        key: customSanctionKey(i.id),
        customId: i.id,
        family: "custom",
        name: i.nom || i.id,
        description: i.description,
        sensitive: false,
        banOnSight: false,
        isCustom: true,
      })),
    ]
  }, [catalog, perso, lang])

  if (error) {
    return (
      <Alert variant="destructive">
        <ErrorIcon />
        <AlertTitle>{t("modules.automod_ai.catalogErrorTitle")}</AlertTitle>
        <AlertDescription>{t("modules.automod_ai.catalogErrorDescription")}</AlertDescription>
        <AlertAction>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            {t("modules.automod_ai.retry")}
          </Button>
        </AlertAction>
      </Alert>
    )
  }

  if (loading || !catalog) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    )
  }

  const rules = catalog.action_rules?.length ? catalog.action_rules : FALLBACK_ACTION_RULES
  const limits = catalog.limits
  const full = perso.length >= limits.infractions_perso
  const usedTemplates = new Set(perso.map((i) => i.modele).filter((m): m is string => Boolean(m)))

  const needle = query.trim().toLowerCase()
  const visible = needle
    ? rows.filter((r) => `${r.name} ${r.description}`.toLowerCase().includes(needle))
    : rows
  const present = new Set(visible.map((r) => r.family))
  const known = FAMILY_ORDER.filter((f) => f !== "custom" && present.has(f))
  const unknown = [...present].filter((f) => !(FAMILY_ORDER as readonly string[]).includes(f))
  const families = [...known, ...unknown, ...(present.has("custom") ? ["custom"] : [])]

  const newId = () =>
    generateCustomInfractionId(
      [...perso.map((i) => i.id), ...(savedConfig?.infractions_perso ?? []).map((i) => i.id)],
      usedIds.current ?? []
    )

  const selected = rows.find((r) => r.key === selectedKey) ?? null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <InputGroup className="sm:max-w-xs">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("modules.automod_ai.sanctions.searchPlaceholder")}
            aria-label={t("modules.automod_ai.sanctions.searchPlaceholder")}
          />
        </InputGroup>
        <div className="flex items-center gap-3 sm:ml-auto">
          <span className="text-xs tabular-nums text-muted-foreground">
            {t("modules.automod_ai.sanctions.count", { count: perso.length, max: limits.infractions_perso })}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" disabled={readOnly || full}>
                <AddIcon data-icon="inline-start" />
                {t("modules.automod_ai.sanctions.add")}
                <ChevronDownIcon data-icon="inline-end" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onSelect={() => setEditing({ infraction: blankInfraction(newId()), isNew: true })}
                >
                  {t("modules.automod_ai.custom.fromScratch")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              {catalog.templates.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>{t("modules.automod_ai.custom.fromTemplate")}</DropdownMenuLabel>
                    {catalog.templates.map((template) => (
                      <DropdownMenuItem
                        key={template.id}
                        disabled={usedTemplates.has(template.id)}
                        onSelect={() =>
                          setEditing({
                            infraction: infractionFromTemplate(template, newId(), lang),
                            isNew: true,
                          })
                        }
                      >
                        {pickLocalized(template.nom, lang) || template.id}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {faulty && faulty.id === null && (
        <Alert variant="destructive">
          <ErrorIcon />
          <AlertDescription>{faulty.message}</AlertDescription>
        </Alert>
      )}

      {visible.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t("modules.automod_ai.sanctions.noResults")}</EmptyTitle>
            <EmptyDescription>{t("modules.automod_ai.sanctions.noResultsHint")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        families.map((family) => {
          const familyRows = visible.filter((r) => r.family === family)
          const title =
            pickLocalized(catalog.families.find((f) => f.id === family)?.name, lang) ||
            t(`modules.automod_ai.scale.family_${family}`, { defaultValue: family })
          return (
            <section key={family} className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
              <ItemGroup className="gap-2">
                {familyRows.map((row) => {
                  const entry = draft.sanctions?.[row.key]
                  const enabled = entry?.enabled !== false
                  const isFaulty =
                    faulty?.id !== null && faulty !== null && (faulty.id === row.key || faulty.id === row.customId)
                  return (
                    <Item
                      key={row.key}
                      variant="outline"
                      size="sm"
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedKey(row.key)}
                      onKeyDown={(e) => {
                        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault()
                          setSelectedKey(row.key)
                        }
                      }}
                      className={cn("cursor-pointer hover:bg-muted/50", isFaulty && "border-destructive")}
                    >
                      <ItemContent>
                        <ItemTitle className="flex-wrap">
                          {row.name}
                          {row.isCustom && (
                            <Badge variant="secondary">{t("modules.automod_ai.sanctions.custom")}</Badge>
                          )}
                          {!enabled && (
                            <Badge variant="outline">{t("modules.automod_ai.scale.disabledBadge")}</Badge>
                          )}
                          {isFaulty && (
                            <Badge variant="destructive">{t("modules.automod_ai.custom.refusedBadge")}</Badge>
                          )}
                        </ItemTitle>
                        <ItemDescription>
                          {summarizeSanction(
                            entry,
                            policies?.[row.key],
                            catalog,
                            lang,
                            t,
                            rules
                          )}
                        </ItemDescription>
                        {isFaulty && faulty && <p className="text-sm text-destructive">{faulty.message}</p>}
                      </ItemContent>
                      <ItemActions onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={enabled}
                          disabled={readOnly}
                          onCheckedChange={(v) =>
                            onUpdate((cfg) =>
                              setSanction(
                                cfg,
                                row.key,
                                applySanctionChanges(
                                  cfg.sanctions?.[row.key],
                                  { enabled: v },
                                  { infractionId: row.key, defaultProfileAction: row.defaultProfileAction }
                                )
                              )
                            )
                          }
                          aria-label={t("modules.automod_ai.scale.enabledLabel", { name: row.name })}
                        />
                      </ItemActions>
                    </Item>
                  )
                })}
              </ItemGroup>
            </section>
          )
        })
      )}

      <SanctionSheet
        key={selected?.key ?? "none"}
        row={selected}
        open={selected !== null}
        onOpenChange={(open) => !open && setSelectedKey(null)}
        entry={selected ? draft.sanctions?.[selected.key] : undefined}
        policy={selected ? policies?.[selected.key] : undefined}
        policiesUnavailable={policies === null}
        infraction={selected?.customId ? perso.find((i) => i.id === selected.customId) : undefined}
        catalog={catalog}
        readOnly={readOnly}
        onChange={(next) => selected && onUpdate((cfg) => setSanction(cfg, selected.key, next))}
        onEditContent={(infraction) => setEditing({ infraction, isNew: false })}
        onDelete={(id) => {
          usedIds.current?.add(id)
          onUpdate((cfg) => removeCustomInfraction(cfg, id))
          if (faulty?.id === id || faulty?.id === customSanctionKey(id)) onClearFaulty()
          setSelectedKey(null)
        }}
      />

      {editing && (
        <CustomInfractionDialog
          guildId={guildId}
          initial={editing.infraction}
          isNew={editing.isNew}
          limits={limits}
          saved={savedConfig?.infractions_perso?.find((i) => i.id === editing.infraction.id)}
          onClose={() => setEditing(null)}
          onSubmit={(infraction) => {
            onUpdate((cfg) => upsertCustomInfraction(cfg, infraction))
            if (faulty?.id === infraction.id) onClearFaulty()
            setEditing(null)
            if (editing.isNew) setSelectedKey(customSanctionKey(infraction.id))
          }}
        />
      )}
    </div>
  )
}

// ─── Édition d'une infraction ─────────────────────────────────────────────────

interface SanctionSheetProps {
  row: Row | null
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: AutomodSanction | undefined
  policy: AutomodPolicy | undefined
  policiesUnavailable: boolean
  infraction: AutomodCustomInfraction | undefined
  catalog: AutomodCatalog
  readOnly: boolean
  onChange: (next: AutomodSanction | null) => void
  onEditContent: (infraction: AutomodCustomInfraction) => void
  onDelete: (id: string) => void
}

function SanctionSheet({
  row,
  open,
  onOpenChange,
  entry,
  policy,
  policiesUnavailable,
  infraction,
  catalog,
  readOnly,
  onChange,
  onEditContent,
  onDelete,
}: SanctionSheetProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isPerso = entry?.mode === "perso"
  const enabled = entry?.enabled !== false
  const rules = catalog.action_rules?.length ? catalog.action_rules : FALLBACK_ACTION_RULES

  const apply = (changes: Partial<AutomodSanction>) =>
    row &&
    onChange(
      applySanctionChanges(entry, changes, {
        infractionId: row.key,
        defaultProfileAction: row.defaultProfileAction,
      })
    )

  const profileAction = row
    ? effectiveProfileAction(entry, {
        profile_actions: row.profileActions,
        default_action_profil: row.defaultProfileAction,
      })
    : undefined
  const usesPlan = profileAction === undefined || profileAction === "bareme"
  const legacy = isPerso && entry?.actions === undefined && entry?.by_gravity !== undefined
  const actions = normalizeActions(entry?.actions)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0 overflow-y-auto sm:max-w-md">
        {row && (
          <>
            <SheetHeader>
              <SheetTitle className="flex flex-wrap items-center gap-2">
                {row.name}
                {row.isCustom && (
                  <Badge variant="secondary">{t("modules.automod_ai.sanctions.custom")}</Badge>
                )}
              </SheetTitle>
              <SheetDescription>{row.description}</SheetDescription>
              {(row.banOnSight || row.sensitive) && (
                <div className="flex flex-wrap gap-1">
                  {row.banOnSight && (
                    <Badge variant="outline">{t("modules.automod_ai.scale.banOnSight")}</Badge>
                  )}
                  {row.sensitive && (
                    <Badge variant="outline">{t("modules.automod_ai.scale.sensitive")}</Badge>
                  )}
                </div>
              )}
            </SheetHeader>

            <fieldset disabled={readOnly} className="contents">
              <FieldGroup className="gap-5 px-4 pb-4">
                {!enabled && (
                  <p className="text-sm text-muted-foreground">
                    {t(
                      row.family === "profile"
                        ? "modules.automod_ai.scale.disabledHelpProfile"
                        : "modules.automod_ai.scale.disabledHelp"
                    )}
                  </p>
                )}

                {row.profileActions && row.profileActions.length > 0 && (
                  <Field>
                    <FieldLabel>{t("modules.automod_ai.scale.profileAction")}</FieldLabel>
                    <Select
                      value={profileAction}
                      onValueChange={(v) => apply({ action_profil: v as AutomodSanction["action_profil"] })}
                    >
                      <SelectTrigger className="w-full" aria-label={t("modules.automod_ai.scale.profileAction")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {row.profileActions.map((id) => (
                            <SelectItem key={id} value={id}>
                              {pickLocalized(catalog.profile_actions.find((a) => a.id === id)?.name, lang) || id}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      {pickLocalized(catalog.profile_actions.find((a) => a.id === profileAction)?.description, lang)}
                    </FieldDescription>
                  </Field>
                )}

                {!usesPlan ? (
                  <p className="text-sm text-muted-foreground">{t("modules.automod_ai.scale.planUnused")}</p>
                ) : (
                  <>
                    <Field>
                      <FieldLabel>{t("modules.automod_ai.scale.mode")}</FieldLabel>
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        value={isPerso ? "perso" : "auto"}
                        onValueChange={(v) => v && apply({ mode: v === "perso" ? "perso" : "auto" })}
                        className="w-full"
                        aria-label={t("modules.automod_ai.scale.mode")}
                      >
                        <ToggleGroupItem value="auto" className="flex-1">
                          {t("modules.automod_ai.scale.modeAuto")}
                        </ToggleGroupItem>
                        <ToggleGroupItem value="perso" className="flex-1">
                          {t("modules.automod_ai.scale.modePerso")}
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </Field>

                    {!isPerso ? (
                      <PolicyView policy={policy} unavailable={policiesUnavailable} catalog={catalog} />
                    ) : legacy ? (
                      <LegacyPlan
                        plans={entry?.by_gravity ?? {}}
                        catalog={catalog}
                        onReplace={() => apply({ actions: ["delete"] })}
                      />
                    ) : (
                      <>
                        <ActionsField
                          rowKey={row.key}
                          actions={actions}
                          rules={rules}
                          catalog={catalog}
                          onChange={(next) => apply({ actions: next })}
                        />
                        {actions.includes("timeout") && (
                          <TimeoutField
                            rowKey={row.key}
                            seconds={entry?.timeout_seconds ?? DEFAULT_TIMEOUT_SECONDS}
                            catalog={catalog}
                            onChange={(seconds) => apply({ timeout_seconds: seconds })}
                          />
                        )}
                        <ApprovalField
                          rowKey={row.key}
                          checked={entry?.require_approval === true}
                          allowed={canRequireApproval(row.key, actions)}
                          isProfile={row.key.startsWith("profil_")}
                          onChange={(v) => apply({ require_approval: v })}
                        />
                      </>
                    )}

                    {isPerso && (
                      <Field orientation="horizontal">
                        <FieldContent>
                          <FieldLabel htmlFor={`recidive-${row.key}`}>
                            {t("modules.automod_ai.scale.recidive")}
                          </FieldLabel>
                          <FieldDescription>{t("modules.automod_ai.scale.recidiveHelp")}</FieldDescription>
                        </FieldContent>
                        <Switch
                          id={`recidive-${row.key}`}
                          checked={entry?.recidive !== false}
                          onCheckedChange={(v) => apply({ recidive: v })}
                        />
                      </Field>
                    )}
                  </>
                )}

                {infraction && (
                  <Field>
                    <FieldLabel>{t("modules.automod_ai.sanctions.contentTitle")}</FieldLabel>
                    <FieldDescription>{t("modules.automod_ai.sanctions.contentHelp")}</FieldDescription>
                    <div>
                      <Button type="button" variant="outline" size="sm" onClick={() => onEditContent(infraction)}>
                        <EditIcon data-icon="inline-start" />
                        {t("modules.automod_ai.sanctions.editContent")}
                      </Button>
                    </div>
                  </Field>
                )}
              </FieldGroup>
            </fieldset>

            <SheetFooter className="flex-row flex-wrap gap-2">
              {entry && (
                <Button type="button" variant="outline" size="sm" disabled={readOnly} onClick={() => onChange(null)}>
                  <RefreshIcon data-icon="inline-start" />
                  {t("modules.automod_ai.scale.reset")}
                </Button>
              )}
              {infraction && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={readOnly}
                  onClick={() => setConfirmDelete(true)}
                >
                  <DeleteIcon data-icon="inline-start" />
                  {t("modules.automod_ai.custom.deleteConfirm")}
                </Button>
              )}
            </SheetFooter>

            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("modules.automod_ai.custom.deleteTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("modules.automod_ai.custom.deleteDescription", { name: row.name })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("modules.automod_ai.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => {
                      if (infraction) onDelete(infraction.id)
                      setConfirmDelete(false)
                    }}
                  >
                    {t("modules.automod_ai.custom.deleteConfirm")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
