import { useState } from "react"
import { useTranslation } from "react-i18next"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  ArrowDown01Icon,
  InformationCircleIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { ActionPlan } from "@/components/automod/action-plan"
import { actionLabel, formatTimeout } from "@/lib/automod-labels"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  AUTOMOD_ACTION_IDS,
  DEFAULT_TIMEOUT_SECONDS,
  FALLBACK_ACTION_RULES,
  FAMILY_ORDER,
  GRAVITIES,
  applySanctionChanges,
  canRequireApproval,
  customSanctionKey,
  effectiveActions,
  effectiveProfileAction,
  joinDuration,
  normalizeActions,
  pickLocalized,
  setSanction,
  splitDuration,
  timeoutBounds,
} from "@/lib/automod"
import type {
  AutomodAction,
  AutomodAiConfig,
  AutomodCatalog,
  AutomodGravityPlan,
  AutomodPolicy,
  AutomodSanction,
} from "@/types/api"

interface AutomodScaleTabProps {
  draft: AutomodAiConfig
  catalog: AutomodCatalog | null
  loading: boolean
  error: string | null
  onRetry: () => void
  onUpdate: (updater: (config: AutomodAiConfig) => AutomodAiConfig) => void
  /** Politique effective de Moddy par infraction ; `null` = indisponible (échec silencieux). */
  policies: Record<string, AutomodPolicy> | null
  /** Rendu en lecture seule : les détails restent dépliés (un bouton désactivé ne s'ouvre pas). */
  readOnly: boolean
}

/** Une ligne du barème, prête à l'affichage. */
interface ScaleEntry {
  key: string
  family: string
  name: string
  description: string
  sensitive: boolean
  banOnSight: boolean
  profileActions?: string[]
  defaultProfileAction?: string
  isCustom: boolean
}

/** Onglet « Sanctions » : plan d'actions de chaque infraction, Moddy ou personnalisé. */
export function AutomodScaleTab({
  draft,
  catalog,
  loading,
  error,
  onRetry,
  onUpdate,
  policies,
  readOnly,
}: AutomodScaleTabProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language

  if (error) {
    return (
      <Alert variant="destructive">
        <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} />
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

  const entries: ScaleEntry[] = [
    ...catalog.infractions.map((i) => ({
      key: i.id,
      family: i.family,
      name: pickLocalized(i.name, lang) || i.id,
      description: pickLocalized(i.description, lang),
      sensitive: i.sensitive,
      banOnSight: i.ban_on_sight,
      profileActions: i.profile_actions,
      defaultProfileAction: i.default_action_profil,
      isCustom: false,
    })),
    ...(draft.infractions_perso ?? []).map((i) => ({
      key: customSanctionKey(i.id),
      family: "custom",
      name: i.nom || i.id,
      description: i.description,
      sensitive: false,
      banOnSight: false,
      isCustom: true,
    })),
  ]

  // Familles dans l'ordre message → image → profile, puis les inconnues, puis `custom`.
  const present = new Set(entries.map((e) => e.family))
  const known = FAMILY_ORDER.filter((f) => f !== "custom" && present.has(f))
  const unknown = [...present].filter((f) => !(FAMILY_ORDER as readonly string[]).includes(f))
  const families = [...known, ...unknown, "custom"]

  return (
    <div className="flex flex-col gap-6">
      <Alert>
        <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
        <AlertTitle>{t("modules.automod_ai.scale.reminderTitle")}</AlertTitle>
        <AlertDescription>
          <ul className="flex list-disc flex-col gap-1 pl-4">
            <li>
              {t("modules.automod_ai.scale.reminderMaxAction", {
                action: t(`modules.automod_ai.maxAction_${draft.max_action}`),
              })}
            </li>
            <li>{t("modules.automod_ai.scale.reminderSeverity")}</li>
          </ul>
        </AlertDescription>
      </Alert>

      {families.map((family) => {
        const rows = entries.filter((e) => e.family === family)
        const title =
          pickLocalized(catalog.families.find((f) => f.id === family)?.name, lang) ||
          t(`modules.automod_ai.scale.family_${family}`, { defaultValue: family })
        return (
          <section key={family} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{title}</h3>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("modules.automod_ai.scale.noCustom")}
              </p>
            ) : (
              <ItemGroup className="gap-2">
                {rows.map((row) => (
                  <ScaleRow
                    key={row.key}
                    row={row}
                    entry={draft.sanctions?.[row.key]}
                    policy={policies?.[row.key]}
                    policiesUnavailable={policies === null}
                    catalog={catalog}
                    readOnly={readOnly}
                    onChange={(next) => onUpdate((cfg) => setSanction(cfg, row.key, next))}
                  />
                ))}
              </ItemGroup>
            )}
          </section>
        )
      })}
    </div>
  )
}

// ─── Ligne ────────────────────────────────────────────────────────────────────

interface ScaleRowProps {
  row: ScaleEntry
  entry: AutomodSanction | undefined
  policy: AutomodPolicy | undefined
  policiesUnavailable: boolean
  catalog: AutomodCatalog
  readOnly: boolean
  onChange: (next: AutomodSanction | null) => void
}

function ScaleRow({
  row,
  entry,
  policy,
  policiesUnavailable,
  catalog,
  readOnly,
  onChange,
}: ScaleRowProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const isPerso = entry?.mode === "perso"
  const [open, setOpen] = useState(isPerso)

  const enabled = entry?.enabled !== false
  const apply = (changes: Partial<AutomodSanction>) =>
    onChange(
      applySanctionChanges(entry, changes, {
        infractionId: row.key,
        defaultProfileAction: row.defaultProfileAction,
      })
    )

  const profileAction = effectiveProfileAction(entry, {
    profile_actions: row.profileActions,
    default_action_profil: row.defaultProfileAction,
  })
  // Pour une infraction de profil, le plan d'actions ne sert qu'avec l'action « barème ».
  const usesPlan = profileAction === undefined || profileAction === "bareme"

  // Ancien barème converti (`by_gravity`) sans `actions` : lecture seule tant
  // qu'on ne le remplace pas — écrire `actions` supprime `by_gravity`.
  const legacy = isPerso && entry?.actions === undefined && entry?.by_gravity !== undefined
  const actions = normalizeActions(entry?.actions)
  const rules = catalog.action_rules?.length ? catalog.action_rules : FALLBACK_ACTION_RULES

  // Ban immédiat : avertissement doux si le plan perso ne bannit pas.
  const plans: AutomodAction[][] = legacy
    ? GRAVITIES.map((g) => entry?.by_gravity?.[g]?.actions ?? [])
        .filter((a) => a.length > 0)
        .map((a) => effectiveActions(a, rules))
    : [effectiveActions(actions, rules)]
  const banLowered = isPerso && row.banOnSight && plans.some((p) => !p.includes("ban"))

  return (
    <Collapsible
      open={open || readOnly}
      onOpenChange={setOpen}
      className="rounded-2xl border"
    >
      <Item size="sm">
        <ItemContent>
          <ItemTitle className="flex-wrap">
            {row.name}
            {row.banOnSight && (
              <InfoBadge
                label={t("modules.automod_ai.scale.banOnSight")}
                help={t("modules.automod_ai.scale.banOnSightHelp")}
              />
            )}
            {row.sensitive && (
              <InfoBadge
                label={t("modules.automod_ai.scale.sensitive")}
                help={t("modules.automod_ai.scale.sensitiveHelp")}
              />
            )}
            {isPerso && usesPlan && (
              <Badge variant="secondary">{t("modules.automod_ai.scale.modePerso")}</Badge>
            )}
            {!enabled && (
              <Badge variant="outline">{t("modules.automod_ai.scale.disabledBadge")}</Badge>
            )}
          </ItemTitle>
          {row.description && <ItemDescription>{row.description}</ItemDescription>}
        </ItemContent>
        <ItemActions>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => apply({ enabled: v })}
            aria-label={t("modules.automod_ai.scale.enabledLabel", { name: row.name })}
          />
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("modules.automod_ai.scale.toggleDetails", { name: row.name })}
            >
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                strokeWidth={2}
                className={cn("transition-transform", (open || readOnly) && "rotate-180")}
              />
            </Button>
          </CollapsibleTrigger>
        </ItemActions>
      </Item>

      <CollapsibleContent className="border-t px-4 py-4">
        <FieldGroup className="gap-4">
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
                <SelectTrigger
                  className="w-full sm:w-72"
                  aria-label={t("modules.automod_ai.scale.profileAction")}
                >
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
                {pickLocalized(
                  catalog.profile_actions.find((a) => a.id === profileAction)?.description,
                  lang
                )}
              </FieldDescription>
            </Field>
          )}

          {!usesPlan ? (
            <p className="text-sm text-muted-foreground">
              {t("modules.automod_ai.scale.planUnused")}
            </p>
          ) : (
            <>
              <Field>
                <FieldLabel>{t("modules.automod_ai.scale.mode")}</FieldLabel>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={isPerso ? "perso" : "auto"}
                  onValueChange={(v) => {
                    if (!v) return
                    apply({ mode: v === "perso" ? "perso" : "auto" })
                    if (v === "perso") setOpen(true)
                  }}
                  className="w-full sm:w-fit"
                  aria-label={t("modules.automod_ai.scale.mode")}
                >
                  <ToggleGroupItem value="auto">{t("modules.automod_ai.scale.modeAuto")}</ToggleGroupItem>
                  <ToggleGroupItem value="perso">{t("modules.automod_ai.scale.modePerso")}</ToggleGroupItem>
                </ToggleGroup>
              </Field>

              {!isPerso ? (
                <PolicyView
                  policy={policy}
                  unavailable={policiesUnavailable}
                  catalog={catalog}
                />
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
              {banLowered && (
                <Alert>
                  <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} />
                  <AlertDescription>{t("modules.automod_ai.scale.banOnSightLowered")}</AlertDescription>
                </Alert>
              )}
            </>
          )}

          {entry && (
            <div>
              <Button type="button" variant="outline" size="sm" onClick={() => onChange(null)}>
                <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} data-icon="inline-start" />
                {t("modules.automod_ai.scale.reset")}
              </Button>
            </div>
          )}
        </FieldGroup>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ─── Politique de Moddy (mode auto) ───────────────────────────────────────────

function GravityPlans({
  plans,
  catalog,
}: {
  plans: Partial<Record<string, AutomodGravityPlan>>
  catalog: AutomodCatalog
}) {
  const { i18n } = useTranslation()
  const lang = i18n.language
  const shown = GRAVITIES.filter((g) => plans[g])
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
      {shown.map((g) => {
        const plan = plans[g]
        return (
          <div key={g} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">
              {pickLocalized(catalog.gravities.find((x) => x.id === g)?.name, lang) || g}
            </dt>
            <dd className="text-right">
              <ActionPlan
                catalog={catalog}
                actions={plan?.actions ?? ["delete"]}
                timeoutSeconds={plan?.timeout_seconds}
              />
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

/** Ce que Moddy applique réellement (`GET .../policies`), à la place de l'ancien « défaut ». */
function PolicyView({
  policy,
  unavailable,
  catalog,
}: {
  policy: AutomodPolicy | undefined
  unavailable: boolean
  catalog: AutomodCatalog
}) {
  const { t } = useTranslation()
  if (!policy) {
    return (
      <p className="text-sm text-muted-foreground">
        {t(unavailable ? "modules.automod_ai.scale.policyUnavailable" : "modules.automod_ai.scale.policyMissing")}
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">
        {t("modules.automod_ai.scale.policyTitle")}
      </p>
      <GravityPlans plans={policy.by_gravity} catalog={catalog} />
      <div className="flex flex-wrap gap-1">
        {policy.recidive && <Badge variant="outline">{t("modules.automod_ai.scale.policyRecidive")}</Badge>}
        {policy.require_approval && (
          <Badge variant="outline">{t("modules.automod_ai.scale.policyApproval")}</Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t("modules.automod_ai.scale.autoNote")}</p>
    </div>
  )
}

/** Plan par gravité hérité d'une ancienne config : lecture seule. */
function LegacyPlan({
  plans,
  catalog,
  onReplace,
}: {
  plans: Partial<Record<string, AutomodGravityPlan>>
  catalog: AutomodCatalog
  onReplace: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-3">
      <GravityPlans plans={plans} catalog={catalog} />
      <Alert>
        <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
        <AlertTitle>{t("modules.automod_ai.scale.legacyTitle")}</AlertTitle>
        <AlertDescription>{t("modules.automod_ai.scale.legacyDescription")}</AlertDescription>
        <AlertAction>
          <Button type="button" size="sm" variant="outline" onClick={onReplace}>
            {t("modules.automod_ai.scale.legacyReplace")}
          </Button>
        </AlertAction>
      </Alert>
    </div>
  )
}

// ─── Plan personnalisé ────────────────────────────────────────────────────────

interface ActionsFieldProps {
  rowKey: string
  actions: AutomodAction[]
  rules: readonly { action: AutomodAction; supersedes: AutomodAction[] }[]
  catalog: AutomodCatalog
  onChange: (next: AutomodAction[]) => void
}

/** Multi-sélection d'actions ; celles remplacées par une autre restent cochables mais grisées. */
function ActionsField({ rowKey, actions, rules, catalog, onChange }: ActionsFieldProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const label = (id: string) => actionLabel(catalog, id, lang, t)
  const kept = effectiveActions(actions, rules)

  const supersededBy = (id: AutomodAction): AutomodAction | null =>
    rules.find((r) => actions.includes(r.action) && (r.supersedes ?? []).includes(id))?.action ?? null

  const toggle = (id: AutomodAction, checked: boolean) => {
    const next = checked ? [...actions, id] : actions.filter((a) => a !== id)
    // Canonique : ordre de l'enum, jamais vide (une liste vide vaut `delete`).
    onChange(AUTOMOD_ACTION_IDS.filter((a) => next.includes(a)))
  }

  return (
    <FieldSet>
      <FieldLegend variant="label">{t("modules.automod_ai.scale.actionsLabel")}</FieldLegend>
      <FieldDescription>{t("modules.automod_ai.scale.actionsHelp")}</FieldDescription>
      <FieldGroup className="gap-3">
        {AUTOMOD_ACTION_IDS.map((id) => {
          const selected = actions.includes(id)
          const by = selected && !kept.includes(id) ? supersededBy(id) : null
          const description = pickLocalized(catalog.actions?.find((a) => a.id === id)?.description, lang)
          const inputId = `action-${rowKey}-${id}`
          return (
            <Field key={id} orientation="horizontal" data-disabled={by ? true : undefined}>
              <Checkbox
                id={inputId}
                checked={selected}
                disabled={selected && actions.length === 1}
                onCheckedChange={(v) => toggle(id, v === true)}
              />
              <FieldContent>
                <FieldLabel htmlFor={inputId} className={cn(by && "text-muted-foreground line-through")}>
                  {label(id)}
                </FieldLabel>
                {by ? (
                  <FieldDescription>
                    {t("modules.automod_ai.scale.supersededBy", { action: label(by) })}
                  </FieldDescription>
                ) : (
                  description && <FieldDescription>{description}</FieldDescription>
                )}
              </FieldContent>
            </Field>
          )
        })}
      </FieldGroup>
    </FieldSet>
  )
}

interface TimeoutFieldProps {
  rowKey: string
  seconds: number
  catalog: AutomodCatalog
  onChange: (seconds: number) => void
}

/** Durée exacte du timeout en jours / heures / minutes, bornée par le catalogue. */
function TimeoutField({ rowKey, seconds, catalog, onChange }: TimeoutFieldProps) {
  const { t } = useTranslation()
  const { min, max } = timeoutBounds(catalog)
  // Saisie locale tant qu'elle est en cours : une valeur hors bornes n'est pas
  // écrite dans le brouillon, et le champ revient à la dernière valeur valide au blur.
  const [typing, setTyping] = useState<{ days: string; hours: string; minutes: string } | null>(null)
  const parts = splitDuration(seconds)
  const shown = typing ?? {
    days: String(parts.days),
    hours: String(parts.hours),
    minutes: String(parts.minutes),
  }
  const toInt = (v: string) => Math.max(0, Number.parseInt(v, 10) || 0)
  const total = joinDuration({
    days: toInt(shown.days),
    hours: toInt(shown.hours),
    minutes: toInt(shown.minutes),
  })
  const invalid = total < min || total > max

  const edit = (unit: "days" | "hours" | "minutes", value: string) => {
    const next = { ...shown, [unit]: value }
    setTyping(next)
    const secondsNext = joinDuration({
      days: toInt(next.days),
      hours: toInt(next.hours),
      minutes: toInt(next.minutes),
    })
    if (secondsNext >= min && secondsNext <= max) onChange(secondsNext)
  }

  const units = [
    { id: "days" as const, label: t("modules.automod_ai.scale.unitDays") },
    { id: "hours" as const, label: t("modules.automod_ai.scale.unitHours") },
    { id: "minutes" as const, label: t("modules.automod_ai.scale.unitMinutes") },
  ]

  return (
    <FieldSet data-invalid={invalid || undefined}>
      <FieldLegend variant="label">{t("modules.automod_ai.scale.timeoutLabel")}</FieldLegend>
      <div className="flex flex-wrap gap-3">
        {units.map((u) => (
          <Field key={u.id} className="w-24">
            <FieldLabel htmlFor={`timeout-${rowKey}-${u.id}`}>{u.label}</FieldLabel>
            <Input
              id={`timeout-${rowKey}-${u.id}`}
              type="number"
              inputMode="numeric"
              min={0}
              value={shown[u.id]}
              aria-invalid={invalid || undefined}
              onChange={(e) => edit(u.id, e.target.value)}
              onBlur={() => setTyping(null)}
            />
          </Field>
        ))}
      </div>
      {invalid ? (
        <FieldError>
          {t("modules.automod_ai.scale.timeoutRange", {
            min: formatTimeout(min, t),
            max: formatTimeout(max, t),
          })}
        </FieldError>
      ) : (
        <FieldDescription>
          {t("modules.automod_ai.scale.timeoutHelp", {
            min: formatTimeout(min, t),
            max: formatTimeout(max, t),
          })}
        </FieldDescription>
      )}
    </FieldSet>
  )
}

interface ApprovalFieldProps {
  rowKey: string
  checked: boolean
  allowed: boolean
  isProfile: boolean
  onChange: (value: boolean) => void
}

/** « Validation par un modérateur » : indisponible pour les profils et les plans qui ne font que supprimer. */
function ApprovalField({ rowKey, checked, allowed, isProfile, onChange }: ApprovalFieldProps) {
  const { t } = useTranslation()
  const id = `approval-${rowKey}`
  return (
    <Field orientation="horizontal" data-disabled={allowed ? undefined : true}>
      <Checkbox
        id={id}
        checked={allowed && checked}
        disabled={!allowed}
        onCheckedChange={(v) => onChange(v === true)}
      />
      <FieldContent>
        <FieldLabel htmlFor={id}>{t("modules.automod_ai.scale.requireApproval")}</FieldLabel>
        <FieldDescription>
          {t(
            allowed
              ? "modules.automod_ai.scale.requireApprovalHelp"
              : isProfile
                ? "modules.automod_ai.scale.requireApprovalProfile"
                : "modules.automod_ai.scale.requireApprovalDeleteOnly"
          )}
        </FieldDescription>
      </FieldContent>
    </Field>
  )
}

// ─── Briques ──────────────────────────────────────────────────────────────────

function InfoBadge({ label, help }: { label: string; help: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" tabIndex={0}>
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{help}</TooltipContent>
    </Tooltip>
  )
}
