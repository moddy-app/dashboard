import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  ArrowDown01Icon,
  InformationCircleIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
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
  DEFAULT_CUSTOM_CRANS,
  FAMILY_ORDER,
  GRAVITIES,
  MAX_ACTION_CRAN,
  applySanctionChanges,
  customSanctionKey,
  effectiveProfileAction,
  pickLocalized,
  setSanction,
} from "@/lib/automod"
import type {
  AutomodAiConfig,
  AutomodCatalog,
  AutomodCrans,
  AutomodGravity,
  AutomodSanction,
} from "@/types/api"

interface AutomodScaleTabProps {
  draft: AutomodAiConfig
  catalog: AutomodCatalog | null
  loading: boolean
  error: string | null
  onRetry: () => void
  onUpdate: (updater: (config: AutomodAiConfig) => AutomodAiConfig) => void
  /** Rendu en lecture seule : les détails restent dépliés (un bouton désactivé ne s'ouvre pas). */
  readOnly: boolean
}

/** Une ligne du barème, prête à l'affichage. */
interface ScaleEntry {
  key: string
  family: string
  name: string
  description: string
  defaults: AutomodCrans
  sensitive: boolean
  banOnSight: boolean
  profileActions?: string[]
  defaultProfileAction?: string
  isCustom: boolean
}

/** Onglet « Barème » : sanction de chaque infraction, Moddy ou personnalisée. */
export function AutomodScaleTab({
  draft,
  catalog,
  loading,
  error,
  onRetry,
  onUpdate,
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
      defaults: i.default_crans ?? DEFAULT_CUSTOM_CRANS,
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
      defaults: catalog.custom_infraction.default_crans ?? DEFAULT_CUSTOM_CRANS,
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
                    catalog={catalog}
                    maxAction={draft.max_action}
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
  catalog: AutomodCatalog
  maxAction: AutomodAiConfig["max_action"]
  readOnly: boolean
  onChange: (next: AutomodSanction | null) => void
}

function ScaleRow({ row, entry, catalog, maxAction, readOnly, onChange }: ScaleRowProps) {
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
  // Pour une infraction de profil, les crans ne servent qu'avec l'action « barème ».
  const usesCrans = profileAction === undefined || profileAction === "bareme"

  const ladderName = (cran: number) =>
    pickLocalized((catalog.cran_ladder ?? []).find((s) => s.cran === cran)?.name, lang) || String(cran)

  const crans: AutomodCrans = { ...row.defaults, ...(entry?.crans ?? {}) }
  const maxCran = MAX_ACTION_CRAN[maxAction]
  const scamLowered = isPerso && row.banOnSight && GRAVITIES.some((g) => crans[g] < 7)

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
            {isPerso && usesCrans && (
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

          {!usesCrans ? (
            <p className="text-sm text-muted-foreground">
              {t("modules.automod_ai.scale.cransUnused")}
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

              {isPerso ? (
                <>
                  <FieldGroup className="gap-4">
                    {GRAVITIES.map((g) => (
                      <CranField
                        key={g}
                        gravity={g}
                        value={crans[g]}
                        catalog={catalog}
                        maxCran={maxCran}
                        ladderName={ladderName}
                        onChange={(cran) => apply({ crans: { ...crans, [g]: cran } })}
                      />
                    ))}
                  </FieldGroup>
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
                  {scamLowered && (
                    <Alert>
                      <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} />
                      <AlertDescription>{t("modules.automod_ai.scale.banOnSightLowered")}</AlertDescription>
                    </Alert>
                  )}
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                    {GRAVITIES.map((g) => (
                      <div key={g} className="flex items-baseline justify-between gap-3 text-sm">
                        <dt className="text-muted-foreground">
                          {pickLocalized(catalog.gravities.find((x) => x.id === g)?.name, lang) || g}
                        </dt>
                        <dd className="font-medium">{ladderName(row.defaults[g])}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="text-xs text-muted-foreground">
                    {t("modules.automod_ai.scale.autoNote")}
                  </p>
                </div>
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

interface CranFieldProps {
  gravity: AutomodGravity
  value: number
  catalog: AutomodCatalog
  maxCran: number
  ladderName: (cran: number) => string
  onChange: (cran: number) => void
}

function CranField({ gravity, value, catalog, maxCran, ladderName, onChange }: CranFieldProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const info = catalog.gravities.find((g) => g.id === gravity)
  const id = useId()
  const capped = value > maxCran
  return (
    <Field>
      <FieldLabel htmlFor={id}>{pickLocalized(info?.name, lang) || gravity}</FieldLabel>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger id={id} className="w-full sm:w-72">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {(catalog.cran_ladder ?? []).map((step) => (
              <SelectItem key={step.cran} value={String(step.cran)}>
                {ladderName(step.cran)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <FieldDescription>{pickLocalized(info?.description, lang)}</FieldDescription>
      {capped && (
        <FieldDescription className="text-foreground">
          {t("modules.automod_ai.scale.capped", { name: ladderName(maxCran) })}
        </FieldDescription>
      )}
    </Field>
  )
}
