import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  AlertCircleIcon,
  ChevronDownIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { ChannelMultiPicker, RoleMultiPicker } from "@/components/pickers"
import { ServerLanguageNote } from "@/components/server-language-note"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useGuildContext } from "@/contexts/GuildContext"
import { readModuleState } from "@/lib/automod"
import { cn } from "@/lib/utils"
import {
  PROFILE_FEATURE,
  SCAN_ALL_FEATURE,
  orderedFeatureIds,
  sharedExemptions,
} from "@/lib/automod"
import { EXEMPT_MAX } from "@/services/automod"
import { CHANNEL_TYPES } from "@/types/api"
import type { AutomodAiConfig, AutomodFeature, AutomodMaxAction, ModuleState } from "@/types/api"
import {
  NO_CHANNEL,
  type FieldErrors,
} from "@/components/automod/automod-form"

const MODULE_STATES: ModuleState[] = ["active", "paused", "simulation"]

const MAX_ACTIONS: AutomodMaxAction[] = ["warn", "mute", "ban"]

interface AutomodSettingsTabProps {
  draft: AutomodAiConfig
  readOnly: boolean
  fieldErrors: FieldErrors
  onPatch: (changes: Partial<AutomodAiConfig>) => void
  onPatchFeature: (featureId: string, changes: Partial<AutomodFeature>) => void
  onPatchExemptions: (changes: { roles?: string[]; channels?: string[] }) => void
  /** Efface l'erreur d'un champ dès qu'il est modifié. */
  onClearFieldError: (field: keyof FieldErrors) => void
}

/** Onglet « Réglages » : général, sévérité, détecteurs, exemptions. */
export function AutomodSettingsTab({
  draft,
  readOnly,
  fieldErrors,
  onPatch,
  onPatchFeature,
  onPatchExemptions,
  onClearFieldError,
}: AutomodSettingsTabProps) {
  const { t } = useTranslation()
  const moduleState = readModuleState(draft.state)
  const { selectedGuildId, channels, roles } = useGuildContext()

  const textChannels = useMemo(
    () =>
      channels.filter(
        (c) => c.type === CHANNEL_TYPES.TEXT || c.type === CHANNEL_TYPES.ANNOUNCEMENT
      ),
    [channels]
  )
  // Exemptions : salons texte, annonces et forums (les fils suivent leur
  // parent) ; rôles hors `@everyone`.
  const exemptableChannels = useMemo(
    () =>
      channels.filter(
        (c) =>
          c.type === CHANNEL_TYPES.TEXT ||
          c.type === CHANNEL_TYPES.ANNOUNCEMENT ||
          c.type === CHANNEL_TYPES.FORUM
      ),
    [channels]
  )
  const exemptableRoles = useMemo(() => roles.filter((r) => r.name !== "@everyone"), [roles])

  const featureIds = orderedFeatureIds(draft.features)
  const exemptions = sharedExemptions(draft.features)

  return (
    <div className="flex flex-col gap-6">
      {/* Général */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("modules.automod_ai.generalTitle")}</CardTitle>
          <CardDescription>{t("modules.automod_ai.generalDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* État du module : actif / en pause / simulation */}
          <Field>
            <FieldLabel>{t("modules.automod_ai.state.title")}</FieldLabel>
            <ToggleGroup
              type="single"
              variant="outline"
              value={moduleState}
              onValueChange={(v) => {
                if (!v || v === moduleState) return
                onPatch({ state: v as ModuleState })
              }}
              className="w-full sm:w-fit"
              aria-label={t("modules.automod_ai.state.title")}
            >
              {MODULE_STATES.map((id) => (
                <ToggleGroupItem key={id} value={id}>
                  {t(`modules.automod_ai.state.${id}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <FieldDescription>{t(`modules.automod_ai.state.${moduleState}_desc`)}</FieldDescription>
          </Field>

          {/* Salon d'alertes */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">{t("modules.automod_ai.notifyChannel")}</label>
            <Select
              value={draft.notify_channel_id ?? NO_CHANNEL}
              onValueChange={(v) => {
                onPatch({ notify_channel_id: v === NO_CHANNEL ? null : v })
                onClearFieldError("notify_channel_id")
              }}
            >
              <SelectTrigger
                className={cn(fieldErrors.notify_channel_id && "border-destructive")}
                disabled={textChannels.length === 0}
              >
                <SelectValue placeholder={t("modules.selectChannel")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CHANNEL}>{t("modules.automod_ai.noNotifyChannel")}</SelectItem>
                {textChannels.length === 0 && (
                  <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                    <AlertCircleIcon className="size-4" />
                    {t("modules.noChannels")}
                  </div>
                )}
                {textChannels.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    # {c.name}
                  </SelectItem>
                ))}
                {/* Salon enregistré absent de la liste (supprimé, mauvais type) :
                    on l'affiche quand même pour ne pas retomber sur le placeholder. */}
                {draft.notify_channel_id &&
                  !textChannels.find((c) => c.id === draft.notify_channel_id) && (
                    <SelectItem value={draft.notify_channel_id} disabled>
                      # {draft.notify_channel_id}
                    </SelectItem>
                  )}
              </SelectContent>
            </Select>
            {fieldErrors.notify_channel_id ? (
              <p className="text-xs text-destructive">{fieldErrors.notify_channel_id}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("modules.automod_ai.notifyChannelDescription")}
              </p>
            )}
          </div>

          {/* Ignorer les modérateurs */}
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">{t("modules.automod_ai.ignoreModerators")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("modules.automod_ai.ignoreModeratorsDescription")}
              </p>
            </div>
            <Switch
              checked={draft.ignore_moderators}
              aria-label={t("modules.automod_ai.ignoreModerators")}
              onCheckedChange={(v) => onPatch({ ignore_moderators: v })}
            />
          </div>

          {/* La langue des DM et cartes de sanction suit celle du serveur — il
              n'y a plus de sélecteur par module. */}
          <ServerLanguageNote guildId={selectedGuildId} />
        </CardContent>
      </Card>

      {/* Sévérité & sanction maximale */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("modules.automod_ai.severityTitle")}</CardTitle>
          <CardDescription>{t("modules.automod_ai.severityDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {/* Sévérité */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{t("modules.automod_ai.severity")}</label>
              <Badge variant="secondary" className="tabular-nums">
                {t(`modules.automod_ai.severity_${draft.severity}`)}
              </Badge>
            </div>
            <div className="px-1 py-2">
              <Slider
                min={1}
                max={5}
                step={1}
                value={[draft.severity]}
                onValueChange={([v]) => onPatch({ severity: v })}
                disabled={readOnly}
                className="w-full"
              />
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>{t("modules.automod_ai.severityLow")}</span>
                <span>{t("modules.automod_ai.severityHigh")}</span>
              </div>
            </div>
            {fieldErrors.severity && (
              <p className="text-xs text-destructive">{fieldErrors.severity}</p>
            )}
          </div>

          {/* Sanction maximale */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">{t("modules.automod_ai.maxAction")}</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {MAX_ACTIONS.map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => onPatch({ max_action: action })}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border p-3 text-left transition-all",
                    draft.max_action === action
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-muted-foreground/50 hover:bg-muted/50"
                  )}
                >
                  <span className="text-sm font-medium">
                    {t(`modules.automod_ai.maxAction_${action}`)}
                  </span>
                  <span className="text-xs text-muted-foreground leading-tight">
                    {t(`modules.automod_ai.maxAction_${action}_desc`)}
                  </span>
                </button>
              ))}
            </div>
            {fieldErrors.max_action ? (
              <p className="text-xs text-destructive">{fieldErrors.max_action}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("modules.automod_ai.maxActionDescription")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Détecteurs — chacun s'active indépendamment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("modules.automod_ai.featuresTitle")}</CardTitle>
          <CardDescription>{t("modules.automod_ai.featuresDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldSet>
            <FieldGroup className="gap-3">
              {featureIds.map((id) => (
                <div key={id} className="flex flex-col gap-3">
                  <FeatureChoice
                    featureId={id}
                    feature={draft.features[id]}
                    onChange={(changes) => onPatchFeature(id, changes)}
                  />
                  {id === PROFILE_FEATURE && draft.features[id].enabled && (
                    <ProfileOptions
                      feature={draft.features[id]}
                      onChange={(changes) => onPatchFeature(id, changes)}
                    />
                  )}
                </div>
              ))}
            </FieldGroup>
            {fieldErrors.features && <FieldError>{fieldErrors.features}</FieldError>}
          </FieldSet>

          {/* `scan_all` : champ ops, placé sous « Captures d'arnaque » dans une
              section repliée, avec son coût. Renvoyé tel que lu sinon. */}
          {draft.features[SCAN_ALL_FEATURE] && (
            <ScanAllSetting
              checked={draft.features[SCAN_ALL_FEATURE].scan_all === true}
              onChange={(v) => onPatchFeature(SCAN_ALL_FEATURE, { scan_all: v })}
            />
          )}
        </CardContent>
      </Card>

      {/* Exemptions — une seule liste, recopiée sur les trois blocs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("modules.automod_ai.exemptionsTitle")}</CardTitle>
          <CardDescription>{t("modules.automod_ai.exemptionsDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {exemptions.diverged && (
            <Alert>
              <TriangleAlertIcon />
              <AlertTitle>{t("modules.automod_ai.exemptionsDivergedTitle")}</AlertTitle>
              <AlertDescription>{t("modules.automod_ai.exemptionsDivergedDescription")}</AlertDescription>
              {!readOnly && (
                <AlertAction>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      onPatchExemptions({ roles: exemptions.roles, channels: exemptions.channels })
                    }
                  >
                    {t("modules.automod_ai.exemptionsUnify")}
                  </Button>
                </AlertAction>
              )}
            </Alert>
          )}
          <FieldGroup>
            <Field data-invalid={fieldErrors.exemptions ? true : undefined}>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor="automod-exempt-roles">
                  {t("modules.automod_ai.exemptRoles")}
                </FieldLabel>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t("modules.automod_ai.exemptCount", {
                    count: exemptions.roles.length,
                    max: EXEMPT_MAX,
                  })}
                </span>
              </div>
              <RoleMultiPicker
                id="automod-exempt-roles"
                value={exemptions.roles}
                roles={exemptableRoles}
                includeManaged
                onChange={(roles) => onPatchExemptions({ roles })}
                max={EXEMPT_MAX}
                placeholder={t("modules.automod_ai.addRole")}
                aria-invalid={Boolean(fieldErrors.exemptions) || undefined}
                disabled={readOnly}
              />
              <FieldDescription>{t("modules.automod_ai.exemptRolesHint")}</FieldDescription>
            </Field>
            <Field data-invalid={fieldErrors.exemptions ? true : undefined}>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor="automod-exempt-channels">
                  {t("modules.automod_ai.exemptChannels")}
                </FieldLabel>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t("modules.automod_ai.exemptCount", {
                    count: exemptions.channels.length,
                    max: EXEMPT_MAX,
                  })}
                </span>
              </div>
              <ChannelMultiPicker
                id="automod-exempt-channels"
                value={exemptions.channels}
                channels={exemptableChannels}
                types={["text", "announcement", "forum"]}
                onChange={(channels) => onPatchExemptions({ channels })}
                max={EXEMPT_MAX}
                placeholder={t("modules.automod_ai.addChannel")}
                aria-invalid={Boolean(fieldErrors.exemptions) || undefined}
                disabled={readOnly}
              />
              <FieldDescription>{t("modules.automod_ai.exemptChannelsHint")}</FieldDescription>
              {fieldErrors.exemptions && <FieldError>{fieldErrors.exemptions}</FieldError>}
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Détecteur ────────────────────────────────────────────────────────────────

interface FeatureChoiceProps {
  featureId: string
  feature: AutomodFeature
  onChange: (changes: Partial<AutomodFeature>) => void
}

/**
 * Une case par détecteur (`features.<id>.enabled`), indépendante des autres.
 * Un id sans traduction retombe sur l'id lui-même plutôt que sur un vide.
 */
function FeatureChoice({ featureId, feature, onChange }: FeatureChoiceProps) {
  const { t } = useTranslation()
  const inputId = `automod-feature-${featureId}`

  return (
    <FieldLabel htmlFor={inputId}>
      <Field orientation="horizontal">
        <FieldContent>
          <FieldTitle>
            {t(`modules.automod_ai.features.${featureId}.name`, { defaultValue: featureId })}
          </FieldTitle>
          <FieldDescription>
            {t(`modules.automod_ai.features.${featureId}.description`, {
              defaultValue: t("modules.automod_ai.features.genericDescription"),
            })}
          </FieldDescription>
        </FieldContent>
        <Checkbox
          id={inputId}
          checked={feature.enabled}
          onCheckedChange={(v) => onChange({ enabled: v === true })}
        />
      </Field>
    </FieldLabel>
  )
}

// ─── Contrôles du détecteur de profils ────────────────────────────────────────

const PROFILE_PARTS = ["avatar", "banner", "pseudo"] as const

/**
 * Sous-options de `profile` : avatar / bannière / pseudo
 * (`features.profile.avatar|banner|pseudo`, vrai par défaut).
 */
function ProfileOptions({
  feature,
  onChange,
}: {
  feature: AutomodFeature
  onChange: (changes: Partial<AutomodFeature>) => void
}) {
  const { t } = useTranslation()

  return (
    <FieldSet className="ml-3 border-l pl-4">
      <FieldGroup className="gap-2">
        {PROFILE_PARTS.map((part) => {
          const inputId = `automod-profile-${part}`
          return (
            <Field key={part} orientation="horizontal">
              <Checkbox
                id={inputId}
                checked={feature[part] !== false}
                onCheckedChange={(v) => onChange({ [part]: v === true })}
              />
              <FieldLabel htmlFor={inputId} className="font-normal">
                {t(`modules.automod_ai.profileParts.${part}`)}
              </FieldLabel>
            </Field>
          )
        })}
      </FieldGroup>
      <FieldDescription>{t("modules.automod_ai.profileBannerNote")}</FieldDescription>
    </FieldSet>
  )
}

// ─── Lecture de toutes les images (image_scam.scan_all) ───────────────────────

function ScanAllSetting({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (value: boolean) => void
}) {
  const { t } = useTranslation()
  // Ouvert d'office si le réglage est déjà actif : un coût en cours ne se cache pas.
  const [open, setOpen] = useState(checked)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-4">
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="-ml-2">
          <ChevronDownIcon
            data-icon="inline-start"
            className={cn("transition-transform", open && "rotate-180")}
          />
          {t("modules.automod_ai.advanced")}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-3 pt-2">
        <p className="text-xs font-medium text-muted-foreground">
          {t("modules.automod_ai.features.image_scam.name")}
        </p>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="automod-scan-all">{t("modules.automod_ai.scanAll")}</FieldLabel>
            <FieldDescription>{t("modules.automod_ai.scanAllDescription")}</FieldDescription>
          </FieldContent>
          <Switch id="automod-scan-all" checked={checked} onCheckedChange={onChange} />
        </Field>
        <Alert>
          <TriangleAlertIcon />
          <AlertDescription>{t("modules.automod_ai.scanAllWarning")}</AlertDescription>
        </Alert>
      </CollapsibleContent>
    </Collapsible>
  )
}
